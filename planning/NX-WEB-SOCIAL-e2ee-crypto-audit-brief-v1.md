# Nexus Social — E2EE external cryptography audit brief v1

Packet: `NX-WEB-SOCIAL-P01-E2EE-CRYPTO-PROTOCOL-REVIEW-PREPARATION-036`  
Prepared: 2026-09-03  
Classification: audit input, **not** an independent audit or production approval

## 1. Audit objective

Assess whether the current Nexus browser E2EE implementation preserves message and
attachment confidentiality/integrity against the stated adversaries, enforces the
current device/member set without downgrade, and fails safely across lifecycle,
replay, recovery and maximum-cardinality conditions. The auditor must also decide
whether Nexus requires a standard ratcheting protocol before public release.

The reproducible source inventory is:

```powershell
cd apps/nexus-web
npm run audit:e2ee:inventory
```

The command uses only local files, emits their SHA-256 values and fails nonzero if
any current construction-scoped implementation marker is absent. The generated
`invariant_summary.total` is the authoritative count. A passing inventory proves
only that the reviewed source shape is present; it does not prove cryptographic
security.

## 2. Protocol map

| Surface | Current construction | Persistent server data |
|---|---|---|
| Direct text | static device P-256 ECDH → HKDF-SHA-256 → AES-256-GCM per recipient device | ciphertext/IV/AAD hash, sender/recipient device IDs, epochs and message metadata |
| Group text | fresh random 256-bit AES-GCM content key per message; payload encrypted once; content key wrapped per active device with the direct construction | one shared ciphertext plus one opaque wrapper per active device and metadata |
| Attachment | fresh random 256-bit AES-GCM content key; opaque resumable container; key and integrity-bound metadata carried inside direct/group message payload | encrypted object, hash, size/type boundary and ordinary message metadata |
| Device authorization | exact sorted device-set commitment plus conversation/member epoch and each participant account-device epoch | public device JWKs, statuses, epoch counters and commitments |
| Safety number | canonical conversation/device-set digest retained locally after explicit verification | public device directory and commitment; no claim of automatic peer authentication |
| Recovery | password-derived PBKDF2-SHA-256 (600,000 iterations) wrapping an ECDH recovery private JWK with AES-256-GCM; explicit pending activation; future messages only | public recovery JWK, activation metadata/status; encrypted portable package stays client-side |

New group writes must use `e2ee_group_v1`; direct writes must use `e2ee_v1`.
Historical direct v1 ciphertext remains readable, but new messages require the v2
epoch binding. The server rechecks device/member/epoch state inside the write
transaction and returns only the authenticated requesting device's envelope.
Disappearing-message expiry is validated, committed for idempotent replay and
enforced by the server; it is **not** inside the client AEAD payload/AAD and is not
cryptographically authenticated against a compromised server.

## 3. Assets and trust boundaries

### Protected assets

- device private ECDH keys and recovery private keys;
- clear message/attachment content and content keys;
- authenticity/integrity of conversation, sender/recipient device, nonce,
  membership/device set, epoch and attachment bindings;
- confidentiality boundaries between personas, conversations, blocked actors,
  removed/revoked devices and pre-join history.

### Trusted components and assumptions

- The browser secure context, Web Crypto implementation and OS randomness behave
  correctly. XSS or a compromised browser profile can read client plaintext and
  use locally available keys.
- The Nexus server authenticates accounts and enforces authorization, but is not
  trusted with plaintext or private device keys. It sees relationship, device,
  timing, size and conversation metadata.
- The server supplies the public-device directory. A compromised server may try
  key substitution. Users only gain detection after comparing safety numbers over
  a trusted independent channel; the current design does not automatically bind a
  device key to a wallet/account signature.
- TLS is required against network attackers. E2EE does not hide metadata and does
  not replace HTTPS origin integrity.
- Recovery security is bounded by the user's passphrase entropy, KDF resistance,
  browser security and correct activation handling.

## 4. Adversaries in scope

1. Unauthenticated outsiders and authenticated non-members attempting ciphertext,
   media or key-material reads.
2. Blocked, removed, pre-join, revoked or stale devices attempting future/history
   access or racing a membership/device transition.
3. Malicious participants submitting missing/duplicate/rebound envelopes,
   malformed JWK/base64, altered AAD/ciphertext, replayed nonce or oversized fanout.
4. Database reader or storage/CDN observer without client keys.
5. Compromised Nexus server attempting public-key substitution or returning a
   stale/incomplete device set.
