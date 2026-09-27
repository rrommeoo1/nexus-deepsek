import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../lib/db.js";
import { createRepo, E2EE_ORPHAN_RETENTION_SECONDS, PERSONAS } from "../lib/repo.js";
import { sha256Hex } from "../lib/security.js";

const publicJwk = (x, y) => ({ kty: "EC", crv: "P-256", x: x.repeat(43), y: y.repeat(43) });

function encryptedMedia(repo, owner, suffix, persona = "social") {
  return repo.insertMedia({
    hash: sha256Hex(`ciphertext:${suffix}`), ext: "nxenc", mime: "application/vnd.nexus.e2ee",
    detectedMime: null, kind: "encrypted", size: 4096, uploadedBy: owner.id,
    purpose: "message_e2ee_attachment", actorPersona: persona,
    scanStatus: "ready_client_encrypted", scanReason: "ciphertext_not_server_scannable",
  });
}

test("E2EE attachment binds ciphertext to one conversation message and exact active-device envelopes", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const alice = repo.createUser({ handle: "attach_alice", displayName: "Alice" });
    const bob = repo.createUser({ handle: "attach_bob", displayName: "Bob" });
    const eve = repo.createUser({ handle: "attach_eve", displayName: "Eve" });
    for (const user of [alice, bob, eve]) for (const persona of PERSONAS) repo.ensurePersona(user.id, persona, {});
    const conversation = repo.createDirectConversation({ creatorId: alice.id, recipientId: bob.id, contextPersona: "social" });
    const aliceDevice = "device:attachment:alice:01";
    const bobDevice = "device:attachment:bob:0001";
    repo.registerChatDevice(alice.id, { deviceId: aliceDevice, label: "Alice", publicJwk: publicJwk("A", "B") });
    repo.registerChatDevice(bob.id, { deviceId: bobDevice, label: "Bob", publicJwk: publicJwk("C", "D") });
    const material = repo.conversationDeviceSet(conversation.id, alice.id);
    const nonce = "e2ee:attachment:nonce:01";
    const envelopes = material.devices.map((device) => ({
      recipient_device_id: device.device_id,
      iv_b64: Buffer.alloc(12, 3).toString("base64"),
      ciphertext_b64: Buffer.from(`wrapped-key:${device.device_id}`).toString("base64"),
      aad_sha256: sha256Hex(JSON.stringify({
        v: 2, conversation_id: conversation.id, client_nonce: nonce,
        sender_device_id: aliceDevice, recipient_device_id: device.device_id,
        device_set_commitment: material.commitment,
        key_epoch: material.key_epoch, key_epoch_commitment: material.key_epoch_commitment,
      })),
    }));
    const media = encryptedMedia(repo, alice, "primary");
    const sent = repo.sendEncryptedConversationMessage({
      conversationId: conversation.id, senderId: alice.id, senderPersona: "social",
      senderDeviceId: aliceDevice, clientNonce: nonce, deviceSetCommitment: material.commitment,
      keyEpoch: material.key_epoch, keyEpochCommitment: material.key_epoch_commitment,
      envelopes, attachmentMediaId: media.id,
    });
    assert.equal(sent.ok, true);
    assert.equal(sent.message.kind, "encrypted_attachment");
    assert.equal(sent.message.body, "");
    assert.equal(sent.message.attachment_media_id, media.id);
    assert.equal(repo.canReadMedia(media.id, alice.id, "social"), true);
    assert.equal(repo.canReadMedia(media.id, bob.id, "social"), true);
    assert.equal(repo.canReadMedia(media.id, eve.id, "social"), false);
    assert.equal(repo.getMessageEnvelope(sent.message.id, bob.id, bobDevice).recipient_device_id, bobDevice);

    const second = encryptedMedia(repo, alice, "different");
    assert.equal(repo.sendEncryptedConversationMessage({
      conversationId: conversation.id, senderId: alice.id, senderPersona: "social",
      senderDeviceId: aliceDevice, clientNonce: nonce, deviceSetCommitment: material.commitment,
      keyEpoch: material.key_epoch, keyEpochCommitment: material.key_epoch_commitment,
      envelopes, attachmentMediaId: second.id,
    }).error, "nonce_conflict");

    const plaintext = repo.insertMedia({
      hash: sha256Hex("plaintext-image"), ext: "jpg", mime: "image/jpeg", detectedMime: "image/jpeg",
      kind: "image", size: 100, uploadedBy: alice.id, purpose: "message_e2ee_attachment",
      actorPersona: "social", scanStatus: "ready_local_validation", scanReason: "fixture",
    });
    assert.equal(repo.sendEncryptedConversationMessage({
      conversationId: conversation.id, senderId: alice.id, senderPersona: "social",
      senderDeviceId: aliceDevice, clientNonce: "e2ee:attachment:nonce:02", deviceSetCommitment: material.commitment,
      keyEpoch: material.key_epoch, keyEpochCommitment: material.key_epoch_commitment,
      envelopes, attachmentMediaId: plaintext.id,
    }).error, "encrypted_attachment_invalid");

    const bobSecond = "device:attachment:bob:0002";
    repo.registerChatDevice(bob.id, { deviceId: bobSecond, label: "Bob new", publicJwk: publicJwk("E", "F") });
    assert.equal(repo.getMessageEnvelope(sent.message.id, bob.id, bobSecond), null);
    repo.revokeChatDevice(bob.id, bobDevice);
    assert.equal(repo.getMessageEnvelope(sent.message.id, bob.id, bobDevice), null);
    assert.equal(repo.canReadMedia(media.id, bob.id, "social"), true, "ciphertext may remain downloadable but no historical key is granted");
    repo.setProfileBlock(bob.id, "social", alice.id, true);
    assert.equal(repo.canReadMedia(media.id, bob.id, "social"), false, "a known ciphertext URL cannot bypass the shared conversation block policy");
  } finally {
    db.close();
  }
});

