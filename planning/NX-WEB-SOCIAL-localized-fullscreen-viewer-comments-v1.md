# Nexus Social — localized full-screen viewer and comments v1

Packet: `NX-WEB-SOCIAL-P01-LOCALIZE-FULLSCREEN-VIEWER-AND-COMMENTS-041`  
Date: 2026-09-04  
Environment: local deterministic, zero external network, zero real funds, zero incremental cost

## Outcome

The full-screen continuous media viewer and comment conversation controls now use
the active Social persona locale in Romanian, English, Polish and Arabic. This
includes the viewer navigation, creator identity/actions, reaction tray, save,
audio, comments shortcut, comment loading/empty/error states, replies, edit,
withdraw, report and mutation feedback.

Creator display names use automatic bidi isolation and Nexus handles remain LTR
inside Arabic UI. The full-screen dialog keeps a stable accessible name through a
localized `aria-labelledby` target. Cached application, locale and stylesheet
generations advance together for phone refreshes.

Comments remain real threads: replies preserve `parent_id`, are rendered under
their parent and keep a tombstone when withdrawn. Reply mode can now be cancelled
without closing the panel or accidentally posting under the wrong parent. The
bottom application dock remains absent while the in-feed comment drawer is open.

The full-screen action overflow is now a real adjacent menu. It contains internal
Not interested and Report actions; the visible ellipsis is no longer a misleading
direct-report shortcut. Not interested removes the item from the current feed and
closes the viewer after the server acknowledges the feedback.

External sharing remains disabled, and this packet introduces no external intent,
provider, payment or chain submission.

## Findings resolved

- **High:** a failed or malformed comments response was presented as an empty
  conversation. It now renders a stable localized error and explicit Retry, without
  exposing backend detail.
- **Medium:** Reply mode had no local cancellation path. A localized cancel control
  clears `parent_id`, restores the input prompt and keeps the panel usable.
- **Medium:** the viewer ellipsis claimed “more options” but invoked Report directly.
  It now opens a colocated internal action menu that closes on selection, outside
  click or Escape.
- **Medium:** comment reaction/edit/withdraw/create failures either leaked raw
  backend strings or failed silently. They now use stable localized outcomes.
- **Medium:** full-screen labels and dynamic identities mixed Romanian literals into
  EN/PL/AR and could reorder under RTL. Catalogue lookup and bidi isolation now
  cover the bounded surface.
- **Medium:** dynamic `aria-label` markup did not satisfy the modal accessibility
  contract. A stable `aria-labelledby` relationship fixed the regression.

## Verification

- Syntax checks: PASS for `app.js` and `interface-locale.js`.
- Focused tests including modal accessibility: `116/116` PASS.
- Full suite: `209/209` PASS across 27 test files.
- Release check: PASS; 1,000 isolated `SYSTEM_TEST` actors; 0 issues.
- Production probes: health PASS, insecure API denied, isolated data true.
- External network: false; real funds: false; incremental cost: 0.

The capacity-constrained worker cannot provide a fresh independent verdict. This
packet therefore claims `PASS_LOCAL_PRIMARY_REVIEW_PENDING`, not an independent
T0/T1 pass. Native language approval, real phone/desktop RTL/LTR visual journeys,
screen-reader validation and trusted-HTTPS device testing remain external gates.

## Scope boundary

This packet covers the full-screen viewer and comment conversation behavior. Trust
Lens/moderation sheets, Create, Live, Messages, Profile and unauthenticated login
copy remain later bounded localization packets. Public deployment and every
external production gate remain disabled.
