import { useRef, useState } from 'react';

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
  hasUploads,
  isHydrating,
  persistenceError,
  sourceMode,
  uploadFiles,
  reorderSlides,
  removeSlide,
  resetUploads,
}) {
  const fileInputRef = useRef(null);
  const [draggedId, setDraggedId] = useState('');

  const handleFileChange = async (event) => {
    const { files } = event.target;
    await uploadFiles(files);
    event.target.value = '';
  };

  return (
    <article className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-orange-300/80">Photo Manager</p>
          <h2 className="mt-2 text-3xl font-semibold text-stone-50">Upload and sort your shots</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-300">
            This is the lineup board. Drop in your images, drag them around, and the story reel follows that order.
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-stone-950/50 px-4 py-2 text-sm text-stone-300">
          Source: <span className="font-semibold capitalize text-stone-100">{sourceMode}</span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center justify-center rounded-full bg-orange-400 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-orange-300"
        >
          Upload Photos
        </button>
        <button
          type="button"
          onClick={resetUploads}
          disabled={!hasUploads}
          className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-stone-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset To Demo
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {persistenceError ? (
        <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
          {persistenceError}
        </div>
      ) : null}

      <div className="mt-6">
        {!uploads.length ? (
          <EmptyState isHydrating={isHydrating} />
        ) : (
          <div className="grid gap-2 grid-cols-4 sm:grid-cols-5 xl:grid-cols-7">
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
        )}
      </div>
    </article>
  );
}
