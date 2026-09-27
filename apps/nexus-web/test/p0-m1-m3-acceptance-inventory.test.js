import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("M1-M3 local acceptance is executable and keeps every production gate explicit", () => {
  const result = spawnSync(process.execPath, ["scripts/m1-m3-acceptance-inventory.mjs"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.aggregate_local_gate, "PASS_LOCAL");
  assert.deepEqual(Object.fromEntries(Object.entries(report.milestones).map(([key, value]) => [key, value.summary])), {
    M1_IDENTITY: { total: 10, passed: 10, failed: 0 },
    M2_DATA_INTEGRITY: { total: 10, passed: 10, failed: 0 },
    M3_NEXUS_SOCIAL: { total: 15, passed: 15, failed: 0 },
  });
  assert.equal(report.external_gates_open.length, 6);
  assert.equal(report.external_network, false);
  assert.equal(report.real_funds, false);
  assert.equal(report.incremental_cost, 0);
});
