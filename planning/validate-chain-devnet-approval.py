#!/usr/bin/env python3
"""Fail-closed validation and single-use consumption of a Devnet approval receipt."""

from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REQUIRED_FIELDS = {
    "schema_version",
    "approval_id",
    "owner",
    "decision",
    "issued_at",
    "expires_at",
    "environment",
    "gateway",
    "subject_sha256",
    "wasm_sha256",
    "approved_run_id",
    "max_public_transactions",
    "max_real_value",
    "wallet_source",
    "single_use",
    "status",
    "source_message_sha256",
    "operation_mode",
    "contract_address",
}


def parse_utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timestamp must include UTC timezone")
    return parsed.astimezone(timezone.utc)


def validate_receipt(receipt: dict[str, Any], expected: dict[str, Any], now: datetime) -> list[str]:
    errors: list[str] = []
    missing = sorted(REQUIRED_FIELDS - receipt.keys())
    if missing:
        errors.append("missing_fields:" + ",".join(missing))
        return errors

    exact = {
        "schema_version": 1,
        "approval_id": expected["approval_id"],
        "decision": "APPROVE",
        "environment": "devnet",
        "gateway": expected["gateway"],
        "subject_sha256": expected["subject_sha256"],
        "wasm_sha256": expected["wasm_sha256"],
        "approved_run_id": expected["run_id"],
        "max_public_transactions": expected["max_public_transactions"],
        "max_real_value": 0,
        "wallet_source": "PUBLIC_MULTIVERSX_SDK_TEST_FIXTURES_ONLY",
        "single_use": True,
        "status": "ISSUED",
        "operation_mode": expected["operation_mode"],
        "contract_address": expected["contract_address"],
    }
    for key, wanted in exact.items():
        if receipt.get(key) != wanted:
            errors.append(f"{key}_mismatch")

    if not isinstance(receipt.get("owner"), str) or not receipt["owner"].strip():
        errors.append("owner_invalid")
    for digest_name in ("subject_sha256", "wasm_sha256", "source_message_sha256"):
        digest = receipt.get(digest_name)
        if not isinstance(digest, str) or len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
            errors.append(f"{digest_name}_invalid")

    try:
        issued_at = parse_utc(receipt["issued_at"])
        expires_at = parse_utc(receipt["expires_at"])
        if issued_at > now:
            errors.append("issued_at_future")
        if expires_at <= now:
            errors.append("approval_expired")
        if expires_at <= issued_at:
            errors.append("approval_interval_invalid")
    except (TypeError, ValueError):
        errors.append("approval_timestamp_invalid")
    return errors


def canonical_digest(receipt: dict[str, Any]) -> str:
    encoded = json.dumps(receipt, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def consume(
    path: Path, expected: dict[str, Any], run_id: str, now: datetime
) -> tuple[dict[str, Any], str]:
    # Lock a stable sidecar inode: locking the receipt itself is insufficient because
    # os.replace() changes its inode and a waiter could retain the old ISSUED content.
    lock_path = path.with_suffix(path.suffix + ".lock")
    with lock_path.open("a+", encoding="utf-8") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        receipt = json.loads(path.read_text(encoding="utf-8"))
        errors = validate_receipt(receipt, expected, now)
        if errors:
            raise ValueError(";".join(errors))
        issued_digest = canonical_digest(receipt)
        consumed = dict(receipt)
        consumed["status"] = "CONSUMED"
        consumed["consumed_at"] = now.isoformat().replace("+00:00", "Z")
        consumed["consumed_by_run_id"] = run_id
        content = json.dumps(consumed, indent=2, sort_keys=True) + "\n"
        temporary = path.with_suffix(path.suffix + f".{os.getpid()}.tmp")
        temporary.write_text(content, encoding="utf-8")
        os.replace(temporary, path)
        return consumed, issued_digest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--receipt", required=True, type=Path)
    parser.add_argument("--approval-id", required=True)
    parser.add_argument("--gateway", required=True)
    parser.add_argument("--subject-sha256", required=True)
    parser.add_argument("--wasm-sha256", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--max-public-transactions", type=int, default=4)
    parser.add_argument("--operation-mode", choices=("Execute", "Resume"), required=True)
    parser.add_argument("--contract-address", required=True)
    parser.add_argument("--consume", action="store_true")
    args = parser.parse_args()

    expected = {
        "approval_id": args.approval_id,
        "gateway": args.gateway,
        "subject_sha256": args.subject_sha256,
        "wasm_sha256": args.wasm_sha256,
        "run_id": args.run_id,
        "max_public_transactions": args.max_public_transactions,
        "operation_mode": args.operation_mode,
        "contract_address": args.contract_address,
    }
    now = datetime.now(timezone.utc)
    try:
        if args.consume:
            consumed, issued_digest = consume(args.receipt, expected, args.run_id, now)
            receipt = consumed
            consumed_digest = canonical_digest(consumed)
        else:
            receipt = json.loads(args.receipt.read_text(encoding="utf-8"))
            errors = validate_receipt(receipt, expected, now)
            if errors:
                print(json.dumps({"status": "DENY", "errors": errors}, sort_keys=True))
                return 1
            issued_digest = canonical_digest(receipt)
            consumed_digest = None
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "DENY", "errors": [str(exc)]}, sort_keys=True))
        return 1
    print(
        json.dumps(
            {
                "status": "PASS",
                "approval_id": args.approval_id,
                "owner": receipt["owner"],
                "issued_receipt_sha256": issued_digest,
                "consumed_receipt_sha256": consumed_digest,
                "single_use_consumed": args.consume,
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
