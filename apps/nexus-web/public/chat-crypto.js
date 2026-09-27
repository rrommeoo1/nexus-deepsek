const DB_NAME = "nexus-secure-chat";
const STORE = "device-keys";
const TRUST_STORE = "conversation-trust";
const RECOVERY_ACTIVATION_STORE = "recovery-activation";
const PRIMARY_KEY = "primary";
const PENDING_RECOVERY_KEY = "pending";
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ATTACHMENT_MAGIC = encoder.encode("NEXUS-E2EE-ATTACHMENT-V1\0");
export const E2EE_ATTACHMENT_MIME = "application/vnd.nexus.e2ee";
export const E2EE_RECOVERY_FORMAT = "NEXUS-E2EE-RECOVERY-V1";
export const E2EE_RECOVERY_KDF_ITERATIONS = 600_000;
const MAX_RECOVERY_PACKAGE_BYTES = 64 * 1024;

function requireCrypto() {
  if (globalThis.isSecureContext === false) throw new Error("E2EE requires HTTPS or localhost");
  if (!globalThis.crypto?.subtle || !globalThis.indexedDB) throw new Error("secure device storage is unavailable in this browser");
}

function openKeyDb() {
  requireCrypto();
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 3);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
      if (!request.result.objectStoreNames.contains(TRUST_STORE)) request.result.createObjectStore(TRUST_STORE);
      if (!request.result.objectStoreNames.contains(RECOVERY_ACTIVATION_STORE)) request.result.createObjectStore(RECOVERY_ACTIVATION_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("secure device database unavailable"));
  });
}

export function completeRecoveryActivationTransaction(transaction, request, action) {
  return new Promise((resolve, reject) => {
    let result = null;
    request.onsuccess = () => { result = action === "read" ? request.result ?? null : true; };
    const failed = () => reject(new Error(`recovery activation ${action} transaction failed`));
    transaction.oncomplete = () => resolve(action === "read" ? result : true);
    transaction.onerror = failed;
    transaction.onabort = failed;
  });
}

async function recoveryActivationRecord(action, value = null) {
  const db = await openKeyDb();
  try {
    const transaction = db.transaction(RECOVERY_ACTIVATION_STORE, action === "read" ? "readonly" : "readwrite");
    const store = transaction.objectStore(RECOVERY_ACTIVATION_STORE);
    const request = action === "read" ? store.get(PENDING_RECOVERY_KEY)
      : action === "write" ? store.put(value, PENDING_RECOVERY_KEY)
        : store.delete(PENDING_RECOVERY_KEY);
    return await completeRecoveryActivationTransaction(transaction, request, action);
  } finally { db.close(); }
}

async function readRecord() {
  const db = await openKeyDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(PRIMARY_KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(new Error("secure device key read failed"));
    });
  } finally { db.close(); }
}

async function writeRecord(record) {
  const db = await openKeyDb();
  try {
    await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(record, PRIMARY_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error("secure device key write failed"));
    });
  } finally { db.close(); }
}

async function readTrustRecord(conversationId) {
  const db = await openKeyDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(TRUST_STORE, "readonly").objectStore(TRUST_STORE).get(`conversation:${conversationId}`);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(new Error("conversation verification state read failed"));
    });
  } finally { db.close(); }
}

async function writeTrustRecord(conversationId, record) {
  const db = await openKeyDb();
  try {
    await new Promise((resolve, reject) => {
      const request = db.transaction(TRUST_STORE, "readwrite").objectStore(TRUST_STORE).put(record, `conversation:${conversationId}`);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error("conversation verification state write failed"));
    });
  } finally { db.close(); }
}

async function createDeviceRecord() {
  requireCrypto();
  const generated = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const publicJwk = await crypto.subtle.exportKey("jwk", generated.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", generated.privateKey);
  // Re-import as non-extractable before persistence. The exportable generation
  // keys and private JWK remain only in this function's transient memory.
  const privateKey = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  return {
    deviceId: `device:${crypto.randomUUID()}`,
    privateKey,
    publicJwk: { kty: publicJwk.kty, crv: publicJwk.crv, x: publicJwk.x, y: publicJwk.y },
    createdAt: Date.now(),
  };
}

function safeOwnerDeviceResult(result, { ownerId, deviceId, action, status }) {
  const device = result?.device;
  return Boolean(result?.ok
    && result.private_key_received === false
    && result.intent?.owner_id === ownerId
    && result.intent?.device_id === deviceId
    && result.intent?.action === action
    && device && typeof device === "object" && !Array.isArray(device)
    && device.device_id === deviceId
    && device.key_algorithm === "ECDH-P256"
    && device.status === status
    && Number.isSafeInteger(Number(device.registered_at)) && Number(device.registered_at) > 0);
}

async function registerChatDevice(api, record, ownerId, label) {
  const idempotencyKey = `nexus-e2ee-register:${record.deviceId}`;
  return api("/api/chat/devices", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: { device_id: record.deviceId, label, public_jwk: record.publicJwk },
  });
}

