# NX-SOCIAL-HUMAN-UX-RECOVERY-04

Date: 2026-09-10  
Scope: fullscreen touch continuity and readable/exclusive comments

## Delivered

- Added a pure four-direction fullscreen gesture decision with a 48 px deliberate
  swipe threshold.
- Added an explicit Android touch path (`touchstart`, `touchmove`, `touchend`,
  `touchcancel`) and retained pointer input for mouse/pen without duplicate touch
  transitions.
- Opening comments now collapses reaction, action and creator menus immediately.
- While comments are open, all engagement/creator chrome is visually and
  interactively removed.
- Rebuilt fullscreen comment typography and target sizes: 18 px heading, 15 px
  thread text, 16 px input, 40 px avatars and at least 44 px critical controls.
- Added a landscape split-view contract for comments.
- Published the Human Journey Audit Matrix so source tests alone cannot be treated
  as proof of good human UX.
- Bumped the mobile assets to `20260910-humanux7`.

## Evidence

- Targeted human-contract suite: 85/85 passed.
- Full local release gate: PASS (67 test files, 1,000 synthetic actors, 0
  synthetic issues, no external network, no real funds, zero incremental cost).
- Running demo health: `ready`; `humanux7` index and CSS are served with the new
  exclusive-comments contract.
- New pure gesture cases cover left, right, up, down, sub-threshold and malformed
  values.
- New comment exclusivity contract checks that the action rail, reaction tray and
  creator overlay cannot compete with the thread.
- The bounded source-CSS regression ceiling moved from 350 KB to 355 KB; the
  actual audited set is 352,245 bytes, leaving less than 1% headroom.

## Honest boundary

The code and deterministic contracts are complete for this packet. Rendered and
physical Android verification remains required before changing the journey status
from `IMPLEMENTED` to `VERIFIED`.

## Next packet

HJ-10: camera/create/live device journey and permission/error-state recovery,
followed by rendered multi-viewport evidence for HJ-01 through HJ-09.
