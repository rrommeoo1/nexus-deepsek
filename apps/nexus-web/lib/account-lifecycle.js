import { createHash, randomUUID } from "node:crypto";
import { sessionSecret } from "./security.js";
import { purgeStoredMedia } from "./media.js";

export const ACCOUNT_DELETION_GRACE_SECONDS = 30 * 24 * 60 * 60;
export const ACCOUNT_EXPORT_TTL_SECONDS = 15 * 60;

function digest(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function accountSubjectHash(user) {
  return digest(`nexus-erasure-subject-v1:${sessionSecret()}:${Number(user?.id) || 0}:${String(user?.handle || "")}`);
}

function activeHold(db, userId, now) {
  return db.prepare(`SELECT 1 FROM account_legal_holds
    WHERE user_id = ? AND active = 1 AND (expires_at IS NULL OR expires_at > ?) LIMIT 1`).get(userId, now);
}

function emitOutbox(db, aggregateId, eventType, payload, now) {
  db.prepare(`INSERT INTO outbox_events
    (aggregate_type, aggregate_id, event_type, payload_json, status, available_at, created_at)
    VALUES ('account', ?, ?, ?, 'pending', ?, ?)
    ON CONFLICT(aggregate_type, aggregate_id, event_type) DO NOTHING`)
    .run(String(aggregateId), eventType, JSON.stringify(payload), now, now);
}

function one(db, sql, userId) {
  return db.prepare(sql).get(userId) ?? null;
}

function many(db, sql, userId) {
  return db.prepare(sql).all(userId);
}

// The export is deliberately allow-listed. Password material, provider subject
// IDs, wallet keystores, session tokens/fingerprints, moderation internals and
// data authored by other people never enter this object.
export function buildAccountExport(db, userId, generatedAt = Math.floor(Date.now() / 1000)) {
  const account = one(db, `SELECT id, handle, display_name, email, email_verified, bio, avatar,
    mvx_address, mvx_alias, linked_wallet, traffic_class, account_state, created_at
    FROM users WHERE id = ?`, userId);
  if (!account) return null;
  const sections = {
    profiles: many(db, `SELECT persona, name, bio, avatar, cover, profile_kind, visibility,
      discoverability, message_policy, interface_locale, content_languages, region_code,
      near_enabled, private_access_enabled, private_access_price_cents,
      private_access_month_price_cents, private_access_forever_price_cents,
      private_access_currency, private_access_duration_days, updated_at
      FROM personas WHERE user_id = ? ORDER BY persona`, userId),
    posts: many(db, `SELECT id, persona, kind, caption, media_id, visibility, status, language,
      region_code, provenance, audio_media_id, audio_rights, audio_attribution, edited_at,
      withdrawn_at, devnet_tx, created_at FROM posts WHERE user_id = ? ORDER BY id`, userId),
    comments: many(db, `SELECT id, post_id, actor_persona, parent_id, body, status, edited_at,
      withdrawn_at, version, pinned_at, created_at FROM comments WHERE user_id = ? ORDER BY id`, userId),
    stories: many(db, `SELECT id, persona, media_id, caption, visibility, status, expires_at,
      created_at, archived_at FROM stories WHERE user_id = ? ORDER BY id`, userId),
    reactions: many(db, `SELECT actor_persona, post_id, kind, created_at, updated_at
      FROM post_reactions WHERE user_id = ? ORDER BY post_id`, userId),
    saved_posts: many(db, `SELECT actor_persona, post_id, created_at FROM saved_posts
      WHERE user_id = ? ORDER BY post_id`, userId),
    follows: many(db, `SELECT followee_id, persona, created_at FROM follows
      WHERE follower_id = ? ORDER BY followee_id`, userId),
    follow_requests: many(db, `SELECT id, target_id, persona, status, decided_at, created_at,
      updated_at FROM follow_requests WHERE requester_id = ? ORDER BY id`, userId),
    authored_messages: many(db, `SELECT id, conversation_id, sender_persona, kind, body,
      attachment_media_id, status, encryption_mode, expires_at, expired_at, created_at, edited_at
      FROM message_items WHERE sender_id = ? ORDER BY id`, userId),
    submitted_reports: many(db, `SELECT id, reporter_persona, subject_type, subject_id, category,
      details, status, outcome, reason_code, created_at, resolved_at FROM moderation_reports
      WHERE reporter_id = ? ORDER BY id`, userId),
    notification_preferences: many(db, `SELECT persona, type, in_app, push, email, preview,
      quiet_start, quiet_end, updated_at FROM notification_preferences WHERE user_id = ?
      ORDER BY persona, type`, userId),
    devnet_actions: many(db, `SELECT actor, action, payload_hash, tx_hash, explorer_url, status,
      created_at FROM devnet_actions WHERE user_id = ? ORDER BY id`, userId),
  };
  return {
    format: "nexus-account-export-v1",
    generated_at: generatedAt,
    account,
    ...sections,
    disclosures: {
      secrets_excluded: true,
      other_users_private_data_excluded: true,
      onchain_erasure: "Datele deja confirmate pe blockchain nu pot fi șterse de Nexus; exportul include doar referințe publice asociate contului.",
    },
  };
}

export function createAccountExportRequest({ db, user, now = Math.floor(Date.now() / 1000) }) {
  const id = randomUUID();
  const subjectHash = accountSubjectHash(user);
  const expiresAt = now + ACCOUNT_EXPORT_TTL_SECONDS;
  const manifestHash = digest(JSON.stringify({ format: "nexus-account-export-v1", user_id: user.id, requested_at: now }));
  db.prepare(`INSERT INTO account_export_requests
    (id, user_id, subject_hash, state, manifest_hash, expires_at, created_at)
    VALUES (?, ?, ?, 'ready', ?, ?, ?)`).run(id, user.id, subjectHash, manifestHash, expiresAt, now);
  emitOutbox(db, id, "account.export_ready", { export_id: id, subject_hash: subjectHash, expires_at: expiresAt }, now);
  return { id, expires_at: expiresAt, manifest_hash: manifestHash };
}

export function getAccountExport({ db, userId, exportId, now = Math.floor(Date.now() / 1000) }) {
  const request = db.prepare(`SELECT * FROM account_export_requests WHERE id = ? AND user_id = ?`).get(exportId, userId);
  if (!request) return { status: "not_found" };
  if (request.state !== "ready" || Number(request.expires_at) <= now) {
    db.prepare(`UPDATE account_export_requests SET state = 'expired' WHERE id = ? AND state = 'ready'`).run(exportId);
    return { status: "expired" };
  }
  return { status: "ready", request, payload: buildAccountExport(db, userId, now) };
}

export function getDeletionStatus(db, userId, now = Math.floor(Date.now() / 1000)) {
  const request = db.prepare(`SELECT id, state, requested_at, execute_after, cancelled_at,
    purged_at, updated_at FROM account_deletion_requests WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 1`).get(userId) ?? null;
  return {
    account_state: db.prepare(`SELECT account_state FROM users WHERE id = ?`).get(userId)?.account_state ?? "missing",
    request,
    grace_seconds: ACCOUNT_DELETION_GRACE_SECONDS,
    cancellable: Boolean(request && new Set(["requested", "blocked_legal_hold"]).has(request.state) && request.execute_after > now),
    onchain_data_erasable: false,
  };
}

export function requestAccountDeletion({
  db, repo, user, currentTokenHash,
  now = Math.floor(Date.now() / 1000),
  notify = (userId, type, body, options) => repo.notify(userId, type, body, options),
}) {
  const existing = db.prepare(`SELECT * FROM account_deletion_requests WHERE user_id = ?
    AND state IN ('requested','blocked_legal_hold','purging') LIMIT 1`).get(user.id);
  if (existing) return { replay: true, request: existing };
  const id = randomUUID();
  const subjectHash = accountSubjectHash(user);
  const executeAfter = now + ACCOUNT_DELETION_GRACE_SECONDS;
  const state = activeHold(db, user.id, now) ? "blocked_legal_hold" : "requested";
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`INSERT INTO account_deletion_requests
      (id, user_id, subject_hash, state, requested_at, execute_after, updated_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, user.id, subjectHash, state, now, executeAfter, now, now);
    db.prepare(`UPDATE users SET account_state = 'deletion_pending' WHERE id = ?`).run(user.id);
    db.prepare(`DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?`).run(user.id, currentTokenHash);
    emitOutbox(db, id, "account.deletion_requested", { deletion_request_id: id, subject_hash: subjectHash, execute_after: executeAfter }, now);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  notify(user.id, "security", "Ștergerea contului a fost programată", { persona: "social", sensitive: true });
  return { replay: false, request: db.prepare(`SELECT * FROM account_deletion_requests WHERE id = ?`).get(id) };
}

export function cancelAccountDeletion({ db, userId, now = Math.floor(Date.now() / 1000) }) {
  const request = db.prepare(`SELECT * FROM account_deletion_requests WHERE user_id = ?
    AND state IN ('requested','blocked_legal_hold') ORDER BY created_at DESC LIMIT 1`).get(userId);
  if (!request || Number(request.execute_after) <= now) return { cancelled: false, reason: "not_cancellable" };
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`UPDATE account_deletion_requests SET state = 'cancelled', cancelled_at = ?, updated_at = ? WHERE id = ?`).run(now, now, request.id);
    db.prepare(`UPDATE users SET account_state = 'active' WHERE id = ?`).run(userId);
    emitOutbox(db, request.id, "account.deletion_cancelled", { deletion_request_id: request.id, subject_hash: request.subject_hash }, now);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { cancelled: true, request_id: request.id };
}

function transferSharedConversations(db, userId) {
  const owned = db.prepare(`SELECT id FROM conversations WHERE created_by = ?`).all(userId);
  for (const conversation of owned) {
    const successor = db.prepare(`SELECT user_id FROM conversation_participants
      WHERE conversation_id = ? AND user_id <> ? ORDER BY joined_at, user_id LIMIT 1`).get(conversation.id, userId);
    if (successor) db.prepare(`UPDATE conversations SET created_by = ? WHERE id = ?`).run(successor.user_id, conversation.id);
  }
}

export function runEligibleAccountPurges({ db, repo, now = Math.floor(Date.now() / 1000), limit = 25, mediaPurger = purgeStoredMedia }) {
  const candidates = db.prepare(`SELECT d.*, u.id existing_user_id FROM account_deletion_requests d
    LEFT JOIN users u ON u.id = d.user_id
    WHERE d.state IN ('requested','blocked_legal_hold','purging') AND d.execute_after <= ?
    ORDER BY d.execute_after, d.id LIMIT ?`).all(now, Math.max(1, Math.min(100, Number(limit) || 25)));
  const results = [];
  for (const request of candidates) {
    if (!request.existing_user_id) {
      results.push({ id: request.id, status: request.state === "purged" ? "purged" : "user_missing" });
      continue;
    }
    if (activeHold(db, request.user_id, now)) {
      db.prepare(`UPDATE account_deletion_requests SET state = 'blocked_legal_hold', updated_at = ? WHERE id = ?`).run(now, request.id);
      results.push({ id: request.id, status: "blocked_legal_hold" });
      continue;
    }
    const media = db.prepare(`SELECT id, hash, ext, mime, size FROM media WHERE uploaded_by = ? ORDER BY id`).all(request.user_id);
    db.prepare(`UPDATE account_deletion_requests SET state = 'purging', media_manifest_json = ?, updated_at = ? WHERE id = ?`)
      .run(JSON.stringify(media), now, request.id);
    try {
      for (const item of media) mediaPurger(item.hash, item.ext);
    } catch (error) {
      results.push({ id: request.id, status: "retryable_media_failure", error: String(error?.message || error) });
      continue;
    }
    const receiptHash = digest(JSON.stringify({ request_id: request.id, subject_hash: request.subject_hash, media, purged_at: now }));
    db.exec("BEGIN IMMEDIATE");
    try {
      transferSharedConversations(db, request.user_id);
      db.prepare(`DELETE FROM message_ciphertext_envelopes WHERE recipient_device_id IN
        (SELECT device_id FROM chat_devices WHERE user_id = ?) OR sender_device_id IN
        (SELECT device_id FROM chat_devices WHERE user_id = ?)`).run(request.user_id, request.user_id);
      db.prepare(`DELETE FROM media WHERE uploaded_by = ?`).run(request.user_id);
      db.prepare(`DELETE FROM users WHERE id = ?`).run(request.user_id);
      db.prepare(`DELETE FROM account_legal_holds WHERE user_id = ?`).run(request.user_id);
      db.prepare(`UPDATE account_deletion_requests SET user_id = NULL, state = 'purged', purged_at = ?,
        purge_receipt_hash = ?, updated_at = ? WHERE id = ?`).run(now, receiptHash, now, request.id);
      db.prepare(`INSERT INTO account_purge_tombstones (subject_hash, deletion_request_id, manifest_hash, purged_at)
        VALUES (?, ?, ?, ?) ON CONFLICT(subject_hash) DO NOTHING`).run(request.subject_hash, request.id, receiptHash, now);
      emitOutbox(db, request.id, "account.purged", { deletion_request_id: request.id, subject_hash: request.subject_hash, receipt_hash: receiptHash }, now);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      results.push({ id: request.id, status: "retryable_database_failure", error: String(error?.message || error) });
      continue;
    }
    results.push({ id: request.id, status: "purged", media_count: media.length, receipt_hash: receiptHash });
  }
  return results;
}
