import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../lib/db.js";
import { createRepo, PERSONAS } from "../lib/repo.js";
import { sha256Hex } from "../lib/security.js";
import { decryptChatMessage, encryptEnvelopeForDevice } from "../public/chat-crypto.js";

const jwk = (x, y) => ({ kty: "EC", crv: "P-256", x: x.repeat(43), y: y.repeat(43) });

function enroll(repo, user, suffix, x, y) {
  const deviceId = `device:epoch:${suffix}:000001`;
  assert.equal(repo.registerChatDevice(user.id, { deviceId, label: suffix, publicJwk: jwk(x, y) }).status, "active");
  return deviceId;
}

function encryptedRequest({ conversationId, sender, senderDeviceId, nonce, material }) {
  const sharedBytes = Buffer.from(`one-shared-ciphertext:${nonce}`);
  const sharedAad = JSON.stringify({
    v: 3, conversation_id: conversationId, client_nonce: nonce,
    sender_device_id: senderDeviceId, device_set_commitment: material.commitment,
    key_epoch: material.key_epoch, key_epoch_commitment: material.key_epoch_commitment,
  });
  const sharedCiphertext = {
    iv_b64: Buffer.alloc(12, 7).toString("base64"),
    ciphertext_b64: sharedBytes.toString("base64"),
    aad_sha256: sha256Hex(sharedAad),
    ciphertext_sha256: sha256Hex(sharedBytes),
  };
  return {
    conversationId,
    senderId: sender.id,
    senderPersona: "social",
    senderDeviceId,
    clientNonce: nonce,
    deviceSetCommitment: material.commitment,
    keyEpoch: material.key_epoch,
    keyEpochCommitment: material.key_epoch_commitment,
    encryptionMode: "e2ee_group_v1",
    sharedCiphertext,
    envelopes: material.devices.map((device) => ({
      recipient_device_id: device.device_id,
      iv_b64: Buffer.alloc(12, 9).toString("base64"),
      ciphertext_b64: Buffer.from(`epoch-cipher:${device.device_id}`).toString("base64"),
      aad_sha256: sha256Hex(JSON.stringify({
        v: 3,
        conversation_id: conversationId,
        client_nonce: nonce,
        sender_device_id: senderDeviceId,
        recipient_device_id: device.device_id,
        device_set_commitment: material.commitment,
        key_epoch: material.key_epoch,
        key_epoch_commitment: material.key_epoch_commitment,
        purpose: "content_key",
        shared_ciphertext_sha256: sharedCiphertext.ciphertext_sha256,
        shared_aad_sha256: sharedCiphertext.aad_sha256,
      })),
    })),
  };
}

test("E2EE epoch schema is present with fail-safe defaults", () => {
  const db = openDb(":memory:");
  try {
    const userColumns = new Set(db.prepare("PRAGMA table_info(users)").all().map((column) => column.name));
    const conversationColumns = new Set(db.prepare("PRAGMA table_info(conversations)").all().map((column) => column.name));
    const messageColumns = new Set(db.prepare("PRAGMA table_info(message_items)").all().map((column) => column.name));
    assert.equal(userColumns.has("chat_key_epoch"), true);
    assert.equal(conversationColumns.has("key_epoch"), true);
    assert.equal(conversationColumns.has("key_epoch_changed_at"), true);
    assert.equal(messageColumns.has("key_epoch"), true);
    assert.equal(messageColumns.has("key_epoch_commitment"), true);
    assert.equal(messageColumns.has("encrypted_request_commitment"), true);
  } finally {
    db.close();
  }
});

