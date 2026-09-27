# Nexus Social — localized Account sessions v1

Packet: `NX-WEB-SOCIAL-P02-LOCALIZE-ACCOUNT-SESSIONS-057`  
Date: 2026-09-05  
Environment: local deterministic, zero external network, zero real funds, zero incremental cost

## Outcome

The Account Center session inventory and password/xPortal revocation entry are now
localized in Romanian, English, Polish and Arabic. A latest-request gate bound to
the selected persona and attached screen rejects out-of-order refreshes.

Session responses fail closed unless the collection, IDs, coarse device labels,
persona, timestamps and current-session marker are valid. Exactly one current
session is required and rendering is capped at 100 entries. Password-based revoke
uses one explicit stable idempotency key, blocks double submission, rejects detached
completion and never displays raw backend errors. xPortal step-up remains required
for accounts without an email credential.

## Findings resolved

- **High:** concurrent refresh responses could overwrite the current inventory.
- **High:** malformed session metadata was trusted before rendering/actions.
- **High:** revoke lacked an explicit visible replay key and stale-screen guard.
- **Medium:** inventory and failure states were Romanian-only and raw errors could
  reach toasts.

## Verification

- Syntax/catalogue checks: PASS; focused audit `2/2` PASS.
- Full suite: `220/220` PASS across 27 files.
- Release check: PASS; 1,000 `SYSTEM_TEST` actors; 0 issues.
- External network, real funds and incremental cost: zero.

Verdict: `PASS_LOCAL_PRIMARY_REVIEW_PENDING`. Native-device review, trusted HTTPS
and independent T0/T1 review remain gates. E2EE recovery and GDPR lifecycle are
separate packets.
