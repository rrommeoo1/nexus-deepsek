# HJ-10 — bounded recording and recovery

Date: 2026-09-12. One camera lifecycle packet, local-only, no incremental cost.

## Findings / delivered

- HIGH: recorded chunks accumulated without checking the 20 MiB limit until stop. New recorder controller checks each incoming chunk before retaining it; an oversize recording fails visibly, never silently attaches a truncated clip. This bounds application-retained chunks, not the browser encoder's internal memory.
- HIGH: empty/oversize recordings and recorder failures could return before cleanup, leaving controls in recording state. A single terminal result now releases handlers/timers and restores retry/gallery recovery through existing localized messages.
- MEDIUM: start/stop exceptions and camera track-ended events lacked a consistent failure path. These are handled without attaching incomplete footage.
- MEDIUM: queued or repeated recorder events could compete with navigation/new captures. Completion is guarded by recorder, stream, persona and connected input identity; repeated Record is ignored while a recorder still owns the capture.
- Retained the existing 3-minute time and 20 MiB file limits, WebM upload contract, native permission/HTTPS gates, source-file attachment workflow and stop-on-navigation behavior.
- Camera shutdown releases tracks even if MediaRecorder.stop throws.

## Evidence

- `bounded-recording.test.js`: six deterministic scenarios covering exact-byte boundary, oversize, empty, start/stop/recorder failures, track interruption, duration limit, stale screen, WebM factory and recovery controls.
- Targeted recorder/picker/performance suite: 12/12 passed.
- Full release:check PASS: 70 test files; 1,000 synthetic actors; zero synthetic issues; local health PASS; no external network, real funds or incremental spend.
- Existing source-size budgets unchanged. Logic moved into `public/bounded-recording.js`, served with HTTP 200.
- Running index updated to `20260912-camera2`.

## Honest boundary

No real camera/microphone, mobile-browser rendering or device-memory measurements were performed. Synthetic event doubles verify lifecycle rules, not encoder/device behavior. HJ-10 remains FIXED-CANDIDATE pending physical-device replay.

## Next

Continue camera permissions/retry and source/editor/publish draft-preservation journey. Render/device validation is still required; the prior saved Browser restriction has not been bypassed. Do not translate passing source/behavior tests into a human UX approval.
