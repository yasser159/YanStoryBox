import { useEffect, useState } from 'react';
import { logEvent } from '../lib/logger';
import { createVideoExportState } from '../lib/videoExportState';

const NOT_IMPLEMENTED_REASON = 'Video export is not implemented yet.';

export function useVideoExport({ timeline, audioTimeline, durationSeconds, fallbackAudioSrc }) {
  const [exportState, setExportState] = useState(() => createVideoExportState({
    supported: false,
    reason: NOT_IMPLEMENTED_REASON,
  }));

  useEffect(() => {
    logEvent('info', 'export.capability_checked', {
      supported: false,
      reason: NOT_IMPLEMENTED_REASON,
      mimeType: '',
      implementationState: 'not_implemented',
    });
  }, []);

  useEffect(() => () => {
    if (exportState.downloadUrl) {
      URL.revokeObjectURL(exportState.downloadUrl);
    }
  }, [exportState.downloadUrl]);

  const startExport = async () => {
    logEvent('warn', 'export.video_requested_unimplemented', {
      timelineCount: timeline?.length || 0,
      audioClipCount: audioTimeline?.length || 0,
      durationSeconds: Number(durationSeconds) || 0,
      fallbackAudio: Boolean(fallbackAudioSrc),
    });
    setExportState(createVideoExportState({
      supported: false,
      reason: NOT_IMPLEMENTED_REASON,
    }));
  };

  const downloadExport = () => {
    if (!exportState.downloadUrl) {
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = exportState.downloadUrl;
    anchor.download = exportState.fileName || 'yan-story-export.webm';
    anchor.click();
    logEvent('info', 'export.download_requested', {
      fileName: anchor.download,
    });
  };

  return {
    exportState,
    startExport,
    downloadExport,
  };
}
