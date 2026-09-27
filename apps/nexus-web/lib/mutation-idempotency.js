import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { sessionSecret } from "./security.js";
import { recordActionIntentForMutation } from "./action-ledger.js";

export const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export const MUTATION_BODY_LIMIT = 1024 * 1024;
export const MUTATION_TTL_SECONDS = 24 * 60 * 60;
export const MUTATION_LEASE_SECONDS = 30;

export class MutationError extends Error {
  constructor(code, status, message, retryable = false) {
    super(message);
    this.name = "MutationError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

const responseKey = () => createHash("sha256").update(`nexus-mutation-response-v1:${sessionSecret()}`).digest();

function sealResponse(body) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", responseKey(), iv);
  const encrypted = Buffer.concat([cipher.update(body), cipher.final()]);
  return Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), encrypted]);
}

export function completeMutationRecord({ db, mutationId, status, headers = {}, body, now = Math.floor(Date.now() / 1000) }) {
  const responseBody = Buffer.isBuffer(body) ? body : Buffer.from(body == null ? "" : String(body));
  const oversized = responseBody.length > MUTATION_BODY_LIMIT;
  const replayBody = oversized
    ? Buffer.from(JSON.stringify({ ok: false, code: "IDEMPOTENCY_RESPONSE_TOO_LARGE", error: "mutation completed; refresh the resource" }))
    : responseBody;
  const replayHeaders = oversized
    ? { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    : Object.fromEntries(Object.entries(headers)
      .map(([name, value]) => [String(name).toLowerCase(), value])
      .filter(([name]) => new Set(["content-type", "cache-control", "content-length", "retry-after"]).has(name)));
  const outcomeStatus = Number(status) || 200;
  db.exec("SAVEPOINT nexus_complete_mutation");
  try {
    const result = db.prepare(`UPDATE mutation_requests
      SET status = 'completed', outcome_status = ?, response_status = ?, response_headers_json = ?, response_body = ?, updated_at = ?
      WHERE id = ? AND status = 'in_progress'`)
      .run(outcomeStatus, oversized ? 409 : outcomeStatus, JSON.stringify(replayHeaders), sealResponse(replayBody), now, mutationId);
    if (result.changes && outcomeStatus >= 200 && outcomeStatus < 300) recordActionIntentForMutation(db, mutationId, now);
    db.exec("RELEASE SAVEPOINT nexus_complete_mutation");
    return result;
  } catch (error) {
    db.exec("ROLLBACK TO SAVEPOINT nexus_complete_mutation");
    db.exec("RELEASE SAVEPOINT nexus_complete_mutation");
    throw error;
  }
}

function openResponse(body) {
  const packed = Buffer.from(body ?? "");
  if (packed.length < 29 || packed[0] !== 1) throw new MutationError("IDEMPOTENCY_REPLAY_UNAVAILABLE", 409, "stored mutation response is unavailable");
  const decipher = createDecipheriv("aes-256-gcm", responseKey(), packed.subarray(1, 13));
  decipher.setAuthTag(packed.subarray(13, 29));
  return Buffer.concat([decipher.update(packed.subarray(29)), decipher.final()]);
}

function cleanKey(value) {
  const key = String(value ?? "").trim();
  if (key.length < 16 || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new MutationError("IDEMPOTENCY_KEY_REQUIRED", 400, "Idempotency-Key must contain 16-128 safe characters");
  }
  return key;
}

function requestFingerprint(actorPersona, method, requestTarget, body) {
  const digest = createHash("sha256");
  digest.update(String(actorPersona));
  digest.update("\0");
  digest.update(String(method).toUpperCase());
  digest.update("\0");
  digest.update(String(requestTarget));
  digest.update("\0");
  digest.update(body);
  return digest.digest("hex");
}

function safeReplayHeaders(value) {
  let parsed = {};
  try { parsed = JSON.parse(value || "{}"); } catch { parsed = {}; }
  const allowed = new Set(["content-type", "cache-control", "content-length", "retry-after"]);
  return Object.fromEntries(Object.entries(parsed).filter(([name]) => allowed.has(name.toLowerCase())));
}

export function prepareMutation({ db, userId, actorPersona, key, method, requestTarget, body, now = Math.floor(Date.now() / 1000) }) {
  key = cleanKey(key);
  method = String(method).toUpperCase();
  if (!MUTATION_METHODS.has(method)) throw new MutationError("MUTATION_METHOD_INVALID", 400, "mutation method invalid");
  if (!Buffer.isBuffer(body)) body = Buffer.from(body ?? "");
  actorPersona = String(actorPersona ?? "").trim().toLowerCase();
  if (!actorPersona) throw new MutationError("MUTATION_PERSONA_REQUIRED", 400, "active persona is required");
  const fingerprint = requestFingerprint(actorPersona, method, requestTarget, body);
  db.exec("BEGIN IMMEDIATE");
  let transactionOpen = true;
  try {
    db.prepare(`DELETE FROM mutation_requests WHERE expires_at <= ?`).run(now);
    const existing = db.prepare(`SELECT * FROM mutation_requests WHERE user_id = ? AND actor_persona = ? AND idempotency_key = ?`).get(userId, actorPersona, key);
    if (existing) {
      if (existing.request_sha256 !== fingerprint || existing.method !== method || existing.request_target !== requestTarget) {
        db.exec("COMMIT");
        transactionOpen = false;
        throw new MutationError("IDEMPOTENCY_CONFLICT", 409, "Idempotency-Key was already used for another mutation");
      }
      if (existing.status === "completed") {
        db.exec("COMMIT");
        transactionOpen = false;
        return {
          action: "replay",
          id: existing.id,
          status: existing.response_status,
          headers: safeReplayHeaders(existing.response_headers_json),
          body: openResponse(existing.response_body),
        };
      }
      if (Number(existing.updated_at) + MUTATION_LEASE_SECONDS > now) {
        db.exec("COMMIT");
        transactionOpen = false;
        throw new MutationError("IDEMPOTENCY_IN_PROGRESS", 409, "mutation with this Idempotency-Key is still in progress", true);
      }
      db.prepare(`UPDATE mutation_requests SET updated_at = ?, expires_at = ? WHERE id = ?`).run(now, now + MUTATION_TTL_SECONDS, existing.id);
      db.exec("COMMIT");
      transactionOpen = false;
      return { action: "execute", id: existing.id, replayedAfterLease: true };
    }
    const inserted = db.prepare(`INSERT INTO mutation_requests
      (user_id, actor_persona, idempotency_key, method, request_target, request_sha256, status, created_at, updated_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, ?)`)
      .run(userId, actorPersona, key, method, requestTarget, fingerprint, now, now, now + MUTATION_TTL_SECONDS);
    db.exec("COMMIT");
    transactionOpen = false;
    return { action: "execute", id: Number(inserted.lastInsertRowid), replayedAfterLease: false };
  } catch (error) {
    if (transactionOpen) db.exec("ROLLBACK");
    throw error;
  }
}

export function attachMutationRecorder({ db, res, mutationId, now = () => Math.floor(Date.now() / 1000) }) {
  const originalWriteHead = res.writeHead.bind(res);
  const originalSetHeader = res.setHeader.bind(res);
  const originalEnd = res.end.bind(res);
  const capturedHeaders = {};
  let statusCode = Number(res.statusCode) || 200;
  let completed = false;

  res.setHeader = (name, value) => {
    capturedHeaders[String(name).toLowerCase()] = value;
    return originalSetHeader(name, value);
  };
  res.writeHead = (status, ...args) => {
    statusCode = Number(status) || 200;
    const headerObject = args.find((arg) => arg && typeof arg === "object" && !Array.isArray(arg));
    if (headerObject) for (const [name, value] of Object.entries(headerObject)) capturedHeaders[name.toLowerCase()] = value;
    return originalWriteHead(status, ...args);
  };
  res.end = (data, ...args) => {
    if (!completed) {
      completed = true;
      const body = Buffer.isBuffer(data) ? data : Buffer.from(data == null ? "" : String(data));
      completeMutationRecord({ db, mutationId, status: statusCode, headers: capturedHeaders, body, now: now() });
    }
    return originalEnd(data, ...args);
  };
}

export function mutationErrorPayload(error) {
  if (!(error instanceof MutationError)) throw error;
  return { status: error.status, body: { ok: false, code: error.code, error: error.message, retryable: error.retryable } };
}