test("orphan E2EE ciphertext purge is bounded, dry-run by default, claim-safe and retryable", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  try {
    const alice = repo.createUser({ handle: "purge_alice", displayName: "Alice" });
    const bob = repo.createUser({ handle: "purge_bob", displayName: "Bob" });
    for (const user of [alice, bob]) for (const persona of PERSONAS) repo.ensurePersona(user.id, persona, {});
    const conversation = repo.createDirectConversation({ creatorId: alice.id, recipientId: bob.id, contextPersona: "social" });
    const aliceDevice = "device:purge:alice:0001";
    const bobDevice = "device:purge:bob:000001";
    repo.registerChatDevice(alice.id, { deviceId: aliceDevice, label: "Alice", publicJwk: publicJwk("G", "H") });
    repo.registerChatDevice(bob.id, { deviceId: bobDevice, label: "Bob", publicJwk: publicJwk("I", "J") });
    const material = repo.conversationDeviceSet(conversation.id, alice.id);
    const claimed = encryptedMedia(repo, alice, "claimed");
    const orphan = encryptedMedia(repo, alice, "orphan");
    const fresh = encryptedMedia(repo, alice, "fresh");
    const old = 2_000_000_000 - E2EE_ORPHAN_RETENTION_SECONDS - 1;
    db.prepare(`UPDATE media SET created_at = ? WHERE id IN (?, ?)`).run(old, claimed.id, orphan.id);
    db.prepare(`UPDATE media SET created_at = ? WHERE id = ?`).run(2_000_000_000, fresh.id);

    const nonce = "e2ee:purge:claimed:01";
    const envelopes = material.devices.map((device) => ({
      recipient_device_id: device.device_id,
      iv_b64: Buffer.alloc(12, 7).toString("base64"),
      ciphertext_b64: Buffer.from(`wrapped:${device.device_id}`).toString("base64"),
      aad_sha256: sha256Hex(JSON.stringify({
        v: 2, conversation_id: conversation.id, client_nonce: nonce,
        sender_device_id: aliceDevice, recipient_device_id: device.device_id,
        device_set_commitment: material.commitment,
        key_epoch: material.key_epoch, key_epoch_commitment: material.key_epoch_commitment,
      })),
    }));
    assert.equal(repo.sendEncryptedConversationMessage({
      conversationId: conversation.id, senderId: alice.id, senderPersona: "social",
      senderDeviceId: aliceDevice, clientNonce: nonce, deviceSetCommitment: material.commitment,
      keyEpoch: material.key_epoch, keyEpochCommitment: material.key_epoch_commitment,
      envelopes, attachmentMediaId: claimed.id,
    }).ok, true);

    let purgeCalls = 0;
    const fakePurger = (hash, ext) => { purgeCalls += 1; return { hash, ext, deleted: 1, already_missing: false }; };
    const preview = repo.purgeOrphanEncryptedAttachments({ now: 2_000_000_000, mediaPurger: fakePurger });
    assert.deepEqual({ dry: preview.dry_run, eligible: preview.eligible, purged: preview.purged, calls: purgeCalls }, { dry: true, eligible: 1, purged: 0, calls: 0 });
    assert.ok(repo.getMediaById(orphan.id));
    assert.ok(repo.getMediaById(claimed.id));
    assert.ok(repo.getMediaById(fresh.id));

    assert.throws(() => repo.purgeOrphanEncryptedAttachments({
      now: 2_000_000_000, dryRun: false, mediaPurger: () => { throw new Error("storage unavailable"); },
    }), /storage unavailable/);
    assert.ok(repo.getMediaById(orphan.id), "failed storage deletion must keep the database record for retry");
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM media_purge_receipts`).get().count, 0);

    const executed = repo.purgeOrphanEncryptedAttachments({ now: 2_000_000_000, dryRun: false, mediaPurger: fakePurger });
    assert.equal(executed.purged, 1);
    assert.equal(executed.receipts.length, 1);
    assert.match(executed.receipts[0].receipt_hash, /^[a-f0-9]{64}$/);
    assert.equal(repo.getMediaById(orphan.id), null);
    assert.ok(repo.getMediaById(claimed.id), "message-claimed ciphertext is never an orphan candidate");
    assert.ok(repo.getMediaById(fresh.id), "fresh ciphertext retains its retry window");
    assert.equal(db.prepare(`SELECT reason FROM media_purge_receipts`).get().reason, "unclaimed_e2ee_attachment_retention_expired");

    const replay = repo.purgeOrphanEncryptedAttachments({ now: 2_000_000_000, dryRun: false, mediaPurger: fakePurger });
    assert.equal(replay.purged, 0);
    assert.equal(purgeCalls, 1, "a completed purge is idempotent");
  } finally {
    db.close();
  }
});