test("group membership, device changes and blocks rotate E2EE authorization fail closed", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const alice = repo.createUser({ handle: "epoch_alice", displayName: "Alice" });
    const bob = repo.createUser({ handle: "epoch_bob", displayName: "Bob" });
    const dan = repo.createUser({ handle: "epoch_dan", displayName: "Dan" });
    const eve = repo.createUser({ handle: "epoch_eve", displayName: "Eve" });
    for (const user of [alice, bob, dan, eve]) for (const persona of PERSONAS) repo.ensurePersona(user.id, persona, {});

    const aliceDevice = enroll(repo, alice, "alice", "A", "B");
    enroll(repo, bob, "bob", "C", "D");
    enroll(repo, dan, "dan", "E", "F");
    enroll(repo, eve, "eve", "G", "H");
    const group = repo.createGroupConversation({ creatorId: alice.id, memberIds: [bob.id, dan.id], title: "Epoch room", contextPersona: "social" });
    const initialEpoch = repo.getConversation(group.id).key_epoch;
    assert.equal(repo.decideGroupInvitation(group.id, bob.id, "accept").key_epoch, initialEpoch + 1);
    assert.equal(repo.decideGroupInvitation(group.id, dan.id, "accept").key_epoch, initialEpoch + 2);

    const material = repo.conversationDeviceSet(group.id, alice.id);
    assert.equal(material.ready, true);
    assert.match(material.key_epoch_commitment, /^[a-f0-9]{64}$/);
    const sentRequest = encryptedRequest({ conversationId: group.id, sender: alice, senderDeviceId: aliceDevice, nonce: "epoch:message:0001", material });
    assert.equal(repo.sendEncryptedConversationMessage(sentRequest).ok, true);

    assert.equal(repo.addGroupMember(group.id, alice.id, eve.id, material.key_epoch - 1), null, "stale group administration is rejected");
    assert.equal(repo.addGroupMember(group.id, alice.id, eve.id, material.key_epoch).key_epoch, material.key_epoch, "a pending invitation does not receive keys or rotate the active set");
    assert.equal(repo.conversationDeviceSet(group.id, alice.id).key_epoch_commitment, material.key_epoch_commitment);
    repo.setProfileBlock(eve.id, "social", alice.id, true);
    assert.equal(repo.decideGroupInvitation(group.id, eve.id, "accept"), null, "a pending member cannot accept through a block with an active member");
    assert.equal(repo.getConversation(group.id).key_epoch, material.key_epoch);
    repo.setProfileBlock(eve.id, "social", alice.id, false);
    assert.equal(repo.decideGroupInvitation(group.id, eve.id, "accept").key_epoch, material.key_epoch + 1);
    const afterAccept = repo.conversationDeviceSet(group.id, alice.id);
    assert.notEqual(afterAccept.key_epoch_commitment, material.key_epoch_commitment);

    const capturedBeforeRemoval = afterAccept;
    assert.equal(repo.removeGroupMember(group.id, alice.id, dan.id, capturedBeforeRemoval.key_epoch), true);
    assert.equal(repo.removeGroupMember(group.id, alice.id, eve.id, capturedBeforeRemoval.key_epoch), false, "a concurrent stale removal cannot rotate or remove twice");
    assert.equal(repo.getConversationDetails(group.id, alice.id).participants.find((member) => member.id === eve.id).state, "active");
    const raced = repo.sendEncryptedConversationMessage(encryptedRequest({
      conversationId: group.id, sender: alice, senderDeviceId: aliceDevice,
      nonce: "epoch:message:race-removal", material: capturedBeforeRemoval,
    }));
    assert.equal(raced.error, "key_epoch_stale");
    assert.equal(db.prepare("SELECT COUNT(*) count FROM message_items WHERE client_nonce = ?").get("epoch:message:race-removal").count, 0);

    const beforeDeviceAdd = repo.conversationDeviceSet(group.id, alice.id);
    enroll(repo, bob, "bob-laptop", "I", "J");
    const afterDeviceAdd = repo.conversationDeviceSet(group.id, alice.id);
    assert.equal(afterDeviceAdd.key_epoch, beforeDeviceAdd.key_epoch, "account epochs scale without rewriting every conversation row");
    assert.notEqual(afterDeviceAdd.key_epoch_commitment, beforeDeviceAdd.key_epoch_commitment);
    assert.equal(repo.sendEncryptedConversationMessage(encryptedRequest({
      conversationId: group.id, sender: alice, senderDeviceId: aliceDevice,
      nonce: "epoch:message:stale-device", material: beforeDeviceAdd,
    })).error, "key_epoch_stale");

    const replayMaterial = afterDeviceAdd;
    const replayRequest = encryptedRequest({ conversationId: group.id, sender: alice, senderDeviceId: aliceDevice, nonce: "epoch:message:nonce-bound", material: replayMaterial });
    assert.equal(repo.sendEncryptedConversationMessage(replayRequest).ok, true);
    assert.equal(repo.sendEncryptedConversationMessage({
      ...replayRequest,
      envelopes: replayRequest.envelopes.map((envelope, index) => index === 0 ? { ...envelope, ciphertext_b64: "!!!", aad_sha256: "0".repeat(64) } : envelope),
    }).error, "nonce_conflict", "a nonce replay is bound to the accepted ciphertext, not only its epoch");
    assert.equal(repo.sendEncryptedConversationMessage({ ...replayRequest, expiresAt: Math.floor(Date.now() / 1000) + 3600 }).error, "nonce_conflict");
    assert.equal(db.prepare("SELECT COUNT(*) count FROM message_items WHERE sender_id = ? AND client_nonce = ?").get(alice.id, replayRequest.clientNonce).count, 1);
    enroll(repo, eve, "eve-tablet", "K", "L");
    const changedMaterial = repo.conversationDeviceSet(group.id, alice.id);
    assert.equal(repo.sendEncryptedConversationMessage({ ...replayRequest, keyEpochCommitment: changedMaterial.key_epoch_commitment }).error, "nonce_conflict");

    repo.setProfileBlock(alice.id, "social", bob.id, true);
    assert.equal(repo.sendEncryptedConversationMessage(replayRequest).error, "conversation_blocked", "repo-level replay cannot disclose a message after block");
    assert.equal(repo.sendConversationMessage({ conversationId: group.id, senderId: alice.id, senderPersona: "social", body: "must not pass", clientNonce: "blocked:plaintext:send" }), null);
    assert.equal(repo.listConversationMessages(group.id, alice.id), null);
    assert.equal(repo.listConversationMessages(group.id, bob.id), null);
    assert.equal(repo.listConversationMessages(group.id, eve.id), null, "a group with an unresolved block freezes instead of leaking a shared plaintext timeline");
    const blocked = repo.conversationDeviceSet(group.id, alice.id);
    assert.equal(blocked.ready, false);
    assert.equal(blocked.blocked_relationship, true);
    assert.deepEqual(blocked.devices, []);
    assert.equal(repo.sendEncryptedConversationMessage(encryptedRequest({
      conversationId: group.id, sender: alice, senderDeviceId: aliceDevice,
      nonce: "epoch:message:blocked", material: changedMaterial,
    })).error, "conversation_blocked");
    repo.setProfileBlock(alice.id, "social", bob.id, false);
    const unblocked = repo.conversationDeviceSet(group.id, alice.id);
    assert.equal(unblocked.ready, true);
    assert.notEqual(unblocked.key_epoch_commitment, changedMaterial.key_epoch_commitment);
  } finally {
    db.close();
  }
});

