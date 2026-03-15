import { logEvent } from './logger';

const DB_NAME = 'yan-story-teller';
const STORE_NAME = 'uploaded-audio';
const DB_VERSION = 4;
const AUDIO_LANE_KEY = 'presentation-audio-lane';

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('uploaded-slides')) {
        database.createObjectStore('uploaded-slides', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB.'));
  });
}

function runTransaction(mode, executor) {
  return openDatabase().then(
    (database) => new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);

      transaction.oncomplete = () => database.close();
      transaction.onerror = () => {
        database.close();
        reject(transaction.error || new Error('IndexedDB audio transaction failed.'));
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error || new Error('IndexedDB audio transaction aborted.'));
      };

      executor(store, resolve, reject);
    }),
  );
}

export async function loadAudioLane() {
  return runTransaction('readonly', (store, resolve, reject) => {
    const request = store.get(AUDIO_LANE_KEY);
    request.onsuccess = () => {
      const record = request.result;
      if (!record) {
        resolve({
          targetDurationSeconds: null,
          audioClips: [],
          audioTimeline: [],
        });
        return;
      }

      const audioClips = Array.isArray(record.audioClips)
        ? record.audioClips.map((clip) => ({
          ...clip,
          kind: 'upload',
          src: URL.createObjectURL(clip.blob),
          blob: clip.blob,
          durationSeconds: Number.isFinite(clip.durationSeconds) ? clip.durationSeconds : null,
          desiredStartTime: Number.isFinite(clip.desiredStartTime) ? clip.desiredStartTime : null,
        }))
        : [];

      resolve({
        targetDurationSeconds: Number.isFinite(record.targetDurationSeconds) ? record.targetDurationSeconds : null,
        audioClips,
        audioTimeline: Array.isArray(record.audioTimeline) ? record.audioTimeline : [],
      });
    };
    request.onerror = () => reject(request.error || new Error('Failed to load audio lane.'));
  });
}

export async function saveAudioLane({ targetDurationSeconds, audioClips, audioTimeline }) {
  return runTransaction('readwrite', (store, resolve, reject) => {
    const request = store.put({
      id: AUDIO_LANE_KEY,
      targetDurationSeconds: Number.isFinite(targetDurationSeconds) ? targetDurationSeconds : null,
      audioClips: audioClips.map((clip) => ({
        id: clip.id,
        title: clip.title,
        fileName: clip.fileName,
        mimeType: clip.mimeType,
        createdAt: clip.createdAt,
        storageMode: clip.storageMode || 'local',
        durationSeconds: Number.isFinite(clip.durationSeconds) ? clip.durationSeconds : null,
        desiredStartTime: Number.isFinite(clip.desiredStartTime) ? clip.desiredStartTime : null,
        blob: clip.blob,
      })),
      audioTimeline,
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Failed to save audio lane.'));
  });
}

export async function clearAudioLane() {
  return runTransaction('readwrite', (store, resolve, reject) => {
    const request = store.delete(AUDIO_LANE_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Failed to clear audio lane.'));
  });
}

export function revokeAudioClipUrls(audioClips) {
  for (const clip of audioClips) {
    if (!clip || clip.kind !== 'upload' || typeof clip.src !== 'string' || !clip.src.startsWith('blob:')) {
      continue;
    }

    try {
      URL.revokeObjectURL(clip.src);
    } catch (error) {
      logEvent('warn', 'audio_lane.object_url_revoke_failed', {
        clipId: clip.id,
        message: error instanceof Error ? error.message : 'Unknown revoke failure',
      });
    }
  }
}
