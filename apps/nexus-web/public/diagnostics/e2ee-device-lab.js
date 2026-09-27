import { decryptChatMessage, encryptGroupPayloadForDevices } from "/chat-crypto.js?v=20260906-p2decrypt1";

const capability = document.getElementById("capability");
const countInput = document.getElementById("devices");
const platformInput = document.getElementById("platform");
const runButton = document.getElementById("run");
const cancelButton = document.getElementById("cancel");
const downloadButton = document.getElementById("download");
const progress = document.getElementById("progress");
const reportNode = document.getElementById("report");
let cancelled = false;
let lastReport = null;

const supported = globalThis.isSecureContext === true && Boolean(globalThis.crypto?.subtle) && Boolean(globalThis.indexedDB);
capability.className = supported ? "ok" : "warning";
capability.textContent = supported
  ? "Mediu securizat disponibil. Poți rula testul local."
  : "BLOCAT: este necesar HTTPS de încredere (sau localhost) cu Web Crypto și IndexedDB.";
runButton.disabled = !supported;

function bytes(value) { return new TextEncoder().encode(value).byteLength; }
function setProgress(value, message) {
  progress.value = value;
  if (message) reportNode.textContent = message;
}

function abortIfCancelled() {
  if (cancelled) throw new DOMException("Cancelled", "AbortError");
}

async function yieldAndCheckCancellation() {
  await new Promise((resolve) => requestAnimationFrame(resolve));
  abortIfCancelled();
}

async function decryptSample(encrypted, senderPublicJwk, target, privateKey, payload) {
  const envelope = encrypted.envelopes.find((item) => item.recipient_device_id === target.device_id);
  const started = performance.now();
  const clear = await decryptChatMessage({
    encryption_mode: "e2ee_group_v1",
    envelope: {
      ...envelope, conversation_id: 35001, client_nonce: "device-lab:group:0001",
      sender_device_id: "device:lab:sender:0001", device_set_commitment: "a".repeat(64),
      key_epoch: 35, key_epoch_commitment: "b".repeat(64), sender_public_jwk: senderPublicJwk,
      shared_iv_b64: encrypted.shared_ciphertext.iv_b64,
      shared_ciphertext_b64: encrypted.shared_ciphertext.ciphertext_b64,
      shared_aad_sha256: encrypted.shared_ciphertext.aad_sha256,
      shared_ciphertext_sha256: encrypted.shared_ciphertext.ciphertext_sha256,
    },
  }, { deviceId: target.device_id, privateKey });
  return { ok: clear === payload.text, elapsed_ms: Number((performance.now() - started).toFixed(2)) };
}

