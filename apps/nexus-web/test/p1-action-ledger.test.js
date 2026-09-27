import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { classifyAction, reconcileActionLedger } from "../lib/action-ledger.js";
import { completeMutationRecord, prepareMutation } from "../lib/mutation-idempotency.js";
import { createLocalOutboxHandlers, dispatchOutboxBatch } from "../lib/outbox.js";

function actor(db, trafficClass = "HUMAN_ORGANIC", suffix = trafficClass.toLowerCase()) {
  const repo = createRepo(db);
  const user = repo.createUser({ handle: `ledger_${suffix}`, displayName: `Ledger ${suffix}`, trafficClass });
  repo.ensurePersona(user.id, "social", {});
  return { repo, user };
}

function complete(db, user, { key = "nexus-action-ledger-key-0001", target = "/api/posts/7/reaction", body = '{"kind":"LIKE"}', status = 200 } = {}) {
  const prepared = prepareMutation({
    db, userId: user.id, actorPersona: "social", key,
    method: "POST", requestTarget: target, body: Buffer.from(body), now: 100,
  });
  const result = completeMutationRecord({ db, mutationId: prepared.id, status, body: '{"ok":true}', now: 101 });
  return { prepared, result };
}

test("one successful mutation creates exactly one hash-only ActionIntent and replay creates none", () => {
  const db = openDb(":memory:");
  try {
    const { repo, user } = actor(db);
    const first = complete(db, user);
    assert.equal(first.result.changes, 1);
    assert.equal(db.prepare("SELECT count(*) count FROM action_intents").get().count, 1);
    assert.equal(db.prepare("SELECT count(*) count FROM outbox_events WHERE event_type = 'action.intent.created'").get().count, 1);
    const replay = prepareMutation({
      db, userId: user.id, actorPersona: "social", key: "nexus-action-ledger-key-0001",
      method: "POST", requestTarget: "/api/posts/7/reaction", body: Buffer.from('{"kind":"LIKE"}'), now: 102,
    });
    assert.equal(replay.action, "replay");
    assert.equal(db.prepare("SELECT count(*) count FROM action_intents").get().count, 1);

    const intent = db.prepare("SELECT * FROM action_intents").get();
    for (const field of ["actor_commitment", "object_commitment", "payload_hash", "idempotency_commitment"]) {
      assert.match(intent[field], /^[a-f0-9]{64}$/);
    }
    assert.equal(intent.chain_status, "LOCAL_ACCEPTED_CHAIN_DISABLED");
    const event = db.prepare("SELECT * FROM outbox_events WHERE event_type = 'action.intent.created'").get();
    const payload = JSON.parse(event.payload_json);
    assert.deepEqual(Object.keys(payload).sort(), ["action_class", "action_type", "actor_kind", "chain_status", "intent_id", "payload_hash"]);
    assert.equal(JSON.stringify(payload).includes("LIKE"), false);
    assert.equal(JSON.stringify(payload).includes(user.handle), false);

    const dispatched = dispatchOutboxBatch({ db, handlers: createLocalOutboxHandlers(repo), now: 101 });
    assert.equal(dispatched.published, 1);
    assert.equal(db.prepare("SELECT chain_status FROM action_intents").get().chain_status, "LOCAL_ACCEPTED_CHAIN_DISABLED");
  } finally { db.close(); }
});

test("synthetic, private and ephemeral actions are classified without false chain claims", () => {
  const db = openDb(":memory:");
  try {
    const { user } = actor(db, "SYSTEM_TEST", "system_test");
    complete(db, user, { key: "nexus-action-ledger-system-0001", target: "/api/chat/conversations/1/messages", body: '{"ciphertext":"private-text-never-export"}' });
    const intent = db.prepare("SELECT * FROM action_intents").get();
    assert.equal(intent.actor_kind, "SYSTEM_TEST");
    assert.equal(intent.action_class, "PRIVATE_ACTION");
    assert.equal(intent.chain_status, "EXCLUDED_SYNTHETIC");
    assert.equal(JSON.stringify(db.prepare("SELECT payload_json FROM outbox_events WHERE event_type = 'action.intent.created'").get()).includes("private-text"), false);
    assert.deepEqual(classifyAction("POST", "/api/social/impressions"), { action_class: "EPHEMERAL_EXCLUDED", action_type: "EPHEMERAL_TRANSPORT" });
    assert.deepEqual(classifyAction("POST", "/api/new-feature"), { action_class: "PRIVATE_ACTION", action_type: "UNCLASSIFIED_MUTATION" });
  } finally { db.close(); }
});

test("mutation completion and ActionIntent/outbox are one atomic savepoint", () => {
  const db = openDb(":memory:");
  try {
    const { user } = actor(db);
    const prepared = prepareMutation({
      db, userId: user.id, actorPersona: "social", key: "nexus-action-ledger-atomic-0001",
      method: "POST", requestTarget: "/api/posts", body: Buffer.from("{}"), now: 100,
    });
    db.exec(`CREATE TRIGGER fail_action_outbox BEFORE INSERT ON outbox_events
      WHEN NEW.event_type = 'action.intent.created' BEGIN SELECT RAISE(ABORT, 'synthetic outbox fault'); END`);
    assert.throws(() => completeMutationRecord({ db, mutationId: prepared.id, status: 201, body: "{}", now: 101 }), /synthetic outbox fault/);
    assert.equal(db.prepare("SELECT status FROM mutation_requests WHERE id = ?").get(prepared.id).status, "in_progress");
    assert.equal(db.prepare("SELECT count(*) count FROM action_intents").get().count, 0);
  } finally { db.close(); }
});

test("oversized replay status preserves the successful outcome and remains reconcilable", () => {
  const db = openDb(":memory:");
  try {
    const { user } = actor(db);
    const prepared = prepareMutation({
      db, userId: user.id, actorPersona: "social", key: "nexus-action-ledger-large-0001",
      method: "POST", requestTarget: "/api/posts", body: Buffer.from("{}"), now: 100,
    });
    completeMutationRecord({ db, mutationId: prepared.id, status: 201, body: Buffer.alloc((1024 * 1024) + 1), now: 101 });
    const stored = db.prepare("SELECT outcome_status, response_status FROM mutation_requests WHERE id = ?").get(prepared.id);
    assert.equal(stored.outcome_status, 201);
    assert.equal(stored.response_status, 409);
    assert.equal(reconcileActionLedger(db).status, "PASS");
  } finally { db.close(); }
});

test("reconciliation detects and repairs a missing derived intent exactly once", () => {
  const db = openDb(":memory:");
  try {
    const { user } = actor(db);
    complete(db, user, { key: "nexus-action-ledger-repair-0001" });
    const intent = db.prepare("SELECT id FROM action_intents").get();
    db.prepare("DELETE FROM outbox_events WHERE aggregate_id = ?").run(intent.id);
    db.prepare("DELETE FROM action_intents WHERE id = ?").run(intent.id);
    const before = reconcileActionLedger(db);
    assert.equal(before.status, "MISMATCH");
    assert.equal(before.mismatches.missing_intent_mutation_ids.length, 1);
    const repaired = reconcileActionLedger(db, { repair: true, recordRun: true, now: 200 });
    assert.equal(repaired.status, "PASS");
    assert.equal(db.prepare("SELECT count(*) count FROM action_intents").get().count, 1);
    assert.equal(db.prepare("SELECT count(*) count FROM action_reconciliation_runs").get().count, 1);
    assert.equal(reconcileActionLedger(db, { repair: true }).status, "PASS");
    assert.equal(db.prepare("SELECT count(*) count FROM action_intents").get().count, 1);
  } finally { db.close(); }
});
