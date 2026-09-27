# Nexus Social — E2EE decryption context integrity v1

Packet: `NX-WEB-SOCIAL-P02-E2EE-DECRYPTION-CONTEXT-INTEGRITY-081`  
Date: 2026-09-06  
Environment: local deterministic, zero external network/funds/cost

## Outcome

Decryption now requires an exact match between message and envelope for message ID,
conversation, nonce, sender/recipient device, device-set commitment and epoch. Public
sender keys are allow-listed and canonical base64 lengths are checked before Web
Crypto receives any material. Direct ciphertext rejects group-only fields.

Decrypted payloads have strict type, timestamp, text, filename, MIME and size bounds.
Encrypted attachments accept only a content-addressed internal `/media/<sha256>.<ext>`
reference whose hash matches the authenticated payload. Downloads are streamed with
a 20 MB hard cap, metadata is canonical, and transient content-key bytes are wiped.

Historical direct E2EE v1 ciphertext remains readable only when both message and
envelope explicitly lack epoch fields. New unbound writes and every group message
remain denied. Decrypted blob URLs are revoked on thread change, navigation, profile
switch and page exit.

## Verification

- JavaScript syntax: PASS.
- Focused crypto/UI/audit checks: `148/148` PASS after legacy compatibility replay.
- Full suite: `240/240` PASS across 27 files.
- Release gate: PASS with 1,000 isolated `SYSTEM_TEST` actors and zero issues.
- External network, real funds and incremental cost: zero.

Verdict: `PASS_LOCAL_PRIMARY_REVIEW_PENDING`. Real-browser memory observation and
independent cryptographic review remain public-release gates.
