import { create } from 'zustand';
import { logEvent } from '../lib/logger';

const PLAYBACK_REVEAL_WINDOW_MS = 4000;

let overlayHideTimer = null;

function clearOverlayHideTimer() {
  if (overlayHideTimer) {
    clearTimeout(overlayHideTimer);
    overlayHideTimer = null;
  }
}

function scheduleOverlayHide() {
  clearOverlayHideTimer();
  overlayHideTimer = setTimeout(() => {
    const state = usePresentationUiStore.getState();
    if (state.overlayPinned || state.controlsPinned || !state.isPlaybackRunning) {
      return;
    }

    logUiChange('ui.overlay_hidden', {
      reason: 'playback_idle_timeout',
      timeoutMs: PLAYBACK_REVEAL_WINDOW_MS,
    });

    usePresentationUiStore.setState({ showOverlayControls: false });
  }, PLAYBACK_REVEAL_WINDOW_MS);
}

function logUiChange(event, details) {
  logEvent('info', event, details);
}

export const usePresentationUiStore = create((set, get) => ({
  showOverlayControls: true,
  overlayPinned: false,
  controlsPinned: false,
  isPlaybackRunning: false,

  updateOverlayFromPointer(relativeY, height) {
    const state = get();
    if (!state.isPlaybackRunning) {
      if (!state.showOverlayControls) {
        logUiChange('ui.overlay_shown', {
          reason: 'playback_not_running',
        });
        set({ showOverlayControls: true });
      }
      return;
    }

    if (!state.showOverlayControls) {
      logUiChange('ui.overlay_shown', {
        reason: 'playback_pointer_activity',
        relativeY: Math.round(relativeY),
        height: Math.round(height),
      });
      set({ showOverlayControls: true });
    }

    scheduleOverlayHide();
  },

  setPlaybackRunning(nextValue) {
    const state = get();
    if (state.isPlaybackRunning === nextValue) {
      return;
    }

    logUiChange('ui.playback_visibility_mode_changed', {
      isPlaybackRunning: nextValue,
      controlsPinned: state.controlsPinned,
      overlayPinned: state.overlayPinned,
    });

    clearOverlayHideTimer();

    if (!nextValue) {
      set({
        isPlaybackRunning: false,
        showOverlayControls: true,
      });
      return;
    }

    const shouldStayVisible = state.controlsPinned || state.overlayPinned;
    set({
      isPlaybackRunning: true,
      showOverlayControls: shouldStayVisible,
    });

    if (shouldStayVisible) {
      return;
    }

    logUiChange('ui.overlay_hidden', {
      reason: 'playback_started',
    });
  },

  hideOverlay() {
    const state = get();
    if (!state.isPlaybackRunning || state.overlayPinned || state.controlsPinned) {
      if (!state.showOverlayControls) {
        set({ showOverlayControls: true });
      }
      return;
    }

    scheduleOverlayHide();
  },

  setOverlayPinned(nextValue) {
    const state = get();
    if (state.overlayPinned === nextValue) {
      return;
    }

    logUiChange('ui.overlay_pin_changed', {
      overlayPinned: nextValue,
    });

    clearOverlayHideTimer();

    set({
      overlayPinned: nextValue,
      showOverlayControls: nextValue ? true : state.isPlaybackRunning ? state.controlsPinned : true,
    });

    if (!nextValue && state.isPlaybackRunning && !state.controlsPinned) {
      scheduleOverlayHide();
    }
  },

  setControlsPinned(nextValue) {
    const state = get();
    if (state.controlsPinned === nextValue) {
      return;
    }

    logUiChange('ui.controls_pin_changed', {
      controlsPinned: nextValue,
      isPlaybackRunning: state.isPlaybackRunning,
    });

    clearOverlayHideTimer();

    set({
      controlsPinned: nextValue,
      showOverlayControls: nextValue ? true : state.isPlaybackRunning ? state.overlayPinned : true,
    });

    if (!nextValue && state.isPlaybackRunning && !state.overlayPinned) {
      scheduleOverlayHide();
    }
  },
}));

export function selectOverlayVisible(state) {
  return state.showOverlayControls || state.overlayPinned || state.controlsPinned;
}
