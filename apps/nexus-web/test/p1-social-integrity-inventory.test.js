import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
function inventory() {
  const run = spawnSync(process.execPath, ["scripts/social-integrity-inventory.mjs"], {
    cwd: root, encoding: "utf8", env: { ...process.env, NO_PROXY: "*", HTTP_PROXY: "", HTTPS_PROXY: "", ALL_PROXY: "" },
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  return JSON.parse(run.stdout);
}

test("Social integrity inventory is reproducible and all controls pass", () => {
  const report = inventory();
  assert.deepEqual(inventory(), report);
  assert.equal(report.schema, "NEXUS_SOCIAL_INTEGRITY_INVENTORY_V2");
  assert.equal(report.local_gate, "PASS_LOCAL_SOURCE_INVENTORY");
  assert.equal(report.invariant_summary.failed, 0);
  assert.ok(report.invariant_summary.total >= 44);
  assert.ok(Object.keys(report.source_sha256).length >= 15);
  assert.equal(report.external_network, false);
  assert.equal(report.real_funds, false);
  assert.equal(report.incremental_cost, 0);
});

test("Social inventory preserves external and independent release gates", () => {
  const report = inventory();
  for (const gate of ["real_device_validation", "independent_security_audit", "production_provider_readiness"])
    assert.ok(report.explicitly_not_claimed.includes(gate), gate);
});