export async function ensureChatDevice(api, ownerId) {
  ownerId = Number(ownerId);
  if (!Number.isSafeInteger(ownerId) || ownerId <= 0) throw new Error("chat device owner is invalid");
  let record = await readRecord();
  if (!record?.privateKey || !record?.deviceId || !record?.publicJwk) {
    record = await createDeviceRecord();
    await writeRecord(record);
  }
  let registered = await registerChatDevice(api, record, ownerId, "This browser");
  if (!registered?.ok && registered?.code === "CHAT_DEVICE_ID_UNAVAILABLE") {
    // A revoked/device-ID collision is permanent. Generate a fresh device ID
    // and key instead of silently reviving or replacing old key material.
    record = await createDeviceRecord();
    await writeRecord(record);
    registered = await registerChatDevice(api, record, ownerId, "This browser");
  }
  if (!safeOwnerDeviceResult(registered, { ownerId, deviceId: record.deviceId, action: "register", status: "active" })) throw new Error("chat device registration failed");
  return { deviceId: record.deviceId, publicJwk: record.publicJwk, privateKey: record.privateKey };
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function canonicalRecoveryActivation(activation, nowSeconds = Math.floor(Date.now() / 1000)) {
  const deviceId = String(activation?.deviceId ?? "");
  const token = String(activation?.token ?? "");
  const expiresAt = Number(activation?.expiresAt);
  const accountBinding = String(activation?.accountBinding ?? "");
  if (!/^device:recovery:[a-zA-Z0-9-]{20,60}$/.test(deviceId) || !/^[A-Za-z0-9_-]{40,80}$/.test(token)
    || !/^[a-f0-9]{64}$/.test(accountBinding) || !Number.isSafeInteger(expiresAt) || expiresAt <= nowSeconds || expiresAt > nowSeconds + 15 * 60) {
    throw new Error("Recovery activation capability is invalid or expired");
  }
  return { deviceId, token, expiresAt, accountBinding };
}

function recoveryActivationAad(deviceId, expiresAt, accountBinding) {
  return encoder.encode(JSON.stringify({ v: 1, purpose: "NEXUS_E2EE_RECOVERY_ACTIVATION", device_id: deviceId, expires_at: expiresAt, account_binding: accountBinding }));
}

export async function persistPendingRecoveryActivation(activation, { write = (record) => recoveryActivationRecord("write", record), nowSeconds } = {}) {
  requireCrypto();
  const clean = canonicalRecoveryActivation(activation, nowSeconds);
  const wrappingKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({
    name: "AES-GCM", iv, additionalData: recoveryActivationAad(clean.deviceId, clean.expiresAt, clean.accountBinding), tagLength: 128,
  }, wrappingKey, encoder.encode(clean.token));
  const record = {
    version: 1, deviceId: clean.deviceId, expiresAt: clean.expiresAt, accountBinding: clean.accountBinding,
    ivB64: bytesToBase64(iv), ciphertextB64: bytesToBase64(ciphertext), wrappingKey,
  };
  await write(record);
  return { deviceId: clean.deviceId, expiresAt: clean.expiresAt };
}

export async function readPendingRecoveryActivation({ read = () => recoveryActivationRecord("read"), clear = () => recoveryActivationRecord("delete"), nowSeconds, accountBinding } = {}) {
  requireCrypto();
  try {
    const record = await read();
    if (!record) return null;
    const expiresAt = Number(record.expiresAt);
    const deviceId = String(record.deviceId ?? "");
    if (record.version !== 1 || !(record.wrappingKey instanceof CryptoKey) || record.accountBinding !== accountBinding || expiresAt <= (nowSeconds ?? Math.floor(Date.now() / 1000))) {
      await clear();
      return null;
    }
    const cleartext = await crypto.subtle.decrypt({
      name: "AES-GCM", iv: base64ToBytes(record.ivB64), additionalData: recoveryActivationAad(deviceId, expiresAt, record.accountBinding), tagLength: 128,
    }, record.wrappingKey, base64ToBytes(record.ciphertextB64));
    return canonicalRecoveryActivation({ deviceId, token: decoder.decode(cleartext), expiresAt, accountBinding: record.accountBinding }, nowSeconds);
  } catch {
    try { await clear(); } catch { /* corrupted activation remains unusable */ }
    return null;
  }
}

export async function clearPendingRecoveryActivation({ clear = () => recoveryActivationRecord("delete") } = {}) {
  try { await clear(); } catch { /* server state remains authoritative and the short lease expires */ }
}

function canonicalPublicJwk(value) {
  if (!value || value.kty !== "EC" || value.crv !== "P-256" || !/^[A-Za-z0-9_-]{40,50}$/.test(String(value.x)) || !/^[A-Za-z0-9_-]{40,50}$/.test(String(value.y)) || "d" in value) {
    throw new Error("E2EE recovery public key is invalid");
  }
  return { kty: "EC", crv: "P-256", x: value.x, y: value.y };
}

function canonicalPrivateJwk(value, expectedPublic) {
  if (!value || value.kty !== "EC" || value.crv !== "P-256" || !/^[A-Za-z0-9_-]{40,50}$/.test(String(value.x)) || !/^[A-Za-z0-9_-]{40,50}$/.test(String(value.y)) || !/^[A-Za-z0-9_-]{40,50}$/.test(String(value.d))) {
    throw new Error("E2EE recovery private key is invalid");
  }
  if (value.x !== expectedPublic.x || value.y !== expectedPublic.y) throw new Error("E2EE recovery key pair does not match");
  return { kty: "EC", crv: "P-256", x: value.x, y: value.y, d: value.d, ext: true, key_ops: ["deriveBits"] };
}

function validateRecoveryPassphrase(passphrase) {
  if (typeof passphrase !== "string" || passphrase !== passphrase.trim() || [...passphrase].length < 14 || [...passphrase].length > 256) {
    throw new Error("Recovery passphrase must contain 14-256 characters without surrounding spaces");
  }
  const characters = [...passphrase];
  const unique = new Set(characters).size;
  if (unique < 6 || characters.length * Math.log2(unique) < 60) throw new Error("Recovery passphrase is too predictable; use several unrelated words");
  return passphrase;
}

export async function computeRecoveryAccountBinding({ userId, mvxAddress }) {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto is unavailable");
  const id = Number(userId);
  const address = String(mvxAddress ?? "").toLowerCase();
  if (!Number.isSafeInteger(id) || id < 1 || !/^erd1[0-9a-z]{58}$/.test(address)) throw new Error("A stable Nexus account identity is required for E2EE recovery");
  return sha256HexBytes(encoder.encode(`NEXUS_E2EE_ACCOUNT_BINDING_V1:${id}:${address}`));
}

function decodeRecoveryBase64(value, minBytes, maxBytes) {
  if (typeof value !== "string" || value.length > Math.ceil(maxBytes / 3) * 4 + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error("E2EE recovery package is invalid");
  const bytes = base64ToBytes(value);
  if (bytes.byteLength < minBytes || bytes.byteLength > maxBytes) throw new Error("E2EE recovery package is invalid");
  return bytes;
}

async function deriveRecoveryKey(passphrase, salt, usages) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(validateRecoveryPassphrase(passphrase)), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: E2EE_RECOVERY_KDF_ITERATIONS },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

function recoveryMetadata(bundle) {
  return {
    format: E2EE_RECOVERY_FORMAT,
    account_binding: bundle.account_binding,
    device_id: bundle.device_id,
    public_jwk: bundle.public_jwk,
    created_at: bundle.created_at,
    history_start_at: bundle.history_start_at,
    scope: "future_messages_only",
    kdf: bundle.kdf,
    cipher: { name: "AES-GCM", iv_b64: bundle.cipher.iv_b64 },
  };
}

function validateRecoveryBundle(input) {
  let bundle = input;
  if (typeof input === "string") {
    if (new Blob([input]).size > MAX_RECOVERY_PACKAGE_BYTES) throw new Error("E2EE recovery package is too large");
    try { bundle = JSON.parse(input); }
    catch { throw new Error("E2EE recovery package is invalid"); }
  }
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle) || bundle.format !== E2EE_RECOVERY_FORMAT || bundle.scope !== "future_messages_only") throw new Error("E2EE recovery package is invalid");
  const accountBinding = String(bundle.account_binding ?? "").toLowerCase();
  const deviceId = String(bundle.device_id ?? "");
  const createdAt = Number(bundle.created_at);
  const historyStartAt = Number(bundle.history_start_at);
  if (!/^[a-f0-9]{64}$/.test(accountBinding) || !/^device:recovery:[a-zA-Z0-9-]{20,60}$/.test(deviceId) || !Number.isSafeInteger(createdAt) || createdAt < 1 || historyStartAt !== createdAt) throw new Error("E2EE recovery package is invalid");
  const publicJwk = canonicalPublicJwk(bundle.public_jwk);
  if (bundle.kdf?.name !== "PBKDF2" || bundle.kdf?.hash !== "SHA-256" || bundle.kdf?.iterations !== E2EE_RECOVERY_KDF_ITERATIONS || bundle.cipher?.name !== "AES-GCM") throw new Error("E2EE recovery package uses unsupported cryptography");
  const salt = decodeRecoveryBase64(bundle.kdf?.salt_b64, 16, 32);
  const iv = decodeRecoveryBase64(bundle.cipher?.iv_b64, 12, 12);
  const ciphertext = decodeRecoveryBase64(bundle.cipher?.ciphertext_b64, 32, 8 * 1024);
  const canonical = {
    format: E2EE_RECOVERY_FORMAT, account_binding: accountBinding, device_id: deviceId, public_jwk: publicJwk,
    created_at: createdAt, history_start_at: historyStartAt, scope: "future_messages_only",
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: E2EE_RECOVERY_KDF_ITERATIONS, salt_b64: bundle.kdf.salt_b64 },
    cipher: { name: "AES-GCM", iv_b64: bundle.cipher.iv_b64, ciphertext_b64: bundle.cipher.ciphertext_b64 },
  };
  return { bundle: canonical, salt, iv, ciphertext };
}

export async function createRecoveryBundle({ accountBinding, deviceId, publicJwk, privateJwk, passphrase, createdAt = Date.now() }) {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto is unavailable");
  const safeDeviceId = String(deviceId ?? "");
  const safeAccountBinding = String(accountBinding ?? "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(safeAccountBinding) || !/^device:recovery:[a-zA-Z0-9-]{20,60}$/.test(safeDeviceId) || !Number.isSafeInteger(Number(createdAt)) || Number(createdAt) < 1) throw new Error("E2EE recovery device metadata is invalid");
  const safePublic = canonicalPublicJwk(publicJwk);
  const safePrivate = canonicalPrivateJwk(privateJwk, safePublic);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const shell = {
    format: E2EE_RECOVERY_FORMAT, account_binding: safeAccountBinding, device_id: safeDeviceId, public_jwk: safePublic,
    created_at: Number(createdAt), history_start_at: Number(createdAt), scope: "future_messages_only",
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: E2EE_RECOVERY_KDF_ITERATIONS, salt_b64: bytesToBase64(salt) },
    cipher: { name: "AES-GCM", iv_b64: bytesToBase64(iv) },
  };
  const key = await deriveRecoveryKey(passphrase, salt, ["encrypt"]);
  const plaintext = encoder.encode(JSON.stringify({ format: E2EE_RECOVERY_FORMAT, account_binding: safeAccountBinding, device_id: safeDeviceId, public_jwk: safePublic, private_jwk: safePrivate }));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(JSON.stringify(recoveryMetadata(shell))), tagLength: 128 }, key, plaintext);
  return { ...shell, cipher: { ...shell.cipher, ciphertext_b64: bytesToBase64(ciphertext) } };
}

