import test from "node:test";
import assert from "node:assert/strict";
import { planDraftEvictions } from "../public/draft-policy.js";

test("draft quota evicts oldest first and never silently evicts the saved draft", () => {
  const records = [
    { id: "new", bytes: 40 },
    { id: "middle", bytes: 40 },
    { id: "old", bytes: 40 },
  ];
  const plan = planDraftEvictions(records, { maxCount: 2, maxBytes: 80, preserveId: "new", sizeOf: (item) => item.bytes });
  assert.deepEqual(plan, { evictIds: ["old"], retainedCount: 2, retainedBytes: 80, overQuota: false });
});

test("draft quota reports unsatisfied policy when the preserved draft alone is too large", () => {
  const plan = planDraftEvictions([{ id: "saved", bytes: 101 }], {
    maxCount: 20,
    maxBytes: 100,
    preserveId: "saved",
    sizeOf: (item) => item.bytes,
  });
  assert.deepEqual(plan.evictIds, []);
  assert.equal(plan.overQuota, true);
});

test("draft quota rejects malformed policy input", () => {
  assert.throws(() => planDraftEvictions([], { maxCount: 0, maxBytes: 100, preserveId: "x" }), /invalid draft quota policy/);
});
