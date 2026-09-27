#!/usr/bin/env python3
"""Build a deterministic SYSTEM_TEST action payload without network access.

The signing key is the public MultiversX SDK fixture seed used by the RustVM
scenario. It must never be used for mainnet, money, identity, or private data.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
from dataclasses import dataclass

from nacl.signing import SigningKey


HEX_32 = re.compile(r"^[0-9a-f]{64}$")
PRIMARY_TEST_SEED_BYTE = 0x42
RECOVERY_TEST_SEED_BYTE = 0x43
ALLOWED_TEST_SEED_BYTES = (PRIMARY_TEST_SEED_BYTE, RECOVERY_TEST_SEED_BYTE)


@dataclass(frozen=True)
class ActionInput:
    chain_id: str
    contract: bytes
    actor_kind: int
    actor: bytes
    action_type: int
    object_commitment: bytes
    payload_commitment: bytes
    visibility: int
    nonce: int
    issued_at: int
    expires_at: int


def decode_hex32(value: str, label: str) -> bytes:
    normalized = value.removeprefix("0x").lower()
    if not HEX_32.fullmatch(normalized) or int(normalized, 16) == 0:
        raise ValueError(f"{label} must be a non-zero 32-byte lowercase hex value")
    return bytes.fromhex(normalized)


def encode_envelope(value: ActionInput, public_key: bytes) -> bytes:
    if value.chain_id != "D":
        raise ValueError("Only MultiversX Devnet chain ID D is allowed")
    if len(value.contract) != 32 or len(public_key) != 32:
        raise ValueError("Contract and session public key must be 32 bytes")
    if value.actor_kind not in (1, 3):
        raise ValueError("Probe actor must be HUMAN fixture or SYSTEM_TEST")
    if value.action_type != 3 or value.visibility != 1 or value.nonce != 1:
        raise ValueError("Probe is fixed to one public LIKE with nonce 1")
    if value.expires_at <= value.issued_at or value.expires_at - value.issued_at > 300_000:
        raise ValueError("Action TTL must be positive and at most five minutes")
    return b"".join(
        (
            struct.pack(">H", 2),
            struct.pack(">B", value.actor_kind),
            value.actor,
            struct.pack(">H", value.action_type),
            value.object_commitment,
            value.payload_commitment,
            struct.pack(">B", value.visibility),
            struct.pack(">Q", value.nonce),
            struct.pack(">Q", value.issued_at),
            struct.pack(">Q", value.expires_at),
            public_key,
        )
    )


def build(value: ActionInput, test_seed_byte: int = PRIMARY_TEST_SEED_BYTE) -> dict[str, object]:
    if test_seed_byte not in ALLOWED_TEST_SEED_BYTES:
        raise ValueError("Only the pinned primary and recovery SYSTEM_TEST seeds are allowed")
    signing_key = SigningKey(bytes([test_seed_byte]) * 32)
    public_key = bytes(signing_key.verify_key)
    envelope = encode_envelope(value, public_key)
    domain = hashlib.sha256(
        b"NEXUS_ACTION_V2\0" + value.chain_id.encode("ascii") + b"\0" + value.contract
    ).digest()
    signing_message = domain + envelope
    signature = signing_key.sign(signing_message).signature
    return {
        "schema_version": 1,
        "task_id": "NX-CHAIN-001",
        "actor_kind": "SYSTEM_TEST" if value.actor_kind == 3 else "HUMAN_FIXTURE",
        "chain_id": value.chain_id,
        "action_type": "LIKE",
        "visibility": "PUBLIC",
        "action_nonce": value.nonce,
        "issued_at_ms": value.issued_at,
        "expires_at_ms": value.expires_at,
        "actor_commitment_hex": value.actor.hex(),
        "object_commitment_hex": value.object_commitment.hex(),
        "payload_commitment_hex": value.payload_commitment.hex(),
        "session_public_key_hex": public_key.hex(),
        "test_seed_id": f"SYSTEM_TEST_{test_seed_byte:02X}",
        "domain_separator_hex": domain.hex(),
        "envelope_hex": envelope.hex(),
        "signing_message_hex": signing_message.hex(),
        "session_signature_hex": signature.hex(),
        "envelope_sha256": hashlib.sha256(envelope).hexdigest(),
        "private_key_disclosed": False,
        "contains_real_person_data": False,
        "network_operations": 0,
        "economic_operations": 0,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--contract-hex", required=True)
    parser.add_argument("--issued-at-ms", required=True, type=int)
    parser.add_argument("--expires-at-ms", required=True, type=int)
    parser.add_argument("--chain-id", default="D")
    parser.add_argument("--actor-kind", default=3, type=int, choices=(1, 3))
    parser.add_argument("--actor-hex", default="11" * 32)
    parser.add_argument("--object-hex", default="22" * 32)
    parser.add_argument("--payload-hex", default="33" * 32)
    parser.add_argument(
        "--test-seed-byte",
        default=PRIMARY_TEST_SEED_BYTE,
        type=lambda value: int(value, 0),
        choices=ALLOWED_TEST_SEED_BYTES,
    )
    arguments = parser.parse_args()
    action = ActionInput(
        chain_id=arguments.chain_id,
        contract=decode_hex32(arguments.contract_hex, "contract"),
        actor_kind=arguments.actor_kind,
        actor=decode_hex32(arguments.actor_hex, "actor"),
        action_type=3,
        object_commitment=decode_hex32(arguments.object_hex, "object"),
        payload_commitment=decode_hex32(arguments.payload_hex, "payload"),
        visibility=1,
        nonce=1,
        issued_at=arguments.issued_at_ms,
        expires_at=arguments.expires_at_ms,
    )
    print(json.dumps(build(action, arguments.test_seed_byte), sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    main()