export async function openRecoveryBundle(input, passphrase, expectedAccountBinding) {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto is unavailable");
  const { bundle, salt, iv, ciphertext } = validateRecoveryBundle(input);
  const expected = String(expectedAccountBinding ?? "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expected) || expected !== bundle.account_binding) throw new Error("Recovery package belongs to a different Nexus account");
  const key = await deriveRecoveryKey(passphrase, salt, ["decrypt"]);
  let clear;
  try {
    clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(JSON.stringify(recoveryMetadata(bundle))), tagLength: 128 }, key, ciphertext);
  } catch {
    throw new Error("Recovery package or passphrase is invalid");
  }
  let payload;
  try { payload = JSON.parse(decoder.decode(clear)); }
  catch { throw new Error("Recovery package or passphrase is invalid"); }
  if (payload?.format !== E2EE_RECOVERY_FORMAT || payload?.account_binding !== bundle.account_binding || payload?.device_id !== bundle.device_id) throw new Error("Recovery package or passphrase is invalid");
  const privateJwk = canonicalPrivateJwk(payload.private_jwk, bundle.public_jwk);
  return { deviceId: bundle.device_id, publicJwk: bundle.public_jwk, privateJwk, createdAt: bundle.created_at, historyStartAt: bundle.history_start_at };
}

export async function provisionRecoveryDevice(api, passphrase, accountBinding, ownerId) {
  ownerId = Number(ownerId);
  if (!Number.isSafeInteger(ownerId) || ownerId <= 0) throw new Error("recovery owner is invalid");
  requireCrypto();
  const generated = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const exportedPublic = await crypto.subtle.exportKey("jwk", generated.publicKey);
  const exportedPrivate = await crypto.subtle.exportKey("jwk", generated.privateKey);
  const deviceId = `device:recovery:${crypto.randomUUID()}`;
  const createdAt = Date.now();
  const bundle = await createRecoveryBundle({ accountBinding, deviceId, publicJwk: exportedPublic, privateJwk: exportedPrivate, passphrase, createdAt });
  const pending = await api("/api/chat/recovery-devices", {
    method: "POST",
    headers: { "Idempotency-Key": `nexus-recovery-provision:${deviceId}` },
    body: { account_binding: accountBinding, device_id: deviceId, public_jwk: bundle.public_jwk },
  });
  if (!safeOwnerDeviceResult(pending, { ownerId, deviceId, action: "provision_recovery", status: "pending_recovery" })
    || pending.pending !== true || pending.account_binding_verified !== true
    || !/^[A-Za-z0-9_-]{40,80}$/.test(String(pending.activation_token || ""))
    || !Number.isSafeInteger(Number(pending.activation_expires_at)) || Number(pending.activation_expires_at) <= Math.floor(Date.now() / 1000)
    || Number(pending.device.activation_expires_at) !== Number(pending.activation_expires_at)) {
    throw new Error("Recovery device pending registration failed");
  }
  return {
    bundle, filename: `nexus-e2ee-recovery-${createdAt}.json`, historyStartAt: createdAt,
    activation: { deviceId, token: pending.activation_token, expiresAt: Number(pending.activation_expires_at), accountBinding },
  };
}

export async function activateProvisionedRecoveryDevice(api, activation, ownerId) {
  ownerId = Number(ownerId);
  if (!Number.isSafeInteger(ownerId) || ownerId <= 0) throw new Error("recovery owner is invalid");
  const deviceId = String(activation?.deviceId ?? "");
  const token = String(activation?.token ?? "");
  if (!/^device:recovery:[a-zA-Z0-9-]{20,60}$/.test(deviceId) || !/^[A-Za-z0-9_-]{40,80}$/.test(token)) throw new Error("Recovery activation capability is invalid");
  const result = await api(`/api/chat/recovery-devices/${encodeURIComponent(deviceId)}/activate`, {
    method: "POST",
    headers: { "Idempotency-Key": `nexus-recovery-activate:${deviceId}` },
    body: { activation_token: token },
  });
  if (!safeOwnerDeviceResult(result, { ownerId, deviceId, action: "activate_recovery", status: "active" }) || result.active !== true || typeof result.replay !== "boolean"
    || !Number.isSafeInteger(Number(result.device.activated_at)) || Number(result.device.activated_at) <= 0) {
    throw new Error(result?.code === "RECOVERY_ACTIVATION_EXPIRED" ? "Recovery activation expired" : "Recovery device activation failed");
  }
  return { deviceId, activatedAt: Number(result.device.activated_at || 0) * 1000, replay: Boolean(result.replay) };
}

