import { logEvent } from './logger';

function clampCueTime(cueTime, duration) {
  if (!Number.isFinite(cueTime)) return 0;
  if (!(duration > 0)) return Math.max(0, cueTime);
  return Math.min(Math.max(0, cueTime), duration);
}

export function buildTimeline(slides, duration) {
  if (!Array.isArray(slides) || slides.length === 0) {
    logEvent('warn', 'timeline.empty_slides', { duration });
    return [];
  }

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const segment = safeDuration > 0 ? safeDuration / slides.length : 0;
  const normalizedSlides = slides
    .map((slide, index) => ({
      ...slide,
      sourceIndex: index,
      cueTime: Number.isFinite(slide.cueTime)
        ? clampCueTime(slide.cueTime, safeDuration)
        : segment * index,
    }))
    .sort((left, right) => {
      if (left.cueTime !== right.cueTime) {
        return left.cueTime - right.cueTime;
      }
      return left.sourceIndex - right.sourceIndex;
    });

  const timeline = normalizedSlides.map((slide, index) => ({
    ...slide,
    startTime: slide.cueTime,
    endTime: index < normalizedSlides.length - 1
      ? normalizedSlides[index + 1].cueTime
      : safeDuration,
  }));

  logEvent('info', 'timeline.built', {
    duration: safeDuration,
    slideCount: slides.length,
    segmentSeconds: segment,
    manualCueCount: slides.filter((slide) => Number.isFinite(slide.cueTime)).length,
    cueMap: timeline.map((slide) => ({
      id: slide.id,
      cueTime: slide.cueTime,
    })),
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
