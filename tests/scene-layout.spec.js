import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const video12Fixture = {
  name: 'video-12s.mp4',
  mimeType: 'video/mp4',
  buffer: readFileSync(path.resolve(process.cwd(), 'tests/fixtures/video-12s.mp4')),
};

const screenTestFixture = {
  name: 'screen test.png',
  mimeType: 'image/png',
  buffer: readFileSync(path.resolve(process.cwd(), 'src/screen test.png')),
};

const demoAudioFixture = {
  name: 'demo-story.wav',
  mimeType: 'audio/wav',
  buffer: readFileSync(path.resolve(process.cwd(), 'public/audio/demo-story.wav')),
};

async function seedLocalVideoSlide(page, { buffer, durationSeconds = 12, cueTime = 0 }) {
  await page.addInitScript(({ bufferBytes, durationSeconds, cueTime }) => {
    window.__seedSlidesPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('yan-story-teller', 4);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('uploaded-slides')) {
          database.createObjectStore('uploaded-slides', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('uploaded-audio')) {
          database.createObjectStore('uploaded-audio', { keyPath: 'id' });
        }
      };

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(['uploaded-slides'], 'readwrite');
        const store = transaction.objectStore('uploaded-slides');
        const blob = new Blob([new Uint8Array(bufferBytes)], { type: 'video/mp4' });

        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => {
          database.close();
          reject(transaction.error);
        };

        store.clear().onsuccess = () => {
          store.put({
            id: 'seed-video-slide',
            title: 'video-12s',
            caption: 'Uploaded video',
            fileName: 'video-12s.mp4',
            mimeType: 'video/mp4',
            createdAt: '2026-03-15T00:00:00.000Z',
            order: 0,
            mediaType: 'video',
            durationSeconds,
            posterSrc: '',
            cueTime,
            blob,
          });
        };
      };
    });
  }, {
    bufferBytes: Array.from(buffer),
    durationSeconds,
    cueTime,
  });
}

async function seedScrollLibrary(page) {
  await page.addInitScript(({ imageBufferBytes, audioBufferBytes }) => {
    const imageBlob = new Blob([new Uint8Array(imageBufferBytes)], { type: 'image/png' });
    const audioBlob = new Blob([new Uint8Array(audioBufferBytes)], { type: 'audio/wav' });

    window.__seedCompositePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('yan-story-teller', 4);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('uploaded-slides')) {
          database.createObjectStore('uploaded-slides', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('uploaded-audio')) {
          database.createObjectStore('uploaded-audio', { keyPath: 'id' });
        }
      };

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(['uploaded-slides', 'uploaded-audio'], 'readwrite');
        const slideStore = transaction.objectStore('uploaded-slides');
        const audioStore = transaction.objectStore('uploaded-audio');

        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => {
          database.close();
          reject(transaction.error);
        };

        slideStore.clear().onsuccess = () => {
          for (let index = 0; index < 18; index += 1) {
            slideStore.put({
              id: `seed-image-${index}`,
              title: `seed-image-${index}`,
              caption: 'Uploaded photo',
              fileName: `seed-image-${index}.png`,
              mimeType: 'image/png',
              createdAt: '2026-03-15T00:00:00.000Z',
              order: index,
              mediaType: 'image',
              durationSeconds: null,
              posterSrc: '',
              cueTime: index === 0 ? 8 : null,
              blob: imageBlob,
            });
          }
        };

        audioStore.clear().onsuccess = () => {
          audioStore.put({
            id: 'presentation-audio-lane',
            targetDurationSeconds: 120,
            audioClips: [
              {
                id: 'seed-audio-1',
                title: 'seed-audio-1',
                fileName: 'seed-audio-1.wav',
                mimeType: 'audio/wav',
                createdAt: '2026-03-15T00:00:00.000Z',
                storageMode: 'local',
                durationSeconds: 24,
                desiredStartTime: 0,
                blob: audioBlob,
              },
            ],
            audioTimeline: [
              {
                id: 'seed-audio-1',
                title: 'seed-audio-1',
                fileName: 'seed-audio-1.wav',
                mimeType: 'audio/wav',
                createdAt: '2026-03-15T00:00:00.000Z',
                storageMode: 'local',
                durationSeconds: 24,
                desiredStartTime: 0,
                startTime: 0,
                endTime: 24,
                spanSeconds: 24,
              },
            ],
          });
        };
      };
    });
  }, {
    imageBufferBytes: Array.from(screenTestFixture.buffer),
    audioBufferBytes: Array.from(demoAudioFixture.buffer),
  });
}

async function pinControls(page) {
  const viewport = page.viewportSize() || { width: 1400, height: 900 };
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  await page.waitForTimeout(150);
}