export async function restoreRecoveryDevice(api, input, passphrase, accountBinding, ownerId) {
  ownerId = Number(ownerId);
  if (!Number.isSafeInteger(ownerId) || ownerId <= 0) throw new Error("recovery owner is invalid");
  requireCrypto();
  const recovered = await openRecoveryBundle(input, passphrase, accountBinding);
  const existing = await readRecord();
  if (existing?.deviceId && existing.deviceId !== recovered.deviceId) throw new Error("A different E2EE key already exists in this browser; recovery is allowed only in a fresh browser profile");
  const privateKey = await crypto.subtle.importKey("jwk", recovered.privateJwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const registered = await registerChatDevice(api, { deviceId: recovered.deviceId, publicJwk: recovered.publicJwk }, ownerId, "Recovered E2EE key");
  if (!safeOwnerDeviceResult(registered, { ownerId, deviceId: recovered.deviceId, action: "register", status: "active" })) throw new Error("Recovery device is revoked or unavailable");
  await writeRecord({ deviceId: recovered.deviceId, publicJwk: recovered.publicJwk, privateKey, createdAt: recovered.createdAt, recoveredAt: Date.now() });
  return { deviceId: recovered.deviceId, historyStartAt: recovered.historyStartAt, privateKeyExtractable: privateKey.extractable };
}

async function sha256HexBytes(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function validateConversationKeyMaterial(material, { conversationId, viewerId, persona, currentDeviceId = null }) {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto is unavailable");
  conversationId = Number(conversationId);
  viewerId = Number(viewerId);
  persona = String(persona ?? "");
  currentDeviceId = currentDeviceId == null ? null : String(currentDeviceId);
  const kind = String(material?.conversation_kind ?? "");
  const protocol = kind === "group"
    ? "NEXUS_GROUP_ENVELOPE_V1_SINGLE_PAYLOAD_CONTENT_KEY_FANOUT"
    : "NEXUS_E2EE_V2_EPOCH_BOUND_ECDH_P256_HKDF_SHA256_AES_256_GCM";
  if (!Number.isSafeInteger(conversationId) || conversationId < 1 || !Number.isSafeInteger(viewerId) || viewerId < 1
    || !new Set(["social", "work", "dating", "travel", "market"]).has(persona)
    || !material || typeof material !== "object" || Array.isArray(material) || material.ok !== true
    || material.privacy_enforced_server_side !== true || material.server_has_private_keys !== false
    || material.ratcheting_sender_key_audit_complete !== false
    || Number(material.query?.conversation_id) !== conversationId || Number(material.query?.viewer_id) !== viewerId
    || material.query?.viewer_persona !== persona || Number(material.conversation_id) !== conversationId
    || material.conversation_persona !== persona || !new Set(["direct", "group"]).has(kind)
    || material.protocol !== protocol || !Array.isArray(material.participants)
    || material.participants.length < 2 || material.participants.length > 50
    || !Array.isArray(material.devices) || material.devices.length > 500
    || !Array.isArray(material.users_without_devices) || material.users_without_devices.length > 50
    || !Array.isArray(material.users_exceeding_device_limit) || material.users_exceeding_device_limit.length > 50
    || typeof material.ready !== "boolean" || typeof material.blocked_relationship !== "boolean") {
    throw new Error("E2EE key material scope is invalid");
  }
  const participants = material.participants.map((participant) => ({
    user_id: Number(participant?.user_id),
    handle: String(participant?.handle ?? ""),
  }));
  if (participants.some((participant) => !Number.isSafeInteger(participant.user_id) || participant.user_id < 1 || !/^[a-z0-9_]{2,30}$/.test(participant.handle))
    || new Set(participants.map((participant) => participant.user_id)).size !== participants.length
    || new Set(participants.map((participant) => participant.handle)).size !== participants.length
    || !participants.some((participant) => participant.user_id === viewerId)
    || participants.some((participant, index) => index > 0 && participants[index - 1].user_id >= participant.user_id)
    || (kind === "direct" && participants.length !== 2)) {
    throw new Error("E2EE participant material is invalid");
  }
  const participantById = new Map(participants.map((participant) => [participant.user_id, participant]));
  const devices = material.devices.map((device) => {
    const deviceId = String(device?.device_id ?? "");
    const userId = Number(device?.user_id);
    const handle = String(device?.handle ?? "");
    const jwk = device?.public_jwk;
    const keys = jwk && typeof jwk === "object" && !Array.isArray(jwk) ? Object.keys(jwk) : [];
    if (!/^[a-zA-Z0-9:_-]{16,80}$/.test(deviceId) || !Number.isSafeInteger(userId) || userId < 1
      || handle !== participantById.get(userId)?.handle || device?.key_algorithm !== "ECDH-P256"
      || jwk?.kty !== "EC" || jwk?.crv !== "P-256" || !/^[A-Za-z0-9_-]{40,50}$/.test(String(jwk?.x))
      || !/^[A-Za-z0-9_-]{40,50}$/.test(String(jwk?.y)) || keys.some((key) => !new Set(["kty", "crv", "x", "y"]).has(key))) {
      throw new Error("E2EE public device material is invalid");
    }
    return { device_id: deviceId, user_id: userId, handle, key_algorithm: "ECDH-P256", public_jwk: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y } };
  });
  if (new Set(devices.map((device) => device.device_id)).size !== devices.length
    || devices.some((device, index) => index > 0 && devices[index - 1].device_id.localeCompare(device.device_id) >= 0)
    || participants.some((participant) => devices.filter((device) => device.user_id === participant.user_id).length > 10)) {
    throw new Error("E2EE device coverage is invalid");
  }
  const without = material.users_without_devices.map(String);
  const exceeding = material.users_exceeding_device_limit.map(String);
  const participantHandles = new Set(participants.map((participant) => participant.handle));
  if (new Set(without).size !== without.length || new Set(exceeding).size !== exceeding.length
    || without.some((handle) => !participantHandles.has(handle)) || exceeding.some((handle) => !participantHandles.has(handle))) {
    throw new Error("E2EE device coverage status is invalid");
  }
  const epochInvalid = material.epoch_state_invalid === true;
  const deviceSetInvalid = material.device_set_invalid === true;
  if (("epoch_state_invalid" in material && typeof material.epoch_state_invalid !== "boolean")
    || ("device_set_invalid" in material && typeof material.device_set_invalid !== "boolean")) {
    throw new Error("E2EE failure state is invalid");
  }
  if (material.blocked_relationship || epochInvalid || deviceSetInvalid || exceeding.length) {
    if (material.ready || devices.length || material.commitment !== null || material.key_epoch_commitment !== null
      || without.length || [material.blocked_relationship, epochInvalid, deviceSetInvalid, exceeding.length > 0].filter(Boolean).length !== 1
      || (epochInvalid ? material.key_epoch !== null : !Number.isSafeInteger(Number(material.key_epoch)) || Number(material.key_epoch) < 1)) {
      throw new Error("E2EE fail-closed state is inconsistent");
    }
  } else {
    const commitment = String(material.commitment ?? "").toLowerCase();
    const keyEpoch = Number(material.key_epoch);
    const keyEpochCommitment = String(material.key_epoch_commitment ?? "").toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(commitment) || !Number.isSafeInteger(keyEpoch) || keyEpoch < 1 || !/^[a-f0-9]{64}$/.test(keyEpochCommitment)) {
      throw new Error("E2EE epoch material is invalid");
    }
    const canonicalDevices = devices.map(({ device_id, user_id, key_algorithm, public_jwk }) => ({ device_id, user_id, key_algorithm, public_jwk }));
    if (await sha256HexBytes(encoder.encode(JSON.stringify(canonicalDevices))) !== commitment) throw new Error("E2EE device-set commitment mismatch");
    const expectedWithout = participants.filter((participant) => !devices.some((device) => device.user_id === participant.user_id)).map((participant) => participant.handle);
    if (JSON.stringify(without) !== JSON.stringify(expectedWithout) || material.ready !== (without.length === 0)) throw new Error("E2EE readiness is inconsistent");
    if (currentDeviceId && !devices.some((device) => device.device_id === currentDeviceId && device.user_id === viewerId)) {
      throw new Error("E2EE current device coverage is invalid");
    }
    if (material.ready && !devices.length) throw new Error("E2EE current device coverage is invalid");
  }
  return {
    ok: true,
    query: { conversation_id: conversationId, viewer_id: viewerId, viewer_persona: persona },
    privacy_enforced_server_side: true,
    conversation_id: conversationId,
    conversation_persona: persona,
    conversation_kind: kind,
    protocol,
    server_has_private_keys: false,
    ratcheting_sender_key_audit_complete: false,
    commitment: material.commitment == null ? null : String(material.commitment).toLowerCase(),
    key_epoch: material.key_epoch == null ? null : Number(material.key_epoch),
    key_epoch_commitment: material.key_epoch_commitment == null ? null : String(material.key_epoch_commitment).toLowerCase(),
    participants,
    devices,
    users_without_devices: without,
    users_exceeding_device_limit: exceeding,
    blocked_relationship: material.blocked_relationship,
    epoch_state_invalid: epochInvalid,
    device_set_invalid: deviceSetInvalid,
    ready: material.ready,
  };
}

function validateSafetyMaterial(material) {
  const conversationId = Number(material?.conversation_id);
  const commitment = String(material?.commitment ?? "").toLowerCase();
  if (!Number.isSafeInteger(conversationId) || conversationId < 1 || !/^[a-f0-9]{64}$/.test(commitment) || !Array.isArray(material?.devices) || material.devices.length < 2 || material.devices.length > 500) {
    throw new Error("E2EE safety material is invalid");
  }
  const devices = material.devices.map((device) => {
    const deviceId = String(device?.device_id ?? "");
    const userId = Number(device?.user_id);
    const algorithm = String(device?.key_algorithm ?? "");
    const jwk = device?.public_jwk;
    if (!/^[a-zA-Z0-9:_-]{16,80}$/.test(deviceId) || !Number.isSafeInteger(userId) || userId < 1 || algorithm !== "ECDH-P256" || jwk?.kty !== "EC" || jwk?.crv !== "P-256" || !/^[A-Za-z0-9_-]{40,50}$/.test(String(jwk.x)) || !/^[A-Za-z0-9_-]{40,50}$/.test(String(jwk.y)) || "d" in jwk) {
      throw new Error("E2EE safety device material is invalid");
    }
    return { device_id: deviceId, user_id: userId, key_algorithm: algorithm, public_jwk: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y } };
  }).sort((a, b) => a.device_id.localeCompare(b.device_id));
  if (new Set(devices.map((device) => device.device_id)).size !== devices.length) throw new Error("E2EE safety device set contains duplicates");
  return { conversationId, commitment, devices };
}

export async function computeConversationSafetyNumber(material) {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto is unavailable");
  const canonical = validateSafetyMaterial(material);
  const derivedCommitment = await sha256HexBytes(encoder.encode(JSON.stringify(canonical.devices)));
  if (derivedCommitment !== canonical.commitment) throw new Error("E2EE device-set commitment mismatch");
  const digest = await sha256HexBytes(encoder.encode(`NEXUS_SAFETY_NUMBER_V1:${canonical.conversationId}:${canonical.commitment}`));
  const decimal = (BigInt(`0x${digest}`) % (10n ** 60n)).toString().padStart(60, "0");
  return {
    conversation_id: canonical.conversationId,
    commitment: canonical.commitment,
    compact: decimal,
    display: decimal.match(/.{5}/g).join(" "),
    device_count: canonical.devices.length,
  };
}

