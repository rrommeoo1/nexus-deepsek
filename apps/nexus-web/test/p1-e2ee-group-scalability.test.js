import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { openDb } from "../lib/db.js";
import { createRepo, PERSONAS } from "../lib/repo.js";
import { decryptChatMessage, encryptGroupPayloadForDevices } from "../public/chat-crypto.js";

// The packet exercises pure Web Crypto helpers; persistent key storage is not
// opened here, but the browser capability gate must still be represented.
globalThis.indexedDB ??= {};

async function enroll(repo, user, label) {
  const keys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const publicJwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
  const deviceId = `device:group:${label}:000001`;
  assert.equal(repo.registerChatDevice(user.id, { deviceId, label, publicJwk }).status, "active");
  return { deviceId, privateKey: keys.privateKey, publicJwk };
}

async function fixture() {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const alice = repo.createUser({ handle: "group_scale_alice", displayName: "Alice" });
  const bob = repo.createUser({ handle: "group_scale_bob", displayName: "Bob" });
  const carol = repo.createUser({ handle: "group_scale_carol", displayName: "Carol" });
  for (const user of [alice, bob, carol]) for (const persona of PERSONAS) repo.ensurePersona(user.id, persona, {});
  const aliceDevice = await enroll(repo, alice, "alice");
  const bobDevice = await enroll(repo, bob, "bob");
  const carolDevice = await enroll(repo, carol, "carol");
  const group = repo.createGroupConversation({ creatorId: alice.id, memberIds: [bob.id, carol.id], title: "Scalable room", contextPersona: "social" });
  repo.decideGroupInvitation(group.id, bob.id, "accept");
  repo.decideGroupInvitation(group.id, carol.id, "accept");
  return { db, repo, alice, bob, carol, group, aliceDevice, bobDevice, carolDevice };
}

async function encryptForFixture(state, nonce, text) {
  const material = state.repo.conversationDeviceSet(state.group.id, state.alice.id);
  const encrypted = await encryptGroupPayloadForDevices({
    conversationId: state.group.id,
    clientNonce: nonce,
    deviceSetCommitment: material.commitment,
    keyEpoch: material.key_epoch,
    keyEpochCommitment: material.key_epoch_commitment,
    senderDevice: { deviceId: state.aliceDevice.deviceId, privateKey: state.aliceDevice.privateKey },
    recipients: material.devices,
    payload: { v: 1, type: "text", text, created_at: 1 },
  });
  return { material, encrypted };
}

test("group envelope schema is additive and preserves historical message tables", () => {
  const db = openDb(":memory:");
  try {
    const columns = new Set(db.prepare("PRAGMA table_info(message_shared_ciphertexts)").all().map((column) => column.name));
    assert.deepEqual([...columns].sort(), ["aad_sha256", "ciphertext_b64", "ciphertext_sha256", "created_at", "iv_b64", "message_id"].sort());
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'message_ciphertext_envelopes'").get());
  } finally {
    db.close();
  }
});

test("group payload is encrypted once and only its random content key fans out per device", async () => {
  const state = await fixture();
  try {
    const nonce = "group:scalable:message:0001";
    const text = "A".repeat(3500);
    const { material, encrypted } = await encryptForFixture(state, nonce, text);
    assert.equal(encrypted.envelopes.length, material.devices.length);
    assert.ok(Buffer.from(encrypted.shared_ciphertext.ciphertext_b64, "base64").length > 3500);
    assert.ok(encrypted.envelopes.every((item) => Buffer.from(item.ciphertext_b64, "base64").length < 400), "per-device records wrap only a content key");

    const sent = state.repo.sendEncryptedConversationMessage({
      conversationId: state.group.id, senderId: state.alice.id, senderPersona: "social",
      senderDeviceId: state.aliceDevice.deviceId, clientNonce: nonce,
      deviceSetCommitment: material.commitment, keyEpoch: material.key_epoch,
      keyEpochCommitment: material.key_epoch_commitment, encryptionMode: "e2ee_group_v1",
      sharedCiphertext: encrypted.shared_ciphertext, envelopes: encrypted.envelopes,
    });
    assert.equal(sent.ok, true);
    assert.equal(sent.message.encryption_mode, "e2ee_group_v1");
    assert.equal(state.db.prepare("SELECT COUNT(*) count FROM message_shared_ciphertexts WHERE message_id = ?").get(sent.message.id).count, 1);
    assert.equal(state.db.prepare("SELECT COUNT(*) count FROM message_ciphertext_envelopes WHERE message_id = ?").get(sent.message.id).count, material.devices.length);
    assert.equal(state.db.prepare("SELECT body FROM message_items WHERE id = ?").get(sent.message.id).body, "");
    assert.equal(JSON.stringify(state.db.prepare("SELECT * FROM message_items WHERE id = ?").get(sent.message.id)).includes(text), false, "server message row never contains plaintext");

    for (const [user, device] of [[state.bob, state.bobDevice], [state.carol, state.carolDevice]]) {
      const message = state.repo.getConversationMessage(sent.message.id);
      message.envelope = state.repo.getMessageEnvelope(message.id, user.id, device.deviceId);
      assert.equal(await decryptChatMessage(message, { deviceId: device.deviceId, privateKey: device.privateKey }), text);
    }
  } finally {
    state.db.close();
  }
});

