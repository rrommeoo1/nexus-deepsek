# Nexus Social — localized Profile shell v1

Packet: `NX-WEB-SOCIAL-P02-LOCALIZE-PROFILE-SHELL-054`  
Date: 2026-09-05  
Environment: local deterministic, zero external network, zero real funds, zero incremental cost

## Outcome

The Profile shell and own-profile preview now support Romanian, English, Polish and
Arabic. Loading, error/retry, section tabs, profile identity, visibility, counters,
empty bio/posts and accessible media labels use parity-checked locale copy.

Profile/account loading uses a latest-request generation bound to the selected
persona and connected viewport. A delayed response cannot render after a persona or
screen change. The public profile is mandatory and fails closed to a recoverable
error; a missing Account Center response becomes an explicit offline-safe account
shape rather than crashing or displaying partial wallet state.

Preview profile/count/post collections and positive IDs are guarded. Avatar, cover
and post thumbnails render only from exact content-addressed internal media paths;
malformed or external URLs are rejected. Counts are non-negative and locale-aware.

## Findings resolved

- **High:** concurrent Profile loads could render an earlier persona after a rapid
  switch. Latest-request and persona/viewport checks now reject stale completion.
- **High:** unvalidated avatar, cover or post media paths could reach preview media
  elements. Only exact internal content-addressed paths are accepted.
- **Medium:** failed Account/Profile responses and malformed counts/posts could
  crash or produce partial UI. Boundaries now fail closed with recovery.
- **Medium:** the shell/preview mixed Romanian-only copy with raw enum labels. This
  bounded surface now uses RO/EN/PL/AR catalogue entries.

## Verification

- Syntax checks: PASS for `app.js`, `interface-locale.js` and `audit.test.js`.
- Focused Profile audit: `2/2` PASS.
- Full product suite: `217/217` PASS across 27 test files.
- Release check: PASS; 1,000 isolated `SYSTEM_TEST` actors; 0 issues.
- External network: false; real funds: false; incremental cost: 0.

Verdict: `PASS_LOCAL_PRIMARY_REVIEW_PENDING`; the independent worker remains
capacity-limited. Native-device RTL/LTR and linguistic review remain external.

## Scope boundary

This packet covers load/retry, section navigation and the own-profile preview.
Wallet/username, profile editing/privacy, sessions/E2EE/GDPR and lifecycle dialogs
remain separate bounded localization and recovery packets.
