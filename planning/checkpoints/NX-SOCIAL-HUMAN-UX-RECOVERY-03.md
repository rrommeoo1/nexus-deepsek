# NX-SOCIAL-HUMAN-UX-RECOVERY-03

Date: 2026-09-10  
Trigger: owner phone evidence showing a navigation trap and non-working refresh  
Status: `LOCAL_FIX_VERIFIED / OWNER_PHONE_RETEST_REQUIRED`

## Root cause

The Feed, Relations and Nexus-mode switchers were marked as modal dialogs. The
shared accessibility manager correctly isolated every sibling of a modal with
`inert`, but that also disabled the product header and bottom navigation. The
result matched the screenshot exactly: X worked inside the sheet while Home and
the other header controls could not receive interaction.

The first refresh implementation listened primarily on the scrolling feed. A
gesture beginning in the Stories area was outside that listener, and Android can
also terminate pointer delivery when native panning takes ownership.

## Correction

- The three header switchers are now non-modal labelled navigation regions. They
  no longer isolate or disable the header and Home dock.
- Every bottom-navigation action closes open navigation switchers before routing.
- Nexus/Home, active switcher toggle, another header switcher, backdrop and X all
  provide valid escape/navigation paths.
- Pull-to-refresh now listens across the entire Social surface, including Stories.
- Android touch cancel completes a qualified pull instead of silently discarding it.
- Pull threshold reduced from 96 px to 64 px while keeping diagonal/horizontal
  gestures rejected.
- Gesture classification moved to `public/social-gesture.js`, a pure tested state
  decision rather than an untestable event-handler branch.
- Cache version advanced to `20260910-humanux6`.

## Evidence

- `node --check public/app.js`: pass.
- `node --check public/social-gesture.js`: pass.
- Full suite: 379 passed, 0 failed.
- Behaviour cases cover: valid top pull, pull away from top denied, left/right
  channel movement, ambiguous movement ignored and invalid input denied.
- Release check: PASS; 1,000 synthetic actors, 0 synthetic issues, no external
  network, no funds, cost 0.
- Running server: health ready, root HTTP 200, cache `humanux6`, gesture module
  HTTP 200.

## Process finding

The earlier audit relied too heavily on static source assertions. Those checks
proved that close handlers existed, but did not prove that the controls remained
interactive after modal isolation. From this packet forward, navigation findings
require a behavioural state test plus owner/device evidence before closure.

## Remaining gate

The implementation is locally verified but must be retested on the same phone.
If any control still fails, the finding remains P0H and is not considered closed.
