import screenTestImage from '../screen test.png';

const assetBase = import.meta.env.BASE_URL;

export const storySlides = [
  {
    id: 'slide-1',
    title: 'Default Screen',
    caption: 'Ready signal on deck while the story waits for the first cue.',
    src: screenTestImage,
    kind: 'demo',
    mediaType: 'image',
    durationSeconds: null,
    posterSrc: '',
  },
  {
    id: 'slide-2',
    title: 'Street Pulse',
    caption: 'The rhythm picks up and the pictures start moving with the beat.',
    src: `${assetBase}images/slide-2.svg`,
    kind: 'demo',
    mediaType: 'image',
    durationSeconds: null,
    posterSrc: '',
  },
  {
    id: 'slide-3',
    title: 'Memory Lane',
    caption: 'Halfway through, the visuals hit like old photos in a shoebox.',
    src: `${assetBase}images/slide-3.svg`,
    kind: 'demo',
    mediaType: 'image',
    durationSeconds: null,
    posterSrc: '',
  },
  {
    id: 'slide-4',
    title: 'Golden Hour',
    caption: 'The pace stretches out and lets the moment breathe.',
    src: `${assetBase}images/slide-4.svg`,
    kind: 'demo',
    mediaType: 'image',
    durationSeconds: null,
    posterSrc: '',
  },
  {
    id: 'slide-5',
    title: 'Final Fade',
    caption: 'Last frame lands clean while the audio wraps the scene.',
    src: `${assetBase}images/slide-5.svg`,
    kind: 'demo',
    mediaType: 'image',
    durationSeconds: null,
    posterSrc: '',
  },
];

export const storyAudio = `${assetBase}audio/demo-story.wav`;
