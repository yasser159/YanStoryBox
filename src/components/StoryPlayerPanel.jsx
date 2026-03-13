function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M8.75 6.2c0-1.02 1.1-1.66 1.99-1.15l8.11 4.67c.89.51.89 1.79 0 2.3l-8.11 4.67c-.89.51-1.99-.13-1.99-1.15V6.2Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M7.75 5.5A1.25 1.25 0 0 1 9 6.75v10.5A1.25 1.25 0 0 1 7.75 18.5h-.5A1.25 1.25 0 0 1 6 17.25V6.75A1.25 1.25 0 0 1 7.25 5.5h.5Zm9 0A1.25 1.25 0 0 1 18 6.75v10.5A1.25 1.25 0 0 1 16.75 18.5h-.5A1.25 1.25 0 0 1 15 17.25V6.75a1.25 1.25 0 0 1 1.25-1.25h.5Z" />
    </svg>
  );
}

function RewindIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M11.02 6.08c.77-.56 1.85-.01 1.85.94v9.96c0 .95-1.08 1.5-1.85.94L4.1 13.01a1.25 1.25 0 0 1 0-2.02l6.92-4.91Zm8 0c.77-.56 1.85-.01 1.85.94v9.96c0 .95-1.08 1.5-1.85.94l-6.92-4.91a1.25 1.25 0 0 1 0-2.02l6.92-4.91Z" />
    </svg>
  );
}

export function PlayerControlsBar({
  playerState,
  togglePlayback,
  rewind,
  onUploadPhotos,
  onUploadAudio,
}) {
  const progress = playerState.duration > 0
    ? Math.min(100, (playerState.currentTime / playerState.duration) * 100)
    : 0;

  return (
    <div className="w-full rounded-[1.5rem] border border-white/10 bg-black/45 p-3 backdrop-blur sm:p-4">
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
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={rewind}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-stone-100 transition hover:bg-white/20"
          aria-label="Rewind"
        >
          <RewindIcon />
        </button>
        <button
          type="button"
          onClick={togglePlayback}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-orange-400 text-stone-950 transition hover:bg-orange-300"
          aria-label={playerState.isPlaying ? 'Pause' : 'Play'}
        >
          {playerState.isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          type="button"
          onClick={onUploadPhotos}
          className="inline-flex items-center justify-center rounded-full bg-orange-400 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-orange-300"
        >
          Upload Photos
        </button>
        <button
          type="button"
          onClick={onUploadAudio}
          className="inline-flex items-center justify-center rounded-full bg-orange-400 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-orange-300"
        >
          Upload Audio
        </button>
      </div>
    </div>
  );
}

export function StoryPlayerPanel({
  timeline,
  playerState,
  className = '',
}) {
  const activeSlide = timeline[playerState.activeSlideIndex] ?? timeline[0] ?? {};

  return (
    <section className="h-full min-h-[100svh]">
      <article className={`scene-shell relative h-full min-h-[100svh] overflow-hidden border-0 bg-stone-900 shadow-2xl shadow-black/40 ${className}`}>
        <div className="absolute inset-0 bg-black" />
        <div className="absolute inset-0 z-10 flex items-center justify-center p-0">
          <img
            key={`${activeSlide?.id}-detail`}
            src={activeSlide?.src}
            alt={activeSlide?.title}
            className="block h-full w-full object-contain object-center transition duration-700 ease-out"
          />
        </div>
      </article>
    </section>
  );
}
