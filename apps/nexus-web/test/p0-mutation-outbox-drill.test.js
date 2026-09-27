import test from "node:test";
import assert from "node:assert/strict";
import { runMutationOutboxDrill } from "../scripts/mutation-outbox-drill.mjs";

test("mutation and Outbox crash windows recover without duplicate durable intent", () => {
  const first = runMutationOutboxDrill();
  const second = runMutationOutboxDrill();
  assert.deepEqual(second, first, "the local drill is deterministic");
  assert.equal(first.schema, "NEXUS_MUTATION_OUTBOX_CRASH_DRILL_V1");
  assert.equal(first.gate, "PASS_LOCAL");
  assert.deepEqual(first.summary, { total: 6, passed: 6, failed: 0 });
  assert.equal(first.local_only, true);
  assert.equal(first.external_network, false);
  assert.equal(first.real_funds, false);
  assert.equal(first.incremental_cost, 0);
});
