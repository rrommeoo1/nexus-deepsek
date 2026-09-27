#!/usr/bin/env python3
"""Offline parity test against the canonical RustVM-generated scenario."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BUILDER_PATH = ROOT / "planning" / "build-chain-devnet-payload.py"
SCENARIO_PATH = ROOT / "contracts" / "nexus-actions" / "scenarios" / "signed-action-replay.scen.json"


def load_builder():
    spec = importlib.util.spec_from_file_location("nexus_devnet_payload", BUILDER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("payload builder cannot be loaded")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def main() -> None:
    builder = load_builder()
    scenario = json.loads(SCENARIO_PATH.read_text(encoding="utf-8"))
    signing_query = next(
        step for step in scenario["steps"]
        if step.get("step") == "scQuery" and step.get("tx", {}).get("function") == "getSigningMessage"
    )
    record_call = next(
        step for step in scenario["steps"]
        if step.get("txId") == "record signed like"
    )
    envelope_hex = signing_query["tx"]["arguments"][0].removeprefix("0x")
    signing_message_hex = signing_query["expect"]["out"][0].removeprefix("0x")
    signature_hex = record_call["tx"]["arguments"][1].removeprefix("0x")
    scenario_name = b"nexus-actions"
    contract_raw = b"\x00" * 8 + b"\x05\x00" + scenario_name + b"_" * (22 - len(scenario_name))
    action = builder.ActionInput(
        chain_id="D",
        contract=contract_raw,
        actor_kind=1,
        actor=bytes([0x11]) * 32,
        action_type=3,
        object_commitment=bytes([0x22]) * 32,
        payload_commitment=bytes([0x33]) * 32,
        visibility=1,
        nonce=1,
        issued_at=1_800_000_000_000,
        expires_at=1_800_000_060_000,
    )
    receipt = builder.build(action)
    system_test_receipt = builder.build(builder.ActionInput(
        chain_id="D",
        contract=contract_raw,
        actor_kind=3,
        actor=bytes([0x11]) * 32,
        action_type=3,
        object_commitment=bytes([0x22]) * 32,
        payload_commitment=bytes([0x33]) * 32,
        visibility=1,
        nonce=1,
        issued_at=1_800_000_000_000,
        expires_at=1_800_000_060_000,
    ))
    recovery_receipt = builder.build(builder.ActionInput(
        chain_id="D",
        contract=contract_raw,
        actor_kind=3,
        actor=bytes([0x11]) * 32,
        action_type=3,
        object_commitment=bytes([0x22]) * 32,
        payload_commitment=bytes([0x33]) * 32,
        visibility=1,
        nonce=1,
        issued_at=1_800_000_000_000,
        expires_at=1_800_000_060_000,
    ), builder.RECOVERY_TEST_SEED_BYTE)
    assertions = {
        "envelope_matches_rustvm": receipt["envelope_hex"] == envelope_hex,
        "signing_message_matches_rustvm": receipt["signing_message_hex"] == signing_message_hex,
        "signature_matches_rustvm": receipt["session_signature_hex"] == signature_hex,
        "fixture_actor_matches": receipt["actor_kind"] == "HUMAN_FIXTURE",
        "devnet_actor_is_system_test": system_test_receipt["actor_kind"] == "SYSTEM_TEST",
        "recovery_seed_is_distinct": recovery_receipt["session_public_key_hex"] != system_test_receipt["session_public_key_hex"],
        "recovery_seed_is_pinned": recovery_receipt["test_seed_id"] == "SYSTEM_TEST_43",
        "recovery_signature_is_valid_shape": len(recovery_receipt["session_signature_hex"]) == 128,
        "no_real_person_data": receipt["contains_real_person_data"] is False,
        "offline_only": receipt["network_operations"] == 0 and receipt["economic_operations"] == 0,
    }
    result = {
        "schema_version": 1,
        "task_id": "NX-CHAIN-001",
        "suite": "DEVNET_PAYLOAD_OFFLINE_RUSTVM_PARITY",
        "status": "PASS" if all(assertions.values()) else "FAIL",
        "assertions": assertions,
        "assertion_count": len(assertions),
        "scenario": "contracts/nexus-actions/scenarios/signed-action-replay.scen.json",
        "envelope_sha256": receipt["envelope_sha256"],
        "network_operations": 0,
        "economic_operations": 0,
    }
    print(json.dumps(result, sort_keys=True, separators=(",", ":")))
    if result["status"] != "PASS":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
