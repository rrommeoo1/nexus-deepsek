import { performance } from "node:perf_hooks";
import { decryptChatMessage, encryptGroupPayloadForDevices } from "../public/chat-crypto.js";

globalThis.indexedDB ??= {};

function readCount() {
  const raw = process.argv.find((argument) => argument.startsWith("--devices="))?.split("=")[1] ?? "500";
  const count = Number(raw);
  if (!Number.isSafeInteger(count) || count < 1 || count > 500) throw new Error("--devices must be an integer between 1 and 500");
  return count;
}

const deviceCount = readCount();
const senderKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
const exportedSenderPublicJwk = await crypto.subtle.exportKey("jwk", senderKeys.publicKey);
const senderPublicJwk = {
  kty: "EC",
  crv: "P-256",
  x: exportedSenderPublicJwk.x,
  y: exportedSenderPublicJwk.y,
};
const recipients = [];
const sampledPrivateKeys = new Map();
for (let index = 0; index < deviceCount; index += 1) {
  const keys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const deviceId = `device:benchmark:${String(index).padStart(4, "0")}`;
  recipients.push({ device_id: deviceId, public_jwk: await crypto.subtle.exportKey("jwk", keys.publicKey) });
  if (index === 0 || index === deviceCount - 1) sampledPrivateKeys.set(deviceId, keys.privateKey);
}
const beforeHeap = process.memoryUsage().heapUsed;
const started = performance.now();
const payload = { v: 1, type: "text", text: "N".repeat(4000), created_at: 1 };
const encrypted = await encryptGroupPayloadForDevices({
  conversationId: 34001,
  clientNonce: "benchmark:group:e2ee:0001",
  deviceSetCommitment: "a".repeat(64),
  keyEpoch: 34,
  keyEpochCommitment: "b".repeat(64),
  senderDevice: { deviceId: "device:benchmark:sender:0001", privateKey: senderKeys.privateKey },
  recipients,
  payload,
});
const encryptElapsedMs = performance.now() - started;
const afterHeap = process.memoryUsage().heapUsed;
async function decryptSample(target) {
  const targetEnvelope = encrypted.envelopes.find((envelope) => envelope.recipient_device_id === target.device_id);
  const startedAt = performance.now();
  const clear = await decryptChatMessage({
    id: 77001,
    conversation_id: 34001,
    client_nonce: "benchmark:group:e2ee:0001",
    sender_device_id: "device:benchmark:sender:0001",
    device_set_commitment: "a".repeat(64),
    key_epoch: 34,
    key_epoch_commitment: "b".repeat(64),
    kind: "encrypted",
    encryption_mode: "e2ee_group_v1",
    envelope: {
      ...targetEnvelope,
      message_id: 77001,
      conversation_id: 34001,
      client_nonce: "benchmark:group:e2ee:0001",
      sender_device_id: "device:benchmark:sender:0001",
      device_set_commitment: "a".repeat(64),
      key_epoch: 34,
      key_epoch_commitment: "b".repeat(64),
      sender_public_jwk: senderPublicJwk,
      shared_iv_b64: encrypted.shared_ciphertext.iv_b64,
      shared_ciphertext_b64: encrypted.shared_ciphertext.ciphertext_b64,
      shared_aad_sha256: encrypted.shared_ciphertext.aad_sha256,
      shared_ciphertext_sha256: encrypted.shared_ciphertext.ciphertext_sha256,
    },
  }, { deviceId: target.device_id, privateKey: sampledPrivateKeys.get(target.device_id) });
  return { ok: clear === payload.text, elapsed_ms: Number((performance.now() - startedAt).toFixed(2)) };
}
const firstDecrypt = await decryptSample(recipients[0]);
const lastDecrypt = deviceCount === 1 ? firstDecrypt : await decryptSample(recipients.at(-1));
const wrapperBytes = encrypted.envelopes.reduce((sum, envelope) => sum + Buffer.byteLength(envelope.ciphertext_b64, "base64"), 0);
const sharedCiphertextBytes = Buffer.byteLength(encrypted.shared_ciphertext.ciphertext_b64, "base64");
const currentCiphertextBytes = sharedCiphertextBytes + wrapperBytes;
const payloadPlaintextBytes = Buffer.byteLength(JSON.stringify(payload));
const legacyRepeatedPayloadCiphertextBytesEstimate = (payloadPlaintextBytes + 16) * deviceCount;
const expectedIds = recipients.map((recipient) => recipient.device_id).sort();
const presentedIds = encrypted.envelopes.map((envelope) => envelope.recipient_device_id).sort();
const exactCoverage = new Set(presentedIds).size === expectedIds.length && JSON.stringify(presentedIds) === JSON.stringify(expectedIds);
const report = {
  benchmark: "NEXUS_GROUP_ENVELOPE_V1_LOCAL_NODE",
  node: process.version,
  devices: deviceCount,
  message_text_bytes: Buffer.byteLength(payload.text),
  payload_plaintext_bytes: payloadPlaintextBytes,
  shared_ciphertext_bytes: sharedCiphertextBytes,
  wrapper_ciphertext_bytes_total: wrapperBytes,
  wrapper_ciphertext_bytes_average: Math.round(wrapperBytes / deviceCount),
  current_ciphertext_bytes_total: currentCiphertextBytes,
  legacy_repeated_payload_ciphertext_bytes_estimate: legacyRepeatedPayloadCiphertextBytesEstimate,
  estimated_ciphertext_storage_reduction_ratio: Number((legacyRepeatedPayloadCiphertextBytesEstimate / currentCiphertextBytes).toFixed(2)),
  encrypt_elapsed_ms: Number(encryptElapsedMs.toFixed(2)),
  decrypt_first_device_elapsed_ms: firstDecrypt.elapsed_ms,
  decrypt_last_device_elapsed_ms: lastDecrypt.elapsed_ms,
  observed_heap_delta_bytes: afterHeap - beforeHeap,
  exact_coverage: exactCoverage,
  first_device_decrypt_ok: firstDecrypt.ok,
  last_device_decrypt_ok: lastDecrypt.ok,
  external_network: false,
  real_funds: false,
  incremental_cost: 0,
  real_device_claim: false,
};
report.local_gate = report.exact_coverage && report.first_device_decrypt_ok && report.last_device_decrypt_ok ? "PASS_LOCAL_OBSERVATION" : "FAIL";
console.log(JSON.stringify(report, null, 2));
if (report.local_gate === "FAIL") process.exitCode = 1;
