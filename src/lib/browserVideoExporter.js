import { logEvent } from './logger';

const IMAGE_LOAD_TIMEOUT_MS = 10_000;
const VIDEO_LOAD_TIMEOUT_MS = 15_000;
const AUDIO_LOAD_TIMEOUT_MS = 15_000;
const RECORDER_START_TIMEOUT_MS = 4_000;
const RECORDER_STOP_TIMEOUT_MS = 8_000;
const EXPORT_BASE_TIMEOUT_MS = 30_000;

function createExportError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function withTimeout(promise, timeoutMs, message, { onTimeout } = {}) {
  let timeoutId = null;

  return new Promise((resolve, reject) => {
    timeoutId = window.setTimeout(() => {
      onTimeout?.();
      reject(createExportError(message, 'EXPORT_TIMEOUT', { timeoutMs }));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function pickRecorderMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];

  return candidates.find((value) => MediaRecorder.isTypeSupported(value)) || '';
}

export function getVideoExportCapability() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      supported: false,
      reason: 'Browser export only works inside the live app.',
      mimeType: '',
    };
  }

  if (typeof HTMLCanvasElement === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
    return {
      supported: false,
      reason: 'This browser cannot capture the scene into a video stream.',
      mimeType: '',
    };
  }

  if (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') {
    return {
      supported: false,
      reason: 'This browser cannot build the audio mix needed for export.',
      mimeType: '',
    };
  }

  if (typeof MediaRecorder === 'undefined') {
    return {
      supported: false,
      reason: 'This browser does not support MediaRecorder video export.',
      mimeType: '',
    };
  }

  const mimeType = pickRecorderMimeType();
  if (!mimeType) {
    return {
      supported: false,
      reason: 'This browser cannot record a downloadable WebM file.',
      mimeType: '',
    };
  }

  return {
    supported: true,
    reason: '',
    mimeType,
  };
}

async function fetchMediaBlob(src, assetMeta, { allowDirectSourceFallback = false } = {}) {
  try {
    const response = await fetch(src);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.blob();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown fetch failure.';
    const level = allowDirectSourceFallback ? 'warn' : 'error';
    logEvent(level, 'export.asset_load_failed', {
      ...assetMeta,
      stage: 'fetch',
      message,
      directSourceFallback: allowDirectSourceFallback,
    });
    if (allowDirectSourceFallback) {
      return null;
    }
    throw createExportError(`Failed to fetch ${assetMeta.assetType} asset.`, 'EXPORT_ASSET_FETCH_FAILED', {
      ...assetMeta,
      message,
    });
  }
}

async function loadImageAsset(src, assetMeta) {
  const blob = await fetchMediaBlob(src, assetMeta, { allowDirectSourceFallback: true });
  const objectUrl = blob ? URL.createObjectURL(blob) : '';
  const image = new Image();
  image.decoding = 'async';
  image.crossOrigin = 'anonymous';

  try {
    await withTimeout(new Promise((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`Image decode failed for ${src}`));
      image.src = objectUrl || src;

      if (typeof image.decode === 'function') {
        image.decode().then(resolve).catch(() => {});
      }
    }), IMAGE_LOAD_TIMEOUT_MS, `Image asset timed out while loading: ${src}`, {
      onTimeout: () => {
        logEvent('error', 'export.asset_load_failed', {
          ...assetMeta,
          stage: 'decode',
          message: 'Image decode timed out.',
        });
      },
    });
  } catch (error) {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
    if (error?.code !== 'EXPORT_TIMEOUT') {
      const message = error instanceof Error ? error.message : 'Image decode failed.';
      logEvent('error', 'export.asset_load_failed', {
        ...assetMeta,
        stage: 'decode',
        message,
      });
    }
    throw error;
  }

  return {
    kind: 'image',
    src,
    objectUrl,
    element: image,
    cleanup: () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    },
  };
}

