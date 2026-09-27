# HJ-10 — camera / picker recovery

Date: 2026-09-12. One bounded packet, local only, no external services or cost.

## Findings and repairs

- HIGH: returning browser focus started a 450 ms timer that navigated Home if native selection had not arrived. Removed speculative cancellation; late native events no longer trigger destructive navigation.
- HIGH: explicit file-picker cancellation always navigated Home, including when caption/media/draft already existed. An empty composer may return Home; a populated one remains available. This preserves in-memory content, not a claim of automatic persistent draft saving.
- HIGH: asynchronous FileReader completion could update a later selection or a newly opened composer. Extracted guarded preview reading: both owning composer and selected File identity must still match. Detached video metadata events are also ignored.
- MEDIUM: camera tracks stopped but visible ready/recording UI and srcObject could remain stale. Cleanup now clears the stream reference, ready class and recording button states.

## Changes

`public/composer-picker.js` owns explicit-cancel behavior and stale-preview fencing. It uses no network, permissions bypass, browser automation or persistence. `app.js` integrates it, with asset version `20260912-camera1`.

## Evidence

- Four deterministic tests cover empty cancellation vs focus, draft preservation/stale events, out-of-order preview completion, and actual camera cleanup against local track/recorder doubles.
- Existing audit assertions changed from requiring the old focus timer to requiring explicit guarded picker integration.
- Full release:check PASS: 69 test files, 1,000 synthetic actors, zero synthetic issues, local health PASS, external_network=false, real_funds=false, incremental_cost=0.
- Running index serves camera1; picker module HTTP 200.
- Existing source-size gates retained. Entry bundle remains at its limit: subsequent expansion requires extraction/refactoring.

## Limits / next

HJ-10 remains FIXED-CANDIDATE, not device-verified. No rendered or real-device testing was performed; saved Browser denial was not bypassed. Native browsers that do not emit cancel leave the composer visible, with its existing explicit Back control, instead of guessing the user cancelled.

Next: camera permission-denied/retry, recording-too-large recovery, native gallery cancellation and keyboard behavior on a permitted physical/browser surface; then three-stage creation with persistent draft protection.