test("a block rotates only shared persona conversations, not a victim's unrelated rooms", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const alice = repo.createUser({ handle: "scope_alice", displayName: "Alice" });
    const bob = repo.createUser({ handle: "scope_bob", displayName: "Bob" });
    const eve = repo.createUser({ handle: "scope_eve", displayName: "Eve" });
    for (const user of [alice, bob, eve]) for (const persona of PERSONAS) repo.ensurePersona(user.id, persona, {});
    enroll(repo, alice, "scope-a", "Q", "R");
    enroll(repo, bob, "scope-b", "S", "T");
    enroll(repo, eve, "scope-e", "U", "V");
    const shared = repo.createDirectConversation({ creatorId: alice.id, recipientId: bob.id, contextPersona: "social" });
    const unrelated = repo.createDirectConversation({ creatorId: bob.id, recipientId: eve.id, contextPersona: "social" });
    const unrelatedBefore = repo.conversationDeviceSet(unrelated.id, bob.id);
    const sharedEpoch = repo.getConversation(shared.id).key_epoch;
    repo.setProfileBlock(alice.id, "social", bob.id, true);
    assert.equal(repo.getConversation(shared.id).key_epoch, sharedEpoch + 1);
    const unrelatedAfter = repo.conversationDeviceSet(unrelated.id, bob.id);
    assert.equal(unrelatedAfter.key_epoch, unrelatedBefore.key_epoch);
    assert.equal(unrelatedAfter.key_epoch_commitment, unrelatedBefore.key_epoch_commitment);
    assert.equal(unrelatedAfter.ready, true);
  } finally {
    db.close();
  }
});

