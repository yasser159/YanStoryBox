import { PhotoManagerPanel } from './components/PhotoManagerPanel';
import { StoryPlayerPanel } from './components/StoryPlayerPanel';
import { useAudioLibrary } from './hooks/useAudioLibrary';
import { useSlideLibrary } from './hooks/useSlideLibrary';
import { useStoryPlayer } from './hooks/useStoryPlayer';

export default function App() {
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
    persistenceError,
  } = useSlideLibrary();
  const { audioRef, playerState, timeline, togglePlayback, rewind } = useStoryPlayer({
    audioSrc,
    slides,
  });
  const activeSlide = timeline[playerState.activeSlideIndex] ?? timeline[0];

  return (
    <main className="min-h-screen">
      <audio ref={audioRef} />

      <div className="mx-auto min-h-screen max-w-none">
        <section className="group relative min-h-screen overflow-hidden">
          <StoryPlayerPanel
            playerState={playerState}
            timeline={timeline}
            togglePlayback={togglePlayback}
            rewind={rewind}
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
            uploadAudioFile={uploadAudioFile}
            className="pointer-events-none absolute inset-x-0 bottom-0 z-30 mx-auto w-full max-w-6xl px-4 pb-4 translate-y-6 opacity-0 transition-all duration-300 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 sm:px-6 sm:pb-6"
          />
        </section>
      </div>
    </main>
  );
}
