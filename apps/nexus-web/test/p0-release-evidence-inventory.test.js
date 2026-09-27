import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

test("release evidence inventory binds every local audit without closing external gates", () => {
  const result = spawnSync(process.execPath, [resolve(import.meta.dirname, "../scripts/release-evidence-inventory.mjs")], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.gate, "PASS_LOCAL");
  assert.equal(Object.keys(report.audits).length, 9);
  assert.equal(Object.keys(report.evidence_sha256).length, 5);
  assert.ok(Object.values(report.evidence_sha256).every((hash) => /^[a-f0-9]{64}$/.test(hash)));
  assert.ok(Object.values(report.external_gates).every((state) => state === "PENDING"));
});
