# Nexus Social — thread response integrity v1

Packet: `NX-WEB-SOCIAL-P01-THREAD-RESPONSE-INTEGRITY-075`  
Date: 2026-09-05  
Environment: local deterministic, zero external network/funds/cost

## Outcome

The active conversation now accepts a response only when it is bound to the exact
conversation, requesting device and active viewer persona. The server supplies
that normalized query contract and an explicit server-side privacy marker.

The client validates the complete conversation summary, ordered unique messages,
participant/sender bindings, internal-only attachments, receipts, E2EE envelope
shape, meetings, calls and typing indicators before rendering anything. A malformed
row rejects the complete response and exposes the existing recoverable retry state;
it is never silently removed to create a misleading partial thread. Meeting reads
are capped at 100 rows in the repository.

## Verification

- JavaScript syntax: PASS.
- Focused thread/API checks `2/2` PASS.
- Audit contract `61/61` PASS.
- Full suite `234/234` PASS across 27 files.
- Release PASS; 1,000 isolated `SYSTEM_TEST` actors; zero issues.
- External network, real funds and incremental cost: zero.

Verdict: `PASS_LOCAL_PRIMARY_REVIEW_PENDING`; real-device E2EE review, production
capacity calibration and independent T0/T1 review remain separate release gates.
