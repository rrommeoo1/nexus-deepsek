#!/usr/bin/env python3
"""Offline-only regression tests for the Devnet command, approval and decode path."""

from __future__ import annotations

import copy
import importlib.util
import json
import subprocess
import sys
import tempfile
from contextlib import redirect_stderr
from datetime import datetime, timedelta, timezone
from io import StringIO
from pathlib import Path

from multiversx_sdk_cli.cli import setup_parser


ROOT = Path(__file__).resolve().parents[1]
PLANNING = ROOT / "planning"
VALID = "erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th"
CONTRACT = "erd1qqqqqqqqqqqqqpgq2yqsh6ut5d3a6q4xf3d3m9e9x8k6z7f0n7as4r9m0x"


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def assert_cli_parse(plan: list[str], expected_function: str) -> None:
    parser = setup_parser(plan)
    parsed = parser.parse_args(plan)
    assert parsed.func.__name__ == expected_function, (plan[:3], parsed.func.__name__, expected_function)


def main() -> int:
    assertions = 0
    plans = [
        (["contract", "deploy", "--bytecode", "/tmp/nexus.wasm", "--pem", "/tmp/alice.pem", "--proxy", "https://devnet-gateway.multiversx.com", "--chain", "D", "--gas-limit", "100000000", "--arguments", "str:D", f"addr:{VALID}", "--send", "--wait-result", "--outfile", "/tmp/deploy.json"], "deploy"),
        (["contract", "call", CONTRACT, "--pem", "/tmp/alice.pem", "--proxy", "https://devnet-gateway.multiversx.com", "--chain", "D", "--function", "setRelayerAllowed", "--gas-limit", "20000000", "--arguments", f"addr:{VALID}", "true", "--send", "--wait-result", "--outfile", "/tmp/call.json"], "call"),
        (["contract", "call", CONTRACT, "--pem", "/tmp/dan.pem", "--proxy", "https://devnet-gateway.multiversx.com", "--chain", "D", "--function", "registerCapability", "--gas-limit", "20000000", "--arguments", "3", "0x" + "11" * 32, "0x" + "22" * 32, "1", "3", "9999999999999", f"addr:{VALID}", "--send", "--wait-result", "--outfile", "/tmp/register.json"], "call"),
        (["contract", "call", CONTRACT, "--pem", "/tmp/dan.pem", "--proxy", "https://devnet-gateway.multiversx.com", "--chain", "D", "--function", "rotateCapability", "--gas-limit", "20000000", "--arguments", "0x" + "22" * 32, "0x" + "44" * 32, "1", "3", "9999999999999", f"addr:{VALID}", "--send", "--wait-result", "--outfile", "/tmp/rotate.json"], "call"),
        (["contract", "call", CONTRACT, "--pem", "/tmp/carol.pem", "--proxy", "https://devnet-gateway.multiversx.com", "--chain", "D", "--function", "recordAction", "--gas-limit", "20000000", "--arguments", "0x0002", "0x" + "33" * 64, "--send", "--wait-result", "--outfile", "/tmp/record.json"], "call"),
        (["contract", "query", CONTRACT, "--proxy", "https://devnet-gateway.multiversx.com", "--function", "getCapability", "--arguments", "0x" + "22" * 32], "query"),
        (["contract", "query", CONTRACT, "--proxy", "https://devnet-gateway.multiversx.com", "--function", "getChainId"], "query"),
        (["contract", "query", CONTRACT, "--proxy", "https://devnet-gateway.multiversx.com", "--function", "getPauser"], "query"),
        (["wallet", "bech32", "--decode", VALID], "do_bech32"),
    ]
    for plan, function in plans:
        assert_cli_parse(plan, function)
        assertions += 1

    invalid_query = next(plan for plan, function in plans if function == "query") + ["--outfile", "/tmp/query.json"]
    with redirect_stderr(StringIO()):
        try:
            setup_parser(invalid_query).parse_args(invalid_query)
            raise AssertionError("query unexpectedly accepted --outfile")
        except SystemExit as exc:
            assert exc.code == 2
    assertions += 1

    runner = (PLANNING / "run-chain-devnet.ps1").read_text(encoding="utf-8")
    assert "'contract', 'query'" in runner and "$query.output | ConvertFrom-Json" in runner
    assert "'contract', 'query'" in runner and "query', $contractAddress" in runner
    assert "--receipt" in runner and "--consume" in runner and "ApprovalReceiptPath" in runner
    assert "decode-chain-capability.py" in runner
    assert "[ValidateSet('Prepare', 'Execute', 'Resume')]" in runner and "ExistingContractAddress" in runner
    assert "$approvalIdPattern = if ($Mode -eq 'Resume')" in runner
    assert "^NX-CHAIN-001-DEVNET-RESUME-[A-Za-z0-9_-]+$" in runner
    assert "^NX-CHAIN-001-DEVNET-APPROVAL-[A-Za-z0-9_-]+$" in runner
    assert "'--timeout'" not in runner
    assert runner.count("Invoke-Mxpy @('contract', 'deploy'") == 1 and runner.count("Invoke-Mxpy @('contract', 'call'") == 4
    execute_branch = runner.split("if ($Mode -eq 'Execute') {", 1)[1].split("} else {", 1)[0]
    assert "'contract', 'deploy'" in execute_branch and "'contract', 'call'" not in execute_branch
    assert "getChainId" in runner and "getPauser" in runner and "chainState" in runner and "pauserState" in runner
    assert "Get-GuardianSnapshot" in runner and runner.index("$guardianSnapshots = @(") < runner.index("$approvalResult = Invoke-ApprovalReceiptConsumption")
    assert "rotateCapability" in runner and "prior_capability_disabled" in runner
    assert "RECOVERY_TEST_SEED_BYTE" in (PLANNING / "build-chain-devnet-payload.py").read_text(encoding="utf-8")
    guard_test = (PLANNING / "test-chain-devnet-guards.ps1").read_text(encoding="utf-8")
    assert "guarded = 'false'" in guard_test and "'null'" in guard_test and "'[null]'" in guard_test
    assert runner.index("$recordPayloadProcess = Invoke-WslCaptured") < runner.index("$record = Invoke-Mxpy")
    assert "Assert-CapabilityTtlBudget" in runner and "+ 300000" in runner
    assert "Test-ActionRecordedEvent" in runner and "QWN0aW9uUmVjb3JkZWQ=" in guard_test
    assert "EI 1.5 event shape rejected" in guard_test and "Wrong event address accepted" in guard_test
    assertions += 20

    approval = load_module("nx_devnet_approval", PLANNING / "validate-chain-devnet-approval.py")
    now = datetime(2026, 8, 2, 21, 0, tzinfo=timezone.utc)
    expected = {"approval_id": "NX-CHAIN-001-DEVNET-APPROVAL-TEST", "gateway": "https://devnet-gateway.multiversx.com", "subject_sha256": "a" * 64, "wasm_sha256": "b" * 64, "run_id": "NX-CHAIN-001-DEVNET-TEST", "max_public_transactions": 4, "operation_mode": "Execute", "contract_address": "NEW_DEPLOYMENT"}
    receipt = {
        "schema_version": 1, "approval_id": expected["approval_id"], "owner": "TEST_OWNER", "decision": "APPROVE",
        "issued_at": (now - timedelta(minutes=1)).isoformat(), "expires_at": (now + timedelta(minutes=30)).isoformat(),
        "environment": "devnet", "gateway": expected["gateway"], "subject_sha256": expected["subject_sha256"],
        "wasm_sha256": expected["wasm_sha256"], "approved_run_id": expected["run_id"], "max_public_transactions": 4,
        "max_real_value": 0, "wallet_source": "PUBLIC_MULTIVERSX_SDK_TEST_FIXTURES_ONLY", "single_use": True,
        "status": "ISSUED", "source_message_sha256": "c" * 64,
        "operation_mode": expected["operation_mode"], "contract_address": expected["contract_address"],
    }
    assert approval.validate_receipt(receipt, expected, now) == []
    assertions += 1
    mutations = []
    missing = copy.deepcopy(receipt); missing.pop("owner"); mutations.append(missing)
    forged = copy.deepcopy(receipt); forged["approval_id"] = "FORGED"; mutations.append(forged)
    expired = copy.deepcopy(receipt); expired["expires_at"] = (now - timedelta(seconds=1)).isoformat(); mutations.append(expired)
    mismatch = copy.deepcopy(receipt); mismatch["subject_sha256"] = "d" * 64; mutations.append(mismatch)
    wrong_run = copy.deepcopy(receipt); wrong_run["approved_run_id"] = "OTHER"; mutations.append(wrong_run)
    reused = copy.deepcopy(receipt); reused["status"] = "CONSUMED"; mutations.append(reused)
    wrong_mode = copy.deepcopy(receipt); wrong_mode["operation_mode"] = "Resume"; mutations.append(wrong_mode)
    wrong_contract = copy.deepcopy(receipt); wrong_contract["contract_address"] = CONTRACT; mutations.append(wrong_contract)
    wrong_cap = copy.deepcopy(receipt); wrong_cap["max_public_transactions"] = 3; mutations.append(wrong_cap)
    for mutation in mutations:
        assert approval.validate_receipt(mutation, expected, now)
        assertions += 1

    live_now = datetime.now(timezone.utc)
    concurrent_receipt = copy.deepcopy(receipt)
    concurrent_receipt["issued_at"] = (live_now - timedelta(minutes=1)).isoformat()
    concurrent_receipt["expires_at"] = (live_now + timedelta(minutes=30)).isoformat()
    validator_path = PLANNING / "validate-chain-devnet-approval.py"
    with tempfile.TemporaryDirectory() as temporary:
        receipt_path = Path(temporary) / "approval.json"
        receipt_path.write_text(json.dumps(concurrent_receipt), encoding="utf-8")
        command = [sys.executable, str(validator_path), "--receipt", str(receipt_path), "--approval-id", expected["approval_id"], "--gateway", expected["gateway"], "--subject-sha256", expected["subject_sha256"], "--wasm-sha256", expected["wasm_sha256"], "--run-id", expected["run_id"], "--operation-mode", expected["operation_mode"], "--contract-address", expected["contract_address"], "--consume"]
        contenders = [subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True) for _ in range(2)]
        outcomes = [process.communicate(timeout=15) + (process.returncode,) for process in contenders]
        assert sorted(outcome[2] for outcome in outcomes) == [0, 1], outcomes
        final_receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        assert final_receipt["status"] == "CONSUMED" and final_receipt["consumed_by_run_id"] == expected["run_id"]
    assertions += 2

    decoder = load_module("nx_capability_decoder", PLANNING / "decode-chain-capability.py")
    scenario = json.loads((ROOT / "contracts/nexus-actions/scenarios/signed-action-replay.scen.json").read_text(encoding="utf-8"))
    encoded = next(step["expect"]["out"][0] for step in scenario["steps"] if step.get("step") == "scQuery" and step["tx"].get("function") == "getCapability")
    abi = json.loads((ROOT / "contracts/nexus-actions/output/nexus-actions.abi.json").read_text(encoding="utf-8"))
    decoded = decoder.decode_capability(encoded, abi)
    assert decoded["schema_version"] == 2 and decoded["used_actions"] == 1 and decoded["last_action_nonce"] == 1 and decoded["active"] is True
    assert decoded["actor_kind"] == 1 and decoded["scope_bits"] == 1 and decoded["max_actions"] == 3
    inactive = bytearray.fromhex(encoded.removeprefix("0x")); inactive[-1] = 0
    inactive_decoded = decoder.decode_capability(inactive.hex(), abi)
    assert inactive_decoded["active"] is False and inactive_decoded["used_actions"] == 1
    assertions += 3

    print(json.dumps({"schema_version": 1, "task_id": "NX-CHAIN-001", "suite": "DEVNET_RUNNER_OFFLINE", "status": "PASS", "assertion_count": assertions, "cli_plans_parsed": len(plans), "approval_negative_cases": len(mutations), "network_operations": 0, "economic_operations": 0}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
