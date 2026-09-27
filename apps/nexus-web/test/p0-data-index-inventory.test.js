import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

test("critical feed, graph, message, upload and outbox queries retain explicit indexes", () => {
  const result = spawnSync(process.execPath, [resolve(import.meta.dirname, "../scripts/data-index-inventory.mjs")], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.gate, "PASS_LOCAL");
  assert.equal(report.summary.failed, 0);
  assert.ok(report.required_indexes.length >= 13);
});
