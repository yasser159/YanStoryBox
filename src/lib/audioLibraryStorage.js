import { logEvent } from './logger';

const DB_NAME = 'yan-story-teller';
const STORE_NAME = 'uploaded-audio';
const DB_VERSION = 2;
const AUDIO_KEY = 'presentation-audio';

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

export async function loadAudio() {
  return runTransaction('readonly', (store, resolve, reject) => {
    const request = store.get(AUDIO_KEY);
    request.onsuccess = () => {
      const record = request.result;
      if (!record) {
        resolve(null);
        return;
      }

      resolve({
        id: record.id,
        title: record.title,
        fileName: record.fileName,
        mimeType: record.mimeType,
        createdAt: record.createdAt,
        kind: 'upload',
        blob: record.blob,
        src: URL.createObjectURL(record.blob),
      });
    };
    request.onerror = () => reject(request.error || new Error('Failed to load uploaded audio.'));
  });
}

export async function saveAudio(audio) {
  return runTransaction('readwrite', (store, resolve, reject) => {
    const request = store.put({
      id: AUDIO_KEY,
      title: audio.title,
      fileName: audio.fileName,
      mimeType: audio.mimeType,
      createdAt: audio.createdAt,
      blob: audio.blob,
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Failed to save uploaded audio.'));
  });
}

export async function clearAudio() {
  return runTransaction('readwrite', (store, resolve, reject) => {
    const request = store.delete(AUDIO_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Failed to clear uploaded audio.'));
  });
}

export function revokeAudioUrl(audio) {
  if (!audio || audio.kind !== 'upload' || typeof audio.src !== 'string' || !audio.src.startsWith('blob:')) {
    return;
  }

  try {
    URL.revokeObjectURL(audio.src);
  } catch (error) {
    logEvent('warn', 'presentation_audio.object_url_revoke_failed', {
      message: error instanceof Error ? error.message : 'Unknown revoke failure',
    });
  }
}
