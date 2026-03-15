import { useEffect, useMemo, useRef, useState } from 'react';
import { canRemoveCueFromTimeline } from '../lib/cueRemoval';
import { formatDurationLabel, resolveAudioClipDropStartTime } from '../lib/audioComposition';
import { buildCueLaneTimeline } from '../lib/timeline';

const EMPTY_DRAG_STATE = {
  id: '',
  source: '',
  kind: '',
  offsetSeconds: 0,
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

function AudioWaveform({ peaks }) {
  const safePeaks = Array.isArray(peaks) && peaks.length ? peaks : [];

  if (!safePeaks.length) {
    return (
      <div className="flex h-full items-center">
        <span className="w-full border-t border-dashed border-cyan-100/35" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-end gap-px">
      {safePeaks.map((peak, index) => {
        const heightPercent = Math.max(10, Math.round((peak || 0) * 100));
        return (
          <span
            // eslint-disable-next-line react/no-array-index-key
            key={`wave-${index}`}
            className="flex-1 rounded-full bg-cyan-100/85"
            style={{ height: `${heightPercent}%` }}
          />
        );
      })}
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
  onSeekTimeline,
  className = '',
  style,
  embedded = false,
}) {
  const [dragState, setDragState] = useState(EMPTY_DRAG_STATE);
  const [dropHandled, setDropHandled] = useState(false);
  const [durationDraft, setDurationDraft] = useState(targetDurationInput);
  const [playheadDragging, setPlayheadDragging] = useState(false);
  const sharedTimelineRef = useRef(null);
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

  const seekFromClientX = (clientX) => {
    if (!(effectiveDuration > 0) || !sharedTimelineRef.current) {
      return;
    }

    const rect = sharedTimelineRef.current.getBoundingClientRect();
    const relativeX = Math.min(Math.max(0, clientX - rect.left), rect.width);
    onSeekTimeline?.((relativeX / rect.width) * effectiveDuration);
  };

  useEffect(() => {
    if (!playheadDragging) {
      return undefined;
    }

    const handlePointerMove = (event) => {
      seekFromClientX(event.clientX);
    };

    const handlePointerUp = (event) => {
      seekFromClientX(event.clientX);
      setPlayheadDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [playheadDragging, effectiveDuration, onSeekTimeline]);

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
                    <p className="mt-1 text-xs text-stone-500">Uploaded audio files sit in the table first. Drag rows onto the lane when you want them in the mix.</p>
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

                {audioClips.length ? (
                  <div className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-black/25">
                    <div className="grid grid-cols-[minmax(0,1fr)_7rem] border-b border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                      <span>File Name</span>
                      <span>Duration</span>
                    </div>
                    <div className="max-h-44 overflow-auto">
                      {audioClips.map((clip) => {
                        const isPinned = Number.isFinite(clip.desiredStartTime);
                        return (
                          <div
                            key={clip.id}
                            draggable
                            onDragStart={() => {
                              setDropHandled(false);
                              setDragState({ id: clip.id, source: 'audio-library', kind: 'audio' });
                            }}
                            onDragEnd={() => setDragState(EMPTY_DRAG_STATE)}
                            className={`border-t border-white/5 px-3 py-2 transition first:border-t-0 ${dragState.id === clip.id ? 'opacity-60' : ''}`}
                            data-testid={`audio-library-clip-${clip.id}`}
                          >
                            <div className={`grid cursor-grab grid-cols-[minmax(0,1fr)_7rem] items-center gap-3 rounded-xl border px-3 py-3 text-sm transition ${isPinned ? 'border-cyan-200/45 bg-cyan-300/12 text-cyan-50' : 'border-white/10 bg-white/[0.03] text-stone-100'}`}>
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="shrink-0" aria-hidden="true">🎵</span>
                                <span className="truncate font-medium">{clip.fileName}</span>
                              </div>
                              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">
                                {formatDurationLabel(clip.durationSeconds || 0)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="relative" ref={sharedTimelineRef} data-testid="shared-playhead-shell">
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

                  <div className="relative space-y-4">
                    <div className="relative h-20 rounded-2xl border border-dashed border-white/15 bg-stone-950/70 px-3 py-2">
                      <div
                        className="absolute inset-x-3 bottom-2 top-2"
                        onClick={(event) => {
                          if (dragState.kind || playheadDragging) return;
                          seekFromClientX(event.clientX);
                        }}
                        onDragOver={(event) => handleDragOver(event, 'audio')}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (dragState.kind !== 'audio' || !(effectiveDuration > 0)) {
                            setDropHandled(false);
                            setDragState(EMPTY_DRAG_STATE);
                            return;
                          }
                          setDropHandled(true);
                          const dropTime = clampDropTime(event, effectiveDuration);
                          setAudioClipStartTime(
                            dragState.id,
                            resolveAudioClipDropStartTime({
                              dropTime,
                              dragOffsetSeconds: dragState.offsetSeconds,
                              targetDurationSeconds: effectiveDuration,
                              snapWindowSeconds: Math.min(2.5, effectiveDuration * 0.04),
                            }),
                          );
                          setDragState(EMPTY_DRAG_STATE);
                        }}
                        data-testid="audio-timeline-lane"
                      >
                        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/10" />
                        {!audioTimeline.length ? (
                          <div className="absolute inset-0 flex items-center justify-center text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
                            No audio clips pinned yet
                          </div>
                        ) : null}
                        {audioTimeline.map((clip) => {
                          const leftPercent = effectiveDuration > 0 ? (clip.startTime / effectiveDuration) * 100 : 0;
                          const width = effectiveDuration > 0
                            ? `max(5rem, ${(Math.max(clip.spanSeconds, 1) / effectiveDuration) * 100}%)`
                            : '5rem';

                          return (
                            <div
                              key={clip.id}
                              draggable
                              onDragStart={(event) => {
                                const markerRect = event.currentTarget.getBoundingClientRect();
                                const relativeX = Math.min(
                                  Math.max(0, event.clientX - markerRect.left),
                                  markerRect.width,
                                );
                                const widthRatio = markerRect.width > 0 ? (relativeX / markerRect.width) : 0;
                                setDropHandled(false);
                                setDragState({
                                  id: clip.id,
                                  source: 'audio-lane',
                                  kind: 'audio',
                                  offsetSeconds: (clip.spanSeconds || clip.durationSeconds || 0) * widthRatio,
                                });
                              }}
                              onDragEnd={() => {
                                const shouldRemoveFromTimeline = !dropHandled && Number.isFinite(clip.desiredStartTime);
                                setDragState(EMPTY_DRAG_STATE);
                                setDropHandled(false);
                                if (shouldRemoveFromTimeline) {
                                  clearAudioClipStartTime(clip.id);
                                }
                              }}
                              className={`absolute top-0 flex h-full flex-col gap-1 ${dragState.id === clip.id ? 'opacity-60' : ''}`}
                              style={{ left: `${leftPercent}%`, width }}
                              data-testid={`audio-clip-marker-${clip.id}`}
                            >
                              <div className="flex h-full flex-col overflow-hidden rounded-xl border border-cyan-200/60 bg-gradient-to-b from-cyan-300/20 via-cyan-300/12 to-cyan-400/10 px-2 py-2 text-xs font-semibold text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="shrink-0" aria-hidden="true">🎵</span>
                                  <span className="truncate">{clip.title}</span>
                                </div>
                                <div className="mt-2 min-h-0 flex-1">
                                  <AudioWaveform peaks={clip.waveformPeaks} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {effectiveDuration > 0 ? (
                      <div className="rounded-[1.5rem] border border-white/10 bg-stone-950/40 p-3">
                        <div className="relative h-24 rounded-2xl border border-dashed border-white/15 bg-stone-950/70 px-3 py-2" data-testid="cue-timeline-shell">
                          <div
                            className="absolute inset-x-3 bottom-5 top-2"
                            onClick={(event) => {
                              if (dragState.kind || playheadDragging) return;
                              seekFromClientX(event.clientX);
                            }}
                            onDragOver={(event) => handleDragOver(event, 'visual')}
                            onDrop={(event) => {
                              event.preventDefault();
                              if (dragState.kind !== 'visual' || !(effectiveDuration > 0)) {
                                setDropHandled(false);
                                setDragState(EMPTY_DRAG_STATE);
                                return;
                              }
                              setDropHandled(true);
                              setSlideCueTime(dragState.id, clampDropTime(event, effectiveDuration), effectiveDuration);
                              setDragState(EMPTY_DRAG_STATE);
                            }}
                            data-testid="cue-timeline-lane"
                          >
                            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/10" />
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
                                  onDragStart={() => {
                                    setDropHandled(false);
                                    setDragState({ id: slide.id, source: 'cue', kind: 'visual' });
                                  }}
                                  onDragEnd={() => {
                                    const shouldRemoveFromTimeline = !dropHandled && canRemoveCueFromTimeline({
                                      slideId: slide.id,
                                      cueTime: slide.cueTime,
                                      draggedId: slide.id,
                                    });
                                    setDragState(EMPTY_DRAG_STATE);
                                    setDropHandled(false);
                                    if (shouldRemoveFromTimeline) {
                                      clearSlideCueTime(slide.id);
                                    }
                                  }}
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
                      </div>
                    ) : null}

                    {effectiveDuration > 0 ? (
                      <div
                        className="pointer-events-none absolute inset-y-0 z-20 -translate-x-1/2"
                        style={{ left: `${playheadPercent}%` }}
                        data-testid="shared-playhead"
                      >
                        <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-orange-300 shadow-[0_0_18px_rgba(251,146,60,0.45)]" />
                        <button
                          type="button"
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setPlayheadDragging(true);
                            seekFromClientX(event.clientX);
                          }}
                          className="pointer-events-auto absolute left-1/2 top-[calc(5rem+0.5rem)] flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-orange-100/80 bg-orange-300 text-stone-950 shadow-lg shadow-orange-300/30"
                          aria-label="Drag timeline read head"
                          data-testid="shared-playhead-handle"
                        >
                          <span className="h-3.5 w-0.5 rounded-full bg-stone-950/70" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2 min-h-0 flex-1 overflow-auto pr-1" data-testid="media-library-scroll">
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
                          onDragStart={() => setDragState({ id: slide.id, source: 'library', kind: 'visual' })}
                          onDragEnd={() => setDragState(EMPTY_DRAG_STATE)}
                          onDragOver={(event) => {
                            if (dragState.kind !== 'visual' || dragState.source === 'cue') return;
                            event.preventDefault();
                            if (event.dataTransfer) {
                              event.dataTransfer.dropEffect = 'move';
                            }
                          }}
                          onDrop={(event) => {
                            if (dragState.kind !== 'visual' || dragState.source === 'cue') return;
                            event.preventDefault();
                            reorderSlides(dragState.id, slide.id);
                            setDragState(EMPTY_DRAG_STATE);
                          }}
                          data-testid={`visual-thumb-${slide.id}`}
                          className={`group relative overflow-hidden rounded-[1.25rem] border transition ${isActive ? 'border-orange-300/80 shadow-[0_0_0_1px_rgba(251,146,60,0.4)]' : 'border-white/10'} ${isDragging ? 'opacity-60' : ''}`}
                        >
                          <div className="aspect-square bg-black/25">
                            <VisualThumb slide={slide} className="h-full w-full object-cover" />
                          </div>
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2">
                            <p className="truncate text-xs font-medium text-stone-100">
                              {index + 1}. {slide.title}
                            </p>
                            {slide.mediaType === 'video' && Number.isFinite(slide.durationSeconds) ? (
                              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-300">
                                {formatDurationLabel(slide.durationSeconds)}
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeSlide(slide.id)}
                            className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-xs font-semibold text-stone-100 opacity-0 transition hover:bg-rose-500 group-hover:opacity-100"
                            aria-label={`Remove ${slide.title}`}
                          >
                            X
                          </button>
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
