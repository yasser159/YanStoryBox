import { useEffect, useMemo, useRef, useState } from 'react';
import { buildTimeline } from '../lib/timeline';
import { StoryPlayer } from '../lib/storyPlayer';
import { logEvent } from '../lib/logger';

export function useStoryPlayer({ audioSrc, audioTimeline, durationHint = 0, slides }) {
  const audioRef = useRef(null);
  const playerRef = useRef(null);
  const [playerState, setPlayerState] = useState({
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    activeSlideIndex: 0,
    status: 'idle',
    error: '',
  });

  const timeline = useMemo(
    () => buildTimeline(slides, durationHint || playerState.duration || 0),
    [durationHint, playerState.duration, slides],
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const player = new StoryPlayer({
      audio,
      timeline,
      audioTimeline,
      fallbackAudioSrc: audioSrc,
      durationHint,
    });
    playerRef.current = player;
    player.mount();

    const unsubscribe = player.subscribe(setPlayerState);
    logEvent('info', 'hook.player_ready', {
      audioSrc,
      slideCount: slides.length,
      audioClipCount: audioTimeline.length,
      durationHint,
    });

    return () => {
      unsubscribe();
      player.unmount();
      playerRef.current = null;
    };
  }, [audioSrc, audioTimeline, durationHint]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    player.updateTimeline(timeline);
    logEvent('info', 'hook.timeline_ready', {
      slideCount: timeline.length,
      slideIds: timeline.map((slide) => slide.id),
    });
  }, [timeline]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    player.updateAudioTimeline(audioTimeline, {
      fallbackAudioSrc: audioSrc,
      durationHint,
    });
    logEvent('info', 'hook.audio_timeline_ready', {
      clipCount: audioTimeline.length,
      clipIds: audioTimeline.map((clip) => clip.id),
      durationHint,
    });
  }, [audioSrc, audioTimeline, durationHint]);

  return {
    audioRef,
    playerState,
    timeline,
    togglePlayback: () => playerRef.current?.togglePlayback(),
    rewind: () => playerRef.current?.rewind(),
    rewindTenSeconds: () => playerRef.current?.rewindTenSeconds(),
    forwardTenSeconds: () => playerRef.current?.forwardTenSeconds(),
    pause: () => playerRef.current?.pause(),
  };
}
