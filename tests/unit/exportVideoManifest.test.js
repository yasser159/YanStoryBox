import { describe, expect, it } from 'vitest';
import { buildExportVideoManifest } from '../../src/lib/exportVideoManifest';

describe('buildExportVideoManifest', () => {
  it('builds visual and audio export entries from the current timelines', () => {
    const manifest = buildExportVideoManifest({
      durationSeconds: 48,
      fallbackAudioSrc: '/audio/demo-story.wav',
      timeline: [
        { id: 'slide-1', mediaType: 'image', src: '/one.png', startTime: 0, endTime: 12, spanSeconds: 12 },
        { id: 'video-1', mediaType: 'video', src: '/two.mp4', posterSrc: '/two.jpg', startTime: 12, endTime: 20, spanSeconds: 8 },
      ],
      audioTimeline: [
        { id: 'clip-1', src: '/clip-1.wav', startTime: 0, endTime: 18 },
      ],
    });

    expect(manifest.durationSeconds).toBe(48);
    expect(manifest.visuals).toHaveLength(2);
    expect(manifest.audioClips).toHaveLength(1);
    expect(manifest.audioClips[0]).toMatchObject({
      id: 'clip-1',
      src: '/clip-1.wav',
      startTime: 0,
      endTime: 18,
    });
  });

  it('falls back to demo audio only when no placed audio clips exist', () => {
    const manifest = buildExportVideoManifest({
      durationSeconds: 30,
      fallbackAudioSrc: '/audio/demo-story.wav',
      timeline: [
        { id: 'slide-1', mediaType: 'image', src: '/one.png', startTime: 0, endTime: 30, spanSeconds: 30 },
      ],
      audioTimeline: [],
    });

    expect(manifest.audioClips).toEqual([]);
    expect(manifest.fallbackAudioSrc).toBe('/audio/demo-story.wav');
  });

  it('throws when there are no visuals to export', () => {
    expect(() => buildExportVideoManifest({
      durationSeconds: 30,
      fallbackAudioSrc: '/audio/demo-story.wav',
      timeline: [],
      audioTimeline: [],
    })).toThrow('Add at least one photo or video before exporting.');
  });

  it('derives a positive duration from the last timed visual when needed', () => {
    const manifest = buildExportVideoManifest({
      durationSeconds: 0,
      timeline: [
        { id: 'slide-1', mediaType: 'image', src: '/one.png', startTime: 0, endTime: 9, spanSeconds: 9 },
      ],
      audioTimeline: [],
    });

    expect(manifest.durationSeconds).toBe(9);
  });

  it('drops fallback audio when placed audio clips already exist', () => {
    const manifest = buildExportVideoManifest({
      durationSeconds: 30,
      fallbackAudioSrc: '/audio/demo-story.wav',
      timeline: [
        { id: 'slide-1', mediaType: 'image', src: '/one.png', startTime: 0, endTime: 30, spanSeconds: 30 },
      ],
      audioTimeline: [
        { id: 'clip-1', src: '/clip-1.wav', startTime: 0, endTime: 18 },
      ],
    });

    expect(manifest.audioClips).toHaveLength(1);
    expect(manifest.fallbackAudioSrc).toBe('');
  });
});
