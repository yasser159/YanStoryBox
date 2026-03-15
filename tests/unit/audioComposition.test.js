import { describe, expect, it } from 'vitest';
import {
  autoPlaceAudioClipsSequentially,
  buildAudioTimeline,
  parseDurationInput,
  placeAudioClipAtTime,
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

  it('auto places uploaded clips sequentially to fill the target duration', () => {
    const placed = autoPlaceAudioClipsSequentially(
      [clip('existing', 12, 0)],
      [clip('new-a', 15), clip('new-b', 20)],
      40,
    );

    expect(placed.map((item) => item.desiredStartTime)).toEqual([12, 27]);
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
});
