import { describe, expect, it } from 'vitest';
import {
  applyExportPhase,
  applyExportProgress,
  createErrorExportState,
  createReadyExportState,
  createRenderingExportState,
  createVideoExportState,
} from '../../src/lib/videoExportState';

describe('video export state helpers', () => {
  it('starts idle when export is supported', () => {
    const state = createVideoExportState({ supported: true });

    expect(state.status).toBe('idle');
    expect(state.exportPhase).toBe('idle');
    expect(state.unsupportedReason).toBe('');
  });

  it('starts unsupported when export is unavailable', () => {
    const state = createVideoExportState({
      supported: false,
      reason: 'MediaRecorder is missing.',
    });

    expect(state.status).toBe('unsupported');
    expect(state.exportPhase).toBe('unsupported');
    expect(state.unsupportedReason).toBe('MediaRecorder is missing.');
  });

  it('moves from rendering to ready', () => {
    const rendering = createRenderingExportState('preparing');
    const progressState = applyExportProgress(
      applyExportPhase(rendering, 'rendering'),
      0.66,
    );
    const ready = createReadyExportState({
      downloadUrl: 'blob:video',
      fileName: 'story.webm',
    });

    expect(progressState.status).toBe('rendering');
    expect(progressState.exportPhase).toBe('rendering');
    expect(progressState.progress).toBe(0.66);
    expect(ready.status).toBe('ready');
    expect(ready.fileName).toBe('story.webm');
  });

  it('moves from rendering to error', () => {
    const rendering = createRenderingExportState('loading-assets');
    const errored = createErrorExportState('Asset decode blew up.');

    expect(rendering.status).toBe('rendering');
    expect(rendering.exportPhase).toBe('loading-assets');
    expect(errored.status).toBe('error');
    expect(errored.error).toBe('Asset decode blew up.');
  });
});
