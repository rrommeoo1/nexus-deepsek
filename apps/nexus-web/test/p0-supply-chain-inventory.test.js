import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

test("offline SBOM is lock-, integrity-, source- and license-complete without advisory overclaim", () => {
  const result = spawnSync(process.execPath, [resolve(import.meta.dirname, "../scripts/supply-chain-inventory.mjs")], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.gate, "PASS_LOCAL");
  assert.equal(report.summary.failed, 0);
  assert.ok(report.package_count >= 200);
  assert.equal(report.advisory_database_checked, false);
  assert.match(report.advisory_nonclaim, /No network advisory database/);
  assert.equal(report.legal_license_gate, "FORMAL_REVIEW_REQUIRED_BEFORE_DISTRIBUTION");
  assert.deepEqual(report.copyleft_packages.map((item) => item.path).sort(), [
    "node_modules/@multiversx/sdk-native-auth-client",
    "node_modules/@multiversx/sdk-native-auth-server",
  ]);
});
