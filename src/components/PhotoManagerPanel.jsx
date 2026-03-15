import { useMemo, useState } from 'react';
import { canRemoveCueFromTimeline } from '../lib/cueRemoval';
import { buildCueLaneTimeline } from '../lib/timeline';

const EMPTY_DRAG_STATE = {
  id: '',
  source: '',
};

function EmptyState({ isHydrating }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-white/10 bg-stone-950/40 p-6 text-sm text-stone-400">
      {isHydrating
        ? 'Restoring uploaded photos from your browser storage.'
        : 'Upload photos or short videos to replace the demo slides. Drag thumbnails to change the story order.'}
    </div>
  );
}

function formatCueTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getTimelineTickStep(duration) {
  if (duration <= 30) return 5;
  if (duration <= 90) return 10;
  if (duration <= 180) return 15;
  return 30;
}

function buildTimelineTicks(duration) {
  if (!(duration > 0)) {
    return [];
  }

  const ticks = [];
  const step = getTimelineTickStep(duration);

  for (let value = 0; value <= duration; value += step) {
    ticks.push({
      value,
      label: formatCueTime(value),
      leftPercent: (value / duration) * 100,
    });
  }

  if (ticks[ticks.length - 1]?.value !== duration) {
    ticks.push({
      value: duration,
      label: formatCueTime(duration),
      leftPercent: 100,
    });
  }

  return ticks;
}

function PlayBadge() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-stone-100 shadow-lg shadow-black/30">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="ml-0.5 h-4 w-4 fill-current">
          <path d="M8.75 6.2c0-1.02 1.1-1.66 1.99-1.15l8.11 4.67c.89.51.89 1.79 0 2.3l-8.11 4.67c-.89.51-1.99-.13-1.99-1.15V6.2Z" />
        </svg>
      </div>
    </div>
  );
}

function VisualThumb({ slide, className }) {
  if (slide.mediaType === 'video') {
    return (
      <div className={`relative ${className}`}>
        <video
          src={slide.src}
          poster={slide.posterSrc || undefined}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
        <PlayBadge />
      </div>
    );
  }

  return (
    <img
      src={slide.src}
      alt={slide.title}
      className={className}
    />
  );
}

