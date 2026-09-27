import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

test("M6-M8 acceptance inventory is executable and keeps external gates open", () => {
  const cwd = resolve(import.meta.dirname, "..");
  const run = spawnSync(process.execPath, ["scripts/m6-m8-acceptance-inventory.mjs"], { cwd, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const report = JSON.parse(run.stdout);
  assert.equal(report.aggregate_local_gate, "PASS_LOCAL");
  assert.deepEqual(report.summary, { total: 24, passed: 24, failed: 0 });
  assert.equal(report.external_network, false);
  assert.equal(report.real_funds, false);
  assert.equal(report.incremental_cost, 0);
  assert.ok(report.external_gates_open.includes("shipping_tracking_maps_routing_eta_and_background_location"));
});
