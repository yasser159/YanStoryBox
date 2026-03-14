import { useState } from 'react';

function EmptyState({ isHydrating }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-white/10 bg-stone-950/40 p-6 text-sm text-stone-400">
      {isHydrating
        ? 'Restoring uploaded photos from your browser storage.'
        : 'Upload photos to replace the demo slides. Drag thumbnails to change the story order.'}
    </div>
  );
}

function formatCueTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function resolveCueTime(slide, index, slideCount, duration) {
  if (Number.isFinite(slide.cueTime)) {
    if (duration > 0) {
      return Math.min(Math.max(0, slide.cueTime), duration);
    }
    return Math.max(0, slide.cueTime);
  }

  if (!(duration > 0) || slideCount === 0) {
    return 0;
  }

  return (duration / slideCount) * index;
}

export function PhotoManagerPanel({
  uploads,
  activeSlideId,
  isHydrating,
  persistenceError,
  reorderSlides,
  setSlideCueTime,
  removeSlide,
  audioError,
  trackDuration = 0,
  currentTime = 0,
  className = '',
  style,
  embedded = false,
}) {
  const [draggedId, setDraggedId] = useState('');
  const cueSlides = uploads
    .map((slide, index) => ({
      ...slide,
      resolvedCueTime: resolveCueTime(slide, index, uploads.length, trackDuration),
    }))
    .sort((left, right) => left.resolvedCueTime - right.resolvedCueTime || left.id.localeCompare(right.id));

  const playheadPercent = trackDuration > 0
    ? Math.min(100, Math.max(0, (currentTime / trackDuration) * 100))
    : 0;

  const handleCueDrop = (event) => {
    event.preventDefault();

    if (!draggedId || !(trackDuration > 0)) {
      setDraggedId('');
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = Math.min(Math.max(0, event.clientX - rect.left), rect.width);
    const cueTime = (relativeX / rect.width) * trackDuration;
    setSlideCueTime(draggedId, cueTime, trackDuration);
    setDraggedId('');
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
                <div
                  className="relative h-24 rounded-2xl border border-dashed border-white/15 bg-stone-950/70 px-3 py-2"
                >
                  <div
                    className="absolute inset-x-3 bottom-5 top-2"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleCueDrop}
                  >
                    <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/10" />
                    <div
                      className="absolute inset-y-0 w-px bg-orange-300/70"
                      style={{ left: `${playheadPercent}%` }}
                    />
                    {cueSlides.map((slide) => {
                      const leftPercent = trackDuration > 0 ? (slide.resolvedCueTime / trackDuration) * 100 : 0;
                      const isActive = slide.id === activeSlideId;

                      return (
                        <div
                          key={`${slide.id}-cue`}
                          draggable
                          onDragStart={() => setDraggedId(slide.id)}
                          onDragEnd={() => setDraggedId('')}
                          className={`absolute top-0 flex w-14 -translate-x-1/2 cursor-grab flex-col items-center gap-1 ${draggedId === slide.id ? 'opacity-60' : ''}`}
                          style={{ left: `${leftPercent}%` }}
                        >
                          <div className={`overflow-hidden rounded-lg border ${isActive ? 'border-orange-300/70' : 'border-white/15'}`}>
                            <img src={slide.src} alt={slide.title} className="h-10 w-10 object-cover" />
                          </div>
                          <div className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${isActive ? 'bg-orange-300 text-stone-950' : 'bg-black/70 text-stone-100'}`}>
                            {formatCueTime(slide.resolvedCueTime)}
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
                <p className="mt-2 text-xs text-stone-400">
                  Drag a thumbnail onto the cue lane to pin that image to a specific moment in the track.
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
                  onDragStart={() => setDraggedId(slide.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    reorderSlides(draggedId, slide.id);
                    setDraggedId('');
                  }}
                  onDragEnd={() => setDraggedId('')}
                  className={`group overflow-hidden rounded-lg border transition ${
                    isActive
                      ? 'border-orange-300/60 bg-orange-300/10'
                      : 'border-white/10 bg-stone-950/40'
                  } ${isDragging ? 'scale-[0.98] opacity-70' : ''}`}
                >
                  <div className="relative">
                    <img src={slide.src} alt={slide.title} className="aspect-square w-full object-cover" />
                    <div className="absolute left-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-stone-100">
                      #{index + 1}
                    </div>
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
