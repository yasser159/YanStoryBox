import { describe, expect, it } from 'vitest';
import { canRemoveCueFromTimeline } from '../../src/lib/cueRemoval';

describe('canRemoveCueFromTimeline', () => {
  it('allows removing a pinned cue when the dragged cue matches the slide id', () => {
    expect(canRemoveCueFromTimeline({
      slideId: 'slide-1',
      cueTime: 18,
      draggedId: 'slide-1',
    })).toBe(true);
  });

  it('blocks removal when the cue is not manually pinned', () => {
    expect(canRemoveCueFromTimeline({
      slideId: 'slide-1',
      cueTime: null,
      draggedId: 'slide-1',
    })).toBe(false);
  });

  it('blocks removal when another slide is being dragged', () => {
    expect(canRemoveCueFromTimeline({
      slideId: 'slide-1',
      cueTime: 18,
      draggedId: 'slide-2',
    })).toBe(false);
  });

  it('blocks removal when nothing is being dragged', () => {
    expect(canRemoveCueFromTimeline({
      slideId: 'slide-1',
      cueTime: 18,
      draggedId: '',
    })).toBe(false);
  });

  it('blocks removal when the slide id is missing', () => {
    expect(canRemoveCueFromTimeline({
      slideId: '',
      cueTime: 18,
      draggedId: 'slide-1',
    })).toBe(false);
  });
});
