import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

test("M4 and M5 local acceptance inventory is complete and externally truthful", () => {
  const run = spawnSync(process.execPath, [resolve(import.meta.dirname, "../scripts/m4-m5-acceptance-inventory.mjs")], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const report = JSON.parse(run.stdout);
  assert.equal(report.aggregate_local_gate, "PASS_LOCAL");
  assert.deepEqual(report.summary, { total: 16, passed: 16, failed: 0 });
  assert.equal(report.external_network, false);
  assert.equal(report.real_funds, false);
  assert.ok(report.external_gates_open.length >= 6);
});
