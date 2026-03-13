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
- [x] Move media persistence to Firebase BigBackEnd project
- [x] Restore photo uploads when Firebase Storage is unavailable from local development
- [x] Show an upload-in-progress wait state while photos are being sent to Firebase Storage

# Notes

- Request: build a web app that plays about 2 minutes of audio while photos slide in sync, with pause/play controls.
- Architectural decision: keep playback timing and logging in core modules, and keep UI focused on rendering and control wiring.
- Logging decision: all core state transitions should emit structured events that can be viewed in-app from a Diagnostics screen.
- Upload decision: user-uploaded photos replace the demo slides automatically and persist in IndexedDB across reloads.
- Audio decision: user-uploaded audio replaces the demo soundtrack automatically and persists in IndexedDB across reloads.
- Backend decision: user-uploaded photos and audio now persist to Firebase Storage + Firestore in project `bigbackend-60150` (BigBackEnd), not only the browser.
- Playback decision: changing slide order must not recreate the audio element or reset playback time.
- Resilience decision: when Firebase Storage rejects local-origin uploads, photos should fall back to browser-local persistence instead of failing silently.
- Feedback decision: photo uploads should expose an explicit in-progress wait state in the control bar so users know the app is busy talking to Firebase.

# Kill List

- Rejected: building everything in one React component. Reason: would mix timing logic, media control, and UI state into one brittle blob.
- Rejected: relying only on browser console logs. Reason: logs need to be inspectable inside the app too.
- Rejected: waiting for a reuse match before starting. Reason: the library index endpoint was unavailable and this repo is empty.
- Rejected: shipping without demo assets. Reason: the app should prove the flow immediately instead of requiring manual setup first.
- Rejected: using `localStorage` for image persistence. Reason: blobs would bloat storage and break fast.
- Rejected: mixing uploaded audio into the photo store shape. Reason: different lifecycle, validation, and reset controls.
- Rejected: using a drag-and-drop package for v1. Reason: native DnD is enough here and keeps the app lean.
- Rejected: keeping IndexedDB as the source of truth for hosted persistence. Reason: hosted app needs shared remote storage, not browser-only memory.
- Rejected: letting photo uploads hard-fail when Firebase Storage preflight breaks locally. Reason: dev and preview flows still need visible, persistent thumbs.

# Review

- Built a Vite + React + Tailwind app with a dedicated playback engine, bounded diagnostics log store, in-app Diagnostics screen, and bundled 2-minute demo audio plus five sample slides.
- Added an IndexedDB-backed uploaded photo library with thumbnail previews, drag-and-drop ordering, remove/reset controls, and diagnostics events for hydration, upload, reorder, and reset flows.
- Added an IndexedDB-backed uploaded audio library with upload/reset controls and separate diagnostics events for soundtrack hydration and replacement.
- Switched media persistence to Firebase `bigbackend-60150` using Storage for uploaded files and Firestore for shared presentation metadata/order.
- Added a local fallback path for photo uploads so Firebase Storage failures on localhost still produce thumbnails, persist in IndexedDB, and emit explicit fallback diagnostics.
- Added a visible upload-in-progress state for photos so the Upload button switches to a spinner and wait copy while Firebase Storage work is in flight.
- Verification: `npm run build` passed on 2026-03-13 after the audio upload changes.
- Verification: Playwright confirmed on 2026-03-13 that the fullscreen stage no longer grows taller than the viewport (`scrollHeight === innerHeight`), top-half hover hides overlays, and lower hover reveals the controls plus thumbnail tray inside the visible screen.
- Verification: Playwright confirmed on 2026-03-13 that selecting a photo on localhost creates a visible thumb immediately, survives refresh, and logs `photos.upload_fell_back_to_local` when Firebase Storage rejects the upload.
