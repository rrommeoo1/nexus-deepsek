import test from "node:test";
import assert from "node:assert/strict";
import { runCycle100Readiness } from "../scripts/cycle-100-readiness.mjs";

test("cycle 100 readiness is evidence-bound and preserves every external release gate", () => {
  const report = runCycle100Readiness();
  assert.equal(report.gate, "PASS_LOCAL_ENGINEERING_SEQUENCE_100");
  assert.equal(report.public_release, "BLOCKED_BY_DECLARED_EXTERNAL_GATES");
  assert.equal(report.authoritative_spec_lines, 848);
  assert.equal(report.completed_cycle_range, "077-100");
  assert.equal(report.external_network, false);
  assert.equal(report.real_funds, false);
  assert.equal(report.incremental_cost, 0);
  assert.equal(report.external_share, "DENIED");
  assert.ok(report.explicitly_not_claimed.length >= 5);
});
