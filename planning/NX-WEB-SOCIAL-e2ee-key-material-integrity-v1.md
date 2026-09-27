# Nexus Social — E2EE key-material integrity v1

Packet: `NX-WEB-SOCIAL-P02-E2EE-KEY-MATERIAL-RESULT-INTEGRITY-080`  
Date: 2026-09-06  
Environment: local deterministic, zero external network/funds/cost

## Outcome

The key-material endpoint now denies cross-profile reads and declares the exact
conversation, viewer and active profile authorized by the Privacy Matrix. It also
returns a bounded active-participant set so the browser can prove that every public
device belongs to an expected participant.

Before safety-number display or encryption, the browser validates conversation,
viewer, profile, protocol, participant cardinality, device ownership, per-user
device limits, readiness and all fail-closed states. It rejects extra private JWK
fields, duplicate or unordered identities, a missing local device and inconsistent
status. The canonical device-set SHA-256 commitment is recalculated locally.

The send path now passes the exact authenticated owner/profile through device
registration and key-material validation. This fixes a regression exposed by the
079 owner-binding control while preserving stable message idempotency.

## Verification

- JavaScript syntax: PASS.
- Focused API/browser/audit checks: `140/140` PASS.
- Full suite: `239/239` PASS across 27 files.
- Release gate: PASS with 1,000 isolated `SYSTEM_TEST` actors and zero issues.
- External network, real funds and incremental cost: zero.

Verdict: `PASS_LOCAL_PRIMARY_REVIEW_PENDING`. Formal cryptographic review,
real-device interoperability and a trusted HTTPS edge remain release gates.
