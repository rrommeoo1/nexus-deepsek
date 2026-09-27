#!/usr/bin/env python3
"""Decode and strictly verify the fixed Nexus SessionCapability ABI payload."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


EXPECTED_ABI_FIELDS = [
    ("schema_version", "u16"),
    ("controller", "Address"),
    ("actor_kind", "u8"),
    ("actor_commitment", "array32<u8>"),
    ("scope_bits", "u32"),
    ("max_actions", "u32"),
    ("used_actions", "u32"),
    ("valid_from", "u64"),
    ("expires_at", "u64"),
    ("last_action_nonce", "u64"),
    ("authorized_relayer", "Address"),
    ("active", "bool"),
]


def decode_capability(encoded_hex: str, abi: dict[str, Any]) -> dict[str, Any]:
    fields = abi["types"]["SessionCapability"]["fields"]
    actual_fields = [(item["name"], item["type"]) for item in fields]
    if actual_fields != EXPECTED_ABI_FIELDS:
        raise ValueError("SessionCapability ABI does not match the pinned decoder schema")
    raw = bytes.fromhex(encoded_hex.removeprefix("0x"))
    if len(raw) != 136:
        raise ValueError(f"SessionCapability must be exactly 136 bytes, got {len(raw)}")
    offset = 0

    def take(length: int) -> bytes:
        nonlocal offset
        value = raw[offset : offset + length]
        offset += length
        return value

    result = {
        "schema_version": int.from_bytes(take(2), "big"),
        "controller_hex": take(32).hex(),
        "actor_kind": int.from_bytes(take(1), "big"),
        "actor_commitment_hex": take(32).hex(),
        "scope_bits": int.from_bytes(take(4), "big"),
        "max_actions": int.from_bytes(take(4), "big"),
        "used_actions": int.from_bytes(take(4), "big"),
        "valid_from": int.from_bytes(take(8), "big"),
        "expires_at": int.from_bytes(take(8), "big"),
        "last_action_nonce": int.from_bytes(take(8), "big"),
        "authorized_relayer_hex": take(32).hex(),
        "active": int.from_bytes(take(1), "big"),
        "raw_sha256": hashlib.sha256(raw).hexdigest(),
    }
    if result["active"] not in (0, 1):
        raise ValueError("active is not canonical bool")
    result["active"] = result["active"] == 1
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--encoded-hex", required=True)
    parser.add_argument("--abi", required=True, type=Path)
    parser.add_argument("--controller-hex", required=True)
    parser.add_argument("--relayer-hex", required=True)
    parser.add_argument("--actor-commitment-hex", required=True)
    parser.add_argument("--actor-kind", required=True, type=int)
    parser.add_argument("--scope-bits", required=True, type=int)
    parser.add_argument("--max-actions", required=True, type=int)
    parser.add_argument("--used-actions", required=True, type=int)
    parser.add_argument("--last-action-nonce", required=True, type=int)
    parser.add_argument("--expires-at", required=True, type=int)
    parser.add_argument("--min-valid-from", required=True, type=int)
    parser.add_argument("--max-valid-from", required=True, type=int)
    parser.add_argument("--active", choices=("true", "false"), default="true")
    args = parser.parse_args()

    decoded = decode_capability(args.encoded_hex, json.loads(args.abi.read_text(encoding="utf-8")))
    expected = {
        "schema_version": 2,
        "controller_hex": args.controller_hex,
        "actor_kind": args.actor_kind,
        "actor_commitment_hex": args.actor_commitment_hex,
        "scope_bits": args.scope_bits,
        "max_actions": args.max_actions,
        "used_actions": args.used_actions,
        "expires_at": args.expires_at,
        "last_action_nonce": args.last_action_nonce,
        "authorized_relayer_hex": args.relayer_hex,
        "active": args.active == "true",
    }
    mismatches = [name for name, value in expected.items() if decoded.get(name) != value]
    if not args.min_valid_from <= decoded["valid_from"] <= args.max_valid_from:
        mismatches.append("valid_from")
    if mismatches:
        print(json.dumps({"status": "FAIL", "mismatches": sorted(set(mismatches)), "decoded": decoded}, sort_keys=True))
        return 1
    print(json.dumps({"status": "PASS", "decoded": decoded}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
