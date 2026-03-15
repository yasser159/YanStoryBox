import { describe, expect, it } from 'vitest';
import {
  buildWaveformPeaks,
  buildAudioTimeline,
  parseDurationInput,
  placeAudioClipAtTime,
  resolveAudioClipDropStartTime,
} from '../../src/lib/audioComposition';

function clip(id, durationSeconds, desiredStartTime = null) {
  return {
    id,
    title: id,
    fileName: `${id}.mp3`,
    mimeType: 'audio/mpeg',
    createdAt: '2026-03-15T00:00:00.000Z',
    kind: 'upload',
    src: `https://example.com/${id}.mp3`,
    storagePath: `audio/${id}.mp3`,
    durationSeconds,
    desiredStartTime,
  };
}

describe('audio composition helpers', () => {
  it('parses seconds and mm:ss target durations', () => {
    expect(parseDurationInput('90')).toBe(90);
    expect(parseDurationInput('02:15')).toBe(135);
    expect(parseDurationInput('2:75')).toBeNull();
    expect(parseDurationInput('trash')).toBeNull();
  });

  it('normalizes waveform peaks from source samples', () => {
    const peaks = buildWaveformPeaks(Float32Array.from([0, 0.2, -0.4, 0.8, -1, 0.5]), 3);
    expect(peaks).toHaveLength(3);
    expect(Math.max(...peaks)).toBe(1);
    expect(Math.min(...peaks)).toBeGreaterThanOrEqual(0);
  });

  it('builds a non-overlapping timeline and clamps the last clip to target duration', () => {
    const timeline = buildAudioTimeline([
      clip('a', 18, 0),
      clip('b', 20, 15),
      clip('c', 12, 32),
    ], 40);

    expect(timeline.clips.map((item) => ({
      id: item.id,
      startTime: item.startTime,
      endTime: item.endTime,
      clamped: item.clamped,
      shifted: item.shifted,
    }))).toEqual([
      { id: 'a', startTime: 0, endTime: 18, clamped: false, shifted: false },
      { id: 'b', startTime: 18, endTime: 38, clamped: false, shifted: true },
      { id: 'c', startTime: 38, endTime: 40, clamped: true, shifted: true },
    ]);
  });

  it('repositions clips by desired start time and keeps sequencing deterministic', () => {
    const updated = placeAudioClipAtTime([
      clip('a', 10, 0),
      clip('b', 10, 20),
    ], 'b', 5, 40);

    const timeline = buildAudioTimeline(updated, 40);
    expect(timeline.clips.map((item) => item.id)).toEqual(['a', 'b']);
    expect(timeline.clips.map((item) => item.startTime)).toEqual([0, 10]);
  });

  it('keeps uploaded clips unplaced until the user drags them onto the lane', () => {
    const timeline = buildAudioTimeline([
      clip('loose-a', 10, null),
      clip('loose-b', 12, null),
    ], 40);

    expect(timeline.clips).toEqual([]);
  });

  it('resolves dropped audio clips from the clip left edge, not the cursor hotspot', () => {
    expect(resolveAudioClipDropStartTime({
      dropTime: 3,
      dragOffsetSeconds: 2.2,
      targetDurationSeconds: 120,
    })).toBe(0);

    expect(resolveAudioClipDropStartTime({
      dropTime: 35,
      dragOffsetSeconds: 4,
      targetDurationSeconds: 120,
    })).toBe(31);
  });
});
