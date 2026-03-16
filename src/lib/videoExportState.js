export function createVideoExportState({ supported = true, reason = '' } = {}) {
  return {
    status: supported ? 'idle' : 'unsupported',
    progress: 0,
    error: '',
    downloadUrl: '',
    fileName: '',
    exportPhase: supported ? 'idle' : 'unsupported',
    unsupportedReason: supported ? '' : reason,
  };
}

export function createRenderingExportState(phase = 'preparing') {
  return {
    status: 'rendering',
    progress: 0,
    error: '',
    downloadUrl: '',
    fileName: '',
    exportPhase: phase,
    unsupportedReason: '',
  };
}

export function createReadyExportState({ downloadUrl, fileName }) {
  return {
    status: 'ready',
    progress: 1,
    error: '',
    downloadUrl,
    fileName,
    exportPhase: 'ready',
    unsupportedReason: '',
  };
}

export function createErrorExportState(message) {
  return {
    status: 'error',
    progress: 0,
    error: message,
    downloadUrl: '',
    fileName: '',
    exportPhase: 'idle',
    unsupportedReason: '',
  };
}

export function applyExportPhase(state, phase) {
  return {
    ...state,
    status: 'rendering',
    exportPhase: phase,
  };
}

export function applyExportProgress(state, progress) {
  return {
    ...state,
    status: 'rendering',
    progress,
  };
}