async function readSceneMetrics(page) {
  return page.evaluate(() => {
    const shell = document.querySelector('.scene-shell');
    const overlay = document.querySelector('.media-overlay');
    const detail = document.querySelector('[data-testid="scene-active-image"], [data-testid="scene-active-video"]');

    if (!shell || !overlay || !detail) {
      return null;
    }

    const shellRect = shell.getBoundingClientRect();
    const detailRect = detail.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const overlayStyle = getComputedStyle(overlay);

    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      shell: {
        width: shellRect.width,
        height: shellRect.height,
        left: shellRect.left,
        right: shellRect.right,
      },
      detail: {
        width: detailRect.width,
        height: detailRect.height,
        left: detailRect.left,
        right: detailRect.right,
        top: detailRect.top,
        bottom: detailRect.bottom,
      },
      overlay: {
        top: overlayRect.top,
        bottom: overlayRect.bottom,
        visibility: overlayStyle.visibility,
        opacity: overlayStyle.opacity,
      },
    };
  });
}

test.describe('scene layout', () => {
  test('seeded short video renders as a pinned timeline block and plays inline', async ({ page }) => {
    await seedLocalVideoSlide(page, { buffer: video12Fixture.buffer, durationSeconds: 12, cueTime: 0 });
    await page.route(/googleapis\.com/, (route) => route.abort());
    await page.goto('/');
    await page.setViewportSize({ width: 1400, height: 900 });
    await pinControls(page);

    const uploadedThumb = page.locator('[data-testid^="visual-thumb-"]').first();
    await expect(uploadedThumb).toBeVisible();
    await expect(page.getByTestId('scene-active-video')).toBeVisible();

    const cueMarker = page.locator('[data-testid^="cue-marker-"]').first();
    await expect(cueMarker).toBeVisible();
    await expect(cueMarker.locator('video')).toBeVisible();

    const cueWidth = await cueMarker.evaluate((node) => node.getBoundingClientRect().width);
    expect(cueWidth).toBeGreaterThan(80);

    await page.getByLabel('Play').click();
    await page.waitForTimeout(1800);

    const currentTime = await page.getByTestId('scene-active-video').evaluate((node) => node.currentTime);
    expect(currentTime).toBeGreaterThan(0.5);
  });

  test('visible photo upload button opens a file chooser', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.mouse.move(700, 760);
    await expect(page.getByTestId('upload-photos-button')).toBeVisible();

    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByTestId('upload-photos-button').click(),
    ]);

    expect(chooser.isMultiple()).toBeTruthy();
  });

  test('scene and visible slide track the viewport across resize', async ({ page }) => {
    await page.goto('/');
    await pinControls(page);

    for (const viewport of [
      { width: 980, height: 820 },
      { width: 1800, height: 1000 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(300);

      const metrics = await readSceneMetrics(page);
      expect(metrics).not.toBeNull();

      expect(metrics.shell.width).toBeCloseTo(metrics.viewportWidth, 0);
      expect(metrics.shell.left).toBeCloseTo(0, 0);
      expect(metrics.shell.right).toBeCloseTo(metrics.viewportWidth, 0);

      expect(metrics.detail.width).toBeCloseTo(metrics.viewportWidth, 0);
      expect(metrics.detail.left).toBeCloseTo(0, 0);
      expect(metrics.detail.right).toBeCloseTo(metrics.viewportWidth, 0);
      expect(metrics.detail.top).toBeGreaterThanOrEqual(0);
      expect(metrics.detail.bottom).toBeLessThanOrEqual(metrics.viewportHeight + 1);
    }
  });

  test('hidden overlay stays offscreen when not hovered', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForTimeout(300);

    const metrics = await readSceneMetrics(page);
    expect(metrics).not.toBeNull();
    expect(metrics.overlay.visibility).toBe('hidden');
    expect(Number(metrics.overlay.opacity)).toBe(0);
    expect(metrics.overlay.bottom).toBeGreaterThan(metrics.overlay.top);
  });

  test('sticky timelines stay visible while the media library scrolls', async ({ page }) => {
    await seedScrollLibrary(page);
    await page.route(/googleapis\.com/, (route) => route.abort());
    await page.goto('/');
    await page.setViewportSize({ width: 1400, height: 900 });
    await pinControls(page);

    const timelineStack = page.getByTestId('timeline-stack');
    const libraryScroll = page.getByTestId('media-library-scroll');
    const audioMarker = page.getByTestId('audio-clip-marker-seed-audio-1');

    await expect(audioMarker).toBeVisible();

    const before = await timelineStack.boundingBox();
    await libraryScroll.evaluate((node) => {
      node.scrollTop = 1000;
    });
    await page.waitForTimeout(200);
    const after = await timelineStack.boundingBox();

    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(after.y).toBeCloseTo(before.y, 0);
    await expect(audioMarker).toBeVisible();
  });
});
