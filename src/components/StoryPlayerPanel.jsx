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
  sourceMode,
  audioSourceMode,
}) {
  const activeSlide = timeline[playerState.activeSlideIndex] ?? timeline[0];
  const progress = playerState.duration > 0
    ? Math.min(100, (playerState.currentTime / playerState.duration) * 100)
    : 0;

  return (
    <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <article className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-stone-900/70 shadow-2xl shadow-black/40">
        <img
          key={activeSlide?.id}
          src={activeSlide?.src}
          alt={activeSlide?.title}
          className="h-[24rem] w-full object-cover object-center transition duration-700 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6">
          <p className="text-xs uppercase tracking-[0.35em] text-orange-300/80">
            Slide {playerState.activeSlideIndex + 1} / {timeline.length}
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-stone-50">{activeSlide?.title}</h2>
          <p className="mt-2 max-w-xl text-sm text-stone-200/90">{activeSlide?.caption}</p>
        </div>
      </article>

      <article className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.35em] text-orange-300/80">Playback</p>
        <h2 className="mt-2 text-3xl font-semibold text-stone-50">Two-minute story reel</h2>
        <p className="mt-3 text-sm leading-6 text-stone-300">
          Think of it like a mini music video: the audio is the driver, and each photo catches a lane in that timeline.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-full border border-white/10 bg-stone-950/50 px-4 py-2 text-sm text-stone-300">
            Photo source: <span className="font-semibold capitalize text-stone-100">{sourceMode}</span>
          </div>
          <div className="rounded-full border border-white/10 bg-stone-950/50 px-4 py-2 text-sm text-stone-300">
            Audio source: <span className="font-semibold capitalize text-stone-100">{audioSourceMode}</span>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex justify-between text-sm text-stone-300">
            <span>{formatTime(playerState.currentTime)}</span>
            <span>{formatTime(playerState.duration || 120)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-200 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={togglePlayback}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-orange-400 px-6 py-3 text-base font-semibold text-stone-950 transition hover:bg-orange-300"
        >
          {playerState.isPlaying ? 'Pause' : 'Play'}
        </button>

        <div className="mt-6 rounded-2xl border border-white/10 bg-stone-950/70 p-4 text-sm text-stone-300">
          <p>Status: <span className="font-semibold text-stone-100">{playerState.status}</span></p>
          {playerState.error ? (
            <p className="mt-2 text-rose-300">{playerState.error}</p>
          ) : null}
        </div>

        <div className="mt-6 space-y-3">
          {timeline.map((slide, index) => {
            const active = index === playerState.activeSlideIndex;
            return (
              <div
                key={slide.id}
                className={`rounded-2xl border px-4 py-3 transition ${
                  active
                    ? 'border-orange-300/60 bg-orange-300/10'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-stone-100">{slide.title}</span>
                  <span className="text-xs uppercase tracking-[0.2em] text-stone-400">
                    {formatTime(slide.startTime)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </article>
    </section>
  );
}
