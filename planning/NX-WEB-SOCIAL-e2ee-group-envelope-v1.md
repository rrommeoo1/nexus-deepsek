# Nexus Group Envelope V1 — protocol boundary

Status: `PASS_LOCAL`, pending independent production cryptography audit and real-device lab.  
Packet: `NX-WEB-SOCIAL-P01-E2EE-GROUP-SENDER-KEY-SCALABILITY-033`.

## Decision

Group messages use one fresh random 256-bit AES-GCM content key per message. The
client encrypts the JSON payload exactly once and wraps only that content key for
every active device using the existing epoch-bound P-256 ECDH + HKDF-SHA-256 +
AES-256-GCM channel. The server stores one shared ciphertext and one small opaque
wrapper per device. It never receives plaintext, the content key or a private
device key.

This is `NEXUS_GROUP_ENVELOPE_V1_SINGLE_PAYLOAD_CONTENT_KEY_FANOUT`. It is a
scalable group-envelope foundation, **not** a claim of a Signal Sender Keys
ratchet, post-compromise security, metadata anonymity or completed formal audit.

## Bindings

Shared-payload AAD (`v:3`) binds:

- conversation ID and client nonce;
- sender device ID;
- exact active-device commitment;
- conversation/member epoch and its composite account-device commitment.

Every device-wrapper AAD additionally binds:

- recipient device ID and purpose `content_key`;
- SHA-256 of the shared ciphertext;
- SHA-256 of the shared-payload AAD.

The encrypted wrapper repeats both hashes beside the random content key. The
recipient verifies wrapper AAD, both repeated commitments, the shared ciphertext
hash and shared AAD before decryption. The content-key byte buffer is cleared from
the client-side typed array after use.

## Authorization and lifecycle

- A group write using legacy `e2ee_v1` is rejected as a downgrade; a direct
  conversation cannot submit the group mode.
- Coverage must equal the canonical current active-device set exactly, without
  duplicates. Missing/invalid devices stop secure send rather than downgrading.
- Block, membership and device epoch checks run before validation and again in a
  `BEGIN IMMEDIATE` transaction before persistence.
- Nonce replay is accepted only when the canonical request commitment—including
  mode, shared ciphertext, all wrappers, attachment and expiry—is identical.
- A newly accepted member begins after the recorded history boundary and receives
  no wrapper for older messages. Removed/revoked devices receive no future wrapper.
- Read returns the shared ciphertext only together with the authenticated
  requesting device's wrapper. A blocked/non-member caller receives neither.
- Expiry removes the shared ciphertext and every wrapper, leaving the existing
  minimal message tombstone.

## Complexity and explicit limits

Payload encryption is `O(payload bytes)` once. Device work/storage is
`O(active devices)` over small key wrappers; the server request remains bounded by
the 2 MiB message-body limit, the 50-member group limit, the 10-active-device
per-account limit, and exact API/repository validation. Attachments retain their
separate resumable client-encrypted object; the group payload contains only its
integrity-bound key and metadata.

## Residual production gates

1. Independent review by a qualified cryptography team and published threat model.
2. Trusted-HTTPS iOS/Android/desktop device lifecycle and interruption testing.
3. Decision and audited implementation for a ratcheting group protocol if Nexus
   requires forward secrecy between successive messages or post-compromise
   security beyond fresh per-message content keys and membership/device rotation.
4. Secure key-backup recovery review and abuse/availability testing at maximum
   supported group/device cardinality.