test("group envelope rejects downgrade, shared-ciphertext tamper and nonce rebinding", async () => {
  const state = await fixture();
  try {
    const nonce = "group:scalable:message:0002";
    const { material, encrypted } = await encryptForFixture(state, nonce, "bound group secret");
    const base = {
      conversationId: state.group.id, senderId: state.alice.id, senderPersona: "social",
      senderDeviceId: state.aliceDevice.deviceId, clientNonce: nonce,
      deviceSetCommitment: material.commitment, keyEpoch: material.key_epoch,
      keyEpochCommitment: material.key_epoch_commitment, envelopes: encrypted.envelopes,
    };
    assert.equal(state.repo.sendEncryptedConversationMessage({ ...base, encryptionMode: "e2ee_v1" }).error, "encryption_mode_downgrade");
    const direct = state.repo.createDirectConversation({ creatorId: state.alice.id, recipientId: state.bob.id, contextPersona: "social" });
    const directMaterial = state.repo.conversationDeviceSet(direct.id, state.alice.id);
    assert.equal(state.repo.sendEncryptedConversationMessage({
      ...base, conversationId: direct.id, deviceSetCommitment: directMaterial.commitment,
      keyEpoch: directMaterial.key_epoch, keyEpochCommitment: directMaterial.key_epoch_commitment,
      encryptionMode: "e2ee_group_v1", sharedCiphertext: encrypted.shared_ciphertext,
    }).error, "encryption_mode_downgrade", "direct chats cannot inject the group wire mode");
    const tampered = { ...encrypted.shared_ciphertext, ciphertext_b64: Buffer.from("tampered ciphertext with enough bytes").toString("base64") };
    assert.equal(state.repo.sendEncryptedConversationMessage({ ...base, encryptionMode: "e2ee_group_v1", sharedCiphertext: tampered }).error, "shared_ciphertext_invalid");

    const accepted = state.repo.sendEncryptedConversationMessage({ ...base, encryptionMode: "e2ee_group_v1", sharedCiphertext: encrypted.shared_ciphertext });
    assert.equal(accepted.ok, true);
    const other = await encryptForFixture(state, nonce, "different payload on same nonce");
    assert.equal(state.repo.sendEncryptedConversationMessage({
      ...base, encryptionMode: "e2ee_group_v1", sharedCiphertext: other.encrypted.shared_ciphertext,
      envelopes: other.encrypted.envelopes,
    }).error, "nonce_conflict");

    const message = state.repo.getConversationMessage(accepted.message.id);
    message.envelope = state.repo.getMessageEnvelope(message.id, state.bob.id, state.bobDevice.deviceId);
    message.envelope.shared_ciphertext_b64 = Buffer.from("ciphertext corrupted after retrieval").toString("base64");
    await assert.rejects(decryptChatMessage(message, { deviceId: state.bobDevice.deviceId, privateKey: state.bobDevice.privateKey }), /commitment mismatch/);

    state.db.prepare("UPDATE message_shared_ciphertexts SET ciphertext_b64 = ? WHERE message_id = ?")
      .run("A".repeat(87_388), accepted.message.id);
    assert.equal(state.repo.getMessageEnvelope(accepted.message.id, state.bob.id, state.bobDevice.deviceId), null, "oversized corrupted shared rows fail before base64 decode");
    state.db.prepare("UPDATE message_shared_ciphertexts SET ciphertext_b64 = ? WHERE message_id = ?")
      .run(encrypted.shared_ciphertext.ciphertext_b64, accepted.message.id);
    state.db.prepare("UPDATE message_ciphertext_envelopes SET ciphertext_b64 = ? WHERE message_id = ? AND recipient_device_id = ?")
      .run("A".repeat(16_388), accepted.message.id, state.bobDevice.deviceId);
    assert.equal(state.repo.getMessageEnvelope(accepted.message.id, state.bob.id, state.bobDevice.deviceId), null, "oversized corrupted wrappers fail before API serialization");
  } finally {
    state.db.close();
  }
});

test("expired group messages purge both shared ciphertext and every device wrapper", async () => {
  const state = await fixture();
  try {
    const nonce = "group:scalable:expiry:0001";
    const { material, encrypted } = await encryptForFixture(state, nonce, "ephemeral group payload");
    const now = Math.floor(Date.now() / 1000);
    const sent = state.repo.sendEncryptedConversationMessage({
      conversationId: state.group.id, senderId: state.alice.id, senderPersona: "social",
      senderDeviceId: state.aliceDevice.deviceId, clientNonce: nonce,
      deviceSetCommitment: material.commitment, keyEpoch: material.key_epoch,
      keyEpochCommitment: material.key_epoch_commitment, encryptionMode: "e2ee_group_v1",
      sharedCiphertext: encrypted.shared_ciphertext, envelopes: encrypted.envelopes, expiresAt: now + 1,
    });
    assert.equal(sent.ok, true);
    assert.equal(state.repo.purgeExpiredMessages(now + 2), 1);
    assert.equal(state.db.prepare("SELECT COUNT(*) count FROM message_shared_ciphertexts WHERE message_id = ?").get(sent.message.id).count, 0);
    assert.equal(state.db.prepare("SELECT COUNT(*) count FROM message_ciphertext_envelopes WHERE message_id = ?").get(sent.message.id).count, 0);
    assert.equal(state.repo.getConversationMessage(sent.message.id).status, "expired");
  } finally {
    state.db.close();
  }
});

test("group benchmark fixture remains compatible with exact encrypted-message context validation", () => {
  const result = spawnSync(process.execPath, ["scripts/group-e2ee-benchmark.mjs", "--devices=3"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    timeout: 15_000,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.devices, 3);
  assert.equal(report.exact_coverage, true);
  assert.equal(report.first_device_decrypt_ok, true);
  assert.equal(report.last_device_decrypt_ok, true);
  assert.equal(report.external_network, false);
  assert.equal(report.real_funds, false);
  assert.equal(report.incremental_cost, 0);
  assert.equal(report.local_gate, "PASS_LOCAL_OBSERVATION");
});
