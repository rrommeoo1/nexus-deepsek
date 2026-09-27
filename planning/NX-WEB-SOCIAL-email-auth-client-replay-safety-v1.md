# Nexus Social — email auth client replay safety v1

Packet: `NX-WEB-AUTH-P02-EMAIL-CLIENT-REPLAY-SAFETY-060`  
Date: 2026-09-05  
Environment: local deterministic, zero external network/funds/cost

## Outcome

Email login and account creation now use explicit intent-bound idempotency keys,
single-flight submission, local validation, disabled/busy states and detached-DOM
guards. A retry keeps the same signup challenge and wallet proof instead of
creating another identity. Raw backend and cryptographic errors are not rendered.

The automatic MultiversX wallet is encrypted and staged as pending before the
account command. It becomes active only when the server confirms the exact same
address and session. An authenticated account can recover a matching staged
wallet after a lost response; a different account cannot promote it.

## Verification

- Auth clients rebuilt locally without network access.
- Focused auth/replay checks `3/3` PASS.
- Full suite `223/223` PASS across 27 files.
- Release PASS; 1,000 isolated `SYSTEM_TEST` actors; zero issues.
- External network, providers, real funds and incremental cost: zero.

Verdict: `PASS_LOCAL_PRIMARY_REVIEW_PENDING`; production email verification,
trusted HTTPS, real xPortal attestation, native-device testing and independent
release review remain external gates.
