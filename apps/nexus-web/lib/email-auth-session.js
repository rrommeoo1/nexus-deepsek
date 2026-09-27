import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { hashToken, issueSession, sessionSecret, sha256Hex } from "./security.js";

const PURPOSES = new Set(["signup", "login", "verify"]);
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export class EmailAuthCommandError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = "EmailAuthCommandError";
    this.code = code;
    this.status = status;
  }
}

function encryptionKey(context) {
  return createHash("sha256").update(`nexus-email-auth-v1:${context}:${sessionSecret()}`).digest();
}

function seal(value, context) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(context), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), encrypted]);
}

function open(value, context) {
  const packed = Buffer.from(value ?? "");
  if (packed.length < 30 || packed[0] !== 1) {
    throw new EmailAuthCommandError("EMAIL_AUTH_REPLAY_UNAVAILABLE", 409, "autentificarea nu mai poate fi reluată");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(context), packed.subarray(1, 13));
  decipher.setAuthTag(packed.subarray(13, 29));
  return Buffer.concat([decipher.update(packed.subarray(29)), decipher.final()]).toString("utf8");
}

export function assertEmailAuthIdempotencyKey(value) {
  const key = String(value ?? "").trim();
  if (key.length < 16 || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new EmailAuthCommandError("IDEMPOTENCY_KEY_REQUIRED", 400, "Idempotency-Key trebuie să conțină 16–128 caractere sigure");
  }
  return key;
}

export function emailAuthRequestMac(value) {
  const canonical = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
  return createHmac("sha256", sessionSecret()).update("nexus-email-auth-request-v1\0").update(canonical).digest("hex");
}

export function issueEmailSignupChallenge({ db, idempotencyKey, email, now = Date.now(), beforeCommit = null }) {
  const key = assertEmailAuthIdempotencyKey(idempotencyKey);
  const cleanEmail = String(email).trim().toLowerCase();
  const requestMac = emailAuthRequestMac({ email: cleanEmail });
  const emailHash = sha256Hex(cleanEmail);
  db.exec("BEGIN IMMEDIATE");
  try {
    const existing = db.prepare(`SELECT * FROM email_signup_challenges WHERE idempotency_key = ?`).get(key);
    if (existing) {
      if (existing.request_mac !== requestMac || existing.email_sha256 !== emailHash) {
        db.exec("COMMIT");
        throw new EmailAuthCommandError("EMAIL_SIGNUP_INIT_CONFLICT", 409, "cheia a fost folosită pentru altă adresă de email");
      }
      const nonce = open(existing.nonce_ciphertext, "signup-challenge");
      db.exec("COMMIT");
      return { replay: true, nonce, expiresAt: Number(existing.expires_at) };
    }
    const nonce = randomBytes(32).toString("base64url");
    const expiresAt = now + CHALLENGE_TTL_MS;
    db.prepare(`INSERT INTO email_signup_challenges
      (nonce_sha256, idempotency_key, request_mac, email_sha256, nonce_ciphertext, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(sha256Hex(nonce), key, requestMac, emailHash, seal(nonce, "signup-challenge"), expiresAt, now);
    if (typeof beforeCommit === "function") beforeCommit();
    db.exec("COMMIT");
    return { replay: false, nonce, expiresAt };
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* conflict paths intentionally commit before throwing */ }
    throw error;
  }
}

export function getEmailSignupChallenge(db, { nonce, email, now = Date.now() }) {
  const row = db.prepare(`SELECT * FROM email_signup_challenges WHERE nonce_sha256 = ?`).get(sha256Hex(String(nonce ?? "")));
  if (!row || row.email_sha256 !== sha256Hex(String(email).trim().toLowerCase()) || Number(row.expires_at) <= now || row.consumed_at) return null;
  return row;
}

function replayCommand(repo, row, { purpose, requestMac, subjectHash, now }) {
  if (row.purpose !== purpose || row.request_mac !== requestMac || row.subject_sha256 !== subjectHash) {
    throw new EmailAuthCommandError("EMAIL_AUTH_REPLAY_CONFLICT", 409, "cheia a fost folosită pentru altă autentificare");
  }
  const token = open(row.session_token_ciphertext, "session-token");
  const session = repo.getSession(hashToken(token));
  if (!session || Number(session.user_id) !== Number(row.user_id) || session.persona !== row.persona || Number(session.expires_at) <= now) {
    throw new EmailAuthCommandError("EMAIL_AUTH_REPLAY_UNAVAILABLE", 409, "sesiunea consumată nu mai este disponibilă");
  }
  const response = JSON.parse(open(row.response_ciphertext, "response"));
  return { replay: true, token, tokenHash: hashToken(token), expiresAt: Number(session.expires_at), response };
}

export function replayEmailAuthCommand({ db, repo, purpose, idempotencyKey, requestData, subject, now = Date.now() }) {
  const key = assertEmailAuthIdempotencyKey(idempotencyKey);
  const requestMac = emailAuthRequestMac(requestData);
  const subjectHash = sha256Hex(String(subject).trim().toLowerCase());
  const existing = db.prepare(`SELECT * FROM email_auth_commands WHERE purpose = ? AND idempotency_key = ?`).get(purpose, key);
  return existing ? replayCommand(repo, existing, { purpose, requestMac, subjectHash, now }) : null;
}

export function consumeEmailAuthCommand({
  db, repo, purpose, idempotencyKey, requestData, subject, persona = "social", operation,
  challengeNonce = null, now = Date.now(), beforeCommit = null,
}) {
  if (!PURPOSES.has(purpose)) throw new EmailAuthCommandError("EMAIL_AUTH_PURPOSE_INVALID", 400, "scop email auth invalid");
  const key = assertEmailAuthIdempotencyKey(idempotencyKey);
  const requestMac = emailAuthRequestMac(requestData);
  const subjectHash = sha256Hex(String(subject).trim().toLowerCase());
  db.exec("BEGIN IMMEDIATE");
  try {
    const existing = db.prepare(`SELECT * FROM email_auth_commands WHERE purpose = ? AND idempotency_key = ?`).get(purpose, key);
    if (existing) {
      const result = replayCommand(repo, existing, { purpose, requestMac, subjectHash, now });
      db.exec("COMMIT");
      return result;
    }
    let challenge = null;
    if (purpose === "signup") {
      challenge = getEmailSignupChallenge(db, { nonce: challengeNonce, email: subject, now });
      if (!challenge) throw new EmailAuthCommandError("EMAIL_SIGNUP_PROOF_INVALID", 400, "dovada walletului local este invalidă, consumată sau expirată");
    }
    const outcome = operation();
    const userId = Number(outcome?.userId);
    if (!Number.isInteger(userId) || userId <= 0 || !outcome?.response) throw new Error("EMAIL_AUTH_OPERATION_INVALID");
    const session = issueSession(userId, persona);
    repo.insertSession({ tokenHash: session.tokenHash, userId, persona, expiresAt: session.expiresAt });
    db.prepare(`INSERT INTO email_auth_commands
      (purpose, idempotency_key, request_mac, subject_sha256, user_id, persona,
       session_token_hash, session_token_ciphertext, response_ciphertext, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(purpose, key, requestMac, subjectHash, userId, persona, session.tokenHash,
        seal(session.token, "session-token"), seal(JSON.stringify(outcome.response), "response"), session.expiresAt, now);
    if (challenge) {
      const changed = db.prepare(`UPDATE email_signup_challenges
        SET consumed_at = ?, consumed_command_key = ?
        WHERE nonce_sha256 = ? AND consumed_at IS NULL`).run(now, key, challenge.nonce_sha256).changes;
      if (changed !== 1) throw new EmailAuthCommandError("EMAIL_SIGNUP_PROOF_CONFLICT", 409, "dovada walletului local a fost deja consumată");
    }
    if (typeof beforeCommit === "function") beforeCommit();
    db.exec("COMMIT");
    return { replay: false, ...session, response: outcome.response };
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* replay paths may have committed before throwing */ }
    throw error;
  }
}

export function consumeAuthLogout({ db, repo, idempotencyKey, tokens = [], now = Date.now() }) {
  const key = assertEmailAuthIdempotencyKey(idempotencyKey);
  const tokenHashes = [...new Set(tokens.filter(Boolean).map((token) => hashToken(String(token))))].sort();
  const credentialSetHash = sha256Hex(tokenHashes.join(":"));
  db.exec("BEGIN IMMEDIATE");
  try {
    const existing = db.prepare(`SELECT * FROM auth_logout_commands WHERE idempotency_key = ?`).get(key);
    if (existing) {
      if (existing.credential_set_sha256 !== credentialSetHash) {
        db.exec("COMMIT");
        throw new EmailAuthCommandError("AUTH_LOGOUT_REPLAY_CONFLICT", 409, "cheia de logout a fost folosită pentru alte credențiale");
      }
      db.exec("COMMIT");
      return { replay: true };
    }
    for (const tokenHash of tokenHashes) repo.deleteSession(tokenHash);
    db.prepare(`INSERT INTO auth_logout_commands (idempotency_key, credential_set_sha256, expires_at, created_at)
      VALUES (?, ?, ?, ?)`).run(key, credentialSetHash, now + 24 * 60 * 60 * 1000, now);
    db.exec("COMMIT");
    return { replay: false };
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* conflict path intentionally committed */ }
    throw error;
  }
}

