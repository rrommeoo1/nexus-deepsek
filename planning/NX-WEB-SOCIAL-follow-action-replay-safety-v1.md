# Nexus Social — follow action replay safety v1

Packet: `NX-WEB-SOCIAL-P01-FOLLOW-ACTION-REPLAY-SAFETY-068`  
Date: 2026-09-05  
Environment: local deterministic, zero external network/funds/cost

## Outcome

The shared Follow/Unfollow action used by feed, fullscreen viewer and public profile
now executes one intent at a time with an explicit stable idempotency key. Rapid
duplicate taps are suppressed. A failed or lost response retains the same key for
an exact retry; a confirmed mutation clears it before the next intent.

Target identity, active persona and response booleans are validated fail-closed.
Detached or cross-persona completions cannot update the UI. A successful result
synchronizes every visible control for the same user, and a Devnet receipt is shown
only when its transaction hash has the expected 64-hex shape. Raw errors stay hidden.

## Verification

- Focused Follow replay-safety check `1/1` PASS.
- Full suite `230/230` PASS across 27 files.
- Release PASS; 1,000 isolated `SYSTEM_TEST` actors; zero issues.
- External network, real funds and incremental cost: zero.

Verdict: `PASS_LOCAL_PRIMARY_REVIEW_PENDING`; real-device rapid-tap/network replay
and independent privacy/security review remain external gates.
