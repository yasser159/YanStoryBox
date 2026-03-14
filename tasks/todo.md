# Task Plan

- [x] Review current React app for functional bugs and regressions
- [x] Verify suspect UI/core interactions in slide, audio, and player flows
- [x] Run build and automated browser checks to confirm findings
- [x] Document confirmed bugs, rejected false positives, and verification results

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
- [x] Replace key React UI transitions with Framer Motion
- [x] Drive slide timing from the actual track length instead of a fixed two-minute placeholder
- [x] Add draggable cue timing so uploaded photos can be pinned to specific moments in the track
- [x] Add 10-second rewind and forward transport controls
- [x] Replace flaky hidden upload triggers with visible controls that contain the real file inputs
- [x] Encapsulate upload buttons into a dedicated picker component and protect them with a browser regression test
- [x] Add drag-to-remove support so pinned timeline items can return to auto timing without deleting the media
- [x] Add a Pin Controls toggle so the lower overlay can stay visible during testing and repeated interactions
- [x] Implement shared UI state management for the presentation overlay and controls pinning

# Notes

- Follow-up fix decision: apply the three user-requested review items even where one was more cleanup than user-facing failure, to keep the code path explicit and less misleading.
- Review decision: treat this pass as a code review first, not an automatic fix pass, and verify any claimed bug against source plus available checks before reporting it.
- Request: build a web app that plays about 2 minutes of audio while photos slide in sync, with pause/play controls.
- Architectural decision: keep playback timing and logging in core modules, and keep UI focused on rendering and control wiring.
- Logging decision: all core state transitions should emit structured events that can be viewed in-app from a Diagnostics screen.
- Upload decision: user-uploaded photos replace the demo slides automatically and persist in IndexedDB across reloads.
- Audio decision: user-uploaded audio replaces the demo soundtrack automatically and persists in IndexedDB across reloads.
- Backend decision: user-uploaded photos and audio now persist to Firebase Storage + Firestore in project `bigbackend-60150` (BigBackEnd), not only the browser.
- Playback decision: changing slide order must not recreate the audio element or reset playback time.
- Resilience decision: when Firebase Storage rejects local-origin uploads, photos should fall back to browser-local persistence instead of failing silently.
- Feedback decision: photo uploads should expose an explicit in-progress wait state in the control bar so users know the app is busy talking to Firebase.
- Motion decision: default React animation library for this app is Framer Motion, used for scene swaps, overlay reveals, and thumbnail entrance/layout motion.
- Timing decision: slide switches should be computed from the real loaded audio duration divided by the current slide count, so uploaded tracks pace uploaded photos correctly.
- Cue decision: uploaded slides can carry persisted `cueTime` values, and the playback timeline should sort by those cue points so drag placement controls when each image appears.
- Transport decision: the player should expose `-10s` and `+10s` seek controls in the core playback engine so UI transport stays dumb and reusable.
- Upload control decision: the visible upload buttons should contain the actual file inputs so clicking the control is the native picker target, not a hidden proxy.
- Picker event decision: keep overlay pinning on the visible wrapper, not on the file input click handler, so the browser sees a clean direct picker interaction.
- Encapsulation decision: upload picker behavior now lives in a dedicated component with a `FileList`-only callback API so player-layout changes do not rewrite picker internals.
- Timeline removal decision: dragging a pinned cue to `Remove From Timeline` clears only `cueTime`; it must not delete the uploaded image from the slideshow.
- Protection decision: upload-picker code is now a protected subsystem because it regressed twice in under 24 hours and one failed fix had to be reverted. Future non-upload tasks should avoid touching the picker component or its click path.
- Reset decision: the upload controls were rebuilt from scratch as native label/input controls, with the real file input stretched over the visible button so the browser owns the chooser interaction directly.
- Overlay decision: the lower controls tray supports a manual `Pin Controls` toggle so repeated interactions do not depend on hover timing.
- Upload logging decision: the protected upload picker logs click attempts and file-selection handoff events to the shared diagnostics stream so chooser failures are observable from the console and Diagnostics history.
- State management decision: shared presentation UI state now lives in a dedicated Zustand store so overlay visibility and pin controls do not stay tangled inside `App.jsx`.

