import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { UploadPickerButton } from './UploadPickerButton';
import { logEvent } from '../lib/logger';

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

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 animate-spin">
      <circle cx="12" cy="12" r="9" className="stroke-current/25" strokeWidth="3" fill="none" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        className="stroke-current"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function PlayerControlsBar({
  playerState,
  togglePlayback,
  rewind,
  rewindTenSeconds,
  forwardTenSeconds,
  onMediaFilesSelected,
  isUploadingMedia = false,
  audioMeta,
}) {
  const progress = playerState.duration > 0
    ? Math.min(100, (playerState.currentTime / playerState.duration) * 100)
    : 0;

  return (
    <motion.div
      className="w-full rounded-[1.5rem] border border-white/10 bg-black/45 p-3 backdrop-blur sm:p-4"
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3 text-sm text-stone-200">
        <div className="max-w-[45vw] truncate rounded-full border border-white/10 bg-stone-950/50 px-3 py-1 text-xs font-medium text-stone-200 sm:max-w-[28rem]">
          Track: <span className="font-semibold text-stone-100">{audioMeta?.fileName || 'demo-story.wav'}</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span>{formatTime(playerState.currentTime)}</span>
          <span>{formatTime(playerState.duration || 120)}</span>
        </div>
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
          onClick={rewindTenSeconds}
          className="inline-flex h-10 min-w-[4.25rem] items-center justify-center rounded-full border border-white/15 bg-white/10 px-3 text-sm font-semibold text-stone-100 transition hover:bg-white/20"
          aria-label="Rewind 10 seconds"
        >
          -10s
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
          onClick={forwardTenSeconds}
          className="inline-flex h-10 min-w-[4.25rem] items-center justify-center rounded-full border border-white/15 bg-white/10 px-3 text-sm font-semibold text-stone-100 transition hover:bg-white/20"
          aria-label="Forward 10 seconds"
        >
          +10s
        </button>
        <UploadPickerButton
          accept="image/*,video/*,audio/*"
          multiple
          disabled={isUploadingMedia}
          onFilesSelected={onMediaFilesSelected}
          logPrefix="upload_button.media"
          buttonTestId="upload-media-button"
          inputTestId="upload-media-input"
          className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
            isUploadingMedia
              ? 'cursor-wait bg-orange-300/80 text-stone-900'
              : 'cursor-pointer bg-orange-400 text-stone-950 hover:bg-orange-300'
          }`}
        >
          {isUploadingMedia ? <SpinnerIcon /> : null}
          <span>
            {isUploadingMedia ? 'Uploading…' : 'Upload Media'}
          </span>
        </UploadPickerButton>
      </div>
      <AnimatePresence initial={false}>
        {isUploadingMedia ? (
          <motion.div
            className="mt-3 text-center text-xs font-medium uppercase tracking-[0.2em] text-orange-100/85"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            Loading media to Firebase storage. Wait a beat.
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

export function StoryPlayerPanel({
  timeline,
  playerState,
  className = '',
}) {
  const videoRef = useRef(null);
  const lastVideoSyncRef = useRef({
    slideId: '',
    second: -1,
    isPlaying: null,
  });
  const activeSlide = timeline[playerState.activeSlideIndex] ?? timeline[0] ?? {};
  const hasActiveSlide = typeof activeSlide?.src === 'string' && activeSlide.src.length > 0;
  const isActiveVideo = hasActiveSlide && activeSlide.mediaType === 'video';

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const offsetSeconds = Math.max(0, playerState.currentTime - (activeSlide.startTime || 0));
    const boundedOffset = Number.isFinite(activeSlide.spanSeconds)
      ? Math.min(offsetSeconds, activeSlide.spanSeconds)
      : offsetSeconds;

    if (Math.abs((video.currentTime || 0) - boundedOffset) > 0.3) {
      video.currentTime = boundedOffset;
    }

    const syncSecond = Math.floor(boundedOffset);
    if (
      lastVideoSyncRef.current.slideId !== activeSlide.id
      || lastVideoSyncRef.current.second !== syncSecond
      || lastVideoSyncRef.current.isPlaying !== playerState.isPlaying
    ) {
      logEvent('info', 'player.video_sync_updated', {
        slideId: activeSlide.id,
        offsetSeconds: boundedOffset,
        currentTime: playerState.currentTime,
        isPlaying: playerState.isPlaying,
      });
      lastVideoSyncRef.current = {
        slideId: activeSlide.id,
        second: syncSecond,
        isPlaying: playerState.isPlaying,
      };
    }

    if (playerState.isPlaying) {
      video.play().catch(() => {});
      return;
    }

    video.pause();
  }, [
    activeSlide.id,
    activeSlide.mediaType,
    activeSlide.spanSeconds,
    activeSlide.startTime,
    playerState.currentTime,
    playerState.isPlaying,
  ]);

  return (
    <section className="h-full min-h-[100svh]">
      <article className={`scene-shell relative h-full min-h-[100svh] overflow-hidden border-0 bg-stone-900 shadow-2xl shadow-black/40 ${className}`}>
        <div className="absolute inset-0 bg-black" />
        <div className="absolute inset-0 z-10 flex items-center justify-center p-0">
          {hasActiveSlide ? (
            isActiveVideo ? (
              <video
                key={`${activeSlide?.id}-detail`}
                ref={videoRef}
                src={activeSlide.src}
                poster={activeSlide.posterSrc || undefined}
                muted
                playsInline
                preload="auto"
                autoPlay={playerState.isPlaying}
                controls={false}
                data-testid="scene-active-video"
                className="block h-full w-full object-contain object-center"
              />
            ) : (
              <img
                key={`${activeSlide?.id}-detail`}
                src={activeSlide.src}
                alt={activeSlide?.title || 'Story slide'}
                data-testid="scene-active-image"
                className="block h-full w-full object-contain object-center"
              />
            )
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-stone-950 text-sm uppercase tracking-[0.2em] text-stone-500">
              No slide loaded
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
