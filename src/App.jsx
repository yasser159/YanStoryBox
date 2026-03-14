import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { PhotoManagerPanel } from './components/PhotoManagerPanel';
import { PlayerControlsBar, StoryPlayerPanel } from './components/StoryPlayerPanel';
import { useAudioLibrary } from './hooks/useAudioLibrary';
import { useSlideLibrary } from './hooks/useSlideLibrary';
import { useStoryPlayer } from './hooks/useStoryPlayer';

export default function App() {
  const [showOverlayControls, setShowOverlayControls] = useState(false);
  const [overlayPinned, setOverlayPinned] = useState(false);
  const {
    audioSrc,
    uploadAudioFile,
    audioError,
    audioMeta,
  } = useAudioLibrary();
  const {
    slides,
    uploads,
    uploadFiles,
    reorderSlides,
    setSlideCueTime,
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
  } = useStoryPlayer({
    audioSrc,
    slides,
  });
  const activeSlide = timeline[playerState.activeSlideIndex] ?? timeline[0];

  const handleStagePointerMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeY = event.clientY - rect.top;
    const lowerTriggerStart = rect.height * 0.58;
    setShowOverlayControls(relativeY >= lowerTriggerStart);
  };

  const handlePhotoFilesSelected = async (files) => {
    setOverlayPinned(true);
    await uploadFiles(files);
    setOverlayPinned(false);
  };

  const handleAudioFilesSelected = async (files) => {
    setOverlayPinned(true);
    const [file] = Array.from(files || []);
    await uploadAudioFile(file);
    setOverlayPinned(false);
  };

  return (
    <main className="h-[100dvh] min-h-[100svh] w-full overflow-hidden">
      <audio ref={audioRef} />

      <div className="mx-auto h-full max-w-none">
        <section
          className="scene-stage relative h-full overflow-hidden"
          style={{ width: '100%', height: '100dvh' }}
          onMouseMove={handleStagePointerMove}
          onMouseLeave={() => {
            if (overlayPinned) {
              return;
            }
            setShowOverlayControls(false);
          }}
        >
          <StoryPlayerPanel
            playerState={playerState}
            timeline={timeline}
          />
          <motion.div
            className={`media-overlay absolute inset-x-0 z-40 ${
              showOverlayControls || overlayPinned
                ? 'visible pointer-events-auto'
                : 'invisible pointer-events-none'
            }`}
            style={{
              top: '55dvh',
              bottom: 'max(0.75rem, env(safe-area-inset-bottom))',
              width: '100%',
            }}
            initial={false}
            animate={showOverlayControls || overlayPinned
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: 72 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mx-auto flex h-full w-full max-w-none flex-col gap-4">
              <PlayerControlsBar
                playerState={playerState}
                togglePlayback={togglePlayback}
                rewind={rewind}
                rewindTenSeconds={rewindTenSeconds}
                forwardTenSeconds={forwardTenSeconds}
                onPhotoFilesSelected={handlePhotoFilesSelected}
                onAudioFilesSelected={handleAudioFilesSelected}
                isUploadingPhotos={isUploadingPhotos}
                audioMeta={audioMeta}
              />
              <PhotoManagerPanel
                uploads={uploads}
                activeSlideId={activeSlide?.id}
                isHydrating={isHydrating}
                persistenceError={persistenceError}
                reorderSlides={reorderSlides}
                setSlideCueTime={setSlideCueTime}
                removeSlide={removeSlide}
                audioError={audioError}
                trackDuration={playerState.duration}
                currentTime={playerState.currentTime}
                embedded
                className="media-tray h-full min-h-0 overflow-auto"
              />
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}