# Kill List

- Rejected: trusting prior automated bug summaries without re-checking source. Reason: these tools love finding smoke where there’s just somebody grilling.
- Rejected: reporting the `useSlideLibrary` upload pre-loop as a functional bug. Reason: it is dead logic and should be cleaned up, but the real image filtering still happens immediately after, so users do not get wrong files through because of that loop.
- Rejected: building everything in one React component. Reason: would mix timing logic, media control, and UI state into one brittle blob.
- Rejected: relying only on browser console logs. Reason: logs need to be inspectable inside the app too.
- Rejected: waiting for a reuse match before starting. Reason: the library index endpoint was unavailable and this repo is empty.
- Rejected: shipping without demo assets. Reason: the app should prove the flow immediately instead of requiring manual setup first.
- Rejected: using `localStorage` for image persistence. Reason: blobs would bloat storage and break fast.
- Rejected: mixing uploaded audio into the photo store shape. Reason: different lifecycle, validation, and reset controls.
- Rejected: using a drag-and-drop package for v1. Reason: native DnD is enough here and keeps the app lean.
- Rejected: keeping IndexedDB as the source of truth for hosted persistence. Reason: hosted app needs shared remote storage, not browser-only memory.
- Rejected: letting photo uploads hard-fail when Firebase Storage preflight breaks locally. Reason: dev and preview flows still need visible, persistent thumbs.
- Rejected: driving the file picker through `inputRef.current.click()`. Reason: hover/focus timing made the chooser path flaky and looked broken even when the upload code was fine.
- Rejected: hidden proxy file inputs for the overlay buttons. Reason: browser chooser behavior got too brittle, and the visible control itself should own the picker.
- Rejected: attaching overlay side effects to the file input `onClick`. Reason: the picker path should stay pure and not depend on click-time state churn.
- Rejected: leaving upload picker logic embedded in `PlayerControlsBar`. Reason: mixing layout edits with picker behavior keeps causing regressions in an area that should be locked down.
- Rejected: using the thumbnail delete button as “timeline removal.” Reason: that kills the media asset, while timeline removal should only clear manual timing and return the item to auto pacing.
- Rejected: treating upload-button fixes as done after build-only validation. Reason: this exact path already failed multiple times without throwing code-level errors, so it needs real browser chooser proof every time.
- Rejected: hover-only access for repeated overlay interactions. Reason: when users need to click around, a manual pin is more reliable than fighting the hover trigger.
- Rejected: moving the whole player, audio library, and slide library into one global store. Reason: the real pain point was shared UI coordination, so a tiny store beats a full app-state rewrite.

# Review

