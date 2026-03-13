import { useEffect, useMemo, useRef, useState } from 'react';
import { buildTimeline } from '../lib/timeline';
import { StoryPlayer } from '../lib/storyPlayer';
import { logEvent } from '../lib/logger';

export function useStoryPlayer({ audioSrc, slides }) {
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
    () => buildTimeline(slides, 120),
    [slides],
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    audio.src = audioSrc;
    audio.preload = 'metadata';

    const player = new StoryPlayer({ audio, timeline });
    playerRef.current = player;
    player.mount();

    const unsubscribe = player.subscribe(setPlayerState);
    logEvent('info', 'hook.player_ready', { audioSrc, slideCount: slides.length });

    return () => {
      unsubscribe();
      player.unmount();
      playerRef.current = null;
    };
  }, [audioSrc]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    player.updateTimeline(timeline);
    logEvent('info', 'hook.timeline_ready', {
      slideCount: timeline.length,
      slideIds: timeline.map((slide) => slide.id),
    });
  }, [timeline]);

  return {
    audioRef,
    playerState,
    timeline,
    togglePlayback: () => playerRef.current?.togglePlayback(),
    pause: () => playerRef.current?.pause(),
  };
}
