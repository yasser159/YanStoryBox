import { useEffect, useMemo, useState } from 'react';
import { canRemoveCueFromTimeline } from '../lib/cueRemoval';
import { formatDurationLabel } from '../lib/audioComposition';
import { buildCueLaneTimeline } from '../lib/timeline';

const EMPTY_DRAG_STATE = {
  id: '',
  source: '',
  kind: '',
};

function EmptyState({ isHydrating }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-white/10 bg-stone-950/40 p-6 text-sm text-stone-400">
      {isHydrating
        ? 'Restoring uploaded media from your browser storage.'
        : 'Upload photos, videos, and audio clips to replace the demo reel. Drag media into the lanes to lock the timing.'}
    </div>
  );
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
      label: formatDurationLabel(value),
      leftPercent: (value / duration) * 100,
    });
  }

  if (ticks[ticks.length - 1]?.value !== duration) {
    ticks.push({
      value: duration,
      label: formatDurationLabel(duration),
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

  return <img src={slide.src} alt={slide.title} className={className} />;
}

function clampDropTime(event, duration) {
  const rect = event.currentTarget.getBoundingClientRect();
  const relativeX = Math.min(Math.max(0, event.clientX - rect.left), rect.width);
  return (relativeX / rect.width) * duration;
}

export function PhotoManagerPanel({
  uploads,
  audioClips,
  audioTimeline,
  targetDurationSeconds,
  targetDurationInput,
  setTargetDurationInput,
  saveTargetDuration,
  activeSlideId,
  isHydrating,
  persistenceError,
  reorderSlides,
  setSlideCueTime,
  clearSlideCueTime,
  removeSlide,
  setAudioClipStartTime,
  clearAudioClipStartTime,
  removeAudioClip,
  audioError,
  trackDuration = 0,
  currentTime = 0,
  className = '',
  style,
  embedded = false,
}) {
  const [dragState, setDragState] = useState(EMPTY_DRAG_STATE);
  const [durationDraft, setDurationDraft] = useState(targetDurationInput);
  const effectiveDuration = targetDurationSeconds || trackDuration || 0;
  const cueSlides = useMemo(
    () => buildCueLaneTimeline(
      uploads.filter((slide) => Number.isFinite(slide.cueTime)),
      effectiveDuration,
    ),
    [effectiveDuration, uploads],
  );
  const rulerTicks = buildTimelineTicks(effectiveDuration);
  const playheadPercent = effectiveDuration > 0
    ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100))
    : 0;
  const draggedVisual = uploads.find((slide) => slide.id === dragState.id);
  const draggedAudioClip = audioClips.find((clip) => clip.id === dragState.id);
  const isDraggedVisualPinned = Number.isFinite(draggedVisual?.cueTime);
  const isDraggedAudioPinned = Number.isFinite(draggedAudioClip?.desiredStartTime);

  useEffect(() => {
    setDurationDraft(targetDurationInput);
  }, [targetDurationInput]);

  const handleDragOver = (event, expectedKind) => {
    if (expectedKind && dragState.kind !== expectedKind) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  };

  return (
    <article className={`${embedded ? 'flex h-full min-h-0 flex-col rounded-[1.5rem] border border-white/10 bg-white/5 p-4 shadow-xl shadow-black/20 backdrop-blur sm:p-5' : 'rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur'} ${className}`} style={style}>
      {persistenceError ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
          {persistenceError}
        </div>
      ) : null}

      {audioError ? (
        <div className={`${persistenceError ? 'mt-4' : ''} rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100`}>
          {audioError}
        </div>
      ) : null}

      <div className={`${persistenceError || audioError ? 'mt-4' : ''} flex h-full min-h-0 flex-col`}>
        {!uploads.length && !audioClips.length ? (
          <EmptyState isHydrating={isHydrating} />
        ) : (
          <>
            <div className="sticky top-0 z-10 shrink-0 space-y-4 bg-gradient-to-b from-stone-950/95 via-stone-950/90 to-stone-950/40 pb-4 backdrop-blur" data-testid="timeline-stack">
              <div className="rounded-[1.5rem] border border-white/10 bg-stone-950/40 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Audio Lane</p>
                    <p className="mt-1 text-xs text-stone-500">Upload clips, set the target duration, and the lane fills them sequentially with no overlap.</p>
                  </div>
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      saveTargetDuration(durationDraft);
                    }}
                  >
                    <input
                      type="text"
                      value={durationDraft}
                      onChange={(event) => setDurationDraft(event.target.value)}
                      className="w-28 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-100 outline-none ring-0 placeholder:text-stone-500"
                      placeholder="mm:ss"
                    />
                    <button
                      type="submit"
                      className="rounded-full bg-orange-400 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-950 transition hover:bg-orange-300"
                    >
                      Set Length
                    </button>
                  </form>
                </div>
                <div className="mb-3 grid h-8 grid-cols-1">
                  <div className="relative h-full">
                    {rulerTicks.map((tick) => (
                      <div
                        key={`ruler-${tick.value}`}
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
                <div className="relative h-20 rounded-2xl border border-dashed border-white/15 bg-stone-950/70 px-3 py-2">
                  <div
                    className="absolute inset-x-3 bottom-2 top-2"
                    onDragOver={(event) => handleDragOver(event, 'audio')}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (dragState.kind !== 'audio' || !(effectiveDuration > 0)) {
                        setDragState(EMPTY_DRAG_STATE);
                        return;
                      }
                      setAudioClipStartTime(dragState.id, clampDropTime(event, effectiveDuration));
                      setDragState(EMPTY_DRAG_STATE);
                    }}
                    data-testid="audio-timeline-lane"
                  >
                    <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/10" />
                    <div className="absolute inset-y-0 w-px bg-orange-300/70" style={{ left: `${playheadPercent}%` }} />
                    {!audioTimeline.length ? (
                      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
                        No audio clips pinned yet
                      </div>
                    ) : null}
                    {audioTimeline.map((clip) => {
                      const leftPercent = effectiveDuration > 0 ? (clip.startTime / effectiveDuration) * 100 : 0;
                      const width = effectiveDuration > 0
                        ? `max(4rem, ${(Math.max(clip.spanSeconds, 1) / effectiveDuration) * 100}%)`
                        : '4rem';

                      return (
                        <div
                          key={clip.id}
                          draggable
                          onDragStart={() => setDragState({ id: clip.id, source: 'audio-lane', kind: 'audio' })}
                          onDragEnd={() => setDragState(EMPTY_DRAG_STATE)}
                          className={`absolute top-0 flex flex-col gap-1 ${dragState.id === clip.id ? 'opacity-60' : ''}`}
                          style={{ left: `${leftPercent}%`, width }}
                          data-testid={`audio-clip-marker-${clip.id}`}
                        >
                          <div className="overflow-hidden rounded-lg border border-cyan-300/35 bg-cyan-300/15 px-2 py-2 text-xs font-semibold text-cyan-50">
                            <div className="truncate">{clip.title}</div>
                            <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-cyan-100/75">
                              {formatDurationLabel(clip.spanSeconds)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div
                  onDragOver={(event) => handleDragOver(event, 'audio')}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragState.kind !== 'audio' || !draggedAudioClip || !Number.isFinite(draggedAudioClip.desiredStartTime)) {
                      setDragState(EMPTY_DRAG_STATE);
                      return;
                    }
                    clearAudioClipStartTime(dragState.id);
                    setDragState(EMPTY_DRAG_STATE);
                  }}
                  className={`mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl border border-dashed px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                    dragState.kind === 'audio' && isDraggedAudioPinned
                      ? 'border-cyan-300/70 bg-cyan-300/10 text-cyan-100'
                      : 'border-white/10 bg-black/30 text-stone-400'
                  }`}
                >
                  Remove Audio From Timeline
                </div>
              </div>

              {effectiveDuration > 0 ? (
                <div className="rounded-[1.5rem] border border-white/10 bg-stone-950/40 p-3">
                  <div className="mb-3 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-stone-400">
                    <span>Visual Cue Lane</span>
                    <span>{formatDurationLabel(effectiveDuration)}</span>
                  </div>
                  <div className="relative h-24 rounded-2xl border border-dashed border-white/15 bg-stone-950/70 px-3 py-2" data-testid="cue-timeline-shell">
                    <div
                      className="absolute inset-x-3 bottom-5 top-2"
                      onDragOver={(event) => handleDragOver(event, 'visual')}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (dragState.kind !== 'visual' || !(effectiveDuration > 0)) {
                          setDragState(EMPTY_DRAG_STATE);
                          return;
                        }
                        setSlideCueTime(dragState.id, clampDropTime(event, effectiveDuration), effectiveDuration);
                        setDragState(EMPTY_DRAG_STATE);
                      }}
                      data-testid="cue-timeline-lane"
                    >
                      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/10" />
                      <div className="absolute inset-y-0 w-px bg-orange-300/70" style={{ left: `${playheadPercent}%` }} />
                      {!cueSlides.length ? (
                        <div className="absolute inset-0 flex items-center justify-center text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
                          No pinned cues yet
                        </div>
                      ) : null}
                      {cueSlides.map((slide) => {
                        const leftPercent = effectiveDuration > 0 ? (slide.startTime / effectiveDuration) * 100 : 0;
                        const isActive = slide.id === activeSlideId;
                        const isVideo = slide.mediaType === 'video';
                        const blockWidth = isVideo && effectiveDuration > 0
                          ? `max(4.5rem, ${(Math.max(slide.spanSeconds || slide.durationSeconds || 1, 1) / effectiveDuration) * 100}%)`
                          : '3.5rem';

                        return (
                          <div
                            key={`${slide.id}-cue`}
                            draggable
                            onDragStart={() => setDragState({ id: slide.id, source: 'cue', kind: 'visual' })}
                            onDragEnd={() => setDragState(EMPTY_DRAG_STATE)}
                            data-testid={`cue-marker-${slide.id}`}
                            className={`absolute top-0 flex cursor-grab flex-col items-center gap-1 ${dragState.id === slide.id ? 'opacity-60' : ''} ${isVideo ? '' : '-translate-x-1/2'}`}
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
                              {formatDurationLabel(slide.startTime)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="absolute inset-x-3 bottom-1 flex justify-between text-[10px] font-medium uppercase tracking-[0.16em] text-stone-500">
                      <span>00:00</span>
                      <span>{formatDurationLabel(effectiveDuration)}</span>
                    </div>
                  </div>
                  <div
                    onDragOver={(event) => handleDragOver(event, 'visual')}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (
                        dragState.kind !== 'visual'
                        || !canRemoveCueFromTimeline({
                          slideId: dragState.id,
                          cueTime: draggedVisual?.cueTime,
                          draggedId: dragState.id,
                        })
                      ) {
                        setDragState(EMPTY_DRAG_STATE);
                        return;
                      }

                      clearSlideCueTime(dragState.id);
                      setDragState(EMPTY_DRAG_STATE);
                    }}
                    data-testid="remove-from-timeline"
                    className={`mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl border border-dashed px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                      dragState.kind === 'visual' && isDraggedVisualPinned
                        ? 'border-rose-400/70 bg-rose-400/10 text-rose-100'
                        : 'border-white/10 bg-black/30 text-stone-400'
                    }`}
                  >
                    Remove Visual From Timeline
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-2 min-h-0 flex-1 overflow-auto pr-1" data-testid="media-library-scroll">
              {audioClips.length ? (
                <section className="mb-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Audio Library</p>
                      <p className="mt-1 text-xs text-stone-500">Drag audio clips onto the audio lane. If they’re already there, drag them again to reposition.</p>
                    </div>
                    <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-stone-300">
                      {audioClips.length} clip{audioClips.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    {audioClips.map((clip) => {
                      const isPinned = Number.isFinite(clip.desiredStartTime);

                      return (
                        <div
                          key={clip.id}
                          draggable
                          onDragStart={() => setDragState({ id: clip.id, source: 'audio-library', kind: 'audio' })}
                          onDragEnd={() => setDragState(EMPTY_DRAG_STATE)}
                          className={`flex cursor-grab items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition ${isPinned ? 'border-cyan-300/30 bg-cyan-300/10' : 'border-white/10 bg-stone-950/40'} ${dragState.id === clip.id ? 'opacity-60' : ''}`}
                          data-testid={`audio-library-clip-${clip.id}`}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-stone-100">{clip.title}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-stone-400">
                              {formatDurationLabel(clip.durationSeconds || 0)} • {isPinned ? `Pinned at ${formatDurationLabel(clip.desiredStartTime)}` : 'Unpinned'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAudioClip(clip.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-xs font-semibold text-stone-100 transition hover:bg-rose-500"
                            aria-label={`Remove ${clip.title}`}
                          >
                            X
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {uploads.length ? (
                <section>
                  <div className="mb-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Visual Library</p>
                    <p className="mt-1 text-xs text-stone-500">Drag visuals onto the visual lane to pin them. The grid below still reorders slideshow fallback timing.</p>
                  </div>
                  <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(4rem,10rem))] justify-center gap-2">
                    {uploads.map((slide, index) => {
                      const isActive = slide.id === activeSlideId;
                      const isDragging = dragState.id === slide.id;

                      return (
                        <div
                          key={slide.id}
                          draggable
                          onDragStart={() => setDragState({ id: slide.id, source: 'grid', kind: 'visual' })}
                          onDragOver={(event) => handleDragOver(event, 'visual')}
                          onDrop={(event) => {
                            event.preventDefault();
                            if (dragState.kind !== 'visual') {
                              setDragState(EMPTY_DRAG_STATE);
                              return;
                            }
                            reorderSlides(dragState.id, slide.id);
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
                            <VisualThumb slide={slide} className="aspect-square w-full object-cover" />
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
                </section>
              ) : null}
            </div>
          </>
        )}
      </div>
    </article>
  );
}
