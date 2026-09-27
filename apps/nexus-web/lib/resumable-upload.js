import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { DATA_DIR } from "./db.js";
import { NEXUS_E2EE_ATTACHMENT_MIME, storeClientEncryptedMedia, storeMedia } from "./media.js";

export const LOCAL_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
export const LOCAL_UPLOAD_CHUNK_BYTES = 1024 * 1024;
export const LOCAL_UPLOAD_ACTIVE_QUOTA_BYTES = 100 * 1024 * 1024;
export const LOCAL_UPLOAD_ACTIVE_SESSION_LIMIT = 20;
export const UPLOAD_PART_DIR = join(DATA_DIR, "upload-parts");
export const UPLOAD_TTL_SECONDS = 24 * 60 * 60;

const PURPOSES = new Set(["social_post", "social_audio", "story", "profile_avatar", "profile_cover", "message_attachment", "message_e2ee_attachment", "watch_video", "music_master"]);
const MIMES = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "audio/mpeg", "audio/wav", "audio/ogg", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.presentationml.presentation", NEXUS_E2EE_ATTACHMENT_MIME]);

export class UploadError extends Error {
  constructor(code, status, message, retryable = false) {
    super(message);
    this.name = "UploadError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

const hash = (value) => createHash("sha256").update(value).digest("hex");
const nowSeconds = () => Math.floor(Date.now() / 1000);

function cleanIdempotencyKey(value) {
  const key = String(value ?? "").trim();
  if (key.length < 16 || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new UploadError("IDEMPOTENCY_KEY_REQUIRED", 400, "Idempotency-Key must contain 16-128 safe characters");
  }
  return key;
}

function safeUploadDirectory(root, uploadId) {
  if (!/^[a-f0-9]{32}$/.test(uploadId)) throw new UploadError("UPLOAD_NOT_FOUND", 404, "upload not found");
  const base = resolve(root);
  const target = resolve(base, uploadId);
  const relation = relative(base, target);
  if (!relation || relation.startsWith("..") || isAbsolute(relation)) throw new UploadError("UPLOAD_PATH_INVALID", 400, "upload path invalid");
  return target;
}

function publicSession(db, id, userId) {
  const row = db.prepare(`SELECT * FROM upload_sessions WHERE id = ? AND user_id = ?`).get(id, userId);
  if (!row) throw new UploadError("UPLOAD_NOT_FOUND", 404, "upload not found");
  const parts = db.prepare(`SELECT part_number, size, sha256 FROM upload_parts WHERE upload_id = ? ORDER BY part_number`).all(id);
  return {
    id: row.id, purpose: row.purpose, mime: row.mime, total_bytes: row.total_bytes,
    expected_sha256: row.expected_sha256, chunk_size: row.chunk_size,
    total_parts: row.total_parts, received_bytes: row.received_bytes,
    status: row.status, media_id: row.media_id, error_code: row.error_code,
    expires_at: row.expires_at, parts,
  };
}

export function beginResumableUpload({ db, userId, actorPersona, purpose, mime, totalBytes, expectedSha256 = null, idempotencyKey, chunkSize = LOCAL_UPLOAD_CHUNK_BYTES, now = nowSeconds() }) {
  const key = cleanIdempotencyKey(idempotencyKey);
  purpose = String(purpose ?? "").trim().toLowerCase();
  mime = String(mime ?? "").trim().toLowerCase();
  totalBytes = Number(totalBytes);
  if (!PURPOSES.has(purpose)) throw new UploadError("UPLOAD_PURPOSE_INVALID", 400, "upload purpose invalid");
  if (!MIMES.has(mime)) throw new UploadError("MEDIA_TYPE_UNSUPPORTED", 415, "media type unsupported");
  if ((purpose === "message_e2ee_attachment") !== (mime === NEXUS_E2EE_ATTACHMENT_MIME)) {
    throw new UploadError("E2EE_ATTACHMENT_BOUNDARY_INVALID", 400, "encrypted attachment purpose and MIME must be used together");
  }
  if (!Number.isSafeInteger(totalBytes) || totalBytes < 1 || totalBytes > LOCAL_UPLOAD_MAX_BYTES) {
    throw new UploadError("UPLOAD_SIZE_INVALID", 413, `local resumable upload supports 1-${LOCAL_UPLOAD_MAX_BYTES} bytes`);
  }
  expectedSha256 = expectedSha256 == null || expectedSha256 === "" ? null : String(expectedSha256).toLowerCase();
  if (expectedSha256 && !/^[a-f0-9]{64}$/.test(expectedSha256)) throw new UploadError("UPLOAD_CHECKSUM_INVALID", 400, "expected_sha256 invalid");
  chunkSize = Math.max(64 * 1024, Math.min(LOCAL_UPLOAD_CHUNK_BYTES, Number(chunkSize) || LOCAL_UPLOAD_CHUNK_BYTES));
  const fingerprint = hash(JSON.stringify({ actorPersona, purpose, mime, totalBytes, expectedSha256, chunkSize }));
  const id = randomBytes(16).toString("hex");
  const totalParts = Math.ceil(totalBytes / chunkSize);
  db.exec("BEGIN IMMEDIATE");
  try {
    const replay = db.prepare(`SELECT * FROM upload_sessions WHERE user_id = ? AND create_idempotency_key = ?`).get(userId, key);
    if (replay) {
      if (replay.request_fingerprint !== fingerprint) throw new UploadError("IDEMPOTENCY_CONFLICT", 409, "Idempotency-Key was already used with a different upload request");
      db.exec("COMMIT");
      return { ...publicSession(db, replay.id, userId), replayed: true };
    }
    db.prepare(`UPDATE upload_sessions SET status = 'expired', error_code = 'UPLOAD_EXPIRED', updated_at = ?
      WHERE user_id = ? AND status IN ('initiated','uploading') AND expires_at <= ?`).run(now, userId, now);
    const active = db.prepare(`SELECT COUNT(*) count, COALESCE(SUM(total_bytes), 0) total_bytes FROM upload_sessions
      WHERE user_id = ? AND status IN ('initiated','uploading','assembling') AND expires_at > ?`).get(userId, now);
    if (Number(active.count) >= LOCAL_UPLOAD_ACTIVE_SESSION_LIMIT || Number(active.total_bytes) + totalBytes > LOCAL_UPLOAD_ACTIVE_QUOTA_BYTES) {
      throw new UploadError("UPLOAD_QUOTA_EXCEEDED", 429, "active upload quota exceeded; cancel or finish an existing upload");
    }
    db.prepare(`INSERT INTO upload_sessions
      (id, user_id, actor_persona, purpose, mime, total_bytes, expected_sha256, chunk_size, total_parts, create_idempotency_key, request_fingerprint, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, userId, actorPersona, purpose, mime, totalBytes, expectedSha256, chunkSize, totalParts, key, fingerprint, now + UPLOAD_TTL_SECONDS, now, now);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { ...publicSession(db, id, userId), replayed: false };
}

export function getResumableUpload({ db, userId, uploadId, now = nowSeconds() }) {
  const session = publicSession(db, uploadId, userId);
  if (session.expires_at <= now && !new Set(["completed", "cancelled", "failed", "expired"]).has(session.status)) {
    db.prepare(`UPDATE upload_sessions SET status = 'expired', error_code = 'UPLOAD_EXPIRED', updated_at = ? WHERE id = ?`).run(now, uploadId);
    session.status = "expired";
    session.error_code = "UPLOAD_EXPIRED";
  }
  return session;
}

export function putResumablePart({ db, userId, uploadId, partNumber, bytes, idempotencyKey, storageRoot = UPLOAD_PART_DIR, now = nowSeconds() }) {
  const key = cleanIdempotencyKey(idempotencyKey);
  const session = getResumableUpload({ db, userId, uploadId, now });
  if (!new Set(["initiated", "uploading"]).has(session.status)) throw new UploadError("UPLOAD_STATE_CONFLICT", 409, `cannot add a part while upload is ${session.status}`);
  partNumber = Number(partNumber);
  if (!Number.isSafeInteger(partNumber) || partNumber < 0 || partNumber >= session.total_parts) throw new UploadError("UPLOAD_PART_INVALID", 400, "part number invalid");
  if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes ?? "");
  const expectedSize = partNumber === session.total_parts - 1 ? session.total_bytes - (session.chunk_size * partNumber) : session.chunk_size;
  if (bytes.length !== expectedSize) throw new UploadError("UPLOAD_PART_SIZE_MISMATCH", 400, `part ${partNumber} must contain exactly ${expectedSize} bytes`);
  const partHash = hash(bytes);
  const existing = db.prepare(`SELECT * FROM upload_parts WHERE upload_id = ? AND part_number = ?`).get(uploadId, partNumber);
  if (existing) {
    if (existing.idempotency_key !== key || existing.sha256 !== partHash || existing.size !== bytes.length) throw new UploadError("IDEMPOTENCY_CONFLICT", 409, "part already exists with different bytes or Idempotency-Key");
    return { upload: getResumableUpload({ db, userId, uploadId, now }), part: existing, replayed: true };
  }
  const reusedKey = db.prepare(`SELECT part_number, sha256 FROM upload_parts WHERE upload_id = ? AND idempotency_key = ?`).get(uploadId, key);
  if (reusedKey) throw new UploadError("IDEMPOTENCY_CONFLICT", 409, "Idempotency-Key was already used for another part");
  const directory = safeUploadDirectory(storageRoot, uploadId);
  mkdirSync(directory, { recursive: true });
  const filePath = join(directory, `${partNumber}.part`);
  try {
    writeFileSync(filePath, bytes, { flag: "wx" });
  } catch (error) {
    if (!existsSync(filePath) || hash(readFileSync(filePath)) !== partHash) throw new UploadError("UPLOAD_PART_WRITE_FAILED", 503, "part storage failed", true);
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`INSERT INTO upload_parts (upload_id, part_number, size, sha256, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(uploadId, partNumber, bytes.length, partHash, key, now);
    db.prepare(`UPDATE upload_sessions SET received_bytes = received_bytes + ?, status = 'uploading', updated_at = ? WHERE id = ?`)
      .run(bytes.length, now, uploadId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    rmSync(filePath, { force: true });
    throw error;
  }
  return { upload: getResumableUpload({ db, userId, uploadId, now }), part: { part_number: partNumber, size: bytes.length, sha256: partHash }, replayed: false };
}

export function completeResumableUpload({ db, repo, userId, uploadId, idempotencyKey, storageRoot = UPLOAD_PART_DIR, mediaStore = storeMedia, encryptedMediaStore = storeClientEncryptedMedia, now = nowSeconds() }) {
  const key = cleanIdempotencyKey(idempotencyKey);
  let row = db.prepare(`SELECT * FROM upload_sessions WHERE id = ? AND user_id = ?`).get(uploadId, userId);
  if (!row) throw new UploadError("UPLOAD_NOT_FOUND", 404, "upload not found");
  if (row.status === "completed") {
    if (row.completion_idempotency_key !== key) throw new UploadError("IDEMPOTENCY_CONFLICT", 409, "completion already used another Idempotency-Key");
    return { upload: publicSession(db, uploadId, userId), media: repo.getMediaById(row.media_id), replayed: true };
  }
  if (!new Set(["initiated", "uploading"]).has(row.status)) throw new UploadError("UPLOAD_STATE_CONFLICT", 409, `cannot complete upload while it is ${row.status}`);
  if (row.expires_at <= now) throw new UploadError("UPLOAD_EXPIRED", 410, "upload expired");
  const parts = db.prepare(`SELECT * FROM upload_parts WHERE upload_id = ? ORDER BY part_number`).all(uploadId);
  if (parts.length !== row.total_parts || Number(row.received_bytes) !== Number(row.total_bytes) || parts.some((part, index) => part.part_number !== index)) {
    throw new UploadError("UPLOAD_INCOMPLETE", 409, "upload is incomplete", true);
  }
  const acquired = db.prepare(`UPDATE upload_sessions SET status = 'assembling', completion_idempotency_key = ?, updated_at = ? WHERE id = ? AND status IN ('initiated','uploading')`).run(key, now, uploadId);
  if (acquired.changes !== 1) throw new UploadError("UPLOAD_ASSEMBLY_BUSY", 409, "upload assembly is already running", true);
  try {
    const directory = safeUploadDirectory(storageRoot, uploadId);
    const buffers = parts.map((part) => {
      const bytes = readFileSync(join(directory, `${part.part_number}.part`));
      if (bytes.length !== part.size || hash(bytes) !== part.sha256) throw new UploadError("UPLOAD_PART_INTEGRITY_FAILED", 409, `part ${part.part_number} failed integrity validation`);
      return bytes;
    });
    const payload = Buffer.concat(buffers);
    const assembledHash = hash(payload);
    if (payload.length !== row.total_bytes || (row.expected_sha256 && row.expected_sha256 !== assembledHash)) throw new UploadError("UPLOAD_CHECKSUM_MISMATCH", 409, "assembled upload checksum mismatch");
    const stored = row.purpose === "message_e2ee_attachment"
      ? encryptedMediaStore(payload, row.mime)
      : mediaStore(payload, row.mime);
    const media = repo.insertMedia({ ...stored, uploadedBy: userId, purpose: row.purpose, actorPersona: row.actor_persona });
    if (!media) throw new UploadError("MEDIA_BOUNDARY_CONFLICT", 409, "identical media conflicts with an existing upload boundary");
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(`UPDATE upload_sessions SET status = 'completed', media_id = ?, error_code = NULL, updated_at = ? WHERE id = ? AND status = 'assembling'`).run(media.id, now, uploadId);
      db.prepare(`INSERT OR IGNORE INTO outbox_events (aggregate_type, aggregate_id, event_type, payload_json, status, available_at, created_at) VALUES ('upload', ?, 'media.upload.completed', ?, 'pending', ?, ?)`)
        .run(uploadId, JSON.stringify({ uploadId, mediaId: media.id }), now, now);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    rmSync(directory, { recursive: true, force: true });
    return { upload: publicSession(db, uploadId, userId), media, replayed: false };
  } catch (error) {
    const code = error instanceof UploadError ? error.code : "UPLOAD_ASSEMBLY_FAILED";
    const terminal = new Set(["UPLOAD_PART_INTEGRITY_FAILED", "UPLOAD_CHECKSUM_MISMATCH", "MEDIA_BOUNDARY_CONFLICT"]).has(code);
    db.prepare(`UPDATE upload_sessions SET status = ?, completion_idempotency_key = ?, error_code = ?, updated_at = ? WHERE id = ? AND status = 'assembling'`)
      .run(terminal ? "failed" : "uploading", terminal ? key : null, code, now, uploadId);
    if (error instanceof UploadError) throw error;
    throw new UploadError("UPLOAD_ASSEMBLY_FAILED", 503, "upload assembly failed; retry with the same Idempotency-Key", true);
  }
}

export function cancelResumableUpload({ db, userId, uploadId, idempotencyKey, storageRoot = UPLOAD_PART_DIR, now = nowSeconds() }) {
  const key = cleanIdempotencyKey(idempotencyKey);
  const row = db.prepare(`SELECT * FROM upload_sessions WHERE id = ? AND user_id = ?`).get(uploadId, userId);
  if (!row) throw new UploadError("UPLOAD_NOT_FOUND", 404, "upload not found");
  if (row.status === "completed") throw new UploadError("UPLOAD_STATE_CONFLICT", 409, "completed upload cannot be cancelled");
  if (row.status === "cancelled") {
    if (row.cancellation_idempotency_key !== key) throw new UploadError("IDEMPOTENCY_CONFLICT", 409, "cancellation already used another Idempotency-Key");
    return { ...publicSession(db, uploadId, userId), replayed: true };
  }
  db.prepare(`UPDATE upload_sessions SET status = 'cancelled', cancellation_idempotency_key = ?, updated_at = ? WHERE id = ?`).run(key, now, uploadId);
  const directory = safeUploadDirectory(storageRoot, uploadId);
  rmSync(directory, { recursive: true, force: true });
  return { ...publicSession(db, uploadId, userId), replayed: false };
}

export function cleanupExpiredResumableUploads({ db, storageRoot = UPLOAD_PART_DIR, now = nowSeconds(), limit = 100, dryRun = true } = {}) {
  const bounded = Math.max(1, Math.min(Number(limit) || 100, 500));
  const candidates = db.prepare(`SELECT id, user_id, received_bytes, status FROM upload_sessions
    WHERE expires_at <= ? AND status IN ('initiated','uploading','failed','expired')
    ORDER BY expires_at, id LIMIT ?`).all(now, bounded);
  if (dryRun) return { dry_run: true, candidates: candidates.length, reclaimed_bytes: candidates.reduce((sum, row) => sum + Number(row.received_bytes || 0), 0), cleaned: 0 };
  let cleaned = 0;
  let reclaimedBytes = 0;
  for (const row of candidates) {
    const changed = db.prepare(`UPDATE upload_sessions SET status = 'expired', error_code = 'UPLOAD_EXPIRED', received_bytes = 0, updated_at = ?
      WHERE id = ? AND user_id = ? AND status IN ('initiated','uploading','failed','expired')`).run(now, row.id, row.user_id);
    if (changed.changes !== 1) continue;
    rmSync(safeUploadDirectory(storageRoot, row.id), { recursive: true, force: true });
    reclaimedBytes += Number(row.received_bytes || 0);
    cleaned += 1;
  }
  return { dry_run: false, candidates: candidates.length, reclaimed_bytes: reclaimedBytes, cleaned };
}
