import { useEffect, useRef, useState } from 'react';
import { storySlides } from '../data/storyMedia';
import { logEvent } from '../lib/logger';
import {
  ensurePresentationDocument,
  loadPresentation,
  removeSlideAsset,
  saveSlides,
  uploadSlides,
} from '../lib/presentationRepository';
import {
  loadSlides as loadLocalSlides,
  revokeSlideUrls,
  saveSlides as saveLocalSlides,
} from '../lib/slideLibraryStorage';
import {
  buildMediaItem,
  extractVisualFileMetadata,
  getMediaTypeFromMimeType,
  MAX_VIDEO_DURATION_SECONDS,
} from '../lib/visualMedia';

function reorderByIds(items, fromId, toId) {
  const fromIndex = items.findIndex((item) => item.id === fromId);
  const toIndex = items.findIndex((item) => item.id === toId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return items;
  }

  const nextItems = [...items];
  const [moved] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, moved);
  return nextItems;
}

export function useSlideLibrary() {
  const [uploadedSlides, setUploadedSlides] = useState([]);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [persistenceError, setPersistenceError] = useState('');
  const [libraryMode, setLibraryMode] = useState('remote');
  const uploadsRef = useRef([]);

  const hydrateLocalSlides = async () => {
    const localSlides = await loadLocalSlides();
    if (localSlides.length) {
      setLibraryMode('local');
      logEvent('warn', 'photos.persist_hydrate_local_fallback', { count: localSlides.length });
    }
    return localSlides;
  };

  const createLocalSlides = (preparedFiles) => preparedFiles.map(({ file, metadata }) => (
    buildMediaItem({
      id: `local-upload-${crypto.randomUUID()}`,
      file,
      src: URL.createObjectURL(file),
      storageMode: 'local',
      mediaType: metadata.mediaType,
      durationSeconds: metadata.durationSeconds,
      posterSrc: metadata.posterSrc,
      createdAt: new Date().toISOString(),
    })
  )).map((slide, index) => ({
    ...slide,
    blob: preparedFiles[index].file,
  }));

  const prepareVisualFiles = async (files) => {
    const preparedFiles = [];

    for (const file of files) {
      const mediaType = getMediaTypeFromMimeType(file.type);
      if (!mediaType) {
        logEvent('warn', 'media.upload_failed', {
          fileName: file.name,
          reason: 'Unsupported file type',
        });
        continue;
      }

      try {
        const metadata = await extractVisualFileMetadata(file);
        if (metadata.mediaType === 'video') {
          logEvent('info', 'media.video_metadata_loaded', {
            fileName: file.name,
            durationSeconds: metadata.durationSeconds,
            hasPoster: Boolean(metadata.posterSrc),
          });
        }
        preparedFiles.push({ file, metadata });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to read visual metadata.';
        const code = error && typeof error === 'object' ? error.code : '';
        if (code === 'VIDEO_TOO_LONG') {
          logEvent('warn', 'media.video_rejected_too_long', {
            fileName: file.name,
            durationSeconds: error.durationSeconds,
            maxDurationSeconds: MAX_VIDEO_DURATION_SECONDS,
          });
          setPersistenceError(`Videos must be ${MAX_VIDEO_DURATION_SECONDS} seconds or shorter.`);
        } else {
          logEvent('error', 'media.upload_failed', {
            fileName: file.name,
            message,
          });
          setPersistenceError(message);
        }
      }
    }

    return preparedFiles;
  };

  const persistUploadedSlides = async (slides) => {
    if (libraryMode === 'local') {
      await saveLocalSlides(slides);
      return;
    }
    await saveSlides(slides);
  };

  useEffect(() => {
    let cancelled = false;
    logEvent('info', 'photos.persist_hydrate_started');

    ensurePresentationDocument()
      .then(() => loadPresentation())
      .then(async (presentation) => {
        if (cancelled) {
          return;
        }

        const restoredSlides = presentation.slides.length
          ? presentation.slides
          : await hydrateLocalSlides();

        const nextMode = presentation.slides.length ? 'remote' : (restoredSlides.length ? 'local' : 'remote');
        setLibraryMode(nextMode);
        setUploadedSlides(restoredSlides);
        setPersistenceError(nextMode === 'local' ? 'Cloud photo storage is unavailable. Using browser-local uploads.' : '');
        logEvent('info', 'photos.persist_hydrate_succeeded', {
          count: restoredSlides.length,
          storageMode: presentation.slides.length ? 'remote' : (restoredSlides.length ? 'local' : 'remote'),
        });
      })
      .catch(async (error) => {
        if (cancelled) return;
        try {
          const restoredSlides = await hydrateLocalSlides();
          setUploadedSlides(restoredSlides);
          setPersistenceError(restoredSlides.length ? 'Cloud photo storage is unavailable. Using browser-local uploads.' : '');
          logEvent('warn', 'photos.persist_hydrate_remote_failed_local_recovered', {
            message: error instanceof Error ? error.message : 'Unknown remote hydrate failure',
            recoveredCount: restoredSlides.length,
          });
        } catch (localError) {
          const message = error instanceof Error ? error.message : 'Failed to restore uploaded slides.';
          setUploadedSlides([]);
          setPersistenceError(message);
          logEvent('error', 'photos.persist_hydrate_failed', {
            message,
            localMessage: localError instanceof Error ? localError.message : 'Unknown local hydrate failure',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setIsHydrating(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    uploadsRef.current = uploadedSlides;
  }, [uploadedSlides]);

  useEffect(() => () => {
    revokeSlideUrls(uploadsRef.current);
  }, []);

  const uploadFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    setIsUploadingPhotos(true);
    logEvent('info', 'media.upload_started', { fileCount: files.length });

    const preparedFiles = await prepareVisualFiles(files);

    if (!preparedFiles.length) {
      if (!persistenceError) {
        setPersistenceError('Only image and short video files are supported.');
      }
      setIsUploadingPhotos(false);
      return;
    }

    const previousSlides = uploadedSlides;
    const canUseLocalFallback = previousSlides.every((slide) => slide.blob instanceof Blob);

    try {
      if (libraryMode === 'local') {
        const acceptedSlides = createLocalSlides(preparedFiles);
        const nextSlides = [...previousSlides, ...acceptedSlides];
        setUploadedSlides(nextSlides);

        try {
          await persistUploadedSlides(nextSlides);
          setPersistenceError('Cloud photo storage is unavailable. Saved in this browser only.');
          logEvent('warn', 'media.upload_local_only', {
            fileCount: acceptedSlides.length,
            mediaIds: acceptedSlides.map((slide) => slide.id),
            mediaTypes: acceptedSlides.map((slide) => slide.mediaType),
          });
        } catch (error) {
          setUploadedSlides(previousSlides);
          const message = error instanceof Error ? error.message : 'Failed to store uploaded media locally.';
          setPersistenceError(message);
          logEvent('error', 'media.upload_failed', {
            fileCount: preparedFiles.length,
            message,
            storageMode: 'local',
          });
        }
        return;
      }

      const acceptedSlides = await uploadSlides(preparedFiles);
      const nextSlides = [...uploadedSlides, ...acceptedSlides];
      setUploadedSlides(nextSlides);
      await persistUploadedSlides(nextSlides);
      setPersistenceError('');
      logEvent('info', 'media.upload_succeeded', {
        fileCount: acceptedSlides.length,
        mediaIds: acceptedSlides.map((slide) => slide.id),
        mediaTypes: acceptedSlides.map((slide) => slide.mediaType),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to store uploaded media.';
      if (!canUseLocalFallback) {
        setUploadedSlides(previousSlides);
        setPersistenceError(message);
        logEvent('error', 'media.upload_failed', {
          fileCount: preparedFiles.length,
          message,
          storageMode: 'remote',
        });
        return;
      }

      const acceptedSlides = createLocalSlides(preparedFiles);
      const nextSlides = [...previousSlides, ...acceptedSlides];
      setUploadedSlides(nextSlides);

      try {
        await saveLocalSlides(nextSlides);
        setLibraryMode('local');
        setPersistenceError('Cloud photo storage is unavailable. Saved in this browser only.');
        logEvent('warn', 'media.upload_fell_back_to_local', {
          fileCount: acceptedSlides.length,
          mediaIds: acceptedSlides.map((slide) => slide.id),
          mediaTypes: acceptedSlides.map((slide) => slide.mediaType),
          remoteMessage: message,
        });
      } catch (localError) {
        setUploadedSlides(previousSlides);
        const localMessage = localError instanceof Error ? localError.message : 'Failed to store uploaded media locally.';
        setPersistenceError(localMessage);
        logEvent('error', 'media.upload_failed', {
          fileCount: preparedFiles.length,
          message,
          localMessage,
          storageMode: 'remote_then_local',
        });
      }
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  const reorderSlides = async (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;

    const nextSlides = reorderByIds(uploadedSlides, fromId, toId);
    if (nextSlides === uploadedSlides) return;

    const previousSlides = uploadedSlides;
    setUploadedSlides(nextSlides);

    try {
      await persistUploadedSlides(nextSlides);
      setPersistenceError('');
      logEvent('info', 'photos.reordered', {
        fromId,
        toId,
        orderedIds: nextSlides.map((slide) => slide.id),
        storageMode: libraryMode,
      });
    } catch (error) {
      setUploadedSlides(previousSlides);
      const message = error instanceof Error ? error.message : 'Failed to save new order.';
      setPersistenceError(message);
      logEvent('error', 'photos.reordered_failed', { fromId, toId, message });
    }
  };

  const setSlideCueTime = async (id, cueTime, duration) => {
    const target = uploadedSlides.find((slide) => slide.id === id);
    if (!target) return;

    const clampedCueTime = Number.isFinite(duration) && duration > 0
      ? Math.min(Math.max(0, cueTime), duration)
      : Math.max(0, cueTime);

    const previousSlides = uploadedSlides;
    const nextSlides = uploadedSlides.map((slide) => (
      slide.id === id
        ? { ...slide, cueTime: clampedCueTime }
        : slide
    ));

    setUploadedSlides(nextSlides);

    try {
      await persistUploadedSlides(nextSlides);
      setPersistenceError('');
      logEvent('info', 'photos.cue_updated', {
        slideId: id,
        cueTime: clampedCueTime,
        duration,
        storageMode: libraryMode,
      });
    } catch (error) {
      setUploadedSlides(previousSlides);
      const message = error instanceof Error ? error.message : 'Failed to save slide cue.';
      setPersistenceError(message);
      logEvent('error', 'photos.cue_update_failed', {
        slideId: id,
        cueTime: clampedCueTime,
        message,
        storageMode: libraryMode,
      });
    }
  };

  const clearSlideCueTime = async (id) => {
    const target = uploadedSlides.find((slide) => slide.id === id);
    if (!target || !Number.isFinite(target.cueTime)) return;

    const previousSlides = uploadedSlides;
    const nextSlides = uploadedSlides.map((slide) => (
      slide.id === id
        ? { ...slide, cueTime: null }
        : slide
    ));

    setUploadedSlides(nextSlides);

    try {
      await persistUploadedSlides(nextSlides);
      setPersistenceError('');
      logEvent('info', 'photos.cue_cleared', {
        slideId: id,
        storageMode: libraryMode,
      });
    } catch (error) {
      setUploadedSlides(previousSlides);
      const message = error instanceof Error ? error.message : 'Failed to clear slide cue.';
      setPersistenceError(message);
      logEvent('error', 'photos.cue_clear_failed', {
        slideId: id,
        message,
        storageMode: libraryMode,
      });
    }
  };

  const removeSlide = async (id) => {
    const target = uploadedSlides.find((slide) => slide.id === id);
    if (!target) return;

    const previousSlides = uploadedSlides;
    const nextSlides = uploadedSlides.filter((slide) => slide.id !== id);
    setUploadedSlides(nextSlides);

    try {
      if (libraryMode === 'local') {
        if (typeof target.src === 'string' && target.src.startsWith('blob:')) {
          revokeSlideUrls([target]);
        }
        await persistUploadedSlides(nextSlides);
      } else {
        await Promise.all([
          saveSlides(nextSlides),
          removeSlideAsset(target),
        ]);
      }
      setPersistenceError('');
      logEvent('info', 'photos.removed', {
        slideId: id,
        remainingCount: nextSlides.length,
        storageMode: libraryMode,
      });
    } catch (error) {
      setUploadedSlides(previousSlides);
      const message = error instanceof Error ? error.message : 'Failed to remove photo.';
      setPersistenceError(message);
      logEvent('error', 'photos.remove_failed', { slideId: id, message });
    }
  };

  const resetUploads = async () => {
    const previousSlides = uploadedSlides;
    setUploadedSlides([]);

    try {
      if (libraryMode === 'local') {
        revokeSlideUrls(previousSlides);
        await persistUploadedSlides([]);
      } else {
        await Promise.all(previousSlides.map((slide) => removeSlideAsset(slide)));
        await saveSlides([]);
      }
      setPersistenceError('');
      logEvent('info', 'photos.reset_to_demo', { clearedCount: previousSlides.length });
    } catch (error) {
      setUploadedSlides(previousSlides);
      const message = error instanceof Error ? error.message : 'Failed to reset uploaded photos.';
      setPersistenceError(message);
      logEvent('error', 'photos.reset_failed', { message });
    }
  };

  return {
    slides: uploadedSlides.length ? uploadedSlides : storySlides,
    uploads: uploadedSlides,
    hasUploads: uploadedSlides.length > 0,
    sourceMode: uploadedSlides.length > 0 ? 'upload' : 'demo',
    uploadFiles,
    reorderSlides,
    setSlideCueTime,
    clearSlideCueTime,
    removeSlide,
    resetUploads,
    isHydrating,
    isUploadingPhotos,
    persistenceError,
  };
}
