import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function inventory() {
  const run = spawnSync(process.execPath, ["scripts/e2ee-audit-inventory.mjs"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NO_PROXY: "*", HTTP_PROXY: "", HTTPS_PROXY: "", ALL_PROXY: "" },
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  return JSON.parse(run.stdout);
}

test("E2EE audit inventory is reproducible, source-bound and has no failed invariant", () => {
  const report = inventory();
  assert.deepEqual(inventory(), report);
  assert.equal(report.schema, "NEXUS_E2EE_AUDIT_INVENTORY_V1");
  assert.equal(report.local_gate, "PASS_LOCAL_SOURCE_SHAPE_INVENTORY");
  assert.equal(report.invariant_summary.failed, 0);
  assert.equal(report.invariant_summary.passed, report.invariant_summary.total);
  assert.ok(report.invariant_summary.total >= 40);
  assert.ok(Object.keys(report.source_sha256).length >= 20);
  const invariantIds = new Set(report.invariants.map((invariant) => invariant.id));
  for (const required of [
    "device_mutation_owner_intent_bound", "key_material_commitment_recomputed_client_side",
    "key_material_cross_profile_denied", "decryption_message_id_context_bound",
    "attachment_download_stream_bounded", "decrypted_blob_revoked_on_page_exit",
  ]) assert.equal(invariantIds.has(required), true, required);
  for (const [name, hash] of Object.entries(report.source_sha256)) {
    assert.match(name, /^(?:public|lib|test)\//);
    assert.match(hash, /^[a-f0-9]{64}$/);
  }
  for (const invariant of report.invariants) {
    assert.equal(invariant.pass, true, invariant.id);
    assert.match(invariant.source, /^(?:public|lib)\//);
    assert.ok(Number.isSafeInteger(invariant.scope_start) && invariant.scope_start > 0, invariant.id);
    assert.ok(Number.isSafeInteger(invariant.evidence_line) && invariant.evidence_line >= invariant.scope_start, invariant.id);
  }
});

test("E2EE inventory refuses production-grade claims that the current protocol cannot make", () => {
  const report = inventory();
  for (const required of [
    "independent_cryptographic_audit",
    "double_ratchet_or_ratcheting_sender_keys",
    "forward_secrecy_or_post_compromise_security",
    "automatic_cryptographic_peer_identity_authentication",
    "metadata_anonymity",
    "cryptographic_authentication_of_message_expiry",
    "real_device_interoperability",
  ]) assert.ok(report.explicitly_not_claimed.includes(required), required);
  assert.equal(report.invariant_assurance, "construction_scoped_source_shape_only_plus_separate_executable_test_artifacts");
  assert.match(report.scope, /source_shape_inventory_not_an_independent_cryptographic_audit/);
  assert.match(report.production_gate, /^BLOCKED_/);
  assert.equal(report.external_network, false);
  assert.equal(report.real_funds, false);
  assert.equal(report.incremental_cost, 0);
});
