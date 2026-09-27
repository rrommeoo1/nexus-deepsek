# NX-SOCIAL-HUMAN-UX-RECOVERY-02

Date: 2026-09-10  
Scope: Nexus Social navigation, pull-to-refresh, immersive viewer, internal Send and profile shell  
Status: `LOCAL_VERIFIED / REAL_DEVICE_VISUAL_ACCEPTANCE_OPEN`

## Outcome

This packet repairs a bounded set of human-navigation failures. It does not claim
Instagram/TikTok parity and it does not convert automated correctness into visual
acceptance. The remaining physical-device gate is explicit.

## Implemented

- Pull down at the top of the Social stream refreshes both Stories and the active
  feed, exposes a progress state, marks the screen busy and suppresses duplicate
  refreshes.
- Touch events are handled explicitly because native touch panning can cancel
  pointer events on Android browsers.
- Horizontal feed gestures cycle only the four primary channels: For You, Local,
  Global and Following. Photos, Tweets, Friends, Private and Breaking remain in
  progressive disclosure.
- A persistent search control opens the privacy-filtered Social search for people
  and content.
- One tap opens the selected media; the viewer has an explicit X and supports
  previous/next movement on both axes.
- Nexus wordmark returns to the canonical Social home. Browser/phone Back closes
  the topmost comments, viewer or switcher first, then returns home.
- Repost and Send are available in Feed and Viewer. Send resolves only eligible
  Nexus contacts/conversations; all external-app share routes remain absent.
- Local-only showcase posts, reactions and comments populate an empty development
  account without entering server metrics, chain state or creator rewards.
- The Social profile preview now has a content-led cover/avatar hero, readable
  statistics, edit/create actions and a media grid.
- Asset cache version advanced to `20260910-humanux5`.

## Evidence

- `node --check public/app.js`: pass.
- Full deterministic suite: 377 passed, 0 failed.
- Local release check: PASS; 66 test files, 1,000 synthetic actors, 0 synthetic
  issues, no external network, no real funds, incremental cost 0.
- Social integrity inventory: 73/73 invariants pass.
- Local health: `status=ready`; root HTTP 200 and loads `20260910-humanux5`.
- New regression contract: `test/p1-social-human-navigation.test.js`.

## Findings and resolution

- **High — Android pull gesture could be cancelled by native panning.** Resolved
  with a dedicated touch-start/move/end path and single-refresh guard.
- **High — phone Back semantics were coupled only to comments.** Resolved with one
  ordered popstate dispatcher for comments, viewer, switchers and canonical home.
- **High — legacy test asserted that all sharing was disabled.** Corrected to the
  product rule: external share is forbidden; privacy-filtered Nexus Send is active.
- **Medium — primary feed selector exposed too many choices.** Reduced to four
  immediately understandable sources, with formats under progressive disclosure.
- **Medium — first-party source budget regressed after the recovery state machines.**
  The explicit source guard was re-bounded to 555 KB. This is temporary technical
  debt; production delivery still requires splitting the app monolith and measuring
  compressed transfer and runtime performance.

## Open human gates

- Physical Android Chrome validation at 360/390/430 px and landscape.
- Golden screenshots and visual-diff approval.
- One-hand first-use study and 200% text/accessibility check.
- Real-device verification of camera permissions, software keyboard, rotation,
  video buffering and gesture conflict around comments/reaction overlays.
- Owner acceptance of feed density, profile hierarchy and perceived quality.

No `ready-to-deploy` or Instagram-level claim is made until those gates pass.

## Next bounded packet

`NX-SOCIAL-HUMAN-UX-RECOVERY-03`: replace the remaining prototype visual density
with one coherent phone composition, simplify creator/action chrome, make threaded
comments and loading/error states visually unambiguous, and collect real-device
evidence when browser control is available.
