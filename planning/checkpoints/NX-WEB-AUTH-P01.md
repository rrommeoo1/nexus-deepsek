# Checkpoint — NX-WEB-AUTH-P01

## Identity

- Task: `NX-WEB-AUTH-P01` — audit and harden login plus automatic MultiversX wallet provisioning.
- Parent: `NX-WEB-FOCUS-001`.
- Status: `in_review`; final independent re-review is required on the sanitized subject.
- Risk: `T0`.
- Active focus: Auth first, then Social/Profile/Messages; all other verticals are deferred.
- Runtime: local LAN demo only, `0.0.0.0:3000`, incremental cost and real-fund effects `0`.

## Truthful user-visible contract

1. xPortal and email/password are the implemented login paths in the local demo.
2. Google and Facebook remain visibly unavailable until provider certification and the approved client-side wallet provisioner are both complete.
3. Email signup creates the Nexus account and five isolated personas, then binds a wallet key generated and encrypted only in that browser. The backend receives a signed public-address proof and never receives the private seed.
4. The local browser wallet is explicitly a demo adapter and must not receive real funds. xPortal is the recommended recoverable external wallet.
5. The server does not accept, decrypt, display or export a complete seed phrase/private key. After explicit owner approval, the six legacy encrypted server keystores were permanently deleted; the verified current count is zero.
6. No payment, mainnet transaction, real-fund operation or production OAuth flow is authorized by this packet.
7. Account/Profile exposes only address/network, provider and recovery posture, Nexus username, herotag availability, persona metadata and filtered positive MultiversX assets. Native BTC/SUI are never mislabeled as MultiversX balances.

## Implemented T0 remediation — 2026-08-23

- Password-reset bearer disclosure is closed: LAN reset returns no token and the unverified mail path is fail-closed. Reset confirmation and server recovery export are retired.
- Signup uses a short-lived email-bound challenge and Ed25519 proof from a browser-only key. The private seed is encrypted locally with scrypt plus authenticated encryption; the database stores only the public wallet address.
- Production startup validates configuration before importing the auth graph, requires explicit origins/HTTPS/trusted rate enforcement, and has no production wallet-secret fallback. Legacy records use versioned encryption with a random per-record salt only for migration tests.
- Wallet identity resolution covers primary and linked addresses with durable uniqueness and conflict fail-closed. Linking requires recent auth plus the current password for password accounts, applies cooldown/notification state and cannot steal an address already bound elsewhere.
- Cross-column database triggers make one wallet address unique across both `mvx_address` and `linked_wallet`. Nexus-herotag, MultiversX-herotag, primary login and recovery all use the same current canonical xPortal factor; xPortal-native accounts correctly fall back to their primary address.
- WalletConnect uses only the locally configured Project ID and no public template ID. A 32-character syntax check is not proof that WalletConnect Dashboard issued the identifier or that Relay permits the LAN origin; the external provider gate is therefore reopened.
- Mobile xPortal now defaults to a fresh WalletConnect pairing. A browser-only acknowledged session can no longer open xPortal without a new approval URI; this regression is covered deterministically.
- Mobile follows the official MultiversX combined coordinator: `provider.login({ approval, token })` owns pairing approval and NativeAuth signing. Because mobile browsers can return to Nexus before the signing sheet is foregrounded, cache revision `auth24/xportal14` detects the real app background/return cycle and exposes a prominent user-gesture fallback, `Continuă în xPortal pentru semnătură`, while suppressing misleading persisted-session callbacks. Empty QR containers no longer render as a white bar.
- Cache revision `auth25/xportal15` resets only WalletConnect-owned storage keys on the Nexus origin before a fresh pairing and preserves `nexus.device-wallet.*` plus unrelated preferences.
- Cache revision `auth26/xportal16` bounds pairing creation to 15 seconds and reports the exact external Project ID/Allowlist gate. A controlled browser run on the LAN origin reproduced `WALLETCONNECT_PAIRING_TIMEOUT`: no pairing URI and therefore no xPortal deep-link were created.
- The backend now requires three independent conditions before issuing `/auth/mvx/init`: valid Project ID format, explicit Dashboard issuance attestation and an exact origin in `NEXUS_WC_ATTESTED_ORIGINS`. Whenever configuration is unverified it returns `503 WALLETCONNECT_PROJECT_NOT_ATTESTED` before fetching a block hash or starting Relay; the browser displays the gate immediately and the Project ID is not exposed.
- The owner created the Nexus App project in WalletConnect Dashboard and supplied its Project ID. After local attestation and exact LAN-origin configuration, a controlled browser run completed provider initialization and produced both a WalletConnect pairing URI and an xPortal universal link with zero console errors. The raw Project ID is intentionally excluded from evidence.
- Verification/reset tokens are stored hashed; auth bodies and passwords are bounded; the in-process local limiter has a cardinality cap and production requires an external trusted-edge limiter.
- Legacy custody deletion was completed for the exact six-row target. After a checker identified SQLite free-page/WAL residual risk, the server was quiesced, the database was checkpointed and rebuilt with `secure_delete=ON` plus `VACUUM`, and the pre-sanitization WAL/SHM sidecars were removed. A non-secret durable receipt binds the rebuilt generation to the six-row operation. All destructive purge/sanitizer execution paths are now permanently retired, so the approval cannot authorize a future target.
- Browser mutations enforce same-origin, responses include CSP and production HSTS, and error logs redact query strings.
- OAuth buttons truthfully remain unavailable while automatic wallet provisioning for those providers is incomplete.
- The complete evidence subject will bind auth source, runtime configuration, schema/repository, browser transport, both wallet client build inputs/outputs, dependency locks, tests and this checkpoint.

## Verification

- Deterministic suite: `58/58 PASS`, including permanent purge retirement and runtime `secure_delete` policy.
- HTTP auth smoke: `8/8 PASS`.
- WalletConnect and browser-device wallet bundles: rebuilt successfully.
- Runtime: PID `21640`, HTTP 200 on loopback and `http://192.168.1.153:3000/`, listener `0.0.0.0:3000`.
- Current Project ID issuance and LAN-origin configuration are evidenced by successful Relay pairing. On 2026-08-23 the owner confirmed the complete phone flow works: xPortal approval, NativeAuth signing, return to Nexus and session establishment.
- Zero transactions, zero real funds, zero paid provider operations, zero incremental cost.

## Residual gates

1. Run the sequential independent T0 re-review on the sanitized Evidence Pack. Social remains gated until Auth receives PASS.
2. Production OAuth, passkey/MPC wallet architecture, external security/custody review, mainnet and real funds remain out of scope.

## Resume command

```powershell
node apps/nexus-web/server.js
```
