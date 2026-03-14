import { expect, test } from '@playwright/test';

async function readSceneMetrics(page) {
  return page.evaluate(() => {
    const shell = document.querySelector('.scene-shell');
    const overlay = document.querySelector('.media-overlay');
    const images = document.querySelectorAll('.scene-shell img');
    const detail = images[1];

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
    expect(metrics.overlay.top).toBeGreaterThanOrEqual(metrics.viewportHeight - 20);
  });
});