export function evaluateSafetyObservation(previous, current, now = Date.now()) {
  now = Number(now);
  if (!Number.isSafeInteger(now) || now < 1 || !current || !/^[a-f0-9]{64}$/.test(String(current.commitment)) || !/^\d{60}$/.test(String(current.compact))) throw new Error("E2EE safety observation is invalid");
  if (!previous) return {
    state: "unverified",
    record: { currentCommitment: current.commitment, verifiedCommitment: null, firstSeenAt: now, lastSeenAt: now, changedAt: null, changeCount: 0, changePending: false },
  };
  if (previous.currentCommitment === current.commitment) return {
    state: previous.verifiedCommitment === current.commitment ? "verified" : previous.changePending ? "changed" : "unverified",
    record: { ...previous, lastSeenAt: now },
  };
  return {
    state: "changed",
    record: { ...previous, currentCommitment: current.commitment, lastSeenAt: now, changedAt: now, changeCount: Number(previous.changeCount || 0) + 1, changePending: true },
  };
}

export function verifySafetyObservation(previous, current, now = Date.now()) {
  const observed = evaluateSafetyObservation(previous, current, now);
  return { state: "verified", record: { ...observed.record, verifiedCommitment: current.commitment, verifiedAt: Number(now), changePending: false } };
}

export async function observeConversationSafety(material) {
  requireCrypto();
  const current = await computeConversationSafetyNumber(material);
  const previous = await readTrustRecord(current.conversation_id);
  const observation = evaluateSafetyObservation(previous, current);
  await writeTrustRecord(current.conversation_id, observation.record);
  return { ...current, state: observation.state, changed_at: observation.record.changedAt, verified_at: observation.record.verifiedAt ?? null };
}

export async function verifyConversationSafety(material) {
  requireCrypto();
  const current = await computeConversationSafetyNumber(material);
  const previous = await readTrustRecord(current.conversation_id);
  const verification = verifySafetyObservation(previous, current);
  await writeTrustRecord(current.conversation_id, verification.record);
  return { ...current, state: verification.state, verified_at: verification.record.verifiedAt };
}

function concatBytes(...arrays) {
  const size = arrays.reduce((total, value) => total + value.byteLength, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const value of arrays) {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    output.set(bytes, offset);
    offset += bytes.byteLength;
  }
  return output;
}

export function chatAad({ conversationId, clientNonce, senderDeviceId, recipientDeviceId, deviceSetCommitment, keyEpoch, keyEpochCommitment }) {
  const epochBound = Number.isSafeInteger(Number(keyEpoch)) && Number(keyEpoch) >= 1 && /^[a-f0-9]{64}$/.test(String(keyEpochCommitment));
  const binding = {
    v: epochBound ? 2 : 1,
    conversation_id: Number(conversationId),
    client_nonce: clientNonce,
    sender_device_id: senderDeviceId,
    recipient_device_id: recipientDeviceId,
    device_set_commitment: deviceSetCommitment,
  };
  if (epochBound) {
    binding.key_epoch = Number(keyEpoch);
    binding.key_epoch_commitment = keyEpochCommitment;
  }
  return JSON.stringify(binding);
}

async function deriveMessageKey(privateKey, publicJwk, { conversationId, deviceSetCommitment, keyEpoch, keyEpochCommitment, senderDeviceId, recipientDeviceId }) {
  const publicKey = await crypto.subtle.importKey("jwk", publicJwk, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = await crypto.subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
  const hkdfKey = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
  const epochBound = Number.isSafeInteger(Number(keyEpoch)) && Number(keyEpoch) >= 1 && /^[a-f0-9]{64}$/.test(String(keyEpochCommitment));
  const saltMaterial = epochBound
    ? `NEXUS_CHAT_SALT_V2:${conversationId}:${deviceSetCommitment}:${keyEpoch}:${keyEpochCommitment}`
    : `NEXUS_CHAT_SALT_V1:${conversationId}:${deviceSetCommitment}`;
  const salt = await crypto.subtle.digest("SHA-256", encoder.encode(saltMaterial));
  const info = encoder.encode(`${epochBound ? "NEXUS_E2EE_V2" : "NEXUS_E2EE_V1"}:${senderDeviceId}:${recipientDeviceId}`);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptPayloadForDevice({ conversationId, clientNonce, deviceSetCommitment, keyEpoch, keyEpochCommitment, senderDevice, recipient, payload }) {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto is unavailable");
  if (!Number.isSafeInteger(Number(keyEpoch)) || Number(keyEpoch) < 1 || !/^[a-f0-9]{64}$/.test(String(keyEpochCommitment))) {
    throw new Error("epoch-bound E2EE key material is required for new messages");
  }
  const aad = chatAad({
    conversationId,
    clientNonce,
    senderDeviceId: senderDevice.deviceId,
    recipientDeviceId: recipient.device_id,
    deviceSetCommitment,
    keyEpoch,
    keyEpochCommitment,
  });
  const aadBytes = encoder.encode(aad);
  const key = await deriveMessageKey(senderDevice.privateKey, recipient.public_jwk, {
    conversationId,
    deviceSetCommitment,
    keyEpoch,
    keyEpochCommitment,
    senderDeviceId: senderDevice.deviceId,
    recipientDeviceId: recipient.device_id,
  });
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aadBytes, tagLength: 128 }, key, plaintext);
  return {
    recipient_device_id: recipient.device_id,
    iv_b64: bytesToBase64(iv),
    ciphertext_b64: bytesToBase64(ciphertext),
    aad_sha256: await sha256HexBytes(aadBytes),
  };
}

export async function encryptEnvelopeForDevice({ conversationId, clientNonce, deviceSetCommitment, keyEpoch, keyEpochCommitment, senderDevice, recipient, text, createdAt = Date.now() }) {
  return encryptPayloadForDevice({
    conversationId, clientNonce, deviceSetCommitment, keyEpoch, keyEpochCommitment, senderDevice, recipient,
    payload: { v: 1, type: "text", text, created_at: createdAt },
  });
}

function groupSharedAad({ conversationId, clientNonce, senderDeviceId, deviceSetCommitment, keyEpoch, keyEpochCommitment }) {
  return JSON.stringify({
    v: 3,
    conversation_id: Number(conversationId),
    client_nonce: clientNonce,
    sender_device_id: senderDeviceId,
    device_set_commitment: deviceSetCommitment,
    key_epoch: Number(keyEpoch),
    key_epoch_commitment: keyEpochCommitment,
  });
}

function groupKeyEnvelopeAad({ conversationId, clientNonce, senderDeviceId, recipientDeviceId, deviceSetCommitment, keyEpoch, keyEpochCommitment, sharedCiphertextSha256, sharedAadSha256 }) {
  return JSON.stringify({
    v: 3,
    conversation_id: Number(conversationId),
    client_nonce: clientNonce,
    sender_device_id: senderDeviceId,
    recipient_device_id: recipientDeviceId,
    device_set_commitment: deviceSetCommitment,
    key_epoch: Number(keyEpoch),
    key_epoch_commitment: keyEpochCommitment,
    purpose: "content_key",
    shared_ciphertext_sha256: sharedCiphertextSha256,
    shared_aad_sha256: sharedAadSha256,
  });
}

