import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../lib/db.js";
import { handleRequest } from "../lib/api.js";
import { createRepo, MAX_E2EE_DEVICE_ENVELOPES, PERSONAS } from "../lib/repo.js";
import { issueSession, sha256Hex } from "../lib/security.js";
import { decryptChatMessage, encryptGroupPayloadForDevices } from "../public/chat-crypto.js";

globalThis.indexedDB ??= {};
let sequence = 0;

function fakeReq(method, url, cookie, body = {}) {
  const raw = Buffer.from(JSON.stringify(body));
  return {
    method,
    url,
    headers: {
      "content-type": "application/json",
      cookie,
      ...(new Set(["POST", "PUT", "PATCH", "DELETE"]).has(method) ? { "idempotency-key": `group-api-${String(++sequence).padStart(12, "0")}` } : {}),
    },
    on(event, callback) {
      if (event === "data") process.nextTick(() => callback(raw));
      else if (event === "end") process.nextTick(callback);
      return this;
    },
    once() { return this; },
    destroy() {},
  };
}

function fakeRes() {
  const response = { statusCode: 200, headers: {}, body: "" };
  response.writeHead = (code, headers) => { response.statusCode = code; Object.assign(response.headers, headers); };
  response.setHeader = (key, value) => { response.headers[key] = value; };
  response.end = (data) => { response.body = Buffer.isBuffer(data) ? data.toString("utf8") : String(data ?? ""); };
  return response;
}

async function enroll(repo, user, label) {
  const keys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const publicJwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
  const deviceId = `device:group:api:${label}`;
  repo.registerChatDevice(user.id, { deviceId, label, publicJwk });
  return { deviceId, privateKey: keys.privateKey };
}

test("group E2EE API negotiates scalable mode and returns only the requesting device wrapper", async () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const sse = { publish() { return { subscribers: 0, written: 0 }; }, broadcast() {}, subscribe() { return () => {}; } };
  try {
    const alice = repo.createUser({ handle: "group_api_alice", displayName: "Alice" });
    const bob = repo.createUser({ handle: "group_api_bob", displayName: "Bob" });
    const carol = repo.createUser({ handle: "group_api_carol", displayName: "Carol" });
    for (const user of [alice, bob, carol]) for (const persona of PERSONAS) repo.ensurePersona(user.id, persona, {});
    const aliceDevice = await enroll(repo, alice, "alice");
    const bobDevice = await enroll(repo, bob, "bob");
    await enroll(repo, carol, "carol");
    const group = repo.createGroupConversation({ creatorId: alice.id, memberIds: [bob.id, carol.id], title: "API group", contextPersona: "social" });
    repo.decideGroupInvitation(group.id, bob.id, "accept");
    repo.decideGroupInvitation(group.id, carol.id, "accept");

    const sessionFor = (user) => {
      const issued = issueSession(user.id, "social");
      repo.insertSession({ tokenHash: issued.tokenHash, userId: user.id, persona: "social", expiresAt: issued.expiresAt });
      return `nexus_session=${issued.token}`;
    };
    const aliceCookie = sessionFor(alice);
    const bobCookie = sessionFor(bob);
    const call = async (cookie, method, path, body = {}) => {
      const response = fakeRes();
      await handleRequest(fakeReq(method, path, cookie, body), response, { repo, db, sse });
      return { status: response.statusCode, body: response.body ? JSON.parse(response.body) : {} };
    };

    const keyMaterialResponse = await call(aliceCookie, "GET", `/api/chat/conversations/${group.id}/key-material`);
    assert.equal(keyMaterialResponse.status, 200);
    assert.equal(keyMaterialResponse.body.conversation_kind, "group");
    assert.match(keyMaterialResponse.body.protocol, /SINGLE_PAYLOAD_CONTENT_KEY_FANOUT/);
    assert.equal(keyMaterialResponse.body.ratcheting_sender_key_audit_complete, false);
    const material = keyMaterialResponse.body;
    const nonce = "group:api:secure:0001";
    const encrypted = await encryptGroupPayloadForDevices({
      conversationId: group.id, clientNonce: nonce, deviceSetCommitment: material.commitment,
      keyEpoch: material.key_epoch, keyEpochCommitment: material.key_epoch_commitment,
      senderDevice: { deviceId: aliceDevice.deviceId, privateKey: aliceDevice.privateKey },
      recipients: material.devices, payload: { v: 1, type: "text", text: "API group secret", created_at: 1 },
    });
    const requestBody = {
      encryption_mode: "e2ee_group_v1", sender_device_id: aliceDevice.deviceId,
      client_nonce: nonce, device_set_commitment: material.commitment,
      key_epoch: material.key_epoch, key_epoch_commitment: material.key_epoch_commitment,
      shared_ciphertext: encrypted.shared_ciphertext, envelopes: encrypted.envelopes,
    };
    const sent = await call(aliceCookie, "POST", `/api/chat/conversations/${group.id}/messages`, requestBody);
    assert.equal(sent.status, 201);
    assert.equal(sent.body.transport.server_received_plaintext, false);
    assert.equal(sent.body.message.encryption_mode, "e2ee_group_v1");

    const read = await call(bobCookie, "GET", `/api/chat/conversations/${group.id}/messages?device_id=${encodeURIComponent(bobDevice.deviceId)}`);
    assert.equal(read.status, 200);
    const received = read.body.messages.find((message) => message.id === sent.body.message.id);
    assert.equal(received.envelope.recipient_device_id, bobDevice.deviceId);
    assert.equal("content_key_b64" in received.envelope, false);
    assert.equal(await decryptChatMessage(received, { deviceId: bobDevice.deviceId, privateKey: bobDevice.privateKey }), "API group secret");

    const downgrade = await call(aliceCookie, "POST", `/api/chat/conversations/${group.id}/messages`, {
      ...requestBody, encryption_mode: "e2ee_v1", client_nonce: "group:api:downgrade:0001", shared_ciphertext: undefined,
    });
    assert.equal(downgrade.status, 400);
    assert.equal(downgrade.body.error, "encryption_mode_downgrade");
  } finally {
    db.close();
  }
});