export function consumeAuthLogoutAll({ db, repo, idempotencyKey, token, userId, now = Date.now() }) {
  const key = assertEmailAuthIdempotencyKey(idempotencyKey);
  const credentialSetHash = sha256Hex(`all:${Number(userId)}:${hashToken(String(token ?? ""))}`);
  db.exec("BEGIN IMMEDIATE");
  try {
    const existing = db.prepare(`SELECT * FROM auth_logout_commands WHERE idempotency_key = ?`).get(key);
    if (existing) {
      if (existing.credential_set_sha256 !== credentialSetHash) {
        db.exec("COMMIT");
        throw new EmailAuthCommandError("AUTH_LOGOUT_REPLAY_CONFLICT", 409, "cheia de logout-all a fost folosită pentru alte credențiale");
      }
      db.exec("COMMIT");
      return { replay: true };
    }
    repo.deleteSessionsForUser(userId);
    db.prepare(`INSERT INTO auth_logout_commands (idempotency_key, credential_set_sha256, expires_at, created_at)
      VALUES (?, ?, ?, ?)`).run(key, credentialSetHash, now + 24 * 60 * 60 * 1000, now);
    db.exec("COMMIT");
    return { replay: false };
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* conflict path intentionally committed */ }
    throw error;
  }
}

export function purgeExpiredEmailAuthState(db, at = Date.now()) {
  const challenges = db.prepare(`DELETE FROM email_signup_challenges WHERE expires_at <= ?`).run(at).changes;
  const commands = db.prepare(`DELETE FROM email_auth_commands WHERE expires_at <= ?`).run(at).changes;
  const logouts = db.prepare(`DELETE FROM auth_logout_commands WHERE expires_at <= ?`).run(at).changes;
  return { challenges, commands, logouts };
}