export async function encryptGroupPayloadForDevices({ conversationId, clientNonce, deviceSetCommitment, keyEpoch, keyEpochCommitment, senderDevice, recipients, payload }) {
  requireCrypto();
  if (!Array.isArray(recipients) || !recipients.length) throw new Error("group device coverage is required");
  if (!Number.isSafeInteger(Number(keyEpoch)) || Number(keyEpoch) < 1 || !/^[a-f0-9]{64}$/.test(String(keyEpochCommitment))) {
    throw new Error("epoch-bound E2EE key material is required for group messages");
  }
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  try {
    const contentKey = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
    const sharedAad = groupSharedAad({ conversationId, clientNonce, senderDeviceId: senderDevice.deviceId, deviceSetCommitment, keyEpoch, keyEpochCommitment });
    const sharedAadBytes = encoder.encode(sharedAad);
    const sharedIv = crypto.getRandomValues(new Uint8Array(12));
    const sharedCipherBytes = new Uint8Array(await crypto.subtle.encrypt({
      name: "AES-GCM", iv: sharedIv, additionalData: sharedAadBytes, tagLength: 128,
    }, contentKey, encoder.encode(JSON.stringify(payload))));
    const sharedCiphertextSha256 = await sha256HexBytes(sharedCipherBytes);
    const sharedAadSha256 = await sha256HexBytes(sharedAadBytes);
    const envelopes = [];
    for (const recipient of recipients) {
      const wrapperAad = groupKeyEnvelopeAad({
        conversationId, clientNonce, senderDeviceId: senderDevice.deviceId,
        recipientDeviceId: recipient.device_id, deviceSetCommitment, keyEpoch, keyEpochCommitment,
        sharedCiphertextSha256, sharedAadSha256,
      });
      const wrapperAadBytes = encoder.encode(wrapperAad);
      const wrapperKey = await deriveMessageKey(senderDevice.privateKey, recipient.public_jwk, {
        conversationId, deviceSetCommitment, keyEpoch, keyEpochCommitment,
        senderDeviceId: senderDevice.deviceId, recipientDeviceId: recipient.device_id,
      });
      const wrapperIv = crypto.getRandomValues(new Uint8Array(12));
      const wrapped = await crypto.subtle.encrypt({
        name: "AES-GCM", iv: wrapperIv, additionalData: wrapperAadBytes, tagLength: 128,
      }, wrapperKey, encoder.encode(JSON.stringify({
        v: 1,
        type: "nexus_group_content_key",
        content_key_b64: bytesToBase64(keyBytes),
        shared_ciphertext_sha256: sharedCiphertextSha256,
        shared_aad_sha256: sharedAadSha256,
      })));
      envelopes.push({
        recipient_device_id: recipient.device_id,
        iv_b64: bytesToBase64(wrapperIv),
        ciphertext_b64: bytesToBase64(wrapped),
        aad_sha256: await sha256HexBytes(wrapperAadBytes),
      });
    }
    return {
      shared_ciphertext: {
        iv_b64: bytesToBase64(sharedIv),
        ciphertext_b64: bytesToBase64(sharedCipherBytes),
        aad_sha256: sharedAadSha256,
        ciphertext_sha256: sharedCiphertextSha256,
      },
      envelopes,
    };
  } finally {
    keyBytes.fill(0);
  }
}