6. Attacker obtaining a long-term device private key or a recovery package.
7. Availability attacker targeting the 50-member × 10-device bound.

Out of scope for a claim of protection: compromised endpoint/browser/XSS while
plaintext is open, coercion/screenshots by a legitimate recipient, traffic-analysis
anonymity, and security of third-party OS backup/sync outside Nexus controls.

## 5. Properties currently claimed locally

- AES-GCM authenticates the encrypted payload under unambiguous JSON AAD fields;
  conversation, nonce, devices, exact set and epoch commitments are bound.
- New writes fail closed when a participant has no valid device, exceeds the
  device cap, is blocked, or the current set/epoch changed before commit.
- Server storage and the E2EE message API do not require plaintext, content keys or
  client private keys.
- Direct/group mode downgrade, wrapper omission/duplication, shared-ciphertext
  tamper, attachment substitution, cross-conversation reads and nonce rebinding
  are covered by deterministic local tests.
- Expiry is only server-validated metadata in the idempotent request commitment;
  no client AEAD-authenticated expiry property is claimed.
- Group content-key bytes and attachment content-key byte arrays are overwritten
  in `finally` blocks on the JS-visible buffer. No claim is made about copies
  retained inside the browser/engine.

## 6. Properties explicitly not claimed

- independent audit, formal verification or Signal compatibility;
- identity-key signatures, automatic peer identity authentication or key
  transparency;
- Double Ratchet, ratcheting Sender Keys, forward secrecy or post-compromise
  security;
- metadata anonymity, sealed sender or traffic-analysis resistance;
- malware scanning of client-encrypted attachments;
- production-grade interoperability/performance on real Android/iOS devices.

Because long-term static device ECDH keys derive wrapper/message keys, compromise
of one such key can expose retained ciphertext where the peer public key and
binding metadata are available. Epoch changes authorize future membership/device
sets but do not by themselves provide forward secrecy. This must be treated as a
release-design decision, not hidden by UI wording.

## 7. Required auditor work programme

### Cryptographic construction

- Verify domain separation, HKDF inputs, key roles, AES-GCM nonce/key domains,
  random-key lifecycle, JWK validation and canonical encodings.
- Attempt cross-mode, cross-conversation, cross-device, reflection, unknown-key
  share, public-key substitution and key-compromise attacks.
- Review whether hash commitments add the intended binding and whether any
  unauthenticated server field can redirect key derivation or AAD.

### State and concurrency

- Model device add/revoke/recovery activation, block/unblock, request accept,
  member add/remove/leave, expiry/purge and idempotent retry as concurrent state
  machines.
- Confirm no transaction interleaving can persist an unauthorized wrapper or
  erase evidence required to reject a conflicting replay.
- Review legacy migration and history-boundary semantics separately from new
  writes.

### Client and recovery

- Test malformed/huge packages, wrong password, KDF resource exhaustion, stale
  activation, IndexedDB transaction faults, interrupted download and browser
  restore/clone behavior.
- Review CSP/XSS exposure, key extractability during generation/import, garbage
  collection limitations and secure-context/origin assumptions.

### Availability and interoperability

- Repeat 1/10/50/100/500-device cases on supported Android/iOS/desktop browsers
  over trusted HTTPS, including backgrounding, memory pressure and interruption.
- Measure complete request framing/storage, not just ciphertext bytes, and probe
  malformed input before allocation/decode.

## 8. Release decisions required after audit

1. Adopt an established audited protocol/library (preferred when feasible) or
   obtain a complete review of this custom construction.
2. Decide the required forward-secrecy and post-compromise-security guarantees;
   implement and re-audit a ratchet if those guarantees are required.
3. Decide whether wallet/device signatures plus a verifiable key-transparency log
   are required to reduce server key-substitution trust.
4. Set supported device/browser matrix and measured group/device limits.
5. Approve user-facing wording that accurately distinguishes E2EE content from
   visible metadata and unscannable attachments.

Until those decisions and external checks are complete, the production E2EE gate
remains blocked. Local `PASS` evidence cannot lift it automatically.

## 9. Local closure update — 2026-09-06

Packets 072–082 added strict response/intent/replay checks around the protocol:
conversation reads and writes, realtime recipient invalidations, device/recovery
mutations, key-material scope and commitment validation, exact decryption context,
bounded internal attachment streaming and decrypted blob cleanup. The inventory now
hashes 20 artifacts and checks 40 construction-scoped invariants. These additions
reduce integration and authorization risk but do not change any non-claim above or
replace the required independent cryptographic audit.
