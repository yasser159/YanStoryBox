import { describe, expect, it } from 'vitest';
import {
  buildMediaItem,
  getMediaTypeFromMimeType,
  MAX_VIDEO_DURATION_SECONDS,
  validateVideoDurationSeconds,
} from '../../src/lib/visualMedia';

describe('visual media helpers', () => {
  it('detects image and video mime types', () => {
    expect(getMediaTypeFromMimeType('image/png')).toBe('image');
    expect(getMediaTypeFromMimeType('video/mp4')).toBe('video');
    expect(getMediaTypeFromMimeType('application/pdf')).toBeNull();
  });

  it('validates short video durations against the max length', () => {
    expect(validateVideoDurationSeconds(4)).toBe(true);
    expect(validateVideoDurationSeconds(MAX_VIDEO_DURATION_SECONDS)).toBe(true);
    expect(validateVideoDurationSeconds(MAX_VIDEO_DURATION_SECONDS + 0.1)).toBe(false);
    expect(validateVideoDurationSeconds(0)).toBe(false);
  });

  it('normalizes uploaded video records with video-specific fields', () => {
    const item = buildMediaItem({
      id: 'video-1',
      file: { name: 'teaser.mp4', type: 'video/mp4' },
      src: 'https://cdn.example.com/teaser.mp4',
      storagePath: 'videos/teaser.mp4',
      storageMode: 'remote',
      mediaType: 'video',
      durationSeconds: 8,
      posterSrc: 'data:image/jpeg;base64,poster',
      createdAt: '2026-03-15T00:00:00.000Z',
    });

    expect(item).toMatchObject({
      id: 'video-1',
      title: 'teaser',
      mediaType: 'video',
      durationSeconds: 8,
      posterSrc: 'data:image/jpeg;base64,poster',
      mimeType: 'video/mp4',
      fileName: 'teaser.mp4',
    });
  });
});