async function postEncryptedMessage(api, conversationId, body, idempotencyKey) {
  const result = await api(`/api/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    body,
  });
  return {
    ...result,
    local_intent: {
      conversation_id: Number(conversationId),
      client_nonce: body.client_nonce,
      encryption_mode: body.encryption_mode,
      attachment_media_id: body.attachment_media_id == null ? null : Number(body.attachment_media_id),
    },
  };
}

export async function encryptChatText(api, { conversationId, ownerId, persona, text, expiresInSeconds = null, clientNonce = null, idempotencyKey = null }) {
  const clean = String(text ?? "");
  if (!clean || clean.length > 4000) throw new Error("secure text must contain 1–4000 characters");
  const device = await ensureChatDevice(api, ownerId);
  const response = await api(`/api/chat/conversations/${conversationId}/key-material`);
  if (!response?.ok) throw new Error(response?.error || "secure key material unavailable");
  const material = await validateConversationKeyMaterial(response, { conversationId, viewerId: ownerId, persona, currentDeviceId: device.deviceId });
  if (material.users_exceeding_device_limit?.length) throw new Error(`E2EE blocked because the active-device safety limit was exceeded for: ${material.users_exceeding_device_limit.join(", ")}`);
  if (material.blocked_relationship) throw new Error("E2EE is blocked while an active participant relationship is blocked");
  if (!material.ready) throw new Error(`E2EE unavailable until these users register a device: ${material.users_without_devices.join(", ")}`);
  const mutationNonce = clientNonce || `e2ee:${crypto.randomUUID()}`;
  if (!/^[A-Za-z0-9:_-]{8,80}$/.test(mutationNonce)) throw new Error("secure message nonce is invalid");
  if (material.conversation_kind === "group") {
    const encrypted = await encryptGroupPayloadForDevices({
      conversationId, clientNonce: mutationNonce, deviceSetCommitment: material.commitment,
      keyEpoch: material.key_epoch, keyEpochCommitment: material.key_epoch_commitment,
      senderDevice: device, recipients: material.devices,
      payload: { v: 1, type: "text", text: clean, created_at: Date.now() },
    });
    return postEncryptedMessage(api, conversationId, {
        encryption_mode: "e2ee_group_v1", sender_device_id: device.deviceId,
        client_nonce: mutationNonce, device_set_commitment: material.commitment,
        key_epoch: material.key_epoch, key_epoch_commitment: material.key_epoch_commitment,
        shared_ciphertext: encrypted.shared_ciphertext, envelopes: encrypted.envelopes,
        expires_in_seconds: expiresInSeconds,
      }, idempotencyKey);
  }
  const envelopes = [];
  for (const recipient of material.devices) {
    envelopes.push(await encryptEnvelopeForDevice({
      conversationId,
      clientNonce: mutationNonce,
      deviceSetCommitment: material.commitment,
      keyEpoch: material.key_epoch,
      keyEpochCommitment: material.key_epoch_commitment,
      senderDevice: device,
      recipient,
      text: clean,
    }));
  }
  return postEncryptedMessage(api, conversationId, {
      encryption_mode: "e2ee_v1",
      sender_device_id: device.deviceId,
      client_nonce: mutationNonce,
      device_set_commitment: material.commitment,
      key_epoch: material.key_epoch,
      key_epoch_commitment: material.key_epoch_commitment,
      envelopes,
      expires_in_seconds: expiresInSeconds,
    }, idempotencyKey);
}

export async function encryptChatAttachment(api, { conversationId, ownerId, persona, file, uploadCiphertext, caption = "", expiresInSeconds = null, clientNonce = null, idempotencyKey = null }) {
  if (!(file instanceof Blob) || file.size < 1) throw new Error("select an attachment first");
  if (file.size > 19 * 1024 * 1024) throw new Error("encrypted attachment supports maximum 19 MB");
  if (typeof uploadCiphertext !== "function") throw new Error("encrypted upload adapter unavailable");
  const device = await ensureChatDevice(api, ownerId);
  const response = await api(`/api/chat/conversations/${conversationId}/key-material`);
  if (!response?.ok) throw new Error(response?.error || "secure key material unavailable");
  const material = await validateConversationKeyMaterial(response, { conversationId, viewerId: ownerId, persona, currentDeviceId: device.deviceId });
  if (material.users_exceeding_device_limit?.length) throw new Error(`E2EE blocked because the active-device safety limit was exceeded for: ${material.users_exceeding_device_limit.join(", ")}`);
  if (material.blocked_relationship) throw new Error("E2EE is blocked while an active participant relationship is blocked");
  if (!material.ready) throw new Error(`E2EE unavailable until these users register a device: ${material.users_without_devices.join(", ")}`);
  const name = String(file.name || "attachment").replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 120) || "attachment";
  const mime = String(file.type || "application/octet-stream").slice(0, 120);
  const contentAad = JSON.stringify({ v: 1, conversation_id: Number(conversationId), name, mime, size: file.size });
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  try {
    const contentKey = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
    const contentIv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({
      name: "AES-GCM", iv: contentIv, additionalData: encoder.encode(contentAad), tagLength: 128,
    }, contentKey, await file.arrayBuffer()));
    const container = concatBytes(ATTACHMENT_MAGIC, ciphertext);
    const cipherSha256 = await sha256HexBytes(container);
    const uploaded = await uploadCiphertext(new Blob([container], { type: E2EE_ATTACHMENT_MIME }));
    if (!uploaded?.ok || !uploaded.media?.client_encrypted || uploaded.media.mime !== E2EE_ATTACHMENT_MIME || uploaded.media.hash !== cipherSha256) {
      throw new Error(uploaded?.error || "encrypted attachment storage boundary rejected the ciphertext");
    }
    const mutationNonce = clientNonce || `e2ee:${crypto.randomUUID()}`;
    if (!/^[A-Za-z0-9:_-]{8,80}$/.test(mutationNonce)) throw new Error("secure message nonce is invalid");
    const payload = {
      v: 1, type: "attachment", text: String(caption || "").slice(0, 4000), created_at: Date.now(),
      media_id: uploaded.media.id, cipher_sha256: cipherSha256,
      content_key_b64: bytesToBase64(keyBytes), content_iv_b64: bytesToBase64(contentIv),
      content_aad: contentAad, name, mime, size: file.size,
    };
    if (material.conversation_kind === "group") {
      const encrypted = await encryptGroupPayloadForDevices({
        conversationId, clientNonce: mutationNonce, deviceSetCommitment: material.commitment,
        keyEpoch: material.key_epoch, keyEpochCommitment: material.key_epoch_commitment,
        senderDevice: device, recipients: material.devices, payload,
      });
      return postEncryptedMessage(api, conversationId, {
          encryption_mode: "e2ee_group_v1", sender_device_id: device.deviceId,
          client_nonce: mutationNonce, device_set_commitment: material.commitment,
          key_epoch: material.key_epoch, key_epoch_commitment: material.key_epoch_commitment,
          shared_ciphertext: encrypted.shared_ciphertext, envelopes: encrypted.envelopes,
          attachment_media_id: uploaded.media.id, expires_in_seconds: expiresInSeconds,
        }, idempotencyKey);
    }
    const envelopes = [];
    for (const recipient of material.devices) {
      envelopes.push(await encryptPayloadForDevice({
        conversationId, clientNonce: mutationNonce, deviceSetCommitment: material.commitment,
        keyEpoch: material.key_epoch, keyEpochCommitment: material.key_epoch_commitment,
        senderDevice: device, recipient, payload,
      }));
    }
    return postEncryptedMessage(api, conversationId, {
        encryption_mode: "e2ee_v1", sender_device_id: device.deviceId,
        client_nonce: mutationNonce, device_set_commitment: material.commitment,
        key_epoch: material.key_epoch, key_epoch_commitment: material.key_epoch_commitment,
        envelopes, attachment_media_id: uploaded.media.id, expires_in_seconds: expiresInSeconds,
      }, idempotencyKey);
  } finally {
    keyBytes.fill(0);
  }
}

function decodeCanonicalBase64(value, { min = 1, max }) {
  value = String(value ?? "");
  if (!value || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error("encrypted base64 material is invalid");
  const bytes = base64ToBytes(value);
  if (bytes.byteLength < min || bytes.byteLength > max || bytesToBase64(bytes) !== value) throw new Error("encrypted base64 material is invalid");
  return bytes;
}

export function validateEncryptedMessageContext(message, device) {
  const envelope = message?.envelope;
  const mode = String(message?.encryption_mode ?? "");
  const group = mode === "e2ee_group_v1";
  const legacyV1 = mode === "e2ee_v1" && message?.key_epoch == null && message?.key_epoch_commitment == null
    && envelope?.key_epoch == null && envelope?.key_epoch_commitment == null;
  const publicJwk = envelope?.sender_public_jwk;
  const publicKeys = publicJwk && typeof publicJwk === "object" && !Array.isArray(publicJwk) ? Object.keys(publicJwk) : [];
  if (!new Set(["e2ee_v1", "e2ee_group_v1"]).has(mode) || !message || typeof message !== "object" || Array.isArray(message)
    || !device || typeof device !== "object" || !/^[A-Za-z0-9:_-]{16,80}$/.test(String(device.deviceId ?? "")) || !device.privateKey
    || !Number.isSafeInteger(Number(message.id)) || Number(message.id) < 1 || !Number.isSafeInteger(Number(message.conversation_id)) || Number(message.conversation_id) < 1
    || !/^[A-Za-z0-9:_-]{8,80}$/.test(String(message.client_nonce ?? "")) || !/^[A-Za-z0-9:_-]{16,80}$/.test(String(message.sender_device_id ?? ""))
    || !/^[a-f0-9]{64}$/.test(String(message.device_set_commitment ?? ""))
    || (!legacyV1 && (!Number.isSafeInteger(Number(message.key_epoch)) || Number(message.key_epoch) < 1 || !/^[a-f0-9]{64}$/.test(String(message.key_epoch_commitment ?? ""))))
    || !new Set(["encrypted", "encrypted_attachment"]).has(message.kind)
    || !envelope || typeof envelope !== "object" || Array.isArray(envelope)
    || Number(envelope.message_id) !== Number(message.id) || Number(envelope.conversation_id) !== Number(message.conversation_id)
    || envelope.client_nonce !== message.client_nonce || envelope.sender_device_id !== message.sender_device_id
    || envelope.device_set_commitment !== message.device_set_commitment || Number(envelope.key_epoch) !== Number(message.key_epoch)
    || envelope.key_epoch_commitment !== message.key_epoch_commitment || envelope.recipient_device_id !== device.deviceId
    || publicJwk?.kty !== "EC" || publicJwk?.crv !== "P-256" || !/^[A-Za-z0-9_-]{40,50}$/.test(String(publicJwk?.x))
    || !/^[A-Za-z0-9_-]{40,50}$/.test(String(publicJwk?.y)) || publicKeys.some((key) => !new Set(["kty", "crv", "x", "y"]).has(key))
    || !/^[a-f0-9]{64}$/.test(String(envelope.aad_sha256 ?? ""))) {
    throw new Error("encrypted message context is invalid");
  }
  decodeCanonicalBase64(envelope.iv_b64, { min: 12, max: 12 });
  decodeCanonicalBase64(envelope.ciphertext_b64, { min: 17, max: 12_288 });
  if (group) {
    decodeCanonicalBase64(envelope.shared_iv_b64, { min: 12, max: 12 });
    decodeCanonicalBase64(envelope.shared_ciphertext_b64, { min: 17, max: 65_536 });
    if (!/^[a-f0-9]{64}$/.test(String(envelope.shared_aad_sha256 ?? "")) || !/^[a-f0-9]{64}$/.test(String(envelope.shared_ciphertext_sha256 ?? ""))) {
      throw new Error("encrypted group message context is invalid");
    }
  } else if ([envelope.shared_iv_b64, envelope.shared_ciphertext_b64, envelope.shared_aad_sha256, envelope.shared_ciphertext_sha256].some((value) => value != null)) {
    throw new Error("encrypted direct message contains group material");
  }
  return envelope;
}

function validateDecryptedPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || payload.v !== 1 || !new Set(["text", "attachment"]).has(payload.type)
    || !Number.isSafeInteger(Number(payload.created_at)) || Number(payload.created_at) < 0 || Number(payload.created_at) > 10_000_000_000_000) {
    throw new Error("encrypted message payload invalid");
  }
  if (payload.type === "text" && (typeof payload.text !== "string" || payload.text.length < 1 || payload.text.length > 4_000)) throw new Error("encrypted message payload invalid");
  if (payload.type === "attachment" && (typeof payload.text !== "string" || payload.text.length > 4_000
    || !Number.isSafeInteger(Number(payload.media_id)) || Number(payload.media_id) < 1 || !/^[a-f0-9]{64}$/.test(String(payload.cipher_sha256 ?? ""))
    || typeof payload.name !== "string" || payload.name.length < 1 || payload.name.length > 120 || /[\\/\u0000-\u001f]/.test(payload.name)
    || typeof payload.mime !== "string" || payload.mime.length > 120 || !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(payload.mime)
    || !Number.isSafeInteger(Number(payload.size)) || Number(payload.size) < 1 || Number(payload.size) > 19 * 1024 * 1024
    || typeof payload.content_aad !== "string" || payload.content_aad.length > 512)) throw new Error("encrypted attachment payload invalid");
  return payload;
}

async function decryptChatPayload(message, device) {
  const envelope = validateEncryptedMessageContext(message, device);
  const aad = chatAad({
    conversationId: envelope.conversation_id,
    clientNonce: envelope.client_nonce,
    senderDeviceId: envelope.sender_device_id,
    recipientDeviceId: envelope.recipient_device_id,
    deviceSetCommitment: envelope.device_set_commitment,
    keyEpoch: envelope.key_epoch,
    keyEpochCommitment: envelope.key_epoch_commitment,
  });
  const aadBytes = encoder.encode(aad);
  if (await sha256HexBytes(aadBytes) !== envelope.aad_sha256) throw new Error("encrypted message binding mismatch");
  const key = await deriveMessageKey(device.privateKey, envelope.sender_public_jwk, {
    conversationId: envelope.conversation_id,
    deviceSetCommitment: envelope.device_set_commitment,
    keyEpoch: envelope.key_epoch,
    keyEpochCommitment: envelope.key_epoch_commitment,
    senderDeviceId: envelope.sender_device_id,
    recipientDeviceId: envelope.recipient_device_id,
  });
  const clear = await crypto.subtle.decrypt({
    name: "AES-GCM", iv: base64ToBytes(envelope.iv_b64),
    additionalData: aadBytes, tagLength: 128,
  }, key, base64ToBytes(envelope.ciphertext_b64));
  return validateDecryptedPayload(JSON.parse(decoder.decode(clear)));
}

async function decryptGroupChatPayload(message, device) {
  const envelope = validateEncryptedMessageContext(message, device);
  const wrapperAad = groupKeyEnvelopeAad({
    conversationId: envelope.conversation_id, clientNonce: envelope.client_nonce,
    senderDeviceId: envelope.sender_device_id, recipientDeviceId: envelope.recipient_device_id,
    deviceSetCommitment: envelope.device_set_commitment, keyEpoch: envelope.key_epoch,
    keyEpochCommitment: envelope.key_epoch_commitment,
    sharedCiphertextSha256: envelope.shared_ciphertext_sha256, sharedAadSha256: envelope.shared_aad_sha256,
  });
  const wrapperAadBytes = encoder.encode(wrapperAad);
  if (await sha256HexBytes(wrapperAadBytes) !== envelope.aad_sha256) throw new Error("group key binding mismatch");
  const wrapperKey = await deriveMessageKey(device.privateKey, envelope.sender_public_jwk, {
    conversationId: envelope.conversation_id, deviceSetCommitment: envelope.device_set_commitment,
    keyEpoch: envelope.key_epoch, keyEpochCommitment: envelope.key_epoch_commitment,
    senderDeviceId: envelope.sender_device_id, recipientDeviceId: envelope.recipient_device_id,
  });
  const clearWrapper = await crypto.subtle.decrypt({
    name: "AES-GCM", iv: base64ToBytes(envelope.iv_b64), additionalData: wrapperAadBytes, tagLength: 128,
  }, wrapperKey, base64ToBytes(envelope.ciphertext_b64));
  const wrapper = JSON.parse(decoder.decode(clearWrapper));
  if (wrapper?.v !== 1 || wrapper?.type !== "nexus_group_content_key"
    || wrapper.shared_ciphertext_sha256 !== envelope.shared_ciphertext_sha256
    || wrapper.shared_aad_sha256 !== envelope.shared_aad_sha256) throw new Error("group content key wrapper invalid");
  const contentKeyBytes = base64ToBytes(wrapper.content_key_b64);
  if (contentKeyBytes.byteLength !== 32) throw new Error("group content key invalid");
  try {
    const sharedCipherBytes = base64ToBytes(envelope.shared_ciphertext_b64);
    if (await sha256HexBytes(sharedCipherBytes) !== envelope.shared_ciphertext_sha256) throw new Error("group ciphertext commitment mismatch");
    const sharedAad = groupSharedAad({
      conversationId: envelope.conversation_id, clientNonce: envelope.client_nonce,
      senderDeviceId: envelope.sender_device_id, deviceSetCommitment: envelope.device_set_commitment,
      keyEpoch: envelope.key_epoch, keyEpochCommitment: envelope.key_epoch_commitment,
    });
    const sharedAadBytes = encoder.encode(sharedAad);
    if (await sha256HexBytes(sharedAadBytes) !== envelope.shared_aad_sha256) throw new Error("group ciphertext binding mismatch");
    const contentKey = await crypto.subtle.importKey("raw", contentKeyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
    const clear = await crypto.subtle.decrypt({
      name: "AES-GCM", iv: base64ToBytes(envelope.shared_iv_b64), additionalData: sharedAadBytes, tagLength: 128,
    }, contentKey, sharedCipherBytes);
    return validateDecryptedPayload(JSON.parse(decoder.decode(clear)));
  } finally {
    contentKeyBytes.fill(0);
  }
}

export async function decryptChatMessage(message, device) {
  if (!new Set(["e2ee_v1", "e2ee_group_v1"]).has(message.encryption_mode)) return message.body;
  const payload = message.encryption_mode === "e2ee_group_v1" ? await decryptGroupChatPayload(message, device) : await decryptChatPayload(message, device);
  if (payload.type !== "text") throw new Error("encrypted message payload invalid");
  return payload.text;
}

async function readBoundedResponseBytes(response, maxBytes) {
  const declared = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("encrypted attachment is too large");
  if (!response.body?.getReader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) throw new Error("encrypted attachment is too large");
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error("encrypted attachment is too large");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}

export async function decryptChatAttachment(message, device, fetcher = fetch, { signal } = {}) {
  const assertActive = () => {
    if (signal?.aborted) throw new DOMException("The attachment decryption was cancelled", "AbortError");
  };
  assertActive();
  if (!new Set(["e2ee_v1", "e2ee_group_v1"]).has(message.encryption_mode) || message.kind !== "encrypted_attachment" || !message.attachment_url) throw new Error("encrypted attachment is unavailable");
  const mediaMatch = String(message.attachment_url).match(/^\/media\/([a-f0-9]{64})\.([a-z0-9]{1,12})$/);
  if (!mediaMatch || mediaMatch[1] !== message.media_hash || !Number.isSafeInteger(Number(message.attachment_media_id)) || Number(message.attachment_media_id) < 1) throw new Error("encrypted attachment storage reference is invalid");
  const payload = message.encryption_mode === "e2ee_group_v1" ? await decryptGroupChatPayload(message, device) : await decryptChatPayload(message, device);
  assertActive();
  if (payload.type !== "attachment" || Number(payload.media_id) !== Number(message.attachment_media_id) || payload.cipher_sha256 !== message.media_hash) throw new Error("encrypted attachment binding mismatch");
  const response = await fetcher(message.attachment_url, { credentials: "same-origin", cache: "no-store", signal });
  if (!response.ok) throw new Error("encrypted attachment download denied");
  const container = await readBoundedResponseBytes(response, 20 * 1024 * 1024);
  assertActive();
  if (await sha256HexBytes(container) !== payload.cipher_sha256) throw new Error("encrypted attachment integrity mismatch");
  if (container.byteLength <= ATTACHMENT_MAGIC.byteLength + 16 || !ATTACHMENT_MAGIC.every((value, index) => container[index] === value)) throw new Error("encrypted attachment container invalid");
  const keyBytes = decodeCanonicalBase64(payload.content_key_b64, { min: 32, max: 32 });
  try {
    const iv = decodeCanonicalBase64(payload.content_iv_b64, { min: 12, max: 12 });
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
    const clear = await crypto.subtle.decrypt({
      name: "AES-GCM", iv,
      additionalData: encoder.encode(payload.content_aad), tagLength: 128,
    }, key, container.subarray(ATTACHMENT_MAGIC.byteLength));
    assertActive();
    const metadata = JSON.parse(payload.content_aad);
    const canonicalMetadata = JSON.stringify({ v: 1, conversation_id: Number(message.conversation_id), name: payload.name, mime: payload.mime, size: clear.byteLength });
    if (payload.content_aad !== canonicalMetadata || metadata.v !== 1 || metadata.conversation_id !== Number(message.conversation_id) || metadata.name !== payload.name || metadata.mime !== payload.mime || metadata.size !== clear.byteLength || Number(payload.size) !== clear.byteLength) throw new Error("encrypted attachment metadata mismatch");
    return { blob: new Blob([clear], { type: payload.mime }), name: payload.name, mime: payload.mime, size: clear.byteLength, text: payload.text };
  } finally {
    keyBytes.fill(0);
  }
}
