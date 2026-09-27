import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

test("critical privacy-bearing reads have explicit owner, participant or Privacy Matrix guards", () => {
  const result = spawnSync(process.execPath, [resolve(import.meta.dirname, "../scripts/read-authorization-inventory.mjs")], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.gate, "PASS_LOCAL");
  assert.equal(report.fail_closed, true);
  assert.equal(report.summary.failed, 0);
  assert.ok(report.summary.total >= 18);
  assert.match(report.scope, /not_every_public/);
});
