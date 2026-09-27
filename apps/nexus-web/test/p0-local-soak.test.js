import test from "node:test";
import assert from "node:assert/strict";
import { runLocalSoak } from "../scripts/local-soak.mjs";

test("bounded local soak has no backlog, isolation or crash-recovery regression", () => {
  const report = runLocalSoak({ rounds: 2, actors: 25 });
  assert.equal(report.gate, "PASS_LOCAL");
  assert.deepEqual(report.checks, {
    every_round_passed: true,
    no_detected_issues: true,
    bounded_round_latency: true,
  });
  assert.equal(report.local_mock_only, true);
  assert.equal(report.network_egress, false);
  assert.equal(report.production_capacity_claim, "NOT_CLAIMED");
});
