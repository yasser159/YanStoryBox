# Yan Story Teller — Claude Instructions

## Project Overview
A browser-only React app that plays a synchronized audio+slideshow story. Users upload photos, videos, and audio clips, pin media to specific timestamps on a timeline, and can export the result as a `.webm` video downloaded directly from the browser (no backend render pipeline).

## Tech Stack
- **React 19** + **Vite 7** (ESM, no CJS)
- **Tailwind CSS 3** for styling
- **Framer Motion** — UI chrome animations only (scene swaps, overlay reveals, thumbnail entrance). Never sneak it onto media transitions unless explicitly asked.
- **Zustand** — shared UI state (`usePresentationUiStore`). Not a full app-state store; scoped to overlay visibility and pin controls.
- **Firebase** (`bigbackend-60150`) — Storage for uploaded files, Firestore for presentation metadata. IndexedDB is the local fallback when Firebase is unavailable.
- **wavesurfer.js** — waveform rendering for placed audio clips. Do not replace with a custom renderer.
- **Vitest** — unit tests in `tests/unit/` only (`npm run test:unit`)
- **Playwright** — e2e/browser tests in `tests/` (`npm run test:e2e`)

## Architecture

```
src/
  App.jsx                      # top-level routing and upload dispatch by MIME type
  main.jsx
  components/
    StoryPlayerPanel.jsx        # fullscreen stage + timeline + controls
    AudioManagerPanel.jsx       # audio lane + clip table + target duration
    PhotoManagerPanel.jsx       # visual library + cue lane
    UploadPickerButton.jsx      # PROTECTED — see below
    AudioWaveformPreview.jsx    # wavesurfer wrapper
    DiagnosticsScreen.jsx       # in-app diagnostics viewer (currently not rendered)
  hooks/
    useStoryPlayer.js           # master playback clock + visual timeline
    useSlideLibrary.js          # uploaded photos/videos + cue state
    useAudioLibrary.js          # multi-clip audio lane + composition
    useVideoExport.js           # export state machine wrapper
    useDiagnostics.js
  lib/
    storyPlayer.js              # pure playback engine
    timeline.js                 # builds visual timeline from cue points
    audioComposition.js         # pure audio clip sequencer
    browserVideoExporter.js     # in-browser canvas+MediaRecorder export
    exportVideoManifest.js      # builds render manifest from current state
    videoExportState.js         # export state shape helpers
    visualMedia.js              # normalizes image/video uploads
    cueRemoval.js               # pure cue-removal decision helper
    logger.js                   # structured event logger
    firebaseClient.js
    presentationRepository.js
    slideLibraryStorage.js
    audioLibraryStorage.js
  stores/
    usePresentationUiStore.js   # Zustand store for overlay + pin state
  data/
    storyMedia.js               # bundled demo assets
```

## Commands
```bash
npm run dev           # Vite dev server
npm run build         # production build
npm run test:unit     # Vitest — tests/unit/ only
npm run test:e2e      # Playwright
npm run test:e2e:headed
```

## Protected Code — Do Not Touch Casually

### UploadPickerButton
The upload picker (`src/components/UploadPickerButton.jsx`) regressed twice in under 24 hours and one fix had to be reverted. Rules:
- The real `<input type="file">` must live **inside** the visible control, stretched over it — no hidden proxy inputs, no `inputRef.current.click()`.
- Overlay pin state goes on the **visible wrapper**, never on the file input `onClick`.
- If a task is not explicitly about uploads, leave this component alone.
- Verification bar: fresh browser session → hover reveal if needed → click visible control → native chooser opens → select real file → new thumbnail appears → refresh still preserves it. Build-only validation is not enough.

## Key Decisions & Rules

**Drag behavior**
- `dragend.dataTransfer.dropEffect` is unreliable in browsers — use explicit valid-target tracking instead.
- Compute placed-clip position from the block's grabbed offset, not just the cursor drop point.
- Add a left-edge snap zone for the audio lane so clips near 0s snap cleanly.

**Timeline**
- The cue lane renders only **manually pinned** slides. Auto-timed slides belong to playback, not the lane.
- "Remove from timeline" clears `cueTime` only — it must never delete the uploaded media asset.
- Audio lane uses sequential, non-overlapping clip placement from `audioComposition.js`.

**Playback**
- The global player clock drives visual timeline and audio composition. Do not rely on the HTML audio element clock for global time.
- When custom audio clips exist, one active audio element swaps sources and offsets; it does not try to stitch a fake master file.

**MediaRecorder / Export**
- Do not trust `MediaRecorder.onstart` alone — poll `recorder.state` for the real truth (Chromium is flaky with `onstart`).
- Export test seeds a short local story, not the 120-second demo reel.
- The export button is removed from the controls bar until a real backend or Remotion path exists. Do not add a visible dead button.

**Waveform**
- Use `wavesurfer.js` for waveform rendering. Do not write custom SVG waveform renderers.
- Waveform data is extracted on upload and persisted with the audio clip record.

**Fullscreen stage**
- Never add bottom padding to the stage shell to make room for overlay UI. Keep the stage locked to viewport height; position controls/trays absolutely inside it.

**Firebase / Storage**
- Project: `bigbackend-60150`
- When Firebase Storage rejects local-origin uploads, fall back to IndexedDB and log `photos.upload_fell_back_to_local`. Do not hard-fail.

## Testing
- Vitest targets `tests/unit/` — do not point it at the whole `tests/` folder (Playwright specs will fight it).
- Playwright browser tests seed IndexedDB locally — do not upload against shared Firebase state during tests.
- Export regression tests use a short seeded story (`< 15s`) to avoid multi-minute render waits.

## Known Open Issues
- `DiagnosticsScreen` component exists but is not rendered anywhere — in-app diagnostics are unreachable.
- Touch/mobile users have no way to reveal the main controls overlay (it's mouse-only via `onMouseMove`/`onMouseLeave`).
