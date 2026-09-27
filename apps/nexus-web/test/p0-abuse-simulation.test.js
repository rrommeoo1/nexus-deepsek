import test from "node:test";
import assert from "node:assert/strict";
import { runAbuseSimulation } from "../scripts/abuse-simulation.mjs";

test("synthetic spam, report flood and blocking cannot affect organic state", () => {
  const report = runAbuseSimulation({ actorCount: 100 });
  assert.equal(report.schema, "NEXUS_SYNTHETIC_ABUSE_SIMULATION_V1");
  assert.equal(report.gate, "PASS_LOCAL");
  assert.deepEqual(report.check_summary, { total: 10, passed: 10, failed: 0 });
  assert.equal(report.summary.actors, 100);
  assert.equal(report.summary.follow_attempts, 100);
  assert.equal(report.summary.report_attempts, 200);
  assert.equal(report.summary.unique_reports, 100);
  assert.equal(report.summary.organic_context_reports, 25);
  assert.equal(report.summary.denied_after_block, 100);
  assert.equal(report.summary.replay_requests, 300);
  assert.equal(report.traffic_class, "SYSTEM_TEST");
  assert.equal(report.network_egress, false);
  assert.equal(report.real_funds, false);
  assert.equal(report.incremental_cost, 0);
  assert.equal(report.trusted_edge_rate_limit_gate, "NOT_CLAIMED_LOCAL");
});
