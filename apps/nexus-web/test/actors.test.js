import test from "node:test";
import assert from "node:assert/strict";
import { runActors } from "../scripts/actors.js";

test("SyntheticActorLab keeps logical actors isolated from organic product state", () => {
  const report = runActors({ count: 50, seed: 71 });
  assert.equal(report.lab, "NEXUS_SYNTHETIC_ACTOR_LAB_V2");
  assert.equal(report.local_only, true);
  assert.equal(report.network_egress, false);
  assert.equal(report.real_funds, false);
  assert.equal(report.deployment_gate, "PASS");
  assert.deepEqual(report.issues, []);
  assert.deepEqual(report.checks, {
    tagged: true,
    organicLeak: false,
    sigilLeak: false,
    selfFollows: 0,
    badThreads: 0,
  });
});