test("API accepts exact E2EE coverage above the former 200-device split-brain limit", async () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const sse = { publish() { return { subscribers: 0, written: 0 }; }, broadcast() {}, subscribe() { return () => {}; } };
  try {
    assert.equal(MAX_E2EE_DEVICE_ENVELOPES, 500);
    const keys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const publicJwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
    const users = [];
    for (let userIndex = 0; userIndex < 21; userIndex += 1) {
      const user = repo.createUser({ handle: `coverage_${String(userIndex).padStart(2, "0")}`, displayName: `Coverage ${userIndex}` });
      users.push(user);
      for (const persona of PERSONAS) repo.ensurePersona(user.id, persona, {});
      for (let deviceIndex = 0; deviceIndex < 10; deviceIndex += 1) {
        assert.ok(repo.registerChatDevice(user.id, {
          deviceId: `device:coverage:${String(userIndex).padStart(2, "0")}:${String(deviceIndex).padStart(2, "0")}`,
          label: "Boundary fixture", publicJwk,
        }));
      }
    }
    const group = repo.createGroupConversation({ creatorId: users[0].id, memberIds: users.slice(1).map((user) => user.id), title: "210 devices", contextPersona: "social" });
    for (const user of users.slice(1)) assert.ok(repo.decideGroupInvitation(group.id, user.id, "accept"));
    const material = repo.conversationDeviceSet(group.id, users[0].id);
    assert.equal(material.ready, true);
    assert.equal(material.devices.length, 210);

    const nonce = "group:api:coverage:0210";
    const sharedBytes = Buffer.from("shared ciphertext boundary");
    const sharedAad = JSON.stringify({
      v: 3, conversation_id: group.id, client_nonce: nonce,
      sender_device_id: material.devices[0].device_id, device_set_commitment: material.commitment,
      key_epoch: material.key_epoch, key_epoch_commitment: material.key_epoch_commitment,
    });
    const shared = {
      iv_b64: Buffer.alloc(12, 4).toString("base64"), ciphertext_b64: sharedBytes.toString("base64"),
      aad_sha256: sha256Hex(sharedAad), ciphertext_sha256: sha256Hex(sharedBytes),
    };
    const envelopes = material.devices.map((device) => ({
      recipient_device_id: device.device_id,
      iv_b64: Buffer.alloc(12, 5).toString("base64"),
      ciphertext_b64: Buffer.from("opaque wrapped key").toString("base64"),
      aad_sha256: sha256Hex(JSON.stringify({
        v: 3, conversation_id: group.id, client_nonce: nonce,
        sender_device_id: material.devices[0].device_id, recipient_device_id: device.device_id,
        device_set_commitment: material.commitment, key_epoch: material.key_epoch,
        key_epoch_commitment: material.key_epoch_commitment, purpose: "content_key",
        shared_ciphertext_sha256: shared.ciphertext_sha256, shared_aad_sha256: shared.aad_sha256,
      })),
    }));
    const issued = issueSession(users[0].id, "social");
    repo.insertSession({ tokenHash: issued.tokenHash, userId: users[0].id, persona: "social", expiresAt: issued.expiresAt });
    const response = fakeRes();
    await handleRequest(fakeReq("POST", `/api/chat/conversations/${group.id}/messages`, `nexus_session=${issued.token}`, {
      encryption_mode: "e2ee_group_v1", sender_device_id: material.devices[0].device_id,
      client_nonce: nonce, device_set_commitment: material.commitment, key_epoch: material.key_epoch,
      key_epoch_commitment: material.key_epoch_commitment, shared_ciphertext: shared, envelopes,
    }), response, { repo, db, sse });
    assert.equal(response.statusCode, 201, response.body);
    assert.equal(db.prepare("SELECT COUNT(*) count FROM message_ciphertext_envelopes").get().count, 210);
  } finally {
    db.close();
  }
});