export function PhotoManagerPanel({
  uploads,
  activeSlideId,
  isHydrating,
  persistenceError,
  reorderSlides,
  setSlideCueTime,
  clearSlideCueTime,
  removeSlide,
  audioError,
  trackDuration = 0,
  currentTime = 0,
  className = '',
  style,
  embedded = false,
}) {
  const [dragState, setDragState] = useState(EMPTY_DRAG_STATE);
  const draggedId = dragState.id;
  const cueSlides = useMemo(
    () => buildCueLaneTimeline(
      uploads.filter((slide) => Number.isFinite(slide.cueTime)),
      trackDuration,
    ),
    [trackDuration, uploads],
  );
  const rulerTicks = buildTimelineTicks(trackDuration);

  const playheadPercent = trackDuration > 0
    ? Math.min(100, Math.max(0, (currentTime / trackDuration) * 100))
    : 0;
  const draggedSlide = uploads.find((slide) => slide.id === draggedId);
  const isDraggedSlidePinned = Number.isFinite(draggedSlide?.cueTime);

  const handleDragOver = (event) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  };

  const handleCueDrop = (event) => {
    event.preventDefault();

    if (!draggedId || !(trackDuration > 0)) {
      setDragState(EMPTY_DRAG_STATE);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = Math.min(Math.max(0, event.clientX - rect.left), rect.width);
    const cueTime = (relativeX / rect.width) * trackDuration;
    setSlideCueTime(draggedId, cueTime, trackDuration);
    setDragState(EMPTY_DRAG_STATE);
  };

  return (
    <article className={`${embedded ? 'rounded-[1.5rem] border border-white/10 bg-white/5 p-4 shadow-xl shadow-black/20 backdrop-blur sm:p-5' : 'rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur'} ${className}`} style={style}>
      {persistenceError ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
          {persistenceError}
        </div>
      ) : null}

      {audioError ? (
        <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
          {audioError}
        </div>
      ) : null}

      <div className={persistenceError || audioError ? 'mt-4' : ''}>
        {!uploads.length ? (
          <EmptyState isHydrating={isHydrating} />
        ) : (
          <div className="w-full">
            {trackDuration > 0 ? (
              <div className="mb-4 rounded-[1.5rem] border border-white/10 bg-stone-950/40 p-3">
                <div className="mb-3 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-stone-400">
                  <span>Slide Cue Lane</span>
                  <span>{formatCueTime(trackDuration)}</span>
                </div>
                <div className="mb-3 grid h-8 grid-cols-1">
                  <div className="relative h-full">
                    {rulerTicks.map((tick) => (
                      <div
                        key={`tick-${tick.value}`}
                        className="absolute bottom-0 top-0"
                        style={{ left: `${tick.leftPercent}%` }}
                      >
                        <div className="flex h-full -translate-x-1/2 flex-col items-center">
                          <span className="text-[10px] font-medium text-stone-500">{tick.label}</span>
                          <span className="mt-1 h-3 w-px bg-white/20" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div
                  className="relative h-24 rounded-2xl border border-dashed border-white/15 bg-stone-950/70 px-3 py-2"
                  data-testid="cue-timeline-shell"
                >
                  <div
                    className="absolute inset-x-3 bottom-5 top-2"
                    onDragOver={handleDragOver}
                    onDrop={handleCueDrop}
                    data-testid="cue-timeline-lane"
                  >
                    <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/10" />
                    <div
                      className="absolute inset-y-0 w-px bg-orange-300/70"
                      style={{ left: `${playheadPercent}%` }}
                    />
                    {!cueSlides.length ? (
                      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
                        No pinned cues yet
                      </div>
                    ) : null}
                    {cueSlides.map((slide) => {
                      const leftPercent = trackDuration > 0 ? (slide.startTime / trackDuration) * 100 : 0;
                      const isActive = slide.id === activeSlideId;
                      const isVideo = slide.mediaType === 'video';
                      const blockWidth = isVideo && trackDuration > 0
                        ? `max(4.5rem, ${(Math.max(slide.spanSeconds || slide.durationSeconds || 1, 1) / trackDuration) * 100}%)`
                        : '3.5rem';

                      return (
                        <div
                          key={`${slide.id}-cue`}
                          draggable
                          onDragStart={() => setDragState({ id: slide.id, source: 'cue' })}
                          onDragEnd={() => setDragState(EMPTY_DRAG_STATE)}
                          data-testid={`cue-marker-${slide.id}`}
                          className={`absolute top-0 flex cursor-grab flex-col items-center gap-1 ${draggedId === slide.id ? 'opacity-60' : ''} ${isVideo ? '' : '-translate-x-1/2'}`}
                          style={{
                            left: `${leftPercent}%`,
                            width: blockWidth,
                            maxWidth: isVideo ? `calc(100% - ${leftPercent}%)` : undefined,
                          }}
                        >
                          <div className={`relative overflow-hidden rounded-lg border ${isActive ? 'border-orange-300/70' : 'border-white/15'} ${isVideo ? 'w-full' : ''}`}>
                            <VisualThumb
                              slide={slide}
                              className={isVideo ? 'h-10 w-full object-cover' : 'h-10 w-10 object-cover'}
                            />
                          </div>
                          <div className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${isActive ? 'bg-orange-300 text-stone-950' : 'bg-black/70 text-stone-100'}`}>
                            {formatCueTime(slide.startTime)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="absolute inset-x-3 bottom-1 flex justify-between text-[10px] font-medium uppercase tracking-[0.16em] text-stone-500">
                    <span>00:00</span>
                    <span>{formatCueTime(trackDuration)}</span>
                  </div>
                </div>
                <div
                  onDragOver={handleDragOver}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (!canRemoveCueFromTimeline({
                      slideId: draggedId,
                      cueTime: draggedSlide?.cueTime,
                      draggedId,
                    })) {
                      setDragState(EMPTY_DRAG_STATE);
                      return;
                    }

                    clearSlideCueTime(draggedId);
                    setDragState(EMPTY_DRAG_STATE);
                  }}
                  data-testid="remove-from-timeline"
                  className={`mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl border border-dashed px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                    draggedId && isDraggedSlidePinned
                      ? 'border-rose-400/70 bg-rose-400/10 text-rose-100'
                      : 'border-white/10 bg-black/30 text-stone-400'
                  }`}
                >
                  Remove From Timeline
                </div>
                <p className="mt-2 text-xs text-stone-400">
                  Drag a thumbnail onto the cue lane to pin that visual to a specific moment in the track. Video blocks stretch to match their seconds on screen. Drag a pinned cue onto the remove strip to send it back to auto timing.
                </p>
              </div>
            ) : null}
            <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(4rem,10rem))] justify-center gap-2">
            {uploads.map((slide, index) => {
              const isActive = slide.id === activeSlideId;
              const isDragging = draggedId === slide.id;

              return (
                <div
                  key={slide.id}
                  draggable
                  onDragStart={() => setDragState({ id: slide.id, source: 'grid' })}
                  onDragOver={handleDragOver}
                  onDrop={(event) => {
                    event.preventDefault();
                    reorderSlides(draggedId, slide.id);
                    setDragState(EMPTY_DRAG_STATE);
                  }}
                  onDragEnd={() => setDragState(EMPTY_DRAG_STATE)}
                  data-testid={`visual-thumb-${slide.id}`}
                  className={`group overflow-hidden rounded-lg border transition ${
                    isActive
                      ? 'border-orange-300/60 bg-orange-300/10'
                      : 'border-white/10 bg-stone-950/40'
                  } ${isDragging ? 'scale-[0.98] opacity-70' : ''}`}
                >
                  <div className="relative">
                    <VisualThumb
                      slide={slide}
                      className="aspect-square w-full object-cover"
                    />
                    <div className="absolute left-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-stone-100">
                      #{index + 1}
                    </div>
                    {slide.mediaType === 'video' ? (
                      <div className="absolute right-1 bottom-1 rounded-full bg-black/75 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.15em] text-stone-100">
                        {Math.round(slide.durationSeconds || 0)}s
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => removeSlide(slide.id)}
                      className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[11px] font-semibold text-stone-100 opacity-0 transition hover:bg-rose-500 group-hover:opacity-100"
                      aria-label={`Remove ${slide.title}`}
                    >
                      X
                    </button>
                    {isActive ? (
                      <div className="absolute bottom-1 right-1 rounded-full bg-orange-300 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.15em] text-stone-950">
                        Live
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}
      </div>

    </article>
  );
}
