import { logEvent } from './logger';

export function buildTimeline(slides, duration) {
  if (!Array.isArray(slides) || slides.length === 0) {
    logEvent('warn', 'timeline.empty_slides', { duration });
    return [];
  }

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const segment = safeDuration > 0 ? safeDuration / slides.length : 0;

  const timeline = slides.map((slide, index) => ({
    ...slide,
    startTime: segment * index,
    endTime: segment * (index + 1),
  }));

  logEvent('info', 'timeline.built', {
    duration: safeDuration,
    slideCount: slides.length,
    segmentSeconds: segment,
  });

  return timeline;
}

export function getSlideIndexForTime(timeline, currentTime) {
  if (!timeline.length) return 0;
  const clampedTime = Math.max(0, currentTime);
  const match = timeline.findIndex(
    (slide) => clampedTime >= slide.startTime && clampedTime < slide.endTime,
  );

  if (match >= 0) return match;
  return timeline.length - 1;
}
