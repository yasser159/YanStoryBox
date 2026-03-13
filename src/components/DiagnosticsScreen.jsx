import { useDiagnostics } from '../hooks/useDiagnostics';

const levelStyles = {
  info: 'border-sky-400/30 bg-sky-400/10 text-sky-100',
  warn: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
  error: 'border-rose-400/30 bg-rose-400/10 text-rose-100',
};

export function DiagnosticsScreen() {
  const entries = useDiagnostics();

  return (
    <section className="rounded-[2rem] border border-white/10 bg-stone-950/60 p-5 shadow-2xl shadow-black/30 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-orange-300/80">Diagnostics</p>
          <h2 className="text-2xl font-semibold text-stone-50">Chronological log stream</h2>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-stone-300">
          {entries.length} events
        </div>
      </div>

      <div className="max-h-[28rem] space-y-3 overflow-auto pr-1">
        {entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-4 text-stone-400">
            No logs yet.
          </div>
        ) : (
          entries
            .slice()
            .reverse()
            .map((entry) => (
              <article
                key={entry.id}
                className={`rounded-2xl border p-4 ${levelStyles[entry.level] ?? levelStyles.info}`}
              >
                <div className="mb-2 flex items-center justify-between gap-4">
                  <strong className="text-sm uppercase tracking-[0.2em]">{entry.event}</strong>
                  <span className="text-xs opacity-80">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                </div>
                <pre className="overflow-auto whitespace-pre-wrap break-words text-xs text-inherit">
                  {JSON.stringify(entry.details, null, 2)}
                </pre>
              </article>
            ))
        )}
      </div>
    </section>
  );
}