test("legacy over-limit and malformed device rows fail closed without a parser exception", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const alice = repo.createUser({ handle: "legacy_device_owner", displayName: "Alice" });
    const bob = repo.createUser({ handle: "legacy_device_peer", displayName: "Bob" });
    for (const user of [alice, bob]) for (const persona of PERSONAS) repo.ensurePersona(user.id, persona, {});
    const conversation = repo.createDirectConversation({ creatorId: alice.id, recipientId: bob.id, contextPersona: "social" });
    for (let index = 0; index < 10; index += 1) {
      db.prepare(`INSERT INTO chat_devices (device_id, user_id, label, public_jwk, status) VALUES (?, ?, 'legacy', ?, 'active')`)
        .run(`device:legacy:a:${String(index).padStart(4, "0")}`, alice.id, JSON.stringify(jwk("W", "X")));
    }
    db.prepare(`INSERT INTO chat_devices (device_id, user_id, label, public_jwk, status) VALUES ('device:legacy:a:zzzz', ?, 'bad sentinel', '{bad', 'active')`).run(alice.id);
    enroll(repo, bob, "legacy-peer", "Y", "Z");
    const material = repo.conversationDeviceSet(conversation.id, bob.id);
    assert.equal(material.ready, false);
    assert.deepEqual(material.users_exceeding_device_limit, [alice.handle]);
    assert.deepEqual(material.devices, []);
    db.prepare("DELETE FROM chat_devices WHERE device_id = 'device:legacy:a:0000'").run();
    const malformed = repo.conversationDeviceSet(conversation.id, bob.id);
    assert.equal(malformed.ready, false);
    assert.equal(malformed.device_set_invalid, true);
    assert.deepEqual(malformed.devices, []);
  } finally {
    db.close();
  }
});

