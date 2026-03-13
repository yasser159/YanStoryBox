import { useState } from 'react';
import { AudioManagerPanel } from './components/AudioManagerPanel';
import { DiagnosticsScreen } from './components/DiagnosticsScreen';
import { PhotoManagerPanel } from './components/PhotoManagerPanel';
import { StoryPlayerPanel } from './components/StoryPlayerPanel';
import { useAudioLibrary } from './hooks/useAudioLibrary';
import { useSlideLibrary } from './hooks/useSlideLibrary';
import { useStoryPlayer } from './hooks/useStoryPlayer';

const tabs = ['player', 'diagnostics'];

export default function App() {
  const [activeTab, setActiveTab] = useState('player');
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
        <section className="mb-8 rounded-[2.5rem] border border-white/10 bg-black/25 p-6 shadow-2xl shadow-black/30 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.45em] text-orange-300/80">Yan Story Teller</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-stone-50 sm:text-5xl">
                Play the audio, let the photos ride shotgun.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-300">
                This player keeps the core playback logic separate from the UI, while the diagnostics feed shows every move in chronological order.
              </p>
            </div>

            <div className="flex gap-3">
              {tabs.map((tab) => {
                const selected = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-full px-5 py-2 text-sm font-medium capitalize transition ${
                      selected
                        ? 'bg-orange-400 text-stone-950'
                        : 'border border-white/10 bg-white/5 text-stone-200 hover:bg-white/10'
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {activeTab === 'player' ? (
          <section className="space-y-6">
            <StoryPlayerPanel
              playerState={playerState}
              timeline={timeline}
              togglePlayback={togglePlayback}
              sourceMode={sourceMode}
              audioSourceMode={audioSourceMode}
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
          </section>
        ) : (
          <DiagnosticsScreen />
        )}
      </div>
    </main>
  );
}
