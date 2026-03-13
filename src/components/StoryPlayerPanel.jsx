function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function StoryPlayerPanel({
  playerState,
  timeline,
  togglePlayback,
}) {
  const activeSlide = timeline[playerState.activeSlideIndex] ?? timeline[0];
  const progress = playerState.duration > 0
    ? Math.min(100, (playerState.currentTime / playerState.duration) * 100)
    : 0;

  return (
    <section>
      <article className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-stone-900/70 shadow-2xl shadow-black/40">
        <img
          key={activeSlide?.id}
          src={activeSlide?.src}
          alt={activeSlide?.title}
          className="h-[24rem] w-full object-cover object-center transition duration-700 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 translate-y-4 px-6 pb-6 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <div className="rounded-[1.5rem] border border-white/10 bg-black/45 p-4 backdrop-blur">
            <div className="mb-2 flex justify-between text-sm text-stone-200">
              <span>{formatTime(playerState.currentTime)}</span>
              <span>{formatTime(playerState.duration || 120)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-200 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <button
              type="button"
              onClick={togglePlayback}
              className="mt-4 inline-flex items-center justify-center rounded-full bg-orange-400 px-5 py-2.5 text-sm font-semibold text-stone-950 transition hover:bg-orange-300"
            >
              {playerState.isPlaying ? 'Pause' : 'Play'}
            </button>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-6">
          <p className="text-xs uppercase tracking-[0.35em] text-orange-300/80">
            Slide {playerState.activeSlideIndex + 1} / {timeline.length}
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-stone-50">{activeSlide?.title}</h2>
          <p className="mt-2 max-w-xl text-sm text-stone-200/90">{activeSlide?.caption}</p>
        </div>
      </article>
    </section>
  );
}