async function loadVideoAsset(src, assetMeta) {
  const blob = await fetchMediaBlob(src, assetMeta, { allowDirectSourceFallback: true });
  const objectUrl = blob ? URL.createObjectURL(blob) : '';
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';

  try {
    await withTimeout(new Promise((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error(`Video decode failed for ${src}`));
      video.src = objectUrl || src;
      video.load();
    }), VIDEO_LOAD_TIMEOUT_MS, `Video asset timed out while loading: ${src}`, {
      onTimeout: () => {
        logEvent('error', 'export.asset_load_failed', {
          ...assetMeta,
          stage: 'decode',
          message: 'Video load timed out.',
        });
      },
    });
  } catch (error) {
    video.pause();
    video.removeAttribute('src');
    video.load();
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
    if (error?.code !== 'EXPORT_TIMEOUT') {
      const message = error instanceof Error ? error.message : 'Video decode failed.';
      logEvent('error', 'export.asset_load_failed', {
        ...assetMeta,
        stage: 'decode',
        message,
      });
    }
    throw error;
  }

  return {
    kind: 'video',
    src,
    objectUrl,
    element: video,
    cleanup: () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    },
  };
}

async function loadAudioBuffer(audioContext, src, assetMeta) {
  try {
    const blob = await fetchMediaBlob(src, assetMeta);
    const arrayBuffer = await blob.arrayBuffer();
    return await withTimeout(
      audioContext.decodeAudioData(arrayBuffer.slice(0)),
      AUDIO_LOAD_TIMEOUT_MS,
      `Audio asset timed out while decoding: ${src}`,
      {
        onTimeout: () => {
          logEvent('error', 'export.asset_load_failed', {
            ...assetMeta,
            stage: 'decode',
            message: 'Audio decode timed out.',
          });
        },
      },
    );
  } catch (error) {
    if (error?.code !== 'EXPORT_TIMEOUT' && error?.code !== 'EXPORT_ASSET_FETCH_FAILED') {
      const message = error instanceof Error ? error.message : 'Audio decode failed.';
      logEvent('error', 'export.asset_load_failed', {
        ...assetMeta,
        stage: 'decode',
        message,
      });
    }
    throw error;
  }
}

function drawContained(ctx, source, width, height) {
  const sourceWidth = source.videoWidth || source.naturalWidth || source.width || 1;
  const sourceHeight = source.videoHeight || source.naturalHeight || source.height || 1;
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const drawX = (width - drawWidth) / 2;
  const drawY = (height - drawHeight) / 2;
  ctx.drawImage(source, drawX, drawY, drawWidth, drawHeight);
}

function getVisualForTime(visuals, currentTime) {
  return visuals.find((item) => currentTime >= item.startTime && currentTime < item.endTime)
    || visuals[visuals.length - 1]
    || null;
}

function emitPhase(onPhaseChange, phase, details = {}) {
  logEvent('info', 'export.phase_changed', {
    phase,
    ...details,
  });
  onPhaseChange?.(phase);
}

