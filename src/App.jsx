import { AudioManagerPanel } from './components/AudioManagerPanel';
import { DiagnosticsScreen } from './components/DiagnosticsScreen';
import { PhotoManagerPanel } from './components/PhotoManagerPanel';
import { StoryPlayerPanel } from './components/StoryPlayerPanel';
import { useAudioLibrary } from './hooks/useAudioLibrary';
import { useSlideLibrary } from './hooks/useSlideLibrary';
import { useStoryPlayer } from './hooks/useStoryPlayer';

export default function App() {
  const {
    audioSrc,
    audioMeta,
    hasUploadedAudio,
    audioSourceMode,
    uploadAudioFile,
    resetAudio,
    isHydratingAudio,
    audioError,
  } = useAudioLibrary();
  const {
    slides,
    uploads,
    hasUploads,
    sourceMode,
    uploadFiles,
    reorderSlides,
    removeSlide,
    resetUploads,
    isHydrating,
    persistenceError,
  } = useSlideLibrary();
  const { audioRef, playerState, timeline, togglePlayback } = useStoryPlayer({
    audioSrc,
    slides,
  });
  const activeSlide = timeline[playerState.activeSlideIndex] ?? timeline[0];

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-10">
      <audio ref={audioRef} />

      <div className="mx-auto max-w-7xl">
        <section className="space-y-6">
          <StoryPlayerPanel
            playerState={playerState}
            timeline={timeline}
            togglePlayback={togglePlayback}
          />
          <AudioManagerPanel
            audioMeta={audioMeta}
            audioSourceMode={audioSourceMode}
            hasUploadedAudio={hasUploadedAudio}
            isHydratingAudio={isHydratingAudio}
            audioError={audioError}
            uploadAudioFile={uploadAudioFile}
            resetAudio={resetAudio}
          />
          <PhotoManagerPanel
            uploads={uploads}
            activeSlideId={activeSlide?.id}
            hasUploads={hasUploads}
            isHydrating={isHydrating}
            persistenceError={persistenceError}
            sourceMode={sourceMode}
            uploadFiles={uploadFiles}
            reorderSlides={reorderSlides}
            removeSlide={removeSlide}
            resetUploads={resetUploads}
          />
          <DiagnosticsScreen />
        </section>
      </div>
    </main>
  );
}
