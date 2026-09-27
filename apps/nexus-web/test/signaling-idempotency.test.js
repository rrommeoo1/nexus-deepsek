import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { sha256Hex } from "../lib/security.js";

test("100 SYSTEM_TEST call pairs keep signaling replay-safe, private and restart-stable", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const now = Math.floor(Date.now() / 1000);
  try {
    const pairs = Array.from({ length: 100 }, (_, index) => {
      const alice = repo.createUser({ handle: `systemtest_call_a_${index}`, displayName: `SYSTEM_TEST caller ${index}`, trafficClass: "SYSTEM_TEST" });
      const bob = repo.createUser({ handle: `systemtest_call_b_${index}`, displayName: `SYSTEM_TEST callee ${index}`, trafficClass: "SYSTEM_TEST" });
      const intruder = repo.createUser({ handle: `systemtest_call_x_${index}`, displayName: `SYSTEM_TEST intruder ${index}`, trafficClass: "SYSTEM_TEST" });
      for (const user of [alice, bob, intruder]) repo.ensurePersona(user.id, "social", {});
      for (const user of [alice, bob, intruder]) repo.ensurePersona(user.id, "work", {});
      const conversation = repo.createDirectConversation({ creatorId: alice.id, recipientId: bob.id, contextPersona: "social" });
      const call = repo.createConversationCall({
        callId: `call:systemtest_${String(index).padStart(6, "0")}_secure`,
        conversationId: conversation.id,
        initiatorId: alice.id,
        mode: "video",
        expiresAt: now + 60,
      });
      repo.decideConversationCall(call.call_id, bob.id, "accept", now);
      return { alice, bob, intruder, call };
    });

    for (const [index, pair] of pairs.entries()) {
      const nonce = `systemtest:offer:${String(index).padStart(5, "0")}`;
      const payloadHash = sha256Hex(`v=0 SYSTEM_TEST ${index}`);
      const first = repo.authorizeConversationCallSignal({ callId: pair.call.call_id, senderId: pair.alice.id, type: "offer", nonce, payloadHash, atSeconds: now });
      assert.equal(first.replay, false);
      assert.equal(first.shouldDeliver, true);
      assert.equal(first.recipient.id, pair.bob.id);
      assert.equal(repo.authorizeConversationCallSignal({ callId: pair.call.call_id, senderId: pair.alice.id, senderPersona: "work", type: "offer", nonce: `${nonce}:work`, payloadHash, atSeconds: now }), null);
      assert.equal(repo.authorizeConversationCallSignal({ callId: pair.call.call_id, senderId: pair.intruder.id, type: "offer", nonce, payloadHash, atSeconds: now }), null);
      assert.equal(repo.markConversationCallSignalDelivered({ callId: pair.call.call_id, senderId: pair.alice.id, nonce, payloadHash, atSeconds: now }), true);

      const restartedRepo = createRepo(db);
      const replay = restartedRepo.authorizeConversationCallSignal({ callId: pair.call.call_id, senderId: pair.alice.id, type: "offer", nonce, payloadHash, atSeconds: now + 1 });
      assert.equal(replay.replay, true);
      assert.equal(replay.shouldDeliver, false);
      assert.equal(restartedRepo.authorizeConversationCallSignal({ callId: pair.call.call_id, senderId: pair.alice.id, type: "offer", nonce, payloadHash: sha256Hex("changed"), atSeconds: now + 1 }), null);
    }

    assert.equal(db.prepare(`SELECT COUNT(*) count FROM call_signal_replay_guard`).get().count, 100);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM call_signal_replay_guard WHERE delivered_at IS NULL`).get().count, 0);
    const columns = db.prepare(`PRAGMA table_info(call_signal_replay_guard)`).all().map((column) => column.name);
    assert.equal(columns.some((name) => /payload(?!_sha256)|sdp|candidate/i.test(name)), false);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM users WHERE traffic_class = 'SYSTEM_TEST'`).get().count, 300);
    assert.deepEqual(repo.listCurrentCalls(pairs[0].alice.id, "work"), []);
  } finally { db.close(); }
});

