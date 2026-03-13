# Task Plan

- [x] Inspect repository state
- [x] Check local reuse sources for relevant frontend patterns
- [x] Scaffold a React + Tailwind web app
- [x] Implement core audio/slideshow engine with structured logs
- [x] Implement UI controls and Diagnostics screen
- [x] Verify with a production build
- [x] Add uploaded photo library with local persistence
- [x] Add thumbnail drag-and-drop ordering UI
- [x] Add uploaded audio library with local persistence

# Notes

- Request: build a web app that plays about 2 minutes of audio while photos slide in sync, with pause/play controls.
- Architectural decision: keep playback timing and logging in core modules, and keep UI focused on rendering and control wiring.
- Logging decision: all core state transitions should emit structured events that can be viewed in-app from a Diagnostics screen.
- Upload decision: user-uploaded photos replace the demo slides automatically and persist in IndexedDB across reloads.
- Audio decision: user-uploaded audio replaces the demo soundtrack automatically and persists in IndexedDB across reloads.
- Playback decision: changing slide order must not recreate the audio element or reset playback time.

# Kill List

- Rejected: building everything in one React component. Reason: would mix timing logic, media control, and UI state into one brittle blob.
- Rejected: relying only on browser console logs. Reason: logs need to be inspectable inside the app too.
- Rejected: waiting for a reuse match before starting. Reason: the library index endpoint was unavailable and this repo is empty.
- Rejected: shipping without demo assets. Reason: the app should prove the flow immediately instead of requiring manual setup first.
- Rejected: using `localStorage` for image persistence. Reason: blobs would bloat storage and break fast.
- Rejected: mixing uploaded audio into the photo store shape. Reason: different lifecycle, validation, and reset controls.
- Rejected: using a drag-and-drop package for v1. Reason: native DnD is enough here and keeps the app lean.

# Review

- Built a Vite + React + Tailwind app with a dedicated playback engine, bounded diagnostics log store, in-app Diagnostics screen, and bundled 2-minute demo audio plus five sample slides.
- Added an IndexedDB-backed uploaded photo library with thumbnail previews, drag-and-drop ordering, remove/reset controls, and diagnostics events for hydration, upload, reorder, and reset flows.
- Added an IndexedDB-backed uploaded audio library with upload/reset controls and separate diagnostics events for soundtrack hydration and replacement.
- Verification: `npm run build` passed on 2026-03-13 after the audio upload changes.
