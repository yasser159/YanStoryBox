import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { DiagnosticsScreen } from './components/DiagnosticsScreen';
import { PhotoManagerPanel } from './components/PhotoManagerPanel';
import { PlayerControlsBar, StagePreview, StoryPlayerPanel } from './components/StoryPlayerPanel';
import { useAudioLibrary } from './hooks/useAudioLibrary';
import { useSlideLibrary } from './hooks/useSlideLibrary';
import { useStoryPlayer } from './hooks/useStoryPlayer';
import { getMediaTypeFromMimeType } from './lib/visualMedia';
import { selectOverlayVisible, usePresentationUiStore } from './stores/usePresentationUiStore';

export default function App() {
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const overlayVisible = usePresentationUiStore(selectOverlayVisible);
  const updateOverlayFromPointer = usePresentationUiStore((state) => state.updateOverlayFromPointer);
  const hideOverlay = usePresentationUiStore((state) => state.hideOverlay);
  const setOverlayPinned = usePresentationUiStore((state) => state.setOverlayPinned);
  const setPlaybackRunning = usePresentationUiStore((state) => state.setPlaybackRunning);
  const {
    audioSrc,
    uploadAudioFiles,
    audioError,
    audioMeta,
    audioClips,
    audioTimeline,
    targetDurationSeconds,
    targetDurationInput,
    setTargetDurationInput,
    saveTargetDuration,
    setAudioClipStartTime,
    clearAudioClipStartTime,
    removeAudioClip,
    isUploadingAudio,
  } = useAudioLibrary();
  const {
    slides,
    uploads,
    uploadFiles,
    reorderSlides,
    setSlideCueTime,
    clearSlideCueTime,
    removeSlide,
    isHydrating,
    isUploadingPhotos,
    persistenceError,
  } = useSlideLibrary();
  const {
    audioRef,
    playerState,
    timeline,
    togglePlayback,
    rewind,
    rewindTenSeconds,
    forwardTenSeconds,
    seekTo,
    timelineDuration,
  } = useStoryPlayer({
    audioSrc,
    audioTimeline,
    durationHint: audioClips.length ? targetDurationSeconds : 0,
    slides,
  });
  const activeSlide = timeline[playerState.activeSlideIndex] ?? timeline[0];
  const isInGap = timeline.length > 0 && activeSlide != null &&
    (playerState.currentTime < activeSlide.startTime || playerState.currentTime >= activeSlide.endTime);

  useEffect(() => {
    setPlaybackRunning(playerState.isPlaying);
  }, [playerState.isPlaying, setPlaybackRunning]);

  const handleStagePointerMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeY = event.clientY - rect.top;
    updateOverlayFromPointer(relativeY, rect.height);
  };

  const handleMediaFilesSelected = async (files) => {
    const allFiles = Array.from(files || []);
    if (!allFiles.length) {
      return;
    }

    const visualFiles = allFiles.filter((file) => Boolean(getMediaTypeFromMimeType(file.type)));
    const audioFiles = allFiles.filter((file) => file.type?.startsWith('audio/'));

    setOverlayPinned(true);
    try {
      if (visualFiles.length) {
        await uploadFiles(visualFiles);
      }
      if (audioFiles.length) {
        await uploadAudioFiles(audioFiles);
      }
    } finally {
      setOverlayPinned(false);
    }
  };

  return (
    <main className="h-[100dvh] min-h-[100svh] w-full overflow-hidden">
      <audio ref={audioRef} />

      <div className="mx-auto h-full max-w-none">
        <section
          className="scene-stage relative h-full overflow-hidden"
          style={{ width: '100%', height: '100dvh' }}
          onMouseMove={handleStagePointerMove}
          onMouseLeave={hideOverlay}
        >
          <StoryPlayerPanel
            playerState={playerState}
            timeline={timeline}
          />
          <motion.div
            className={`media-overlay absolute inset-x-0 z-40 ${
              overlayVisible
                ? 'visible pointer-events-auto'
                : 'invisible pointer-events-none'
            }`}
            style={{
              top: 'max(0.75rem, env(safe-area-inset-top))',
              bottom: 'max(0.75rem, env(safe-area-inset-bottom))',
              width: '100%',
            }}
            initial={false}
            animate={overlayVisible
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: 72 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mx-auto flex h-full w-full max-w-none flex-col gap-4">
              <StagePreview activeSlide={activeSlide} isInGap={isInGap} playerState={playerState} />
              <PlayerControlsBar
                playerState={playerState}
                togglePlayback={togglePlayback}
                rewind={rewind}
                rewindTenSeconds={rewindTenSeconds}
                forwardTenSeconds={forwardTenSeconds}
                onMediaFilesSelected={handleMediaFilesSelected}
                isUploadingMedia={isUploadingPhotos || isUploadingAudio}
                audioMeta={audioMeta}
                showDiagnostics={showDiagnostics}
                onToggleDiagnostics={() => setShowDiagnostics((v) => !v)}
              />
              {showDiagnostics ? (
                <DiagnosticsScreen />
              ) : null}
              <PhotoManagerPanel
                uploads={uploads}
                audioClips={audioClips}
                audioTimeline={audioTimeline}
                targetDurationSeconds={targetDurationSeconds}
                targetDurationInput={targetDurationInput}
                setTargetDurationInput={setTargetDurationInput}
                saveTargetDuration={saveTargetDuration}
                activeSlideId={activeSlide?.id}
                isHydrating={isHydrating}
                persistenceError={persistenceError}
                reorderSlides={reorderSlides}
                setSlideCueTime={setSlideCueTime}
                clearSlideCueTime={clearSlideCueTime}
                removeSlide={removeSlide}
                setAudioClipStartTime={setAudioClipStartTime}
                clearAudioClipStartTime={clearAudioClipStartTime}
                removeAudioClip={removeAudioClip}
                audioError={audioError}
                trackDuration={timelineDuration || playerState.duration}
                currentTime={playerState.currentTime}
                onSeekTimeline={seekTo}
                embedded
                className="media-tray h-full min-h-0"
              />
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}
