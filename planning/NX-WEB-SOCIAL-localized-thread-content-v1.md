# Nexus Social — localized secure thread content v1

Packet: `NX-WEB-SOCIAL-P02-LOCALIZE-THREAD-CONTENT-051`  
Date: 2026-09-05  
Environment: local deterministic, zero external network, zero real funds, zero incremental cost

## Outcome

The bounded conversation-content surface now uses the active Romanian, English,
Polish or Arabic locale for request decisions, message states, E2EE safety,
attachments, call capability and recovery copy. Numbers and timestamps use the
active interface locale. Backend failure text is mapped to controlled user copy;
raw errors, call reasons and unsafe status explanations are not rendered.

Conversation and group-request decisions retain a stable mutation key per visible
button, send an explicit `Idempotency-Key`, disable both decisions while the
request is pending and ignore completion after the user leaves the thread. A
failed request can be retried with the same key; a successful decision refreshes
only the still-active conversation.

Plain attachments render only when the server URL matches the exact internal
content-addressed `/media/<sha256>.<extension>` shape. External, absolute,
protocol-relative, malformed and unexpected paths become no attachment. E2EE
attachments remain explicit local decrypt actions. Their temporary object URLs
are tracked and revoked on thread reload or close to avoid retaining decrypted
blobs longer than the active view.

Safety-number verification remains explicit and single-flight. Invalid device or
verification material keeps E2EE disabled. Missing-device collections are guarded,
and call controls describe only locally proven P2P capability; group calls remain
blocked without SFU.

## Findings resolved

- **High:** a backend-provided attachment URL could reach an image, video or
  download element without an internal-path allowlist. Rendering is now restricted
  to content-addressed Nexus media paths.
- **High:** accept/decline actions could be submitted concurrently without a stable
  client mutation identity. Both controls are now single-flight and replay-safe.
- **Medium:** request, safety, attachment and call states mixed Romanian literals
  with raw backend/device details. They now use parity-checked controlled copy.
- **Medium:** decrypted attachment object URLs survived until browser cleanup.
  Nexus now revokes them when the active thread reloads or closes.
- **Medium:** malformed `users_without_devices` could break E2EE readiness copy.
  The collection now fails closed to an empty list.

## Verification

- Syntax checks: PASS for `app.js`, `interface-locale.js` and `audit.test.js`.
- Focused messaging/E2EE audit: `13/13` PASS.
- Full product suite: `214/214` PASS across 27 test files.
- Release check: PASS; 1,000 isolated `SYSTEM_TEST` actors; 0 issues.
- Production probe: health PASS, insecure API denied, isolated data true.
- External network: false; real funds: false; incremental cost: 0.

The independent worker remains capacity-limited, so the local verdict is
`PASS_LOCAL_PRIMARY_REVIEW_PENDING`. Native-device RTL/LTR review, trusted HTTPS,
formal cryptographic review and production SFU/TURN remain external gates.

## Scope boundary

This packet covers the visible thread content, request decisions, safety-number
controls, attachment rendering/decryption lifetime and direct-call capability
copy. Meeting creation, group administration and Activity Center remain separate
bounded localization/audit packets. The E2EE protocol itself was not changed.
