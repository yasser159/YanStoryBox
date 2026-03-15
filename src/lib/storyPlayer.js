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
  }

  updateTimeline(timeline) {
    this.timeline = timeline;
    const activeSlideIndex = getSlideIndexForTime(this.timeline, this.audio.currentTime || 0);
    logEvent('info', 'player.timeline_updated', {
      slideCount: this.timeline.length,
      activeSlideIndex,
      currentTime: this.audio.currentTime || 0,
    });
    this.setState({ activeSlideIndex });
  }

  updateAudioTimeline(audioTimeline, { fallbackAudioSrc = this.fallbackAudioSrc, durationHint = this.durationHint } = {}) {
    this.audioTimeline = audioTimeline;
    this.fallbackAudioSrc = fallbackAudioSrc;
    this.durationHint = durationHint;

    const nextDuration = durationHint || this.audio.duration || this.state.duration || 0;
    const activeAudioClip = getActiveAudioClip(this.audioTimeline, this.state.currentTime) || getNextAudioClip(this.audioTimeline, this.state.currentTime);

    logEvent('info', 'player.audio_timeline_updated', {
      clipCount: this.audioTimeline.length,
      duration: nextDuration,
      activeAudioClipId: activeAudioClip?.id || '',
      currentTime: this.state.currentTime,
    });

    this.setState({
      duration: nextDuration,
      activeAudioClipId: activeAudioClip?.id || '',
    });

    if (this.audioTimeline.length > 0) {
      this.syncAudioForTime(this.state.currentTime, { autoplay: this.state.isPlaying });
      return;
    }

    if (this.fallbackAudioSrc) {
      this.audio.src = this.fallbackAudioSrc;
      this.audio.preload = 'metadata';
    }
  }

  mount() {
    if (!this.audioTimeline.length && this.fallbackAudioSrc) {
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
    });

    this.emit();
  }

  unmount() {
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

  handleLoadedMetadata() {
    if (this.audioTimeline.length > 0 && this.pendingAudioSync) {
      const offset = Math.min(
        Math.max(0, this.pendingAudioSync.offset),
        Math.max(0, this.audio.duration || this.pendingAudioSync.spanSeconds || this.pendingAudioSync.offset),
      );
      this.audio.currentTime = offset;
      if (this.pendingAudioSync.autoplay) {
        this.audio.play().catch(() => {});
      }
      this.pendingAudioSync = null;
    }

    const duration = this.audioTimeline.length > 0
      ? (this.durationHint || this.state.duration || 0)
      : (this.audio.duration || 0);
    logEvent('info', 'audio.metadata_loaded', { duration });
    this.setState({ duration, status: 'ready' });
  }

  handleTimeUpdate() {
    if (this.audioTimeline.length > 0) {
      const activeAudioClip = this.activeAudioClip || getActiveAudioClip(this.audioTimeline, this.state.currentTime) || getNextAudioClip(this.audioTimeline, this.state.currentTime);

      if (!activeAudioClip) {
        if (this.state.isPlaying) {
          this.handleEnded();
        }
        return;
      }

      const currentTime = Math.min(activeAudioClip.startTime + (this.audio.currentTime || 0), activeAudioClip.endTime);
      if (currentTime >= activeAudioClip.endTime - 0.05) {
        const nextAudioClip = getNextAudioClip(this.audioTimeline, activeAudioClip.endTime + 0.001);
        if (nextAudioClip) {
          this.syncAudioForTime(nextAudioClip.startTime, { autoplay: this.state.isPlaying, force: true });
          return;
        }

        this.setState({
          currentTime: this.durationHint || activeAudioClip.endTime,
          activeSlideIndex: getSlideIndexForTime(this.timeline, this.durationHint || activeAudioClip.endTime),
          activeAudioClipId: '',
        });
        if (this.state.isPlaying) {
          this.handleEnded();
        }
        return;
      }

      this.setState({
        currentTime,
        activeSlideIndex: getSlideIndexForTime(this.timeline, currentTime),
        activeAudioClipId: activeAudioClip.id,
      });
      return;
    }

    const currentTime = this.audio.currentTime || 0;
    const activeSlideIndex = getSlideIndexForTime(this.timeline, currentTime);
    this.setState({ currentTime, activeSlideIndex });
  }

  handlePlay() {
    logEvent('info', 'audio.play');
    this.setState({ isPlaying: true, status: 'playing', error: '' });
  }

  handlePause() {
    logEvent('info', 'audio.pause', { currentTime: this.audio.currentTime || 0 });
    this.setState({ isPlaying: false, status: 'paused' });
  }

  handleEnded() {
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
    logEvent('error', 'audio.error', { message });
    this.setState({ error: message, status: 'error', isPlaying: false });
  }

  async play() {
    logEvent('info', 'player.play_requested');
    if (this.audioTimeline.length > 0) {
      this.syncAudioForTime(this.state.currentTime, { autoplay: true });
      this.setState({ isPlaying: true, status: 'playing', error: '' });
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
    this.audio.pause();
    this.setState({ isPlaying: false, status: 'paused' });
  }

  rewind() {
    logEvent('info', 'player.rewind_requested', {
      previousTime: this.audio.currentTime || 0,
    });
    if (this.audioTimeline.length > 0) {
      this.syncAudioForTime(0, { autoplay: false, force: true });
    } else {
      this.audio.currentTime = 0;
    }
    this.setState({
      currentTime: 0,
      activeSlideIndex: 0,
      activeAudioClipId: this.audioTimeline[0]?.id || '',
      status: this.audio.paused ? 'ready' : this.state.status,
      error: '',
    });
  }

  seekBy(deltaSeconds) {
    const previousTime = this.audioTimeline.length > 0
      ? this.state.currentTime
      : (this.audio.currentTime || 0);
    const duration = this.durationHint || this.audio.duration || this.state.duration || 0;
    const nextTime = Math.min(
      Math.max(0, previousTime + deltaSeconds),
      duration > 0 ? duration : previousTime + deltaSeconds,
    );
    const activeSlideIndex = getSlideIndexForTime(this.timeline, nextTime);

    logEvent('info', 'player.seek_requested', {
      deltaSeconds,
      previousTime,
      nextTime,
      duration,
      activeSlideIndex,
    });

    if (this.audioTimeline.length > 0) {
      this.syncAudioForTime(nextTime, { autoplay: this.state.isPlaying, force: true });
    } else {
      this.audio.currentTime = nextTime;
    }
    this.setState({
      currentTime: nextTime,
      activeSlideIndex,
      activeAudioClipId: this.audioTimeline.length > 0 ? (getActiveAudioClip(this.audioTimeline, nextTime)?.id || '') : this.state.activeAudioClipId,
      status: this.audio.paused ? 'ready' : this.state.status,
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
    if (this.audio.paused) {
      this.play();
      return;
    }

    this.pause();
  }

  syncAudioForTime(currentTime, { autoplay = false, force = false } = {}) {
    const activeAudioClip = getActiveAudioClip(this.audioTimeline, currentTime)
      || (autoplay ? getNextAudioClip(this.audioTimeline, currentTime) : null);

    if (!activeAudioClip) {
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

    logEvent('info', 'player.audio_clip_sync_updated', {
      clipId: activeAudioClip.id,
      currentTime,
      offsetSeconds: safeOffset,
      autoplay,
      force,
    });

    const shouldSwapSrc = force || this.activeAudioClip?.id !== activeAudioClip.id || this.audio.src !== activeAudioClip.src;
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
      if (Math.abs((this.audio.currentTime || 0) - safeOffset) > 0.35) {
        this.audio.currentTime = safeOffset;
      }
      if (autoplay) {
        this.audio.play().catch(() => {});
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
