import { useRef } from 'react';

export function AudioManagerPanel({
  audioMeta,
  audioSourceMode,
  hasUploadedAudio,
  isHydratingAudio,
  audioError,
  uploadAudioFile,
  resetAudio,
}) {
  const fileInputRef = useRef(null);

  const handleAudioChange = async (event) => {
    const [file] = Array.from(event.target.files || []);
    await uploadAudioFile(file);
    event.target.value = '';
  };

  return (
    <article className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-orange-300/80">Audio Manager</p>
          <h2 className="mt-2 text-3xl font-semibold text-stone-50">Upload the soundtrack</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-300">
            Same hustle as the photos: drop in your own audio and the presentation rides with that track instead of the demo joint.
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-stone-950/50 px-4 py-2 text-sm text-stone-300">
          Source: <span className="font-semibold capitalize text-stone-100">{audioSourceMode}</span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center justify-center rounded-full bg-orange-400 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-orange-300"
        >
          Upload Audio
        </button>
        <button
          type="button"
          onClick={resetAudio}
          disabled={!hasUploadedAudio}
          className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-stone-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset To Demo Audio
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleAudioChange}
        />
      </div>

      {audioError ? (
        <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
          {audioError}
        </div>
      ) : null}

      <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-stone-950/40 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-stone-400">{isHydratingAudio ? 'Restoring uploaded audio...' : 'Current track'}</p>
            <h3 className="mt-1 text-xl font-semibold text-stone-50">{audioMeta.title}</h3>
            <p className="mt-1 text-sm text-stone-400">{audioMeta.fileName}</p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-stone-300">
            {audioMeta.mimeType || 'audio/*'}
          </div>
        </div>
      </div>
    </article>
  );
}
