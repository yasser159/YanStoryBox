import { useRef, useState } from 'react';
import { PhotoManagerPanel } from './components/PhotoManagerPanel';
import { PlayerControlsBar, StoryPlayerPanel } from './components/StoryPlayerPanel';
import { useAudioLibrary } from './hooks/useAudioLibrary';
import { useSlideLibrary } from './hooks/useSlideLibrary';
import { useStoryPlayer } from './hooks/useStoryPlayer';

export default function App() {
  const [showOverlayControls, setShowOverlayControls] = useState(false);
  const [overlayPinned, setOverlayPinned] = useState(false);
  const photoInputRef = useRef(null);
  const audioInputRef = useRef(null);
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
    removeSlide,
    isHydrating,
    isUploadingPhotos,
    persistenceError,
  } = useSlideLibrary();
  const { audioRef, playerState, timeline, togglePlayback, rewind } = useStoryPlayer({
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

  const handlePhotoInputChange = async (event) => {
    setOverlayPinned(true);
    const { files } = event.target;
    await uploadFiles(files);
    event.target.value = '';
    setOverlayPinned(false);
  };

  const handleAudioInputChange = async (event) => {
    setOverlayPinned(true);
    const [file] = Array.from(event.target.files || []);
    await uploadAudioFile(file);
    event.target.value = '';
    setOverlayPinned(false);
  };

  const openPicker = (inputRef) => {
    setOverlayPinned(true);

    const releasePin = () => {
      window.removeEventListener('focus', releasePin);
      window.setTimeout(() => {
        setOverlayPinned(false);
      }, 300);
    };

    window.addEventListener('focus', releasePin, { once: true });
    inputRef.current?.click();
  };

  return (
    <main className="h-[100dvh] min-h-[100svh] w-full overflow-hidden">
      <audio ref={audioRef} />
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handlePhotoInputChange}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleAudioInputChange}
      />

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
          <div
            className={`media-overlay absolute inset-x-0 z-40 transition-all duration-300 ${
              showOverlayControls || overlayPinned
                ? 'visible pointer-events-auto translate-y-0 opacity-100'
                : 'invisible pointer-events-none translate-y-full opacity-0'
            }`}
            style={{
              top: '55dvh',
              bottom: 'max(0.75rem, env(safe-area-inset-bottom))',
              width: '100%',
            }}
          >
            <div className="mx-auto flex h-full w-full max-w-none flex-col gap-4">
              <PlayerControlsBar
                playerState={playerState}
                togglePlayback={togglePlayback}
                rewind={rewind}
                onUploadPhotos={() => openPicker(photoInputRef)}
                onUploadAudio={() => openPicker(audioInputRef)}
                isUploadingPhotos={isUploadingPhotos}
                audioMeta={audioMeta}
              />
              <PhotoManagerPanel
                uploads={uploads}
                activeSlideId={activeSlide?.id}
                isHydrating={isHydrating}
                persistenceError={persistenceError}
                uploadFiles={uploadFiles}
                reorderSlides={reorderSlides}
                removeSlide={removeSlide}
                audioMeta={audioMeta}
                audioError={audioError}
                embedded
                className="media-tray h-full min-h-0 overflow-auto"
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
