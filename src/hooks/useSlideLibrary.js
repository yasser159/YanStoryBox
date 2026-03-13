import { useEffect, useRef, useState } from 'react';
import { storySlides } from '../data/storyMedia';
import { logEvent } from '../lib/logger';
import {
  clearSlides,
  loadSlides,
  revokeSlideUrls,
  saveSlides,
} from '../lib/slideLibraryStorage';

function deriveTitle(fileName) {
  return fileName.replace(/\.[^.]+$/, '') || 'Uploaded photo';
}

function createUploadSlide(file) {
  return {
    id: `upload-${crypto.randomUUID()}`,
    title: deriveTitle(file.name),
    caption: 'Uploaded photo',
    src: URL.createObjectURL(file),
    kind: 'upload',
    fileName: file.name,
    mimeType: file.type,
    createdAt: new Date().toISOString(),
    blob: file,
  };
}

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
  const [persistenceError, setPersistenceError] = useState('');
  const uploadsRef = useRef([]);

  useEffect(() => {
    let cancelled = false;
    logEvent('info', 'photos.persist_hydrate_started');

    loadSlides()
      .then((slides) => {
        if (cancelled) {
          revokeSlideUrls(slides);
          return;
        }

        setUploadedSlides(slides);
        setPersistenceError('');
        logEvent('info', 'photos.persist_hydrate_succeeded', { count: slides.length });
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Failed to restore uploaded slides.';
        setUploadedSlides([]);
        setPersistenceError(message);
        logEvent('error', 'photos.persist_hydrate_failed', { message });
      })
      .finally(() => {
        if (!cancelled) {
          setIsHydrating(false);
        }
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

  const persistSlides = async (slides) => {
    await saveSlides(slides);
    setPersistenceError('');
  };

  const uploadFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    logEvent('info', 'photos.upload_started', { fileCount: files.length });

    const accepted = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        logEvent('warn', 'photos.upload_failed', {
          fileName: file.name,
          reason: 'Unsupported file type',
        });
        continue;
      }
      accepted.push(createUploadSlide(file));
    }

    if (!accepted.length) {
      setPersistenceError('Only image files are supported.');
      return;
    }

    const previousSlides = uploadedSlides;
    const nextSlides = [...uploadedSlides, ...accepted];

    try {
      setUploadedSlides(nextSlides);
      await persistSlides(nextSlides);
      logEvent('info', 'photos.upload_succeeded', {
        fileCount: accepted.length,
        slideIds: accepted.map((slide) => slide.id),
      });
    } catch (error) {
      revokeSlideUrls(accepted);
      setUploadedSlides(previousSlides);
      const message = error instanceof Error ? error.message : 'Failed to store uploaded photos.';
      setPersistenceError(message);
      logEvent('error', 'photos.upload_failed', {
        fileCount: accepted.length,
        message,
      });
    }
  };

  const reorderSlides = async (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;

    const nextSlides = reorderByIds(uploadedSlides, fromId, toId);
    if (nextSlides === uploadedSlides) return;

    const previousSlides = uploadedSlides;
    setUploadedSlides(nextSlides);

    try {
      await persistSlides(nextSlides);
      logEvent('info', 'photos.reordered', {
        fromId,
        toId,
        orderedIds: nextSlides.map((slide) => slide.id),
      });
    } catch (error) {
      setUploadedSlides(previousSlides);
      const message = error instanceof Error ? error.message : 'Failed to save new order.';
      setPersistenceError(message);
      logEvent('error', 'photos.reordered_failed', { fromId, toId, message });
    }
  };

  const removeSlide = async (id) => {
    const target = uploadedSlides.find((slide) => slide.id === id);
    if (!target) return;

    const previousSlides = uploadedSlides;
    const nextSlides = uploadedSlides.filter((slide) => slide.id !== id);
    setUploadedSlides(nextSlides);

    try {
      await persistSlides(nextSlides);
      revokeSlideUrls([target]);
      logEvent('info', 'photos.removed', { slideId: id, remainingCount: nextSlides.length });
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
      await clearSlides();
      revokeSlideUrls(previousSlides);
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
    removeSlide,
    resetUploads,
    isHydrating,
    persistenceError,
  };
}
