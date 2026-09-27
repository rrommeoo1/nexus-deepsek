import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { hashToken, issueSession, sessionSecret, sha256Hex } from "./security.js";

const PURPOSES = new Set(["native", "nexus_username", "multiversx_alias", "recover"]);

export class NativeAuthSessionError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = "NativeAuthSessionError";
    this.code = code;
    this.status = status;
  }
}

const encryptionKey = () => createHash("sha256").update(`nexus-native-auth-session-v1:${sessionSecret()}`).digest();

function sealToken(token) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), encrypted]);
}

function openToken(value) {
  const packed = Buffer.from(value ?? "");
  if (packed.length < 30 || packed[0] !== 1) throw new NativeAuthSessionError("NATIVE_AUTH_REPLAY_UNAVAILABLE", 409, "sesiunea NativeAuth nu mai poate fi reluată");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), packed.subarray(1, 13));
  decipher.setAuthTag(packed.subarray(13, 29));
  return Buffer.concat([decipher.update(packed.subarray(29)), decipher.final()]).toString("utf8");
}

export function assertNativeAuthIdempotencyKey(value) {
  const key = String(value ?? "").trim();
  if (key.length < 16 || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new NativeAuthSessionError("IDEMPOTENCY_KEY_REQUIRED", 400, "Idempotency-Key trebuie să conțină 16–128 caractere sigure");
  }
  return key;
}

export function consumeNativeAuthSession({
  db, repo, token, purpose, idempotencyKey, requestBody, address, userId, persona,
  now = Date.now(), beforeCommit = null,
}) {
  if (!PURPOSES.has(purpose)) throw new NativeAuthSessionError("NATIVE_AUTH_PURPOSE_INVALID", 400, "scop NativeAuth invalid");
  const key = assertNativeAuthIdempotencyKey(idempotencyKey);
  const tokenHash = sha256Hex(String(token));
  const requestHash = sha256Hex(Buffer.isBuffer(requestBody) ? requestBody : Buffer.from(requestBody ?? ""));
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`DELETE FROM native_auth_consumptions WHERE expires_at <= ?`).run(now);
    const byKey = db.prepare(`SELECT * FROM native_auth_consumptions WHERE purpose = ? AND idempotency_key = ?`).get(purpose, key);
    const existing = byKey ?? db.prepare(`SELECT * FROM native_auth_consumptions WHERE token_sha256 = ?`).get(tokenHash);
    if (existing) {
      if (existing.token_sha256 !== tokenHash || existing.purpose !== purpose || existing.request_sha256 !== requestHash
          || existing.address !== address || Number(existing.user_id) !== Number(userId) || existing.persona !== persona) {
        db.exec("COMMIT");
        throw new NativeAuthSessionError("NATIVE_AUTH_REPLAY_CONFLICT", 409, "tokenul sau cheia NativeAuth a fost deja folosită pentru altă autentificare");
      }
      const sessionToken = openToken(existing.session_token_ciphertext);
      const session = repo.getSession(hashToken(sessionToken));
      if (!session || Number(session.user_id) !== Number(userId) || session.persona !== persona || Number(session.expires_at) <= now) {
        db.exec("COMMIT");
        throw new NativeAuthSessionError("NATIVE_AUTH_REPLAY_UNAVAILABLE", 409, "sesiunea NativeAuth consumată nu mai este disponibilă");
      }
      db.exec("COMMIT");
      return { replay: true, token: sessionToken, tokenHash: hashToken(sessionToken), expiresAt: Number(session.expires_at) };
    }

    const session = issueSession(userId, persona);
    repo.insertSession({ tokenHash: session.tokenHash, userId, persona, expiresAt: session.expiresAt });
    db.prepare(`INSERT INTO native_auth_consumptions
      (token_sha256, purpose, idempotency_key, request_sha256, address, user_id, persona,
       session_token_hash, session_token_ciphertext, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(tokenHash, purpose, key, requestHash, address, userId, persona, session.tokenHash, sealToken(session.token), session.expiresAt, now);
    if (typeof beforeCommit === "function") beforeCommit();
    db.exec("COMMIT");
    return { replay: false, ...session };
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* conflict paths intentionally commit before throwing */ }
    throw error;
  }
}

export function purgeExpiredNativeAuthConsumptions(db, at = Date.now()) {
  return db.prepare(`DELETE FROM native_auth_consumptions WHERE expires_at <= ?`).run(at).changes;
}
