# Nexus Social — localized Live Studio v1

Packet: `NX-WEB-SOCIAL-P02-LOCALIZE-LIVE-STUDIO-046`  
Date: 2026-09-04  
Environment: local deterministic, zero external network, zero real funds, zero incremental cost

## Outcome

The private Live Studio setup now follows the active persona locale in Romanian,
English, Polish and Arabic. Camera and microphone controls, permission and recovery
states, metadata fields, audience choices and private-preview results use the shared
catalogue. Raw backend reasons are not rendered.

Device admission is fail-closed. A private preview can be saved only while one live
video track and one live audio track exist. If either track ends, the UI immediately
disables Save and reports that the device is unavailable. Closing the sheet, moving
the app to the background or leaving the route stops all tracks.

Rapid retry, camera flip and close operations are protected by a latest-request gate.
A stale `getUserMedia` result cannot replace the current stream; every track from a
stale result is stopped. Optional microphone metering is isolated so an unsupported
or failing `AudioContext` cannot tear down an otherwise valid camera/microphone
session.

Private-preview persistence uses one stable `Idempotency-Key` for unchanged form
content, rotates it after edits and prevents simultaneous duplicate submission.
Unexpected client exceptions produce a localized recoverable state and re-enable
submission only if the device remains ready.

The truth boundary is unchanged: this saves metadata for a private local preview.
It does not start a broadcast, publish a session, contact an SFU/TURN service or
claim production moderation.

## Findings resolved

- **High:** a stale camera request could win after a flip/retry/close operation and
  replace the intended stream or leak active tracks. The latest-request gate now
  rejects stale completion and explicitly stops its tracks.
- **High:** repeated preview submission had no stable mutation identity. The form
  now carries a content-stable idempotency key, rotates it on edits and blocks
  concurrent submission.
- **Medium:** an ended camera or microphone track was not reflected reliably in the
  save gate. Track end events now refresh controls and fail closed.
- **Medium:** microphone analyser failure could invalidate a valid device session.
  Optional metering is now isolated and partially-created audio contexts are closed.
- **Medium:** Live Studio mixed Romanian literals and could expose backend error
  text. The bounded surface now has RO/EN/PL/AR catalogue parity and stable errors.

## Verification

- Syntax checks: PASS for `app.js` and `interface-locale.js`.
- Focused core/audit/operational tests: `114/114` PASS.
- Full product suite: `210/210` PASS across 27 test files.
- Release check: PASS; 1,000 isolated `SYSTEM_TEST` actors; 0 issues.
- Production probe: health PASS, insecure API denied, isolated data true.
- External network: false; real funds: false; incremental cost: 0.

The independent worker remains capacity-limited, so the local result is
`PASS_LOCAL_PRIMARY_REVIEW_PENDING`. Trusted-HTTPS Android/iOS camera behavior,
orientation changes and real-device permission recovery remain external gates.

## Scope boundary

This packet covers only the Live Studio device/setup and private-preview surface.
Live discovery, competitions and battle copy remain in the next localization packet.
Production broadcast, SFU/TURN, recording, moderation and public session lifecycle
remain intentionally blocked.
