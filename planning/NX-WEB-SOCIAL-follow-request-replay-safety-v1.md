# Nexus Social — follow request replay safety v1

Packet: `NX-WEB-SOCIAL-P01-FOLLOW-REQUEST-REPLAY-SAFETY-069`  
Date: 2026-09-05  
Environment: local deterministic, zero external network/funds/cost

## Outcome

Incoming Accept/Decline and outgoing Cancel actions now carry explicit stable
idempotency keys that survive UI reloads after ambiguous failures. The existing
single-flight gate prevents overlapping decisions. Keys are removed only after an
exact valid response confirms the requested decision or cancellation.

Incoming/outgoing lists are capped at 80 rows, bound to the active persona and
validated before render. Request IDs, counterpart IDs, pending status, handle and
name must satisfy the contract; avatars resolve only through canonical internal
media paths. Decision responses must echo the request and decision, while Cancel
must return both `active=false` and `request_pending=false`. Raw errors stay hidden.

## Verification

- Focused Follow-request replay-safety check `1/1` PASS.
- Full suite `231/231` PASS across 27 files.
- Release PASS; 1,000 isolated `SYSTEM_TEST` actors; zero issues.
- External network, real funds and incremental cost: zero.

Verdict: `PASS_LOCAL_PRIMARY_REVIEW_PENDING`; real-device retry storms and
independent privacy/security review remain external gates.