test("historical E2EE v1 ciphertext decrypts, while new unbound writes are refused", async () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const alice = repo.createUser({ handle: "legacy_crypto_a", displayName: "Alice" });
    const bob = repo.createUser({ handle: "legacy_crypto_b", displayName: "Bob" });
    for (const user of [alice, bob]) for (const persona of PERSONAS) repo.ensurePersona(user.id, persona, {});
    const conversation = repo.createDirectConversation({ creatorId: alice.id, recipientId: bob.id, contextPersona: "social" });
    const aliceKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const bobKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const alicePublic = await crypto.subtle.exportKey("jwk", aliceKeys.publicKey);
    const bobPublic = await crypto.subtle.exportKey("jwk", bobKeys.publicKey);
    const aliceDevice = "device:legacy:crypto:a1";
    const bobDevice = "device:legacy:crypto:b1";
    repo.registerChatDevice(alice.id, { deviceId: aliceDevice, label: "legacy a", publicJwk: alicePublic });
    repo.registerChatDevice(bob.id, { deviceId: bobDevice, label: "legacy b", publicJwk: bobPublic });
    const deviceSet = repo.conversationDeviceSet(conversation.id, alice.id);
    const nonce = "legacy:e2ee:v1:nonce";
    const aad = JSON.stringify({
      v: 1, conversation_id: conversation.id, client_nonce: nonce,
      sender_device_id: aliceDevice, recipient_device_id: bobDevice,
      device_set_commitment: deviceSet.commitment,
    });
    const bobImported = await crypto.subtle.importKey("jwk", bobPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const shared = await crypto.subtle.deriveBits({ name: "ECDH", public: bobImported }, aliceKeys.privateKey, 256);
    const hkdfKey = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
    const encoder = new TextEncoder();
    const salt = await crypto.subtle.digest("SHA-256", encoder.encode(`NEXUS_CHAT_SALT_V1:${conversation.id}:${deviceSet.commitment}`));
    const contentKey = await crypto.subtle.deriveKey({
      name: "HKDF", hash: "SHA-256", salt, info: encoder.encode(`NEXUS_E2EE_V1:${aliceDevice}:${bobDevice}`),
    }, hkdfKey, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(aad), tagLength: 128 }, contentKey,
      encoder.encode(JSON.stringify({ v: 1, type: "text", text: "legacy secret", created_at: 1 })));
    const inserted = db.prepare(`INSERT INTO message_items
      (conversation_id, sender_id, sender_persona, kind, body, client_nonce, encryption_mode, sender_device_id, device_set_commitment)
      VALUES (?, ?, 'social', 'encrypted', '', ?, 'e2ee_v1', ?, ?)`)
      .run(conversation.id, alice.id, nonce, aliceDevice, deviceSet.commitment);
    const messageId = Number(inserted.lastInsertRowid);
    db.prepare(`INSERT INTO message_ciphertext_envelopes
      (message_id, recipient_device_id, sender_device_id, iv_b64, ciphertext_b64, aad_sha256)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run(messageId, bobDevice, aliceDevice, Buffer.from(iv).toString("base64"), Buffer.from(ciphertext).toString("base64"), sha256Hex(aad));
    const message = repo.listConversationMessages(conversation.id, bob.id).find((item) => item.id === messageId);
    message.envelope = repo.getMessageEnvelope(messageId, bob.id, bobDevice);
    assert.equal(message.envelope.key_epoch, null);
    assert.equal(await decryptChatMessage(message, { deviceId: bobDevice, privateKey: bobKeys.privateKey }), "legacy secret");
    await assert.rejects(encryptEnvelopeForDevice({
      conversationId: conversation.id, clientNonce: "new-without-epoch", deviceSetCommitment: deviceSet.commitment,
      senderDevice: { deviceId: aliceDevice, privateKey: aliceKeys.privateKey },
      recipient: { device_id: bobDevice, public_jwk: bobPublic }, text: "downgrade",
    }), /epoch-bound E2EE key material is required/);
  } finally {
    db.close();
  }
});

test("accepting a direct-message request activates a fresh conversation epoch atomically", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const alice = repo.createUser({ handle: "epoch_request_a", displayName: "Alice" });
    const bob = repo.createUser({ handle: "epoch_request_b", displayName: "Bob" });
    for (const user of [alice, bob]) for (const persona of PERSONAS) repo.ensurePersona(user.id, persona, {});
    enroll(repo, alice, "request-a", "M", "N");
    enroll(repo, bob, "request-b", "O", "P");
    const request = repo.createDirectConversation({
      creatorId: alice.id, recipientId: bob.id, contextPersona: "social", requestRecipientId: bob.id,
    });
    const before = repo.getConversation(request.id);
    assert.equal(before.status, "request");
    assert.equal(repo.conversationDeviceSet(request.id, alice.id), null);
    const accepted = repo.decideConversationRequest(request.id, bob.id, "accept");
    assert.equal(accepted.status, "active");
    assert.equal(accepted.key_epoch, before.key_epoch + 1);
    assert.equal(repo.conversationDeviceSet(request.id, alice.id).ready, true);
    assert.equal(repo.decideConversationRequest(request.id, bob.id, "accept"), null, "a replay cannot rotate the epoch twice");
    assert.equal(repo.getConversation(request.id).key_epoch, accepted.key_epoch);
  } finally {
    db.close();
  }
});

test("a blocked pending direct request cannot be read or accepted", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const alice = repo.createUser({ handle: "blocked_request_a", displayName: "Alice" });
    const bob = repo.createUser({ handle: "blocked_request_b", displayName: "Bob" });
    for (const user of [alice, bob]) for (const persona of PERSONAS) repo.ensurePersona(user.id, persona, {});
    const request = repo.createDirectConversation({
      creatorId: alice.id, recipientId: bob.id, contextPersona: "social", requestRecipientId: bob.id,
    });
    assert.ok(repo.sendConversationMessage({
      conversationId: request.id, senderId: alice.id, senderPersona: "social",
      body: "one request preview", clientNonce: "pending:before:block",
    }));
    repo.setProfileBlock(bob.id, "social", alice.id, true);
    assert.equal(repo.conversationBlockState(request.id).blocked, true);
    assert.equal(repo.listConversationMessages(request.id, bob.id), null);
    assert.equal(repo.decideConversationRequest(request.id, bob.id, "accept"), null);
    assert.equal(repo.getConversation(request.id).status, "request");
    assert.equal(repo.decideConversationRequest(request.id, bob.id, "decline").status, "declined", "decline remains available as the safe exit");
  } finally {
    db.close();
  }
});
