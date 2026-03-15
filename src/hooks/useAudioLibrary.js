import { useEffect, useMemo, useRef, useState } from 'react';
import { storyAudio } from '../data/storyMedia';
import { logEvent } from '../lib/logger';
import {
  autoPlaceAudioClipsSequentially,
  buildAudioClipRecord,
  buildAudioTimeline,
  clearAudioClipPlacement,
  DEFAULT_TARGET_DURATION_SECONDS,
  extractAudioFileMetadata,
  formatDurationLabel,
  parseDurationInput,
  placeAudioClipAtTime,
} from '../lib/audioComposition';
import {
  ensurePresentationDocument,
  loadPresentation,
  removeAudioAsset,
  saveAudioLane as saveRemoteAudioLane,
  uploadAudioClips,
} from '../lib/presentationRepository';
import {
  clearAudioLane as clearLocalAudioLane,
  loadAudioLane as loadLocalAudioLane,
  revokeAudioClipUrls,
  saveAudioLane as saveLocalAudioLane,
} from '../lib/audioLibraryStorage';

function normalizeClipRecord(clip) {
  return {
    ...clip,
    kind: 'upload',
    durationSeconds: Number.isFinite(clip.durationSeconds) ? clip.durationSeconds : null,
    desiredStartTime: Number.isFinite(clip.desiredStartTime) ? clip.desiredStartTime : null,
    storageMode: clip.storageMode || 'remote',
  };
}

