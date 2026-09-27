# Nexus Social — localized Create, camera and drafts v1

Packet: `NX-WEB-SOCIAL-P02-LOCALIZE-CREATE-CAMERA-AND-DRAFTS-043`  
Date: 2026-09-04  
Environment: local deterministic, zero external network, zero real funds, zero incremental cost

## Outcome

The Social Create Hub, camera recovery states and local draft library now use the
active persona locale in Romanian, English, Polish and Arabic. Camera, Gallery,
Story, Clip, Post, Drafts and Live remain reachable from the one central Create
entry. The composer header explains whether Nexus is opening the camera, native
gallery, Story camera or Clip camera.

The camera behavior remains truthful:

- live browser preview uses `getUserMedia` only in a secure context;
- LAN HTTP falls back to the browser/OS native capture picker and does not claim a
  live preview;
- camera and microphone tracks stop on composer close, Home, picker cancellation,
  successful capture and capture-to-input failure;
- denied permission exposes Retry and Gallery paths;
- an unsupported or throwing `MediaRecorder` returns a stable local error;
- recorded Clips remain bounded to three minutes.

Local drafts are isolated by both authenticated user and active persona on list,
open and delete. A forged or stale draft ID cannot delete a draft from another
persona. IndexedDB failure is no longer rendered as an empty library: the screen
shows a truthful error and Retry. Drafts remain browser-local and contain no wallet
keys.

This packet does not alter resumable upload, moderation or publication semantics.
External sharing, production providers, real payments and chain submission remain
disabled.

## Findings resolved

- **High:** local draft deletion trusted the provided ID without rechecking owner
  and persona. Deletion now reads and verifies the record before mutation.
- **High:** failure to attach a captured photo/video could leave camera and
  microphone tracks active. Tracks now stop before the error is returned.
- **Medium:** IndexedDB failure was followed by the normal “no drafts” screen. A
  distinct localized failure with Retry now prevents this false empty state.
- **Medium:** `MediaRecorder` construction could throw and strand the capture flow.
  Construction is guarded and returns the native-camera fallback message.
- **Medium:** Create, camera and draft states were Romanian-only and dates ignored
  the persona locale. The bounded surface now uses the complete locale catalogue
  and locale-aware date formatting.

## Verification

- Syntax checks: PASS for `app.js` and `interface-locale.js`.
- Focused tests including modal accessibility: `116/116` PASS.
- Full suite: `209/209` PASS across 27 test files.
- Release check: PASS; 1,000 isolated `SYSTEM_TEST` actors; 0 issues.
- Existing resumable upload simulations remain PASS, including interruption,
  conflict, retry and 100 concurrent upload actors.
- External network: false; real funds: false; incremental cost: 0.

The independent worker remains capacity-limited, so the local result is
`PASS_LOCAL_PRIMARY_REVIEW_PENDING`. Camera preview, OS picker behavior, permission
prompts, lens switching and MediaRecorder compatibility still require trusted-HTTPS
real-device testing on supported Android/iOS browsers.

## Scope boundary

This packet covers Create entry, composer entry context, camera lifecycle/recovery
and local drafts. Creator Studio editing, upload-progress/error copy, publication
copy, Live Studio, Messages, Profile and login remain later bounded packets.
