import { logEvent } from './logger';

const DB_NAME = 'yan-story-teller';
const STORE_NAME = 'uploaded-slides';
const DB_VERSION = 4;

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
      if (!database.objectStoreNames.contains('uploaded-audio')) {
        database.createObjectStore('uploaded-audio', { keyPath: 'id' });
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

      transaction.oncomplete = () => {
        database.close();
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error || new Error('IndexedDB transaction failed.'));
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error || new Error('IndexedDB transaction aborted.'));
      };

      executor(store, resolve, reject);
    }),
  );
}

export async function loadSlides() {
  return runTransaction('readonly', (store, resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const records = Array.isArray(request.result) ? request.result : [];
      const slides = records
        .sort((left, right) => left.order - right.order)
        .map((record) => ({
          id: record.id,
          title: record.title,
          caption: record.caption,
          src: URL.createObjectURL(record.blob),
          kind: 'upload',
          mediaType: record.mediaType || 'image',
          durationSeconds: Number.isFinite(record.durationSeconds) ? record.durationSeconds : null,
          posterSrc: record.posterSrc || '',
          fileName: record.fileName,
          mimeType: record.mimeType,
          createdAt: record.createdAt,
          blob: record.blob,
          cueTime: Number.isFinite(record.cueTime) ? record.cueTime : null,
        }));
      resolve(slides);
    };
    request.onerror = () => reject(request.error || new Error('Failed to load slides.'));
  });
}

export async function saveSlides(slides) {
  return runTransaction('readwrite', (store, resolve, reject) => {
    const clearRequest = store.clear();
    clearRequest.onerror = () => reject(clearRequest.error || new Error('Failed to clear slides.'));
    clearRequest.onsuccess = () => {
      if (!slides.length) {
        resolve();
        return;
      }

      let completed = 0;
      let settled = false;

      for (const [order, slide] of slides.entries()) {
        const request = store.put({
          id: slide.id,
          title: slide.title,
          caption: slide.caption,
          fileName: slide.fileName,
          mimeType: slide.mimeType,
          createdAt: slide.createdAt,
          order,
          mediaType: slide.mediaType || 'image',
          durationSeconds: Number.isFinite(slide.durationSeconds) ? slide.durationSeconds : null,
          posterSrc: slide.posterSrc || '',
          cueTime: Number.isFinite(slide.cueTime) ? slide.cueTime : null,
          blob: slide.blob,
        });

        request.onerror = () => {
          if (settled) return;
          settled = true;
          reject(request.error || new Error('Failed to save slide.'));
        };

        request.onsuccess = () => {
          if (settled) return;
          completed += 1;
          if (completed === slides.length) {
            settled = true;
            resolve();
          }
        };
      }
    };
  });
}

export async function clearSlides() {
  return runTransaction('readwrite', (store, resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Failed to clear uploaded slides.'));
  });
}

export function revokeSlideUrls(slides) {
  for (const slide of slides) {
    if (slide.kind === 'upload' && typeof slide.src === 'string' && slide.src.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(slide.src);
      } catch (error) {
        logEvent('warn', 'photos.object_url_revoke_failed', {
          slideId: slide.id,
          message: error instanceof Error ? error.message : 'Unknown revoke failure',
        });
      }
    }
  }
}
