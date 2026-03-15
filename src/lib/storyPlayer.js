import { getSlideIndexForTime } from './timeline';
import { logEvent } from './logger';

function getActiveAudioClip(audioTimeline, currentTime) {
  return audioTimeline.find((clip) => currentTime >= clip.startTime && currentTime < clip.endTime) || null;
}

function getNextAudioClip(audioTimeline, currentTime) {
  return audioTimeline.find((clip) => clip.startTime >= currentTime) || null;
}

export class StoryPlayer {
  constructor({ audio, timeline, audioTimeline = [], fallbackAudioSrc = '', durationHint = 0 }) {
    this.audio = audio;
    this.timeline = timeline;
    this.audioTimeline = audioTimeline;
    this.fallbackAudioSrc = fallbackAudioSrc;
    this.durationHint = durationHint;
    this.listeners = new Set();
    this.activeAudioClip = null;
    this.pendingAudioSync = null;
    this.clockFrame = null;
    this.clockStartedAtMs = null;
    this.state = {
      currentTime: 0,
      duration: durationHint || audio.duration || 0,
      isPlaying: false,
      activeSlideIndex: 0,
      activeAudioClipId: audioTimeline[0]?.id || '',
      status: 'idle',
      error: '',
    };

    this.handleLoadedMetadata = this.handleLoadedMetadata.bind(this);
    this.handleTimeUpdate = this.handleTimeUpdate.bind(this);
    this.handlePlay = this.handlePlay.bind(this);
    this.handlePause = this.handlePause.bind(this);
    this.handleEnded = this.handleEnded.bind(this);
    this.handleError = this.handleError.bind(this);
    this.tickClock = this.tickClock.bind(this);
  }

  isComposedMode() {
    return Boolean(this.durationHint > 0 && (this.audioTimeline.length > 0 || !this.fallbackAudioSrc));
  }

  getDuration() {
    return this.durationHint || this.audio.duration || this.state.duration || 0;
  }

  updateTimeline(timeline) {
    this.timeline = timeline;
    const activeSlideIndex = getSlideIndexForTime(this.timeline, this.state.currentTime);
    logEvent('info', 'player.timeline_updated', {
      slideCount: this.timeline.length,
      activeSlideIndex,
      currentTime: this.state.currentTime,
    });
    this.setState({ activeSlideIndex });
  }

  updateAudioTimeline(audioTimeline, { fallbackAudioSrc = this.fallbackAudioSrc, durationHint = this.durationHint } = {}) {
    this.audioTimeline = audioTimeline;
    this.fallbackAudioSrc = fallbackAudioSrc;
    this.durationHint = durationHint;

    const nextDuration = this.getDuration();
    const activeAudioClip = getActiveAudioClip(this.audioTimeline, this.state.currentTime);

    logEvent('info', 'player.audio_timeline_updated', {
      clipCount: this.audioTimeline.length,
      duration: nextDuration,
      activeAudioClipId: activeAudioClip?.id || '',
      currentTime: this.state.currentTime,
      composedMode: this.isComposedMode(),
    });

    this.setState({
      duration: nextDuration,
      activeAudioClipId: activeAudioClip?.id || '',
    });

    if (this.isComposedMode()) {
      this.syncAudioForTime(this.state.currentTime, { autoplay: this.state.isPlaying, force: true });
      if (this.state.isPlaying) {
        this.startClock(this.state.currentTime);
      }
      return;
    }

    this.stopClock();
    if (this.fallbackAudioSrc) {
      this.audio.src = this.fallbackAudioSrc;
      this.audio.preload = 'metadata';
    }
  }

  mount() {
    if (!this.isComposedMode() && this.fallbackAudioSrc) {
      this.audio.src = this.fallbackAudioSrc;
      this.audio.preload = 'metadata';
    }

    this.audio.addEventListener('loadedmetadata', this.handleLoadedMetadata);
    this.audio.addEventListener('timeupdate', this.handleTimeUpdate);
    this.audio.addEventListener('play', this.handlePlay);
    this.audio.addEventListener('pause', this.handlePause);
    this.audio.addEventListener('ended', this.handleEnded);
    this.audio.addEventListener('error', this.handleError);

    logEvent('info', 'player.mounted', {
      duration: this.audio.duration || 0,
      slideCount: this.timeline.length,
      composedMode: this.isComposedMode(),
    });

    this.emit();
  }

