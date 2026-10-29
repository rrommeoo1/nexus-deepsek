/**
 * Verification and reset tokens, stored as hashes, used once, expired on the clock.
 *
 * Why a table and not the two columns `users` already carries: a token row knows *which purpose* it
 * serves, *which address* it was sent to and *when it was minted*, so a second request can revoke the
 * first link, a resend can be cooled down, an expiry sweep can be one query, and the row can be shown
 * as consumed instead of being silently overwritten. The legacy `users.email_verification_token`
 * columns keep working for the wallet-signup flow that predates this table.
 *
 * The plaintext token exists only in the caller's hands for the length of one send. What is stored is
 * `sha256(token)`, so a database read — or a backup — reveals no working link.
 */
import { randomBytes } from "node:crypto";
import { sha256Hex } from "../security.js";

export const EMAIL_TOKEN_PURPOSES = Object.freeze({ verify: "verify_email", reset: "reset_password" });

/** 24 h to confirm an address (a phone can sit in a drawer), 30 min to change a password. */
export const EMAIL_TOKEN_TTL_MINUTES = Object.freeze({ verify_email: 24 * 60, reset_password: 30 });

/** The shortest gap between two user-initiated sends of the same purpose to the same account. */
export const EMAIL_RESEND_COOLDOWN_SECONDS = 60;

function requireTable(db) {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'email_tokens'`).get();
  if (!row) {
    const error = new Error("tabela email_tokens lipsește; baza trebuie migrată");
    error.code = "EMAIL_TOKENS_TABLE_MISSING";
    throw error;
  }
}

export function emailTokenTtlMinutes(purpose) {
  return EMAIL_TOKEN_TTL_MINUTES[purpose] ?? 30;
}

/**
 * Mints a token. Every earlier unconsumed token of the same purpose for the same account is revoked
 * first: one live link per purpose means a forwarded or shoulder-surfed old mail cannot be replayed
 * after the owner asks for a new one.
 */
export function issueEmailToken(db, { userId, purpose, email, ttlMinutes = null, now = Date.now(), requestedIpHash = "" }) {
  requireTable(db);
  const minutes = Number.isFinite(Number(ttlMinutes)) && Number(ttlMinutes) > 0 ? Number(ttlMinutes) : emailTokenTtlMinutes(purpose);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = now + minutes * 60_000;
  db.prepare(`UPDATE email_tokens SET consumed_at = ? WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL`)
    .run(now, userId, purpose);
  db.prepare(`INSERT INTO email_tokens (user_id, purpose, token_sha256, email, expires_at, created_at, requested_ip_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(userId, purpose, sha256Hex(token), String(email ?? "").toLowerCase(), expiresAt, now, String(requestedIpHash ?? ""));
  return { token, expiresAt, minutes, purpose };
}

/**
 * Single-use by construction: the `UPDATE` is the check. Two concurrent requests present the same
 * token, exactly one row changes, and the loser is refused like any other stale link.
 */
export function consumeEmailToken(db, { purpose, token, now = Date.now() }) {
  requireTable(db);
  const presented = String(token ?? "").trim();
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(presented)) return null;
  const hash = sha256Hex(presented);
  const changed = db.prepare(`UPDATE email_tokens SET consumed_at = ?
    WHERE token_sha256 = ? AND purpose = ? AND consumed_at IS NULL AND expires_at > ?`)
    .run(now, hash, purpose, now).changes;
  if (changed !== 1) return null;
  return db.prepare(`SELECT * FROM email_tokens WHERE token_sha256 = ?`).get(hash) ?? null;
}

export function readEmailToken(db, { purpose, token }) {
  requireTable(db);
  const presented = String(token ?? "").trim();
  if (!presented) return null;
  return db.prepare(`SELECT * FROM email_tokens WHERE token_sha256 = ? AND purpose = ?`).get(sha256Hex(presented), purpose) ?? null;
}

/**
 * Removes a token that was never delivered.
 *
 * A provider refusal must not cost the owner his retry: a token left behind by a failed send would
 * start the resend cooldown for a message nobody received, so the row is dropped and the next attempt
 * is immediate. Nothing is lost by deleting it — the only copy of the plaintext was in that message.
 */
export function forgetEmailToken(db, { token }) {
  requireTable(db);
  const presented = String(token ?? "").trim();
  if (!presented) return 0;
  return db.prepare(`DELETE FROM email_tokens WHERE token_sha256 = ?`).run(sha256Hex(presented)).changes;
}

/** Revokes every live token of an account (all purposes when `purpose` is omitted). */
export function revokeEmailTokens(db, { userId, purpose = null, now = Date.now() }) {
  requireTable(db);
  if (purpose) {
    return db.prepare(`UPDATE email_tokens SET consumed_at = ? WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL`)
      .run(now, userId, purpose).changes;
  }
  return db.prepare(`UPDATE email_tokens SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL`)
    .run(now, userId).changes;
}

/** When this account last asked for this kind of link, for the resend cooldown. */
export function lastEmailTokenAt(db, { userId, purpose }) {
  requireTable(db);
  const row = db.prepare(`SELECT MAX(created_at) AS last FROM email_tokens WHERE user_id = ? AND purpose = ?`).get(userId, purpose);
  return Number(row?.last ?? 0);
}

export function countEmailTokensSince(db, { userId, purpose, since }) {
  requireTable(db);
  const row = db.prepare(`SELECT COUNT(*) AS total FROM email_tokens WHERE user_id = ? AND purpose = ? AND created_at >= ?`)
    .get(userId, purpose, since);
  return Number(row?.total ?? 0);
}

/** The expiry sweep, called from the same timer that already purges challenges and sessions. */
export function purgeExpiredEmailTokens(db, at = Date.now()) {
  try {
    requireTable(db);
    return db.prepare(`DELETE FROM email_tokens WHERE expires_at <= ?`).run(at).changes;
  } catch {
    return 0;
  }
}
