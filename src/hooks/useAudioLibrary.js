import { useEffect, useRef, useState } from 'react';
import { storyAudio } from '../data/storyMedia';
import { logEvent } from '../lib/logger';
import {
  clearAudio,
  loadAudio,
  revokeAudioUrl,
  saveAudio,
} from '../lib/audioLibraryStorage';

function deriveAudioTitle(fileName) {
  return fileName.replace(/\.[^.]+$/, '') || 'Uploaded audio';
}

function createUploadedAudio(file) {
  return {
    id: 'presentation-audio',
    title: deriveAudioTitle(file.name),
    fileName: file.name,
    mimeType: file.type,
    createdAt: new Date().toISOString(),
    kind: 'upload',
    blob: file,
    src: URL.createObjectURL(file),
  };
}

export function useAudioLibrary() {
  const [uploadedAudio, setUploadedAudio] = useState(null);
  const [isHydratingAudio, setIsHydratingAudio] = useState(true);
  const [audioError, setAudioError] = useState('');
  const audioRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    logEvent('info', 'presentation_audio.persist_hydrate_started');

    loadAudio()
      .then((audio) => {
        if (cancelled) {
          revokeAudioUrl(audio);
          return;
        }

        setUploadedAudio(audio);
        setAudioError('');
        logEvent('info', 'presentation_audio.persist_hydrate_succeeded', {
          hasUpload: Boolean(audio),
          fileName: audio?.fileName || '',
        });
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Failed to restore uploaded audio.';
        setUploadedAudio(null);
        setAudioError(message);
        logEvent('error', 'presentation_audio.persist_hydrate_failed', { message });
      })
      .finally(() => {
        if (!cancelled) {
          setIsHydratingAudio(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    audioRef.current = uploadedAudio;
  }, [uploadedAudio]);

  useEffect(() => () => {
    revokeAudioUrl(audioRef.current);
  }, []);

  const uploadAudioFile = async (file) => {
    if (!file) return;

    logEvent('info', 'presentation_audio.upload_started', {
      fileName: file.name,
      mimeType: file.type,
    });

    if (!file.type.startsWith('audio/')) {
      const message = 'Only audio files are supported.';
      setAudioError(message);
      logEvent('warn', 'presentation_audio.upload_failed', {
        fileName: file.name,
        reason: 'Unsupported file type',
      });
      return;
    }

    const nextAudio = createUploadedAudio(file);
    const previousAudio = uploadedAudio;

    try {
      setUploadedAudio(nextAudio);
      await saveAudio(nextAudio);
      setAudioError('');
      if (previousAudio) {
        revokeAudioUrl(previousAudio);
      }
      logEvent('info', 'presentation_audio.upload_succeeded', {
        fileName: file.name,
        mimeType: file.type,
      });
    } catch (error) {
      setUploadedAudio(previousAudio);
      revokeAudioUrl(nextAudio);
      const message = error instanceof Error ? error.message : 'Failed to store uploaded audio.';
      setAudioError(message);
      logEvent('error', 'presentation_audio.upload_failed', { fileName: file.name, message });
    }
  };

  const resetAudio = async () => {
    const previousAudio = uploadedAudio;
    setUploadedAudio(null);

    try {
      await clearAudio();
      setAudioError('');
      revokeAudioUrl(previousAudio);
      logEvent('info', 'presentation_audio.reset_to_demo', {
        hadUpload: Boolean(previousAudio),
      });
    } catch (error) {
      setUploadedAudio(previousAudio);
      const message = error instanceof Error ? error.message : 'Failed to reset uploaded audio.';
      setAudioError(message);
      logEvent('error', 'presentation_audio.reset_failed', { message });
    }
  };

  return {
    audioSrc: uploadedAudio?.src || storyAudio,
    audioMeta: uploadedAudio || {
      id: 'demo-audio',
      title: 'Demo Story Audio',
      fileName: 'demo-story.wav',
      mimeType: 'audio/wav',
      createdAt: '',
      kind: 'demo',
      src: storyAudio,
    },
    hasUploadedAudio: Boolean(uploadedAudio),
    audioSourceMode: uploadedAudio ? 'upload' : 'demo',
    uploadAudioFile,
    resetAudio,
    isHydratingAudio,
    audioError,
  };
}