  unmount() {
    this.stopClock();
    this.audio.removeEventListener('loadedmetadata', this.handleLoadedMetadata);
    this.audio.removeEventListener('timeupdate', this.handleTimeUpdate);
    this.audio.removeEventListener('play', this.handlePlay);
    this.audio.removeEventListener('pause', this.handlePause);
    this.audio.removeEventListener('ended', this.handleEnded);
    this.audio.removeEventListener('error', this.handleError);

    logEvent('info', 'player.unmounted');
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  emit() {
    for (const listener of this.listeners) {
      listener({ ...this.state });
    }
  }

  setState(nextState) {
    this.state = { ...this.state, ...nextState };
    this.emit();
  }

  startClock(fromTime = this.state.currentTime) {
    this.stopClock();
    this.clockStartedAtMs = performance.now() - (fromTime * 1000);
    this.clockFrame = requestAnimationFrame(this.tickClock);
    logEvent('info', 'player.clock_started', {
      fromTime,
      duration: this.getDuration(),
    });
  }

  stopClock() {
    if (this.clockFrame) {
      cancelAnimationFrame(this.clockFrame);
      this.clockFrame = null;
    }
    this.clockStartedAtMs = null;
  }

  tickClock() {
    if (!this.state.isPlaying) {
      this.stopClock();
      return;
    }

    const duration = this.getDuration();
    const nextTime = duration > 0
      ? Math.min(duration, Math.max(0, (performance.now() - this.clockStartedAtMs) / 1000))
      : Math.max(0, (performance.now() - this.clockStartedAtMs) / 1000);

    this.updateGlobalTime(nextTime, { autoplayAudio: true });

    if (duration > 0 && nextTime >= duration - 0.016) {
      this.stopClock();
      this.audio.pause();
      this.setState({
        currentTime: duration,
        activeSlideIndex: getSlideIndexForTime(this.timeline, duration),
        activeAudioClipId: '',
        isPlaying: false,
        status: 'ended',
      });
      logEvent('info', 'player.clock_ended', { duration });
      return;
    }

    this.clockFrame = requestAnimationFrame(this.tickClock);
  }

  updateGlobalTime(currentTime, { autoplayAudio = false } = {}) {
    const activeSlideIndex = getSlideIndexForTime(this.timeline, currentTime);

    if (this.isComposedMode()) {
      this.syncAudioForTime(currentTime, { autoplay: autoplayAudio });
    }

    this.setState({
      currentTime,
      activeSlideIndex,
      activeAudioClipId: this.isComposedMode() ? (getActiveAudioClip(this.audioTimeline, currentTime)?.id || '') : this.state.activeAudioClipId,
    });
  }

  handleLoadedMetadata() {
    if (this.isComposedMode() && this.pendingAudioSync) {
      const offset = Math.min(
        Math.max(0, this.pendingAudioSync.offset),
        Math.max(0, this.audio.duration || this.pendingAudioSync.spanSeconds || this.pendingAudioSync.offset),
      );
      this.audio.currentTime = offset;
      logEvent('info', 'player.audio_clip_source_swapped', {
        clipId: this.pendingAudioSync.clipId,
        offsetSeconds: offset,
        autoplay: this.pendingAudioSync.autoplay,
      });

      if (this.pendingAudioSync.autoplay) {
        this.audio.play().catch((error) => {
          logEvent('error', 'player.audio_clip_sync_failed', {
            clipId: this.pendingAudioSync?.clipId || '',
            message: error instanceof Error ? error.message : 'Audio clip play failed',
          });
        });
      }
      this.pendingAudioSync = null;
    }

    const duration = this.isComposedMode()
      ? this.getDuration()
      : (this.audio.duration || 0);
    logEvent('info', 'audio.metadata_loaded', { duration, composedMode: this.isComposedMode() });
    this.setState({ duration, status: 'ready' });
  }

  handleTimeUpdate() {
    if (this.isComposedMode()) {
      return;
    }

    const currentTime = this.audio.currentTime || 0;
    const activeSlideIndex = getSlideIndexForTime(this.timeline, currentTime);
    this.setState({ currentTime, activeSlideIndex });
  }

  handlePlay() {
    if (this.isComposedMode()) {
      logEvent('info', 'player.audio_clip_started', {
        clipId: this.activeAudioClip?.id || '',
        currentTime: this.state.currentTime,
      });
      return;
    }

    logEvent('info', 'audio.play');
    this.setState({ isPlaying: true, status: 'playing', error: '' });
  }

  handlePause() {
    if (this.isComposedMode()) {
      logEvent('info', 'player.audio_clip_paused', {
        clipId: this.activeAudioClip?.id || '',
        currentTime: this.state.currentTime,
      });
      return;
    }

    logEvent('info', 'audio.pause', { currentTime: this.audio.currentTime || 0 });
    this.setState({ isPlaying: false, status: 'paused' });
  }

  handleEnded() {
    if (this.isComposedMode()) {
      logEvent('info', 'player.audio_clip_ended', {
        clipId: this.activeAudioClip?.id || '',
        currentTime: this.state.currentTime,
      });
      return;
    }

    logEvent('info', 'audio.ended');
    this.setState({
      isPlaying: false,
      status: 'ended',
      currentTime: this.durationHint || this.audio.duration || this.state.currentTime,
      activeSlideIndex: this.timeline.length - 1,
      activeAudioClipId: '',
    });
  }

  handleError() {
    const message = this.audio.error?.message || 'Audio playback failed';
    logEvent('error', this.isComposedMode() ? 'player.audio_clip_sync_failed' : 'audio.error', {
      clipId: this.activeAudioClip?.id || '',
      message,
    });
    this.stopClock();
    this.setState({ error: message, status: 'error', isPlaying: false });
  }

  async play() {
    logEvent('info', 'player.play_requested', {
      composedMode: this.isComposedMode(),
      placedClipCount: this.audioTimeline.length,
    });

    if (this.isComposedMode()) {
      if (!this.audioTimeline.length) {
        logEvent('warn', 'player.audio_lane_idle', {
          placedClipCount: this.audioTimeline.length,
          reason: 'no_placed_audio_clips',
        });
      }
      this.setState({ isPlaying: true, status: 'playing', error: '' });
      this.startClock(this.state.currentTime);
      this.updateGlobalTime(this.state.currentTime, { autoplayAudio: true });
      return;
    }

    try {
      await this.audio.play();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Play request failed';
      logEvent('error', 'player.play_rejected', { message });
      this.setState({ error: message, status: 'error', isPlaying: false });
    }
  }

  pause() {
    logEvent('info', 'player.pause_requested');
    this.stopClock();
    this.audio.pause();
    this.setState({ isPlaying: false, status: 'paused' });
  }

  rewind() {
    logEvent('info', 'player.rewind_requested', {
      previousTime: this.state.currentTime,
    });
    this.seekTo(0);
    this.setState({
      status: this.state.isPlaying ? this.state.status : 'ready',
      error: '',
    });
  }

  seekBy(deltaSeconds) {
    const previousTime = this.state.currentTime;
    const duration = this.getDuration();
    const nextTime = Math.min(
      Math.max(0, previousTime + deltaSeconds),
      duration > 0 ? duration : previousTime + deltaSeconds,
    );

    logEvent('info', 'player.seek_requested', {
      deltaSeconds,
      previousTime,
      nextTime,
      duration,
      activeSlideIndex: getSlideIndexForTime(this.timeline, nextTime),
    });

    this.seekTo(nextTime);
  }

  seekTo(nextTime) {
    const duration = this.getDuration();
    const clampedTime = Math.min(
      Math.max(0, nextTime),
      duration > 0 ? duration : Math.max(0, nextTime),
    );

    logEvent('info', 'player.seek_to_requested', {
      previousTime: this.state.currentTime,
      nextTime: clampedTime,
      duration,
      activeSlideIndex: getSlideIndexForTime(this.timeline, clampedTime),
    });

    if (this.isComposedMode() && this.state.isPlaying) {
      this.startClock(clampedTime);
    }

    if (!this.isComposedMode()) {
      this.audio.currentTime = clampedTime;
    }

    this.updateGlobalTime(clampedTime, { autoplayAudio: this.state.isPlaying });
    this.setState({
      status: this.state.isPlaying ? 'playing' : 'ready',
      error: '',
    });
  }

  rewindTenSeconds() {
    this.seekBy(-10);
  }

  forwardTenSeconds() {
    this.seekBy(10);
  }

  togglePlayback() {
    if (this.state.isPlaying || !this.audio.paused && !this.isComposedMode()) {
      this.pause();
      return;
    }

    this.play();
  }

  syncAudioForTime(currentTime, { autoplay = false, force = false } = {}) {
    const activeAudioClip = getActiveAudioClip(this.audioTimeline, currentTime);

    if (!activeAudioClip) {
      if (this.activeAudioClip) {
        logEvent('info', 'player.audio_clip_cleared', {
          previousClipId: this.activeAudioClip.id,
          currentTime,
        });
      }
      this.activeAudioClip = null;
      this.pendingAudioSync = null;
      this.audio.pause();
      this.setState({
        currentTime,
        activeAudioClipId: '',
        activeSlideIndex: getSlideIndexForTime(this.timeline, currentTime),
      });
      return;
    }

    const offset = Math.max(0, currentTime - activeAudioClip.startTime);
    const safeOffset = Math.min(offset, Math.max(0, activeAudioClip.spanSeconds - 0.05));
    const shouldSwapSrc = force || this.activeAudioClip?.id !== activeAudioClip.id || this.audio.src !== activeAudioClip.src;

    logEvent('info', 'player.audio_clip_selected', {
      clipId: activeAudioClip.id,
      currentTime,
      offsetSeconds: safeOffset,
      autoplay,
      force,
      shouldSwapSrc,
    });

    this.activeAudioClip = activeAudioClip;

    if (shouldSwapSrc) {
      this.pendingAudioSync = {
        clipId: activeAudioClip.id,
        offset: safeOffset,
        autoplay,
        spanSeconds: activeAudioClip.spanSeconds,
      };
      this.audio.pause();
      this.audio.src = activeAudioClip.src;
      this.audio.load();
    } else {
      if (Math.abs((this.audio.currentTime || 0) - safeOffset) > 0.2) {
        this.audio.currentTime = safeOffset;
      }
      if (autoplay) {
        this.audio.play().catch((error) => {
          logEvent('error', 'player.audio_clip_sync_failed', {
            clipId: activeAudioClip.id,
            message: error instanceof Error ? error.message : 'Audio clip play failed',
          });
        });
      } else {
        this.audio.pause();
      }
    }

    this.setState({
      currentTime,
      activeAudioClipId: activeAudioClip.id,
      activeSlideIndex: getSlideIndexForTime(this.timeline, currentTime),
    });
  }
}