async function runLab() {
  const deviceCount = Number(countInput.value);
  if (!Number.isSafeInteger(deviceCount) || deviceCount < 1 || deviceCount > 500) {
    reportNode.textContent = "Numărul trebuie să fie între 1 și 500.";
    return;
  }
  cancelled = false;
  lastReport = null;
  runButton.disabled = true;
  cancelButton.disabled = false;
  downloadButton.disabled = true;
  const startedAt = new Date().toISOString();
  try {
    setProgress(1, "Generez chei distincte numai în memorie…");
    const keygenStarted = performance.now();
    const senderKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const senderPublicJwk = await crypto.subtle.exportKey("jwk", senderKeys.publicKey);
    const recipients = [];
    const sampledPrivateKeys = new Map();
    for (let index = 0; index < deviceCount; index += 1) {
      abortIfCancelled();
      const keys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
      const deviceId = `device:lab:${String(index).padStart(4, "0")}`;
      recipients.push({ device_id: deviceId, public_jwk: await crypto.subtle.exportKey("jwk", keys.publicKey) });
      if (index === 0 || index === deviceCount - 1) sampledPrivateKeys.set(deviceId, keys.privateKey);
      if (index % 10 === 0) {
        setProgress(2 + Math.floor((index / deviceCount) * 38), `Chei distincte: ${index + 1}/${deviceCount}`);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }
    const keygenElapsed = performance.now() - keygenStarted;
    abortIfCancelled();
    const payload = { v: 1, type: "text", text: "N".repeat(4000), created_at: 1 };
    setProgress(44, "Criptez un payload și împachetez cheia pentru fiecare dispozitiv…");
    const beforeHeap = performance.memory?.usedJSHeapSize ?? null;
    const encryptStarted = performance.now();
    const encrypted = await encryptGroupPayloadForDevices({
      conversationId: 35001, clientNonce: "device-lab:group:0001", deviceSetCommitment: "a".repeat(64),
      keyEpoch: 35, keyEpochCommitment: "b".repeat(64),
      senderDevice: { deviceId: "device:lab:sender:0001", privateKey: senderKeys.privateKey }, recipients, payload,
    });
    await yieldAndCheckCancellation();
    const encryptElapsed = performance.now() - encryptStarted;
    const afterHeap = performance.memory?.usedJSHeapSize ?? null;
    setProgress(86, "Verific acoperirea și decriptarea dispozitivelor de margine…");
    const expectedIds = recipients.map((item) => item.device_id).sort();
    const presentedIds = encrypted.envelopes.map((item) => item.recipient_device_id).sort();
    const exactCoverage = new Set(presentedIds).size === expectedIds.length && JSON.stringify(presentedIds) === JSON.stringify(expectedIds);
    const first = await decryptSample(encrypted, senderPublicJwk, recipients[0], sampledPrivateKeys.get(recipients[0].device_id), payload);
    await yieldAndCheckCancellation();
    const last = deviceCount === 1 ? first : await decryptSample(encrypted, senderPublicJwk, recipients.at(-1), sampledPrivateKeys.get(recipients.at(-1).device_id), payload);
    await yieldAndCheckCancellation();
    const sharedBytes = atob(encrypted.shared_ciphertext.ciphertext_b64).length;
    const wrapperBytes = encrypted.envelopes.reduce((sum, item) => sum + atob(item.ciphertext_b64).length, 0);
    const completedReport = {
      schema: "NEXUS_E2EE_DEVICE_LAB_REPORT_V1", started_at: startedAt,
      platform_class: platformInput.value, secure_context: true, device_count: deviceCount,
      distinct_key_count: recipients.length, message_text_bytes: bytes(payload.text),
      payload_plaintext_bytes: bytes(JSON.stringify(payload)), shared_ciphertext_bytes: sharedBytes,
      wrapper_ciphertext_bytes_total: wrapperBytes, ciphertext_bytes_total: sharedBytes + wrapperBytes,
      key_generation_elapsed_ms: Number(keygenElapsed.toFixed(2)), encrypt_elapsed_ms: Number(encryptElapsed.toFixed(2)),
      decrypt_first_elapsed_ms: first.elapsed_ms, decrypt_last_elapsed_ms: last.elapsed_ms,
      observed_heap_delta_bytes: beforeHeap == null || afterHeap == null ? null : afterHeap - beforeHeap,
      exact_sorted_unique_coverage: exactCoverage, first_device_decrypt_ok: first.ok, last_device_decrypt_ok: last.ok,
      keys_exported: false, ciphertext_exported: false, network_requests_by_harness: 0,
      real_funds: false, production_approval: false,
      local_gate: exactCoverage && first.ok && last.ok ? "PASS_LOCAL_DEVICE_OBSERVATION" : "FAIL",
    };
    abortIfCancelled();
    lastReport = completedReport;
    setProgress(100);
    reportNode.textContent = JSON.stringify(lastReport, null, 2);
    downloadButton.disabled = false;
  } catch (error) {
    const aborted = error?.name === "AbortError";
    lastReport = null;
    setProgress(0, aborted ? "Rulare anulată. Nicio cheie și niciun rezultat nu au fost păstrate." : "FAIL_LOCAL: verificarea nu s-a putut finaliza în acest browser.");
  } finally {
    runButton.disabled = !supported;
    cancelButton.disabled = true;
  }
}

runButton.addEventListener("click", runLab);
cancelButton.addEventListener("click", () => { cancelled = true; cancelButton.disabled = true; });
downloadButton.addEventListener("click", () => {
  if (!lastReport) return;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(lastReport, null, 2)], { type: "application/json" }));
  link.download = `nexus-e2ee-device-lab-${lastReport.platform_class}-${lastReport.device_count}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
});
