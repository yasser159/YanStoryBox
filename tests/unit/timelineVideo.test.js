import { describe, expect, it } from 'vitest';
import { buildTimeline } from '../../src/lib/timeline';

describe('video timeline spans', () => {
  it('gives pinned videos a span based on their duration', () => {
    const timeline = buildTimeline([
      { id: 'photo-1', mediaType: 'image', cueTime: 0 },
      { id: 'video-1', mediaType: 'video', cueTime: 10, durationSeconds: 6 },
      { id: 'photo-2', mediaType: 'image', cueTime: 25 },
    ], 40);

    const video = timeline.find((item) => item.id === 'video-1');
    expect(video.startTime).toBe(10);
    expect(video.endTime).toBe(16);
    expect(video.spanSeconds).toBe(6);
  });

  it('clamps pinned video spans to the next cue start', () => {
    const timeline = buildTimeline([
      { id: 'video-1', mediaType: 'video', cueTime: 10, durationSeconds: 12 },
      { id: 'photo-2', mediaType: 'image', cueTime: 18 },
    ], 40);

    const video = timeline.find((item) => item.id === 'video-1');
    expect(video.startTime).toBe(10);
    expect(video.endTime).toBe(18);
    expect(video.spanSeconds).toBe(8);
  });

  it('keeps non-pinned media on the even fallback cadence', () => {
    const timeline = buildTimeline([
      { id: 'photo-1', mediaType: 'image' },
      { id: 'video-1', mediaType: 'video', durationSeconds: 4 },
      { id: 'photo-2', mediaType: 'image' },
    ], 30);

    expect(timeline.map((item) => item.startTime)).toEqual([0, 10, 20]);
    expect(timeline[1].spanSeconds).toBe(4);
  });
});
