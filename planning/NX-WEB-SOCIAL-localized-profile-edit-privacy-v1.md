# Nexus Social — localized profile edit and privacy v1

Packet: `NX-WEB-SOCIAL-P02-LOCALIZE-PROFILE-EDIT-PRIVACY-055`  
Date: 2026-09-05  
Environment: local deterministic, zero external network, zero real funds, zero incremental cost

## Outcome

The Social profile editor is localized in Romanian, English, Polish and Arabic and
keeps each Nexus persona independent. Display name, bio, avatar, cover, profile
kind, visibility, message policy, content languages, Near consent/region and paid
private-access settings are validated before any mutation. The server remains the
authoritative Privacy Matrix and media-grant boundary.

One form submission retains one stable `Idempotency-Key`; an actual edit rotates
the key and a disabled submit prevents duplicate dispatch. The selected persona is
captured before asynchronous media uploads. A completion is ignored when the form
is detached or the active persona changed, preventing a delayed Social upload from
being committed to Work, Dating, Travel or Market.

Avatar and cover inputs admit JPEG, PNG and WebP only, enforce bounded size before
upload and continue through the existing resumable pipeline. Existing and returned
media paths are accepted only through the internal content-addressed URL allowlist.
Raw backend/provider errors are replaced with controlled, localized recovery copy.

## Findings resolved

- **High:** a persona switch during asynchronous avatar/cover upload could send the
  final update to a different active persona. The request and response are now bound
  to the persona captured when the screen loaded.
- **High:** the form did not provide an explicit stable intent key or single-flight
  protection. It now replays one exact intent and rejects duplicate submission.
- **High:** stored or returned profile media paths could be reused without the
  client-side internal-media boundary. Both are now allow-listed fail-closed.
- **Medium:** free-form locale, region, price, duration and policy values reached the
  server without local feedback. Bounded enum/format/range checks now run first.
- **Medium:** edit, privacy, progress and error states were Romanian-only and could
  expose raw errors. The bounded surface now has parity-checked RO/EN/PL/AR copy.

## Verification

- Syntax checks: PASS for `app.js` and `interface-locale.js`.
- Focused profile/privacy audit: `3/3` PASS.
- Full product suite: `218/218` PASS across 27 test files.
- Release check: PASS; 1,000 isolated `SYSTEM_TEST` actors; 0 issues.
- External network: false; real funds: false; incremental cost: 0.

Verdict: `PASS_LOCAL_PRIMARY_REVIEW_PENDING`. Production payment settlement,
native-device locale/accessibility review and independent T0/T1 review remain gated.

## Scope boundary

This packet covers the profile editor and its privacy controls. Wallet/username,
access/recovery/lifecycle surfaces, login localization, real payment settlement and
native device verification remain separate packets.