export async function exportPlaybackVideo(manifest, { onProgress, onPhaseChange } = {}) {
  const capability = getVideoExportCapability();
  logEvent('info', 'export.capability_checked', {
    supported: capability.supported,
    reason: capability.reason,
    mimeType: capability.mimeType,
  });

  if (!capability.supported) {
    throw createExportError(capability.reason, 'EXPORT_UNSUPPORTED');
  }

  if (!manifest || !(manifest.durationSeconds > 0)) {
    throw createExportError('Nothing to export yet.', 'EXPORT_INVALID_MANIFEST');
  }

  if (!Array.isArray(manifest.visuals) || manifest.visuals.length === 0) {
    throw createExportError('Add at least one photo or video before exporting.', 'EXPORT_NO_VISUALS');
  }

  logEvent('info', 'export.video_requested', {
    durationSeconds: manifest.durationSeconds,
    visualCount: manifest.visuals.length,
    audioClipCount: manifest.audioClips.length,
    fallbackAudio: Boolean(manifest.fallbackAudioSrc),
    mimeType: capability.mimeType,
  });

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  const canvas = document.createElement('canvas');
  canvas.width = manifest.width;
  canvas.height = manifest.height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw createExportError('Failed to create export canvas.', 'EXPORT_CANVAS_FAILED');
  }

  const tempCleanupFns = [];
  const audioSources = [];
  const streamTracks = [];
  let audioContext = null;
  let recorder = null;
  let rafId = null;
  let outputDownloadUrl = '';

  const cleanup = async () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    for (const source of audioSources) {
      try {
        source.stop();
      } catch {
        // No-op. Already stopped.
      }
      try {
        source.disconnect();
      } catch {
        // No-op. Already disconnected.
      }
    }

    for (const track of streamTracks) {
      try {
        track.stop();
      } catch {
        // No-op. Already stopped.
      }
    }

    for (const fn of tempCleanupFns.splice(0)) {
      try {
        fn();
      } catch {
        // No-op. Cleanup should never take the app hostage.
      }
    }

    if (audioContext) {
      try {
        await audioContext.close();
      } catch {
        // No-op.
      }
    }
  };

  try {
    emitPhase(onPhaseChange, 'preparing', {
      durationSeconds: manifest.durationSeconds,
    });

    audioContext = new AudioContextCtor();
    const audioDestination = audioContext.createMediaStreamDestination();
    const canvasStream = canvas.captureStream(manifest.frameRate || 30);
    const stream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioDestination.stream.getAudioTracks(),
    ]);
    streamTracks.push(...stream.getTracks());

    recorder = new MediaRecorder(stream, { mimeType: capability.mimeType });
    const chunks = [];
    let recorderStarted = false;
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onstart = () => {
      recorderStarted = true;
    };
    recorder.onerror = (event) => {
      const message = recorder.error?.message || event?.error?.message || 'MediaRecorder failed.';
      logEvent('error', 'export.recorder_failed', {
        stage: recorderStarted ? 'recording' : 'starting',
        message,
      });
    };

    const recorderStopPromise = new Promise((resolve, reject) => {
      recorder.onstop = () => resolve();
      const originalOnError = recorder.onerror;
      recorder.onerror = (event) => {
        originalOnError?.(event);
        const message = recorder.error?.message || event?.error?.message || 'MediaRecorder failed.';
        reject(createExportError(message, 'EXPORT_RECORDER_FAILED'));
      };
    });

    emitPhase(onPhaseChange, 'loading-assets', {
      visualCount: manifest.visuals.length,
    });

    const visualAssetEntries = await Promise.all(manifest.visuals.map(async (item) => {
      const assetMeta = {
        assetType: item.mediaType === 'video' ? 'video' : 'image',
        assetId: item.id,
        src: item.src,
      };
      const asset = item.mediaType === 'video'
        ? await loadVideoAsset(item.src, assetMeta)
        : await loadImageAsset(item.src, assetMeta);
      tempCleanupFns.push(asset.cleanup);
      return [item.id, asset];
    }));
    const visualAssets = new Map(visualAssetEntries);

    emitPhase(onPhaseChange, 'composing-audio', {
      placedAudioClipCount: manifest.audioClips.length,
      fallbackAudio: Boolean(manifest.fallbackAudioSrc),
    });

    const audioSpecs = manifest.audioClips.length
      ? manifest.audioClips
      : (manifest.fallbackAudioSrc ? [{
        id: 'fallback-audio',
        src: manifest.fallbackAudioSrc,
        startTime: 0,
        endTime: manifest.durationSeconds,
        sourceOffset: 0,
      }] : []);

    const audioBuffers = new Map();
    for (const clip of audioSpecs) {
      const buffer = await loadAudioBuffer(audioContext, clip.src, {
        assetType: 'audio',
        assetId: clip.id,
        src: clip.src,
      });
      audioBuffers.set(clip.id, buffer);
    }

    logEvent('info', 'export.manifest_built', {
      durationSeconds: manifest.durationSeconds,
      visualCount: manifest.visuals.length,
      audioClipCount: audioSpecs.length,
    });

    await audioContext.resume();
    const prerollMs = 180;
    const audioStartTime = audioContext.currentTime + (prerollMs / 1000);

    for (const clip of audioSpecs) {
      const buffer = audioBuffers.get(clip.id);
      if (!buffer) continue;
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioDestination);
      const clipDuration = Math.max(0, clip.endTime - clip.startTime);
      source.start(audioStartTime + clip.startTime, clip.sourceOffset || 0, clipDuration);
      audioSources.push(source);
    }

    logEvent('info', 'export.audio_composed', {
      clipCount: audioSpecs.length,
      fallbackAudio: audioSpecs.some((clip) => clip.id === 'fallback-audio'),
    });

    emitPhase(onPhaseChange, 'rendering', {
      durationSeconds: manifest.durationSeconds,
    });

    recorder.start(250);
    await withTimeout(
      new Promise((resolve, reject) => {
        const waitForRecording = () => {
          if (recorder.state === 'recording') {
            recorderStarted = true;
            resolve();
            return;
          }

          if (recorder.state === 'inactive') {
            reject(createExportError('Video recorder failed to start.', 'EXPORT_RECORDER_FAILED'));
            return;
          }

          requestAnimationFrame(waitForRecording);
        };

        waitForRecording();
      }),
      RECORDER_START_TIMEOUT_MS,
      'Video recorder failed to start.',
      {
        onTimeout: () => {
          logEvent('error', 'export.recorder_failed', {
            stage: 'starting',
            message: 'MediaRecorder start timed out.',
          });
        },
      },
    );

    const renderStart = performance.now() + prerollMs;
    let activeVideoId = '';
    const renderLoopPromise = new Promise((resolve, reject) => {
      const renderFrame = () => {
        try {
          const now = performance.now();
          const currentTime = Math.max(0, (now - renderStart) / 1000);
          const progress = manifest.durationSeconds > 0
            ? Math.min(1, currentTime / manifest.durationSeconds)
            : 0;
          onProgress?.(progress);

          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, manifest.width, manifest.height);

          const visual = getVisualForTime(manifest.visuals, currentTime);
          if (visual) {
            const asset = visualAssets.get(visual.id);
            if (asset?.kind === 'image') {
              drawContained(ctx, asset.element, manifest.width, manifest.height);
            } else if (asset?.kind === 'video') {
              const desiredOffset = (visual.sourceOffset || 0) + Math.max(0, currentTime - visual.startTime);
              if (activeVideoId !== visual.id) {
                activeVideoId = visual.id;
                asset.element.currentTime = Math.min(desiredOffset, Math.max(0, asset.element.duration || desiredOffset));
              } else if (Math.abs(asset.element.currentTime - desiredOffset) > 0.25) {
                asset.element.currentTime = Math.min(desiredOffset, Math.max(0, asset.element.duration || desiredOffset));
              }
              drawContained(ctx, asset.element, manifest.width, manifest.height);
            }
          }

          if (currentTime >= manifest.durationSeconds) {
            onProgress?.(1);
            resolve();
            if (recorder?.state !== 'inactive') {
              recorder.stop();
            }
            return;
          }

          rafId = requestAnimationFrame(renderFrame);
        } catch (error) {
          reject(error);
          if (recorder?.state !== 'inactive') {
            recorder.stop();
          }
        }
      };

      rafId = requestAnimationFrame(renderFrame);
    });

    const renderTimeoutMs = Math.max(
      EXPORT_BASE_TIMEOUT_MS,
      Math.ceil(manifest.durationSeconds * 1000 * 1.35),
    );

    await withTimeout(renderLoopPromise, renderTimeoutMs, 'Video export stalled while rendering.', {
      onTimeout: () => {
        logEvent('error', 'export.render_timeout', {
          durationSeconds: manifest.durationSeconds,
          timeoutMs: renderTimeoutMs,
        });
        if (recorder?.state !== 'inactive') {
          recorder.stop();
        }
      },
    });

    emitPhase(onPhaseChange, 'finalizing', {
      chunkCount: chunks.length,
    });

    await withTimeout(recorderStopPromise, RECORDER_STOP_TIMEOUT_MS, 'Video export failed to finalize.', {
      onTimeout: () => {
        logEvent('error', 'export.recorder_failed', {
          stage: 'finalizing',
          message: 'MediaRecorder stop timed out.',
        });
      },
    });

    const blob = new Blob(chunks, { type: recorder.mimeType || capability.mimeType });
    if (!(blob.size > 0)) {
      logEvent('error', 'export.recorder_failed', {
        stage: 'finalizing',
        message: 'Recorder produced an empty file.',
      });
      throw createExportError('Video export finished empty. Try again.', 'EXPORT_EMPTY_BLOB');
    }

    outputDownloadUrl = URL.createObjectURL(blob);
    const fileName = `yan-story-export-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
    logEvent('info', 'export.video_ready', {
      fileName,
      mimeType: blob.type || capability.mimeType,
      sizeBytes: blob.size,
      durationSeconds: manifest.durationSeconds,
    });

    return {
      blob,
      downloadUrl: outputDownloadUrl,
      mimeType: blob.type || capability.mimeType,
      fileName,
    };
  } catch (error) {
    logEvent('error', 'export.video_failed', {
      message: error instanceof Error ? error.message : 'Unknown export error.',
      code: error?.code || 'EXPORT_UNKNOWN',
    });
    throw error;
  } finally {
    await cleanup();
  }
}