- Fixed the slide upload validation path so unsupported files are logged during the same filtering pass that builds `imageFiles`, instead of keeping a dead pre-loop that looked like it did work.
- Fixed the cue removal drop target to call `clearSlideCueTime` directly, matching the component contract instead of silently tolerating a missing handler on that one path.
- Fixed the story player empty-state render so it only mounts the `<img>` when a real slide source exists, and otherwise shows a simple `No slide loaded` placeholder.
- Built a Vite + React + Tailwind app with a dedicated playback engine, bounded diagnostics log store, in-app Diagnostics screen, and bundled 2-minute demo audio plus five sample slides.
- Added an IndexedDB-backed uploaded photo library with thumbnail previews, drag-and-drop ordering, remove/reset controls, and diagnostics events for hydration, upload, reorder, and reset flows.
- Added an IndexedDB-backed uploaded audio library with upload/reset controls and separate diagnostics events for soundtrack hydration and replacement.
- Switched media persistence to Firebase `bigbackend-60150` using Storage for uploaded files and Firestore for shared presentation metadata/order.
- Added a local fallback path for photo uploads so Firebase Storage failures on localhost still produce thumbnails, persist in IndexedDB, and emit explicit fallback diagnostics.
- Added a visible upload-in-progress state for photos so the Upload button switches to a spinner and wait copy while Firebase Storage work is in flight.
- Replaced the main scene swap, lower media overlay reveal, and thumbnail card motion with Framer Motion instead of plain CSS-only transitions.
- Updated the slideshow timeline to rebuild from the loaded audio duration, so uploaded photos switch based on `track length / photo count` instead of a hardcoded 120-second assumption.
- Added a cue lane where uploaded thumbnails can be dragged to a specific point in the track, persisted locally/remotely, and then used by the playback timeline as real slide cue points.
- Added 10-second skip-back and skip-forward controls, backed by core seek logic that clamps within the track and updates the active slide immediately.
- Moved the real photo/audio file inputs into the visible upload controls so clicking the button directly opens the browser picker.
- Moved overlay pinning off the file input click handler and onto the visible control wrapper to reduce picker-trigger flakiness.
- Extracted upload picker behavior into a dedicated `UploadPickerButton` component and added a Playwright regression test for the visible photo upload button.
- Added a `Remove From Timeline` drop zone in the cue lane that clears manual cue placement and sends the slide back to auto timing without deleting the upload.
- Added a `Pin Controls` toggle to keep the lower overlay visible during testing and multi-step interactions.
- Added structured diagnostics logs for upload-button clicks and file-selection events so the picker path exposes what the browser is doing.
- Added a small Zustand store for shared overlay visibility and pinning state, with structured diagnostics logs on UI state transitions and less prop-drilling through the player controls.
- Verification: `npm run build` passed on 2026-03-14 after introducing the shared Zustand UI store.
- Verification: `npx playwright test tests/scene-layout.spec.js --grep "visible photo upload button opens a file chooser"` passed on 2026-03-14 after the state-management refactor touched the player controls bar.
- Verification: Playwright confirmed on 2026-03-14 that dragging a manually pinned cue marker onto `Remove From Timeline` emits `photos.cue_cleared`.
- Captured the upload-button incident as protected code after repeated regressions and a revert, with explicit rules in project memory for how the picker works and how it must be verified.
- Verification: `npm run build` passed on 2026-03-13 after the audio upload changes.
- Verification: Playwright confirmed on 2026-03-13 that the fullscreen stage no longer grows taller than the viewport (`scrollHeight === innerHeight`), top-half hover hides overlays, and lower hover reveals the controls plus thumbnail tray inside the visible screen.
- Verification: Playwright confirmed on 2026-03-13 that selecting a photo on localhost creates a visible thumb immediately, survives refresh, and logs `photos.upload_fell_back_to_local` when Firebase Storage rejects the upload.
- Verification: Playwright confirmed on 2026-03-14 that dragging a cue marker updates persisted timing and emits `photos.cue_updated` with the dropped cue time.
- Verification: `npm run build` passed on 2026-03-14 during the bug review pass, with one Vite warning about a large JS chunk but no build errors.
- Verification: `npm run build` passed on 2026-03-14 after fixing the three pasted issues.
- Verification: `npm run test:e2e` failed on 2026-03-14 because `tests/scene-layout.spec.js` now makes stale assumptions about overlay visibility and the number of `.scene-shell img` elements; this exposed test bugs plus a real mobile-overlay accessibility gap.
- Review finding: the main controls overlay is triggered only by `onMouseMove`/`onMouseLeave` on the stage shell, so touch/mobile users have no equivalent interaction path to reveal playback or upload controls.
- Review finding: `DiagnosticsScreen` exists but is not rendered anywhere in the app, so the in-app inspection surface required by the project architecture is effectively unreachable.
