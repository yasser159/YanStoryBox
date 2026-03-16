import { logEvent } from './logger';

function clampCueTime(cueTime, duration) {
  if (!Number.isFinite(cueTime)) return 0;
  if (!(duration > 0)) return Math.max(0, cueTime);
  return Math.min(Math.max(0, cueTime), duration);
}

function clampVideoEndTime(startTime, durationSeconds, safeDuration) {
  const nominalEnd = startTime + (Number.isFinite(durationSeconds) ? durationSeconds : 0);
  return safeDuration > 0 ? Math.min(nominalEnd, safeDuration) : nominalEnd;
}

function buildTimelineItems(slides, duration, { emitLogs }) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const segment = safeDuration > 0 ? safeDuration / slides.length : 0;
  const normalizedSlides = slides
    .map((slide, index) => ({
      ...slide,
      sourceIndex: index,
      mediaType: slide.mediaType || 'image',
      durationSeconds: Number.isFinite(slide.durationSeconds) ? slide.durationSeconds : null,
      posterSrc: slide.posterSrc || '',
      isPinned: Number.isFinite(slide.cueTime),
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

  const timeline = normalizedSlides.map((slide, index) => {
    const nextStartTime = index < normalizedSlides.length - 1
      ? normalizedSlides[index + 1].cueTime
      : safeDuration;
    const isVideo = slide.mediaType === 'video';
    const endTime = isVideo
      ? clampVideoEndTime(slide.cueTime, slide.durationSeconds, safeDuration)
      : nextStartTime;
    const spanSeconds = Math.max(0, endTime - slide.cueTime);

    if (emitLogs && isVideo) {
      logEvent('info', 'timeline.video_span_built', {
        id: slide.id,
        startTime: slide.cueTime,
        endTime,
        durationSeconds: slide.durationSeconds,
        spanSeconds,
        clampedByNextCue: Number.isFinite(nextStartTime) && endTime === nextStartTime && nextStartTime < (slide.cueTime + (slide.durationSeconds || 0)),
      });
    }

    return {
      ...slide,
      startTime: slide.cueTime,
      endTime,
      spanSeconds,
    };
  });

  return timeline;
}

export function buildCueLaneTimeline(slides, duration) {
  if (!Array.isArray(slides) || slides.length === 0) {
    return [];
  }

  return buildTimelineItems(slides, duration, { emitLogs: false });
}

export function buildTimeline(slides, duration) {
  if (!Array.isArray(slides) || slides.length === 0) {
    logEvent('warn', 'timeline.empty_slides', { duration });
    return [];
  }

  const timeline = buildTimelineItems(slides, duration, { emitLogs: true });

  logEvent('info', 'timeline.built', {
    duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
    slideCount: slides.length,
    segmentSeconds: (Number.isFinite(duration) && duration > 0 ? duration : 0) / slides.length,
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