test("an unacknowledged signal becomes deliverable only after its bounded claim expires", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const now = Math.floor(Date.now() / 1000);
  try {
    const alice = repo.createUser({ handle: "signal_claim_alice", displayName: "Alice" });
    const bob = repo.createUser({ handle: "signal_claim_bob", displayName: "Bob" });
    for (const user of [alice, bob]) repo.ensurePersona(user.id, "social", {});
    const conversation = repo.createDirectConversation({ creatorId: alice.id, recipientId: bob.id, contextPersona: "social" });
    const call = repo.createConversationCall({ callId: "call:signal_claim_recovery_01", conversationId: conversation.id, initiatorId: alice.id, mode: "audio", expiresAt: now + 60 });
    repo.decideConversationCall(call.call_id, bob.id, "accept", now);
    const command = { callId: call.call_id, senderId: alice.id, type: "offer", nonce: "signal:claim:recovery:01", payloadHash: sha256Hex("claim fixture") };
    assert.equal(repo.authorizeConversationCallSignal({ ...command, atSeconds: now }).shouldDeliver, true);
    assert.equal(repo.authorizeConversationCallSignal({ ...command, atSeconds: now + 1 }).shouldDeliver, false);
    assert.equal(repo.authorizeConversationCallSignal({ ...command, atSeconds: now + 5 }).shouldDeliver, true);
    assert.equal(repo.markConversationCallSignalDelivered({ ...command, atSeconds: now + 5 }), true);
    assert.equal(repo.authorizeConversationCallSignal({ ...command, atSeconds: now + 6 }).shouldDeliver, false);
    // Device loss is fail-closed: an active call without both participant leases expires.
    assert.equal(repo.authorizeConversationCallSignal({ ...command, atSeconds: now + 61 }), null);
    assert.equal(db.prepare(`SELECT status FROM conversation_calls WHERE call_id = ?`).get(call.call_id).status, "failed");
  } finally { db.close(); }
});

test("active call requires a fresh persona-bound lease from both exact participants", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const now = Math.floor(Date.now() / 1000);
  try {
    const alice = repo.createUser({ handle: "lease_alice", displayName: "Alice" });
    const bob = repo.createUser({ handle: "lease_bob", displayName: "Bob" });
    const eve = repo.createUser({ handle: "lease_eve", displayName: "Eve" });
    for (const user of [alice, bob, eve]) for (const persona of ["social", "work"]) repo.ensurePersona(user.id, persona, {});
    const conversation = repo.createDirectConversation({ creatorId: alice.id, recipientId: bob.id, contextPersona: "social" });
    const call = repo.createConversationCall({ callId: "call:participant_lease_secure_01", conversationId: conversation.id, initiatorId: alice.id, mode: "audio", expiresAt: now + 60 });
    assert.equal(repo.decideConversationCall(call.call_id, bob.id, "accept", now).status, "active");
    assert.equal(repo.touchConversationCallLease({ callId: call.call_id, userId: eve.id, viewerPersona: "social", atSeconds: now }), null);
    assert.equal(repo.touchConversationCallLease({ callId: call.call_id, userId: alice.id, viewerPersona: "work", atSeconds: now }), null);
    assert.equal(repo.touchConversationCallLease({ callId: call.call_id, userId: alice.id, viewerPersona: "social", atSeconds: now + 20 }).lease_until, now + 45);
    assert.equal(repo.touchConversationCallLease({ callId: call.call_id, userId: bob.id, viewerPersona: "social", atSeconds: now + 20 }).lease_until, now + 45);
    assert.equal(repo.expireConversationCalls(now + 44), 0);
    assert.equal(repo.getConversationCall(call.call_id, alice.id).status, "active");
    assert.equal(repo.expireConversationCalls(now + 45), 1);
    assert.equal(repo.getConversationCall(call.call_id, bob.id).status, "failed");
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM call_participant_leases WHERE call_id = ?`).get(call.call_id).count, 2);
  } finally { db.close(); }
});
