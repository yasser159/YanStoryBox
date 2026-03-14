import { create } from 'zustand';
import { logEvent } from '../lib/logger';

const LOWER_OVERLAY_TRIGGER_RATIO = 0.58;

function logUiChange(event, details) {
  logEvent('info', event, details);
}

export const usePresentationUiStore = create((set, get) => ({
  showOverlayControls: false,
  overlayPinned: false,
  controlsPinned: false,

  updateOverlayFromPointer(relativeY, height) {
    const nextValue = height > 0 && relativeY >= height * LOWER_OVERLAY_TRIGGER_RATIO;
    if (get().showOverlayControls === nextValue) {
      return;
    }

    logUiChange('ui.overlay_hover_changed', {
      showOverlayControls: nextValue,
      relativeY: Math.round(relativeY),
      height: Math.round(height),
    });

    set({ showOverlayControls: nextValue });
  },

  hideOverlay() {
    const state = get();
    if (state.overlayPinned || state.controlsPinned || !state.showOverlayControls) {
      return;
    }

    logUiChange('ui.overlay_hidden', {
      reason: 'pointer_leave',
    });

    set({ showOverlayControls: false });
  },

  setOverlayPinned(nextValue) {
    if (get().overlayPinned === nextValue) {
      return;
    }

    logUiChange('ui.overlay_pin_changed', {
      overlayPinned: nextValue,
    });

    set({ overlayPinned: nextValue });
  },

  setControlsPinned(nextValue) {
    if (get().controlsPinned === nextValue) {
      return;
    }

    logUiChange('ui.controls_pin_changed', {
      controlsPinned: nextValue,
    });

    set({
      controlsPinned: nextValue,
      showOverlayControls: nextValue ? true : get().showOverlayControls,
    });
  },
}));

export function selectOverlayVisible(state) {
  return state.showOverlayControls || state.overlayPinned || state.controlsPinned;
}
