export const DEFAULT_TARGET_DURATION_SECONDS = 120;

function stripExtension(fileName) {
  return fileName.replace(/\.[^.]+$/, '');
}

function clampTime(value, maxValue = Infinity) {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  return Number.isFinite(maxValue) ? Math.min(safeValue, maxValue) : safeValue;
}

export function parseDurationInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    const seconds = Number(raw);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  }

  if (/^\d{1,2}:\d{1,2}$/.test(raw)) {
    const [minutes, seconds] = raw.split(':').map(Number);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds >= 60) {
      return null;
    }
    const totalSeconds = (minutes * 60) + seconds;
    return totalSeconds > 0 ? totalSeconds : null;
  }

  return null;
}

export function formatDurationLabel(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function buildAudioClipRecord({
  id,
  file,
  src,
  storagePath,
  storageMode,
  durationSeconds,
  createdAt = new Date().toISOString(),
  desiredStartTime = null,
}) {
  return {
    id,
    title: stripExtension(file.name) || 'Uploaded audio clip',
    fileName: file.name,
    mimeType: file.type,
    createdAt,
    kind: 'upload',
    src,
    storagePath,
    storageMode,
    durationSeconds,
    desiredStartTime: Number.isFinite(desiredStartTime) ? desiredStartTime : null,
  };
}

export async function extractAudioFileMetadata(file) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const durationSeconds = await new Promise((resolve, reject) => {
      const audio = document.createElement('audio');
      const cleanup = () => {
        audio.removeAttribute('src');
        audio.load();
      };

      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        const duration = audio.duration;
        cleanup();
        if (!Number.isFinite(duration) || duration <= 0) {
          reject(new Error('Failed to read uploaded audio duration.'));
          return;
        }
        resolve(duration);
      };
      audio.onerror = () => {
        cleanup();
        reject(new Error('Failed to read uploaded audio metadata.'));
      };
      audio.src = objectUrl;
    });

    return {
      durationSeconds,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function buildAudioTimeline(clips, targetDurationSeconds) {
  const safeTargetDuration = Number.isFinite(targetDurationSeconds) && targetDurationSeconds > 0
    ? targetDurationSeconds
    : clips.reduce((sum, clip) => sum + (Number.isFinite(clip.durationSeconds) ? clip.durationSeconds : 0), 0);

  const placedClips = clips
    .filter((clip) => Number.isFinite(clip.desiredStartTime) && Number.isFinite(clip.durationSeconds))
    .map((clip, index) => ({
      ...clip,
      sourceIndex: index,
      requestedStartTime: clampTime(clip.desiredStartTime, safeTargetDuration),
    }))
    .sort((left, right) => {
      if (left.requestedStartTime !== right.requestedStartTime) {
        return left.requestedStartTime - right.requestedStartTime;
      }
      return left.sourceIndex - right.sourceIndex;
    });

  const timeline = [];
  let previousEndTime = 0;

  for (const clip of placedClips) {
    const startTime = Math.max(clip.requestedStartTime, previousEndTime);
    const endTime = clampTime(startTime + clip.durationSeconds, safeTargetDuration);
    if (endTime <= startTime) {
      continue;
    }

    const spanSeconds = endTime - startTime;
    timeline.push({
      ...clip,
      startTime,
      endTime,
      spanSeconds,
      clamped: endTime < startTime + clip.durationSeconds,
      shifted: startTime > clip.requestedStartTime,
    });
    previousEndTime = endTime;
  }

  return {
    duration: safeTargetDuration,
    clips: timeline,
  };
}

export function autoPlaceAudioClipsSequentially(existingClips, newClips, targetDurationSeconds) {
  const currentTimeline = buildAudioTimeline(existingClips, targetDurationSeconds);
  let cursor = currentTimeline.clips.at(-1)?.endTime || 0;

  return newClips.map((clip) => {
    const durationSeconds = Number.isFinite(clip.durationSeconds) ? clip.durationSeconds : 0;
    if (Number.isFinite(targetDurationSeconds) && targetDurationSeconds > 0 && cursor >= targetDurationSeconds) {
      return {
        ...clip,
        desiredStartTime: null,
      };
    }

    const desiredStartTime = clampTime(cursor, targetDurationSeconds);
    cursor = Number.isFinite(targetDurationSeconds) && targetDurationSeconds > 0
      ? Math.min(cursor + durationSeconds, targetDurationSeconds)
      : cursor + durationSeconds;

    return {
      ...clip,
      desiredStartTime,
    };
  });
}

export function placeAudioClipAtTime(clips, clipId, desiredStartTime, targetDurationSeconds) {
  return clips.map((clip) => (
    clip.id === clipId
      ? {
        ...clip,
        desiredStartTime: clampTime(desiredStartTime, targetDurationSeconds),
      }
      : clip
  ));
}

export function clearAudioClipPlacement(clips, clipId) {
  return clips.map((clip) => (
    clip.id === clipId
      ? { ...clip, desiredStartTime: null }
      : clip
  ));
}
