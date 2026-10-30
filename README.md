# Yan Story Box

A browser app that turns a folder of photos, clips and audio into a narrated slideshow. Upload media, pin each item to a point on the audio timeline, play it back in sync, and share the result.

This is the public hosting mirror of the Story Teller app, served from GitHub Pages.

## Features

- Timeline editor on top of a waveform (wavesurfer.js): drag media onto the moment it should appear
- Photo and video slides with crossfade transitions
- Fullscreen stage with hover-revealed controls
- Media stored in Firebase Storage, so a story survives a refresh and opens on any device
- Export the finished story for offline playback

## Stack

React 19 · Vite · Tailwind · Zustand · framer-motion · Firebase (Auth, Firestore, Storage)

## Development

```bash
npm install
npm run dev           # local dev server
npm run test:unit     # vitest
npm run test:e2e      # playwright
npm run build         # production bundle
```

The GitHub Actions workflow in `.github/` builds and publishes `dist/` to GitHub Pages on every push to `main`.

## License

MIT
