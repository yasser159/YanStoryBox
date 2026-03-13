import { getSlideIndexForTime } from './timeline';
import { logEvent } from './logger';

export class StoryPlayer {
  constructor({ audio, timeline }) {
    this.audio = audio;
    this.timeline = timeline;
    this.listeners = new Set();
    this.state = {
      currentTime: 0,
      duration: audio.duration || 0,
      isPlaying: false,
      activeSlideIndex: 0,
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

  mount() {
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
    const duration = this.audio.duration || 0;
    logEvent('info', 'audio.metadata_loaded', { duration });
    this.setState({ duration, status: 'ready' });
  }

  handleTimeUpdate() {
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
      currentTime: this.audio.duration || this.state.currentTime,
      activeSlideIndex: this.timeline.length - 1,
    });
  }

  handleError() {
    const message = this.audio.error?.message || 'Audio playback failed';
    logEvent('error', 'audio.error', { message });
    this.setState({ error: message, status: 'error', isPlaying: false });
  }

  async play() {
    logEvent('info', 'player.play_requested');
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
  }

  togglePlayback() {
    if (this.audio.paused) {
      this.play();
      return;
    }

    this.pause();
  }
}
