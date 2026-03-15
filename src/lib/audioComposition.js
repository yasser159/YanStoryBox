export const DEFAULT_TARGET_DURATION_SECONDS = 120;
const DEFAULT_WAVEFORM_SAMPLES = 72;

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
  waveformPeaks = [],
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
    waveformPeaks: Array.isArray(waveformPeaks) ? waveformPeaks : [],
    desiredStartTime: Number.isFinite(desiredStartTime) ? desiredStartTime : null,
  };
}

export function buildWaveformPeaks(channelData, sampleCount = DEFAULT_WAVEFORM_SAMPLES) {
  if (!channelData || channelData.length === 0 || !Number.isFinite(sampleCount) || sampleCount <= 0) {
    return [];
  }

  const safeSampleCount = Math.max(1, Math.floor(sampleCount));
  const blockSize = Math.max(1, Math.floor(channelData.length / safeSampleCount));
  const peaks = [];

  for (let index = 0; index < safeSampleCount; index += 1) {
    const start = index * blockSize;
    const end = Math.min(channelData.length, start + blockSize);
    let peak = 0;

    for (let cursor = start; cursor < end; cursor += 1) {
      peak = Math.max(peak, Math.abs(channelData[cursor] || 0));
    }

    peaks.push(Number(peak.toFixed(4)));
  }

  const maxPeak = Math.max(...peaks, 0);
  if (maxPeak <= 0) {
    return peaks.map(() => 0);
  }

  return peaks.map((peak) => Number((peak / maxPeak).toFixed(4)));
}

export function resolveAudioClipDropStartTime({
  dropTime,
  dragOffsetSeconds = 0,
  targetDurationSeconds,
  snapWindowSeconds = 2.5,
}) {
  const adjustedTime = clampTime(dropTime - dragOffsetSeconds, targetDurationSeconds);
  const safeSnapWindow = Number.isFinite(snapWindowSeconds) ? Math.max(0, snapWindowSeconds) : 0;
  return adjustedTime <= safeSnapWindow ? 0 : adjustedTime;
}

export async function extractAudioFileMetadata(file) {
  const objectUrl = URL.createObjectURL(file);
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;

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

    if (!AudioContextCtor) {
      throw new Error('Waveform extraction is not supported in this browser.');
    }

    const context = new AudioContextCtor();
    let waveformPeaks = [];
    try {
      const buffer = await file.arrayBuffer();
      const audioBuffer = await context.decodeAudioData(buffer.slice(0));
      const channelData = audioBuffer.getChannelData(0);
      waveformPeaks = buildWaveformPeaks(channelData);
    } finally {
      await context.close().catch(() => {});
    }

    if (!waveformPeaks.length) {
      throw new Error('Failed to extract waveform data from uploaded audio.');
    }

    return {
      durationSeconds,
      waveformPeaks,
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
