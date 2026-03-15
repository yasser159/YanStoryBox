import { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';

function densifyPeaks(peaks, targetLength = 256) {
  const safePeaks = Array.isArray(peaks) ? peaks.filter((value) => Number.isFinite(value)) : [];
  if (safePeaks.length <= 1 || safePeaks.length >= targetLength) {
    return safePeaks;
  }

  const expanded = [];
  for (let index = 0; index < targetLength; index += 1) {
    const position = (index / (targetLength - 1)) * (safePeaks.length - 1);
    const leftIndex = Math.floor(position);
    const rightIndex = Math.min(safePeaks.length - 1, Math.ceil(position));
    const blend = position - leftIndex;
    const left = safePeaks[leftIndex];
    const right = safePeaks[rightIndex];
    expanded.push(left + ((right - left) * blend));
  }

  return expanded;
}

function exaggeratePeaks(peaks, curve = 2.75) {
  const safePeaks = Array.isArray(peaks) ? peaks.filter((value) => Number.isFinite(value)) : [];
  return safePeaks.map((peak) => {
    const normalized = Math.max(0, peak);
    return Math.min(1, Math.pow(normalized, curve));
  });
}

export function AudioWaveformPreview({ peaks, durationSeconds, className = '' }) {
  const containerRef = useRef(null);
  const waveSurferRef = useRef(null);

  useEffect(() => {
    const safePeaks = exaggeratePeaks(densifyPeaks(peaks));
    const safeDuration = Number.isFinite(durationSeconds) ? durationSeconds : 0;

    if (!containerRef.current || !safePeaks.length || !(safeDuration > 0)) {
      return undefined;
    }

    const waveSurfer = WaveSurfer.create({
      container: containerRef.current,
      peaks: [safePeaks],
      duration: safeDuration,
      interact: false,
      cursorWidth: 0,
      normalize: false,
      barWidth: 1,
      barGap: 0,
      barRadius: 999,
      waveColor: '#6b7280',
      progressColor: '#6b7280',
      height: 56,
      hideScrollbar: true,
    });

    waveSurferRef.current = waveSurfer;

    return () => {
      waveSurfer.destroy();
      waveSurferRef.current = null;
    };
  }, [durationSeconds, peaks]);

  if (!Array.isArray(peaks) || !peaks.length || !(durationSeconds > 0)) {
    return (
      <div className={`flex h-full items-center ${className}`}>
        <span className="w-full border-t border-dashed border-slate-300/35" />
      </div>
    );
  }

  return (
    <div className={`pointer-events-none h-full w-full overflow-hidden rounded-md ${className}`}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