export function useAudioLibrary() {
  const [audioClips, setAudioClips] = useState([]);
  const [isHydratingAudio, setIsHydratingAudio] = useState(true);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [targetDurationSeconds, setTargetDurationSeconds] = useState(DEFAULT_TARGET_DURATION_SECONDS);
  const [targetDurationInput, setTargetDurationInput] = useState(formatDurationLabel(DEFAULT_TARGET_DURATION_SECONDS));
  const [audioLibraryMode, setAudioLibraryMode] = useState('remote');
  const clipsRef = useRef([]);

  const audioTimelineState = useMemo(
    () => buildAudioTimeline(audioClips, targetDurationSeconds),
    [audioClips, targetDurationSeconds],
  );

  useEffect(() => {
    logEvent('info', 'audio_lane.composition_built', {
      targetDurationSeconds,
      clipCount: audioClips.length,
      placedClipCount: audioTimelineState.clips.length,
      clipMap: audioTimelineState.clips.map((clip) => ({
        id: clip.id,
        startTime: clip.startTime,
        endTime: clip.endTime,
        clamped: clip.clamped,
        shifted: clip.shifted,
      })),
    });
  }, [audioClips.length, audioTimelineState.clips, targetDurationSeconds]);

  const persistAudioLane = async (clips, nextTargetDurationSeconds, timeline = buildAudioTimeline(clips, nextTargetDurationSeconds).clips) => {
    const payload = {
      targetDurationSeconds: nextTargetDurationSeconds,
      audioClips: clips,
      audioTimeline: timeline,
    };

    if (audioLibraryMode === 'local') {
      await saveLocalAudioLane(payload);
      return;
    }

    await saveRemoteAudioLane(payload);
  };

  const hydrateLocalLane = async () => {
    const localLane = await loadLocalAudioLane();
    if (localLane.audioClips.length) {
      setAudioLibraryMode('local');
      logEvent('warn', 'audio_lane.persist_hydrate_local_fallback', {
        clipCount: localLane.audioClips.length,
      });
    }
    return localLane;
  };

  useEffect(() => {
    let cancelled = false;
    logEvent('info', 'audio_lane.persist_hydrate_started');

    ensurePresentationDocument()
      .then(() => loadPresentation())
      .then(async (presentation) => {
        if (cancelled) return;

        const legacyAudio = presentation.audio;
        const hasRemoteLane = Array.isArray(presentation.audioClips) && presentation.audioClips.length > 0;
        const localLane = hasRemoteLane ? null : await hydrateLocalLane();
        const hydratedClips = hasRemoteLane
          ? presentation.audioClips.map(normalizeClipRecord)
          : (localLane?.audioClips || []);

        const nextTargetDuration = Number.isFinite(presentation.targetDurationSeconds)
          ? presentation.targetDurationSeconds
          : (Number.isFinite(localLane?.targetDurationSeconds) ? localLane.targetDurationSeconds : DEFAULT_TARGET_DURATION_SECONDS);

        setAudioClips(hydratedClips);
        setTargetDurationSeconds(nextTargetDuration);
        setTargetDurationInput(formatDurationLabel(nextTargetDuration));
        setAudioError('');
        setAudioLibraryMode(hasRemoteLane ? 'remote' : (hydratedClips.length ? 'local' : 'remote'));

        logEvent('info', 'audio_lane.persist_hydrate_succeeded', {
          clipCount: hydratedClips.length,
          targetDurationSeconds: nextTargetDuration,
          storageMode: hasRemoteLane ? 'remote' : (hydratedClips.length ? 'local' : 'remote'),
          hasLegacyAudio: Boolean(legacyAudio),
        });
      })
      .catch(async (error) => {
        if (cancelled) return;
        try {
          const localLane = await hydrateLocalLane();
          setAudioClips(localLane.audioClips);
          const nextTargetDuration = Number.isFinite(localLane.targetDurationSeconds)
            ? localLane.targetDurationSeconds
            : DEFAULT_TARGET_DURATION_SECONDS;
          setTargetDurationSeconds(nextTargetDuration);
          setTargetDurationInput(formatDurationLabel(nextTargetDuration));
          setAudioError(localLane.audioClips.length ? 'Cloud audio storage is unavailable. Using browser-local clips.' : '');
          logEvent('warn', 'audio_lane.persist_hydrate_remote_failed_local_recovered', {
            message: error instanceof Error ? error.message : 'Unknown remote hydrate failure',
            recoveredCount: localLane.audioClips.length,
          });
        } catch (localError) {
          const message = error instanceof Error ? error.message : 'Failed to restore uploaded audio clips.';
          setAudioClips([]);
          setAudioError(message);
          logEvent('error', 'audio_lane.persist_hydrate_failed', {
            message,
            localMessage: localError instanceof Error ? localError.message : 'Unknown local hydrate failure',
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsHydratingAudio(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    clipsRef.current = audioClips;
  }, [audioClips]);

  useEffect(() => () => {
    revokeAudioClipUrls(clipsRef.current);
  }, []);

  const saveTargetDuration = async (value) => {
    const parsedDuration = parseDurationInput(value);
    if (!parsedDuration) {
      const message = 'Enter duration as seconds or mm:ss.';
      setAudioError(message);
      logEvent('warn', 'audio_lane.target_duration_failed', {
        input: value,
        reason: 'invalid_format',
      });
      return false;
    }

    const previousTargetDuration = targetDurationSeconds;
    setTargetDurationSeconds(parsedDuration);
    setTargetDurationInput(formatDurationLabel(parsedDuration));

    const nextTimeline = buildAudioTimeline(audioClips, parsedDuration).clips;

    try {
      await persistAudioLane(audioClips, parsedDuration, nextTimeline);
      setAudioError('');
      logEvent('info', 'audio_lane.target_duration_updated', {
        targetDurationSeconds: parsedDuration,
        clipCount: audioClips.length,
      });
      return true;
    } catch (error) {
      setTargetDurationSeconds(previousTargetDuration);
      setTargetDurationInput(formatDurationLabel(previousTargetDuration));
      const message = error instanceof Error ? error.message : 'Failed to save audio target duration.';
      setAudioError(message);
      logEvent('error', 'audio_lane.target_duration_failed', {
        input: value,
        message,
      });
      return false;
    }
  };

  const prepareAudioFiles = async (files) => {
    const preparedFiles = [];

    for (const file of files) {
      if (!file.type.startsWith('audio/')) {
        logEvent('warn', 'audio_lane.clip_upload_failed', {
          fileName: file.name,
          reason: 'Unsupported file type',
        });
        continue;
      }

      try {
        const metadata = await extractAudioFileMetadata(file);
        preparedFiles.push({ file, metadata });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to read uploaded audio metadata.';
        logEvent('error', 'audio_lane.clip_upload_failed', {
          fileName: file.name,
          message,
        });
        setAudioError(message);
      }
    }

    return preparedFiles;
  };

  const createLocalAudioClips = (preparedFiles) => preparedFiles.map(({ file, metadata }) => (
    buildAudioClipRecord({
      id: `local-audio-${crypto.randomUUID()}`,
      file,
      src: URL.createObjectURL(file),
      storageMode: 'local',
      durationSeconds: metadata.durationSeconds,
    })
  )).map((clip, index) => ({
    ...clip,
    blob: preparedFiles[index].file,
  }));

  const uploadAudioFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    setIsUploadingAudio(true);
    logEvent('info', 'audio_lane.clip_upload_started', {
      fileCount: files.length,
    });

    const preparedFiles = await prepareAudioFiles(files);
    if (!preparedFiles.length) {
      if (!audioError) {
        setAudioError('Only audio files are supported.');
      }
      setIsUploadingAudio(false);
      return;
    }

    const previousClips = audioClips;
    const canUseLocalFallback = previousClips.every((clip) => clip.blob instanceof Blob);

    try {
      if (audioLibraryMode === 'local') {
        const nextLocalClips = autoPlaceAudioClipsSequentially(
          previousClips,
          createLocalAudioClips(preparedFiles),
          targetDurationSeconds,
        );
        const nextClips = [...previousClips, ...nextLocalClips];
        const nextTimeline = buildAudioTimeline(nextClips, targetDurationSeconds).clips;
        setAudioClips(nextClips);
        await saveLocalAudioLane({
          targetDurationSeconds,
          audioClips: nextClips,
          audioTimeline: nextTimeline,
        });
        setAudioError('Cloud audio storage is unavailable. Saved in this browser only.');
        logEvent('warn', 'audio_lane.clip_upload_local_only', {
          clipCount: nextLocalClips.length,
          clipIds: nextLocalClips.map((clip) => clip.id),
        });
        return;
      }

      const remoteClips = await uploadAudioClips(preparedFiles);
      const placedClips = autoPlaceAudioClipsSequentially(previousClips, remoteClips, targetDurationSeconds);
      const nextClips = [...previousClips, ...placedClips];
      const nextTimeline = buildAudioTimeline(nextClips, targetDurationSeconds).clips;
      setAudioClips(nextClips);
      await persistAudioLane(nextClips, targetDurationSeconds, nextTimeline);
      setAudioError('');

      nextTimeline
        .filter((clip) => clip.clamped)
        .forEach((clip) => {
          logEvent('warn', 'audio_lane.clip_clamped', {
            clipId: clip.id,
            startTime: clip.startTime,
            endTime: clip.endTime,
            targetDurationSeconds,
          });
        });

      logEvent('info', 'audio_lane.clip_upload_succeeded', {
        clipCount: placedClips.length,
        clipIds: placedClips.map((clip) => clip.id),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to store uploaded audio clips.';
      if (!canUseLocalFallback) {
        setAudioError(message);
        logEvent('error', 'audio_lane.clip_upload_failed', {
          fileCount: preparedFiles.length,
          message,
          storageMode: 'remote',
        });
        return;
      }

      const localClips = autoPlaceAudioClipsSequentially(
        previousClips,
        createLocalAudioClips(preparedFiles),
        targetDurationSeconds,
      );
      const nextClips = [...previousClips, ...localClips];
      const nextTimeline = buildAudioTimeline(nextClips, targetDurationSeconds).clips;
      setAudioClips(nextClips);

      try {
        await saveLocalAudioLane({
          targetDurationSeconds,
          audioClips: nextClips,
          audioTimeline: nextTimeline,
        });
        setAudioLibraryMode('local');
        setAudioError('Cloud audio storage is unavailable. Saved in this browser only.');
        logEvent('warn', 'audio_lane.clip_upload_fell_back_to_local', {
          clipCount: localClips.length,
          remoteMessage: message,
        });
      } catch (localError) {
        setAudioClips(previousClips);
        const localMessage = localError instanceof Error ? localError.message : 'Failed to store uploaded audio clips locally.';
        setAudioError(localMessage);
        logEvent('error', 'audio_lane.clip_upload_failed', {
          fileCount: preparedFiles.length,
          message,
          localMessage,
          storageMode: 'remote_then_local',
        });
      }
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const setAudioClipStartTime = async (clipId, desiredStartTime) => {
    const previousClips = audioClips;
    const nextClips = placeAudioClipAtTime(audioClips, clipId, desiredStartTime, targetDurationSeconds);
    const nextTimeline = buildAudioTimeline(nextClips, targetDurationSeconds).clips;
    setAudioClips(nextClips);

    try {
      await persistAudioLane(nextClips, targetDurationSeconds, nextTimeline);
      setAudioError('');
      logEvent('info', 'audio_lane.clip_position_updated', {
        clipId,
        desiredStartTime,
      });
    } catch (error) {
      setAudioClips(previousClips);
      const message = error instanceof Error ? error.message : 'Failed to save audio clip timing.';
      setAudioError(message);
      logEvent('error', 'audio_lane.clip_position_failed', {
        clipId,
        desiredStartTime,
        message,
      });
    }
  };

  const clearAudioClipStartTime = async (clipId) => {
    const targetClip = audioClips.find((clip) => clip.id === clipId);
    if (!targetClip || !Number.isFinite(targetClip.desiredStartTime)) {
      return;
    }

    const previousClips = audioClips;
    const nextClips = clearAudioClipPlacement(audioClips, clipId);
    const nextTimeline = buildAudioTimeline(nextClips, targetDurationSeconds).clips;
    setAudioClips(nextClips);

    try {
      await persistAudioLane(nextClips, targetDurationSeconds, nextTimeline);
      setAudioError('');
      logEvent('info', 'audio_lane.clip_removed_from_timeline', {
        clipId,
      });
    } catch (error) {
      setAudioClips(previousClips);
      const message = error instanceof Error ? error.message : 'Failed to remove audio clip from timeline.';
      setAudioError(message);
      logEvent('error', 'audio_lane.clip_remove_from_timeline_failed', {
        clipId,
        message,
      });
    }
  };

  const removeAudioClip = async (clipId) => {
    const targetClip = audioClips.find((clip) => clip.id === clipId);
    if (!targetClip) {
      return;
    }

    const previousClips = audioClips;
    const nextClips = audioClips.filter((clip) => clip.id !== clipId);
    const nextTimeline = buildAudioTimeline(nextClips, targetDurationSeconds).clips;
    setAudioClips(nextClips);

    try {
      if (audioLibraryMode === 'local') {
        if (typeof targetClip.src === 'string' && targetClip.src.startsWith('blob:')) {
          revokeAudioClipUrls([targetClip]);
        }
        await saveLocalAudioLane({
          targetDurationSeconds,
          audioClips: nextClips,
          audioTimeline: nextTimeline,
        });
      } else {
        await Promise.all([
          saveRemoteAudioLane({
            targetDurationSeconds,
            audioClips: nextClips,
            audioTimeline: nextTimeline,
          }),
          removeAudioAsset(targetClip),
        ]);
      }

      setAudioError('');
      logEvent('info', 'audio_lane.clip_removed', {
        clipId,
        remainingCount: nextClips.length,
      });
    } catch (error) {
      setAudioClips(previousClips);
      const message = error instanceof Error ? error.message : 'Failed to delete audio clip.';
      setAudioError(message);
      logEvent('error', 'audio_lane.clip_remove_failed', {
        clipId,
        message,
      });
    }
  };

  const clearAudioLane = async () => {
    const previousClips = audioClips;
    setAudioClips([]);

    try {
      if (audioLibraryMode === 'local') {
        revokeAudioClipUrls(previousClips);
        await clearLocalAudioLane();
      } else {
        await Promise.all(previousClips.map((clip) => removeAudioAsset(clip)));
        await saveRemoteAudioLane({
          targetDurationSeconds,
          audioClips: [],
          audioTimeline: [],
        });
      }
      setAudioError('');
      logEvent('info', 'audio_lane.reset', {
        clearedCount: previousClips.length,
      });
    } catch (error) {
      setAudioClips(previousClips);
      const message = error instanceof Error ? error.message : 'Failed to clear audio lane.';
      setAudioError(message);
      logEvent('error', 'audio_lane.reset_failed', {
        message,
      });
    }
  };

  const effectiveAudioTimeline = audioTimelineState.clips;
  const hasUploadedAudio = audioClips.length > 0;

  return {
    audioSrc: !hasUploadedAudio ? storyAudio : '',
    audioMeta: hasUploadedAudio
      ? {
        id: 'audio-lane',
        title: 'Audio lane',
        fileName: `${audioClips.length} audio clip${audioClips.length === 1 ? '' : 's'}`,
        mimeType: 'audio/mixed',
        createdAt: '',
        kind: 'upload',
        src: '',
      }
      : {
        id: 'demo-audio',
        title: 'Demo Story Audio',
        fileName: 'demo-story.wav',
        mimeType: 'audio/wav',
        createdAt: '',
        kind: 'demo',
        src: storyAudio,
      },
    audioSourceMode: hasUploadedAudio ? 'upload' : 'demo',
    hasUploadedAudio,
    targetDurationSeconds,
    targetDurationInput,
    setTargetDurationInput,
    saveTargetDuration,
    audioClips,
    audioTimeline: effectiveAudioTimeline,
    uploadAudioFiles,
    setAudioClipStartTime,
    clearAudioClipStartTime,
    removeAudioClip,
    clearAudioLane,
    isHydratingAudio,
    isUploadingAudio,
    audioError,
  };
}
