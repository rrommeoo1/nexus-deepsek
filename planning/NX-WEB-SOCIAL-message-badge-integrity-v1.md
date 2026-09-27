# Nexus Social — unified message badge integrity v1

Packet: `NX-WEB-SOCIAL-P01-MESSAGE-BADGE-INTEGRITY-072`  
Date: 2026-09-05  
Environment: local deterministic, zero external network/funds/cost

## Outcome

The unified inbox badge is now bound to the authenticated user and latest request.
The API returns the exact requested persona/box plus a server-side privacy marker;
the client requires `all/inbox`, caps the list at 100, rejects duplicate or invalid
conversation IDs and accepts unread counts only as bounded non-negative integers.

Malformed, failed or stale responses preserve the last verified badge instead of
showing a false zero. The aggregate is capped before navigation rendering, and
logout/landing invalidates pending work and clears the authenticated badge.

## Verification

- Syntax checks: PASS.
- Focused client badge check `1/1` PASS; focused unified messaging API `1/1` PASS.
- Full suite `234/234` PASS across 27 files.
- Release PASS; 1,000 isolated `SYSTEM_TEST` actors; zero issues.
- External network, real funds and incremental cost: zero.

Verdict: `PASS_LOCAL_PRIMARY_REVIEW_PENDING`; production push notification badges
remain separately gated and are not inferred from this in-app state.
