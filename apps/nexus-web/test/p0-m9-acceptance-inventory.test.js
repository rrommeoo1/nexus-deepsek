import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

test("M9 acceptance inventory is executable and preserves external gates", () => {
  const cwd = resolve(import.meta.dirname, "..");
  const run = spawnSync(process.execPath, ["scripts/m9-acceptance-inventory.mjs"], { cwd, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const report = JSON.parse(run.stdout);
  assert.equal(report.aggregate_local_gate, "PASS_LOCAL");
  assert.deepEqual(report.summary, { total: 12, passed: 12, failed: 0 });
  assert.equal(report.external_network, false);
  assert.equal(report.real_funds, false);
  assert.equal(report.incremental_cost, 0);
  assert.ok(report.external_gates_open.includes("age_identity_liveness_and_adult-content-provider_validation"));
});
