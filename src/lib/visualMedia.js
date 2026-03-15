export const MAX_VIDEO_DURATION_SECONDS = 15;

function stripExtension(fileName) {
  return fileName.replace(/\.[^.]+$/, '');
}

export function getMediaTypeFromMimeType(mimeType = '') {
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  return null;
}

export function validateVideoDurationSeconds(durationSeconds, maxDurationSeconds = MAX_VIDEO_DURATION_SECONDS) {
  return Number.isFinite(durationSeconds)
    && durationSeconds > 0
    && durationSeconds <= maxDurationSeconds;
}

export function buildMediaItem({
  id,
  file,
  src,
  storagePath,
  storageMode,
  mediaType,
  durationSeconds = null,
  posterSrc = '',
  createdAt = new Date().toISOString(),
}) {
  return {
    id,
    title: stripExtension(file.name) || `Uploaded ${mediaType}`,
    caption: mediaType === 'video' ? 'Uploaded video' : 'Uploaded photo',
    src,
    kind: 'upload',
    mediaType,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
    posterSrc: posterSrc || '',
    fileName: file.name,
    mimeType: file.type,
    createdAt,
    storagePath,
    storageMode,
    cueTime: null,
  };
}

export async function extractVisualFileMetadata(file) {
  const mediaType = getMediaTypeFromMimeType(file?.type || '');
  if (!mediaType) {
    const error = new Error('Unsupported visual file type.');
    error.code = 'UNSUPPORTED_VISUAL_TYPE';
    throw error;
  }

  if (mediaType === 'image') {
    return {
      mediaType,
      durationSeconds: null,
      posterSrc: '',
    };
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const metadata = await new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const cleanup = () => {
        video.removeAttribute('src');
        video.load();
      };

      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = async () => {
        try {
          const durationSeconds = video.duration;
          cleanup();
          resolve({
            mediaType,
            durationSeconds,
            posterSrc: '',
          });
        } catch (error) {
          cleanup();
          reject(error);
        }
      };

      video.onerror = () => {
        cleanup();
        reject(new Error('Failed to read uploaded video metadata.'));
      };

      video.src = objectUrl;
    });

    if (!validateVideoDurationSeconds(metadata.durationSeconds)) {
      const error = new Error(`Videos must be ${MAX_VIDEO_DURATION_SECONDS} seconds or shorter.`);
      error.code = 'VIDEO_TOO_LONG';
      error.durationSeconds = metadata.durationSeconds;
      throw error;
    }

    return metadata;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
