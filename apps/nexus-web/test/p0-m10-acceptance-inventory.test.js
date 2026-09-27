import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

test("M10 acceptance inventory proves local slices and preserves provider/country gates", () => {
  const cwd = resolve(import.meta.dirname, "..");
  const run = spawnSync(process.execPath, ["scripts/m10-acceptance-inventory.mjs"], { cwd, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const report = JSON.parse(run.stdout);
  assert.equal(report.aggregate_local_gate, "PASS_LOCAL");
  assert.deepEqual(report.summary, { total: 16, passed: 16, failed: 0 });
  assert.equal(report.external_network, false); assert.equal(report.real_funds, false); assert.equal(report.incremental_cost, 0);
  assert.ok(report.external_gates_open.includes("kids_separate_production_tenant_binary_and_key_hierarchy"));
});
