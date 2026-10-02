# Camera framing and creator draft stability — local evidence

Scope: creator camera preview/capture parity and protection against losing a post before publication. No production deployment or external provider was used.

## Changes

- Request a high-detail camera stream with soft `ideal` constraints so unsupported devices can still open the camera. Show the full camera frame, without crop or selfie mirror, in capture and review. Store the filter once in the edit manifest instead of baking it into the photograph and applying it again.
- Improve JPEG capture quality. The web upload cap remains 20 MB; the hidden video recording duration is now 60 seconds rather than 10 minutes so its bitrate does not collapse under that cap.
- Save selected media immediately, serialize draft writes, display save/failure state, and require a successful local save before moving from preview to publication details. A full draft quota no longer silently deletes earlier drafts.
- Make the publication thumbnail non-interactive. The explicit back/preview controls remain available, and the details fields remain in the same form.

## Verification

- `npm run release:check` in `apps/nexus-web`: PASS, 117 test files, 1,000 synthetic actors, isolated production smoke PASS, no external network or funds.
- Targeted camera/draft tests: stream constraints, capture framing/filter, video duration, immediate/ordered/retryable draft saves, and non-exit thumbnail.
- Local isolated browser flow: selected a synthetic image, entered title and description, tapped thumbnail and blank details area, returned to preview, advanced again, refreshed, reopened Drafts, and confirmed media/title/description were retained.

## Limits before release

- Browser automation cannot validate a physical Android phone camera sensor, autofocus, exposure, orientation metadata, or a real 60-second recording. These need device acceptance before production rollout.
- The requested resolution is a preference, not a guarantee; hardware and browser permissions determine the actual stream. Drafts are local to the current device/browser until separately synchronized.
- Production deploy remains blocked pending explicit owner confirmation.
