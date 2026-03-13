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

export function PhotoManagerPanel({
  uploads,
  activeSlideId,
  isHydrating,
  persistenceError,
  uploadFiles,
  reorderSlides,
  removeSlide,
  audioMeta,
  audioError,
  className = '',
  style,
  embedded = false,
}) {
  const [draggedId, setDraggedId] = useState('');

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
            <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(clamp(4rem,9vw,6.5rem),1fr))] gap-2">
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
