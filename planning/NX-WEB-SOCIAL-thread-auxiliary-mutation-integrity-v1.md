# Nexus Social — thread auxiliary mutation integrity v1

Packet: `NX-WEB-SOCIAL-P01-THREAD-AUXILIARY-MUTATION-INTEGRITY-077`  
Date: 2026-09-06  
Environment: local deterministic, zero external network/funds/cost

## Outcome

Typing, meeting scheduling and group administration are now denied when the active
profile does not match the conversation profile. Every successful response exposes
a normalized intent containing the exact conversation, actor, profile and action;
the browser validates that intent and the returned resource before changing UI.
Typing uses bounded stable retry keys instead of a new implicit key for each attempt.

Direct-call start, accept/decline, signaling and end now use explicit bounded replay
keys and validate call identity, conversation, participants, profile, mode and state.
Signaling results bind the sender, nonce and type and continue to persist only a
durable payload hash—not SDP or ICE. A previously delivered signal replay now reports
`delivered: true`, preventing false client failure after a lost HTTP response.

## Verification

- JavaScript syntax: PASS.
- Focused auxiliary/inbox/call checks: PASS.
- Full suite: `235/235` PASS across 27 files.
- Release gate: PASS with 1,000 isolated `SYSTEM_TEST` actors and zero issues.
- External network, real funds and incremental cost: zero.

Verdict: `PASS_LOCAL_PRIMARY_REVIEW_PENDING`. Real-device WebRTC/E2EE, production
TURN/SFU capacity, HTTPS and independent T0/T1 review remain separate release gates.
