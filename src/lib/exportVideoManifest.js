export function buildExportVideoManifest({
  timeline = [],
  audioTimeline = [],
  fallbackAudioSrc = '',
  durationSeconds = 0,
  width = 1280,
  height = 720,
  frameRate = 30,
}) {
  const visuals = timeline
    .filter((item) => typeof item.src === 'string' && item.src.length > 0)
    .map((item) => ({
      id: item.id,
      mediaType: item.mediaType || 'image',
      src: item.src,
      posterSrc: item.posterSrc || '',
      startTime: Number(item.startTime) || 0,
      endTime: Number(item.endTime) || 0,
      spanSeconds: Number(item.spanSeconds) || 0,
      sourceOffset: 0,
    }))
    .filter((item) => item.endTime > item.startTime);

  const audioClips = audioTimeline
    .filter((clip) => typeof clip.src === 'string' && clip.src.length > 0)
    .map((clip) => ({
      id: clip.id,
      src: clip.src,
      startTime: Number(clip.startTime) || 0,
      endTime: Number(clip.endTime) || 0,
      sourceOffset: 0,
    }))
    .filter((clip) => clip.endTime > clip.startTime);

  const safeDuration = Number.isFinite(durationSeconds) && durationSeconds > 0
    ? durationSeconds
    : Math.max(
      ...visuals.map((item) => Number(item.endTime) || 0),
      ...audioClips.map((item) => Number(item.endTime) || 0),
      0,
    );

  if (!visuals.length) {
    throw new Error('Add at least one photo or video before exporting.');
  }

  if (!(safeDuration > 0)) {
    throw new Error('Nothing to export yet.');
  }

  return {
    version: 1,
    durationSeconds: safeDuration,
    width,
    height,
    frameRate,
    visuals,
    audioClips,
    fallbackAudioSrc: audioClips.length === 0 && typeof fallbackAudioSrc === 'string'
      ? fallbackAudioSrc
      : '',
  };
}
