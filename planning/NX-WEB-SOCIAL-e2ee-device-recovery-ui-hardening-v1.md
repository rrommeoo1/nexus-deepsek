# Nexus Social — E2EE device and recovery UI hardening v1

Packet: `NX-WEB-SOCIAL-P02-E2EE-DEVICE-RECOVERY-UI-058`  
Date: 2026-09-05  
Environment: local deterministic, zero external network, zero real funds, zero incremental cost

## Outcome

The Account Center E2EE device inventory is localized in RO/EN/PL/AR and now
rejects stale, malformed, duplicate or oversized responses. Device identifiers,
labels, algorithms, status and timestamps are validated before rendering. Revoke
uses a stable explicit idempotency key, single-flight behavior and detached/persona
guards; server error text is never exposed.

Recovery remains explicit, client-encrypted and forward-only. Import now accepts
only JSON (or a `.json` file without a browser MIME) up to 64 KB. Expired pending
capabilities are cleared before activation. Provision, activation and restore ignore
completion after leaving the profile and use controlled failures instead of raw
cryptographic/provider errors. The cryptographic protocol itself was not changed.

## Findings resolved

- **High:** stale or malformed device inventories could become interactive.
- **High:** device revoke lacked a visible stable replay key and stale-screen guard.
- **High:** an expired recovered activation could remain actionable after refresh.
- **Medium:** recovery admitted any non-empty file under the size limit.
- **Medium:** internal exception messages could be exposed to the user.

## Verification

- Syntax/catalogue PASS; focused E2EE UI audit `4/4` PASS.
- Full suite `221/221` PASS across 27 test files.
- Release PASS with 1,000 isolated `SYSTEM_TEST` actors and zero issues.
- External network, real funds and incremental cost: zero.

Verdict: `PASS_LOCAL_PRIMARY_REVIEW_PENDING`. Formal cryptographic audit,
native-device verification and trusted HTTPS remain external gates.
