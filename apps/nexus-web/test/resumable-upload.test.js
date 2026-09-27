import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import {
  UploadError, beginResumableUpload, cancelResumableUpload, cleanupExpiredResumableUploads, completeResumableUpload,
  getResumableUpload, LOCAL_UPLOAD_ACTIVE_QUOTA_BYTES, putResumablePart,
} from "../lib/resumable-upload.js";
import { NEXUS_E2EE_ATTACHMENT_MAGIC, NEXUS_E2EE_ATTACHMENT_MIME } from "../lib/media.js";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const key = (suffix) => `nexus-upload-${suffix}-0001`;

function fakeMediaStore(payload, mime) {
  return {
    hash: sha256(payload), ext: "jpg", mime, kind: "image", size: payload.length,
    scanStatus: "ready_local_validation", scanReason: "test_signature",
    detectedMime: mime, filePath: "test-only",
  };
}

function fakeEncryptedMediaStore(payload, mime) {
  assert.equal(mime, NEXUS_E2EE_ATTACHMENT_MIME);
  assert.equal(payload.subarray(0, NEXUS_E2EE_ATTACHMENT_MAGIC.length).equals(NEXUS_E2EE_ATTACHMENT_MAGIC), true);
  return {
    hash: sha256(payload), ext: "nxenc", mime, kind: "encrypted", size: payload.length,
    scanStatus: "ready_client_encrypted", scanReason: "ciphertext_not_server_scannable",
    detectedMime: null, filePath: "test-only",
  };
}

test("E2EE attachment upload binds opaque MIME to purpose and remains resumable without a false malware-scan claim", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const storageRoot = mkdtempSync(join(tmpdir(), "nexus-upload-e2ee-"));
  try {
    const owner = repo.createUser({ handle: "e2ee-upload-owner", displayName: "E2EE upload owner" });
    repo.ensurePersona(owner.id, "social", {});
    const ciphertext = Buffer.concat([NEXUS_E2EE_ATTACHMENT_MAGIC, Buffer.alloc(90_000, 77)]);
    assert.throws(() => beginResumableUpload({
      db, userId: owner.id, actorPersona: "social", purpose: "message_e2ee_attachment",
      mime: "image/jpeg", totalBytes: ciphertext.length, idempotencyKey: key("e2ee-wrong-mime"),
    }), (error) => error.code === "E2EE_ATTACHMENT_BOUNDARY_INVALID");
    assert.throws(() => beginResumableUpload({
      db, userId: owner.id, actorPersona: "social", purpose: "message_attachment",
      mime: NEXUS_E2EE_ATTACHMENT_MIME, totalBytes: ciphertext.length, idempotencyKey: key("e2ee-wrong-purpose"),
    }), (error) => error.code === "E2EE_ATTACHMENT_BOUNDARY_INVALID");
    const upload = beginResumableUpload({
      db, userId: owner.id, actorPersona: "social", purpose: "message_e2ee_attachment",
      mime: NEXUS_E2EE_ATTACHMENT_MIME, totalBytes: ciphertext.length, expectedSha256: sha256(ciphertext),
      idempotencyKey: key("e2ee-create"), chunkSize: 64 * 1024,
    });
    for (let part = 0; part < upload.total_parts; part += 1) {
      const start = part * upload.chunk_size;
      putResumablePart({
        db, userId: owner.id, uploadId: upload.id, partNumber: part,
        bytes: ciphertext.subarray(start, Math.min(start + upload.chunk_size, ciphertext.length)),
        idempotencyKey: key(`e2ee-part-${part}`), storageRoot,
      });
    }
    const completed = completeResumableUpload({
      db, repo, userId: owner.id, uploadId: upload.id, idempotencyKey: key("e2ee-complete"),
      storageRoot, encryptedMediaStore: fakeEncryptedMediaStore,
    });
    assert.equal(completed.media.scan_status, "ready_client_encrypted");
    assert.equal(completed.media.scan_reason, "ciphertext_not_server_scannable");
    assert.equal(repo.hasMediaUploadGrant(completed.media.id, owner.id, "message_e2ee_attachment", "social"), true);
    assert.equal(completeResumableUpload({
      db, repo, userId: owner.id, uploadId: upload.id, idempotencyKey: key("e2ee-complete"), storageRoot,
      encryptedMediaStore: () => { throw new Error("must not rerun"); },
    }).replayed, true);
  } finally {
    db.close();
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("resumable upload survives interruption, rejects conflicting retries and completes once with outbox", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const storageRoot = mkdtempSync(join(tmpdir(), "nexus-upload-test-"));
  try {
    const owner = repo.createUser({ handle: "upload-owner", displayName: "Owner" });
    const stranger = repo.createUser({ handle: "upload-stranger", displayName: "Stranger" });
    repo.ensurePersona(owner.id, "social", {});
    repo.ensurePersona(owner.id, "work", {});
    repo.ensurePersona(stranger.id, "social", {});
    const bytes = Buffer.concat([Buffer.from("ffd8ffe0", "hex"), Buffer.alloc(160_000, 7)]);
    const create = beginResumableUpload({
      db, userId: owner.id, actorPersona: "social", purpose: "social_post",
      mime: "image/jpeg", totalBytes: bytes.length, expectedSha256: sha256(bytes),
      idempotencyKey: key("create"), chunkSize: 64 * 1024,
    });
    assert.equal(create.replayed, false);
    assert.equal(create.total_parts, 3);

    const replayCreate = beginResumableUpload({
      db, userId: owner.id, actorPersona: "social", purpose: "social_post",
      mime: "image/jpeg", totalBytes: bytes.length, expectedSha256: sha256(bytes),
      idempotencyKey: key("create"), chunkSize: 64 * 1024,
    });
    assert.equal(replayCreate.id, create.id);
    assert.equal(replayCreate.replayed, true);
    assert.throws(() => beginResumableUpload({
      db, userId: owner.id, actorPersona: "social", purpose: "story", mime: "image/jpeg",
      totalBytes: bytes.length, expectedSha256: sha256(bytes), idempotencyKey: key("create"), chunkSize: 64 * 1024,
    }), (error) => error instanceof UploadError && error.code === "IDEMPOTENCY_CONFLICT");

    const first = bytes.subarray(0, create.chunk_size);
    const firstPut = putResumablePart({ db, userId: owner.id, uploadId: create.id, partNumber: 0, bytes: first, idempotencyKey: key("part-0"), storageRoot });
    assert.equal(firstPut.replayed, false);
    assert.equal(getResumableUpload({ db, userId: owner.id, uploadId: create.id }).received_bytes, first.length);
    assert.throws(() => getResumableUpload({ db, userId: stranger.id, uploadId: create.id }), (error) => error.code === "UPLOAD_NOT_FOUND");

    const resumed = putResumablePart({ db, userId: owner.id, uploadId: create.id, partNumber: 0, bytes: first, idempotencyKey: key("part-0"), storageRoot });
    assert.equal(resumed.replayed, true);
    assert.equal(resumed.upload.received_bytes, first.length);
    assert.throws(() => putResumablePart({ db, userId: owner.id, uploadId: create.id, partNumber: 0, bytes: first, idempotencyKey: key("wrong-key"), storageRoot }), (error) => error.code === "IDEMPOTENCY_CONFLICT");

    for (let part = 1; part < create.total_parts; part++) {
      const start = part * create.chunk_size;
      putResumablePart({ db, userId: owner.id, uploadId: create.id, partNumber: part, bytes: bytes.subarray(start, Math.min(start + create.chunk_size, bytes.length)), idempotencyKey: key(`part-${part}`), storageRoot });
    }
    const completed = completeResumableUpload({ db, repo, userId: owner.id, uploadId: create.id, idempotencyKey: key("complete"), storageRoot, mediaStore: fakeMediaStore });
    assert.equal(completed.upload.status, "completed");
    assert.equal(completed.media.hash, sha256(bytes));
    assert.equal(repo.hasMediaUploadGrant(completed.media.id, owner.id, "social_post", "social"), true);
    assert.equal(repo.hasMediaUploadGrant(completed.media.id, owner.id, "social_post", "work"), false);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM outbox_events WHERE aggregate_id = ? AND event_type = 'media.upload.completed'`).get(create.id).count, 1);

    const replayComplete = completeResumableUpload({ db, repo, userId: owner.id, uploadId: create.id, idempotencyKey: key("complete"), storageRoot, mediaStore: () => { throw new Error("must not run"); } });
    assert.equal(replayComplete.replayed, true);
    assert.equal(replayComplete.media.id, completed.media.id);
  } finally {
    db.close();
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("resumable upload cancellation is idempotent and fail-closed", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const storageRoot = mkdtempSync(join(tmpdir(), "nexus-upload-cancel-"));
  try {
    const owner = repo.createUser({ handle: "cancel-owner", displayName: "Owner" });
    repo.ensurePersona(owner.id, "social", {});
    const upload = beginResumableUpload({ db, userId: owner.id, actorPersona: "social", purpose: "story", mime: "image/jpeg", totalBytes: 70_000, idempotencyKey: key("cancel-create"), chunkSize: 64 * 1024 });
    const cancelled = cancelResumableUpload({ db, userId: owner.id, uploadId: upload.id, idempotencyKey: key("cancel"), storageRoot });
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelResumableUpload({ db, userId: owner.id, uploadId: upload.id, idempotencyKey: key("cancel"), storageRoot }).replayed, true);
    assert.throws(() => putResumablePart({ db, userId: owner.id, uploadId: upload.id, partNumber: 0, bytes: Buffer.alloc(64 * 1024), idempotencyKey: key("cancel-part"), storageRoot }), (error) => error.code === "UPLOAD_STATE_CONFLICT");
  } finally {
    db.close();
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("active upload quota is atomic and cancellation immediately restores capacity", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const storageRoot = mkdtempSync(join(tmpdir(), "nexus-upload-quota-"));
  try {
    const owner = repo.createUser({ handle: "quota-owner", displayName: "Owner" });
    repo.ensurePersona(owner.id, "social", {});
    const sessions = [];
    for (let index = 0; index < 5; index++) sessions.push(beginResumableUpload({
      db, userId: owner.id, actorPersona: "social", purpose: "story", mime: "video/mp4",
      totalBytes: 20 * 1024 * 1024, idempotencyKey: key(`quota-${index}`), now: 100,
    }));
    assert.equal(LOCAL_UPLOAD_ACTIVE_QUOTA_BYTES, 100 * 1024 * 1024);
    assert.throws(() => beginResumableUpload({
      db, userId: owner.id, actorPersona: "social", purpose: "story", mime: "image/jpeg",
      totalBytes: 1, idempotencyKey: key("quota-over"), now: 100,
    }), (error) => error.code === "UPLOAD_QUOTA_EXCEEDED" && error.status === 429);
    cancelResumableUpload({ db, userId: owner.id, uploadId: sessions[0].id, idempotencyKey: key("quota-cancel"), storageRoot, now: 101 });
    const recovered = beginResumableUpload({
      db, userId: owner.id, actorPersona: "social", purpose: "story", mime: "image/jpeg",
      totalBytes: 1, idempotencyKey: key("quota-recovered"), now: 101,
    });
    assert.equal(recovered.status, "initiated");
  } finally {
    db.close();
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("expired upload cleanup is dry-run by default and reclaims only an explicit bounded execution", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const storageRoot = mkdtempSync(join(tmpdir(), "nexus-upload-cleanup-"));
  try {
    const owner = repo.createUser({ handle: "cleanup-owner", displayName: "Owner" });
    repo.ensurePersona(owner.id, "social", {});
    const upload = beginResumableUpload({ db, userId: owner.id, actorPersona: "social", purpose: "story", mime: "image/jpeg", totalBytes: 64 * 1024, idempotencyKey: key("cleanup-create"), chunkSize: 64 * 1024, now: 100 });
    putResumablePart({ db, userId: owner.id, uploadId: upload.id, partNumber: 0, bytes: Buffer.alloc(64 * 1024), idempotencyKey: key("cleanup-part"), storageRoot, now: 200 });
    const partPath = join(storageRoot, upload.id, "0.part");
    assert.equal(existsSync(partPath), true);
    const preview = cleanupExpiredResumableUploads({ db, storageRoot, now: 100 + 24 * 60 * 60 + 1 });
    assert.deepEqual(preview, { dry_run: true, candidates: 1, reclaimed_bytes: 64 * 1024, cleaned: 0 });
    assert.equal(existsSync(partPath), true);
    const executed = cleanupExpiredResumableUploads({ db, storageRoot, now: 100 + 24 * 60 * 60 + 1, dryRun: false });
    assert.deepEqual(executed, { dry_run: false, candidates: 1, reclaimed_bytes: 64 * 1024, cleaned: 1 });
    assert.equal(existsSync(partPath), false);
    assert.equal(getResumableUpload({ db, userId: owner.id, uploadId: upload.id, now: 100 + 24 * 60 * 60 + 1 }).received_bytes, 0);
  } finally {
    db.close();
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("100 SYSTEM_TEST actors interleave resumable uploads without cross-owner leaks or duplicate outbox events", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const storageRoot = mkdtempSync(join(tmpdir(), "nexus-upload-actors-"));
  try {
    const actors = Array.from({ length: 100 }, (_, index) => {
      const user = repo.createUser({
        handle: `systemtest_upload_${String(index).padStart(3, "0")}`,
        displayName: `SYSTEM_TEST upload ${index}`,
        trafficClass: "SYSTEM_TEST",
      });
      repo.ensurePersona(user.id, "social", {});
      const bytes = Buffer.concat([Buffer.from("ffd8ffe0", "hex"), Buffer.alloc(70_000 + index, index % 251)]);
      const upload = beginResumableUpload({
        db, userId: user.id, actorPersona: "social", purpose: "social_post",
        mime: "image/jpeg", totalBytes: bytes.length, expectedSha256: sha256(bytes),
        idempotencyKey: `systemtest-create-${String(index).padStart(4, "0")}`,
        chunkSize: 64 * 1024,
      });
      return { user, bytes, upload };
    });

    // First wave intentionally stops after one part. This models an interrupted client fleet.
    for (const [index, actor] of actors.entries()) {
      const first = actor.bytes.subarray(0, actor.upload.chunk_size);
      const partKey = `systemtest-part-${String(index).padStart(4, "0")}-0`;
      putResumablePart({ db, userId: actor.user.id, uploadId: actor.upload.id, partNumber: 0, bytes: first, idempotencyKey: partKey, storageRoot });
      if (index % 5 === 0) {
        assert.equal(putResumablePart({ db, userId: actor.user.id, uploadId: actor.upload.id, partNumber: 0, bytes: first, idempotencyKey: partKey, storageRoot }).replayed, true);
      }
    }

    // Resume in reverse order so that storage and DB state are interleaved across owners.
    for (const [reverseIndex, actor] of [...actors].reverse().entries()) {
      const index = actors.length - reverseIndex - 1;
      for (let part = 1; part < actor.upload.total_parts; part++) {
        const start = part * actor.upload.chunk_size;
        putResumablePart({
          db, userId: actor.user.id, uploadId: actor.upload.id, partNumber: part,
          bytes: actor.bytes.subarray(start, Math.min(start + actor.upload.chunk_size, actor.bytes.length)),
          idempotencyKey: `systemtest-part-${String(index).padStart(4, "0")}-${part}`,
          storageRoot,
        });
      }
      completeResumableUpload({
        db, repo, userId: actor.user.id, uploadId: actor.upload.id,
        idempotencyKey: `systemtest-complete-${String(index).padStart(4, "0")}`,
        storageRoot, mediaStore: fakeMediaStore,
      });
    }

    assert.equal(db.prepare(`SELECT COUNT(*) count FROM upload_sessions WHERE status = 'completed'`).get().count, 100);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM outbox_events WHERE event_type = 'media.upload.completed'`).get().count, 100);
    assert.equal(db.prepare(`SELECT COUNT(*) count FROM users WHERE traffic_class = 'SYSTEM_TEST'`).get().count, 100);
    assert.throws(
      () => getResumableUpload({ db, userId: actors[1].user.id, uploadId: actors[0].upload.id }),
      (error) => error.code === "UPLOAD_NOT_FOUND",
    );
  } finally {
    db.close();
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("transient assembly failure remains retryable with the same completion key", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const storageRoot = mkdtempSync(join(tmpdir(), "nexus-upload-retry-"));
  try {
    const owner = repo.createUser({ handle: "systemtest_retry_owner", displayName: "SYSTEM_TEST retry", trafficClass: "SYSTEM_TEST" });
    repo.ensurePersona(owner.id, "social", {});
    const bytes = Buffer.concat([Buffer.from("ffd8ffe0", "hex"), Buffer.alloc(70_000, 11)]);
    const upload = beginResumableUpload({ db, userId: owner.id, actorPersona: "social", purpose: "social_post", mime: "image/jpeg", totalBytes: bytes.length, expectedSha256: sha256(bytes), idempotencyKey: key("retry-create"), chunkSize: 64 * 1024 });
    for (let part = 0; part < upload.total_parts; part++) {
      const start = part * upload.chunk_size;
      putResumablePart({ db, userId: owner.id, uploadId: upload.id, partNumber: part, bytes: bytes.subarray(start, Math.min(start + upload.chunk_size, bytes.length)), idempotencyKey: key(`retry-part-${part}`), storageRoot });
    }
    assert.throws(
      () => completeResumableUpload({ db, repo, userId: owner.id, uploadId: upload.id, idempotencyKey: key("retry-complete"), storageRoot, mediaStore: () => { throw new Error("temporary storage fault"); } }),
      (error) => error.code === "UPLOAD_ASSEMBLY_FAILED" && error.retryable,
    );
    assert.equal(getResumableUpload({ db, userId: owner.id, uploadId: upload.id }).status, "uploading");
    assert.equal(completeResumableUpload({ db, repo, userId: owner.id, uploadId: upload.id, idempotencyKey: key("retry-complete"), storageRoot, mediaStore: fakeMediaStore }).upload.status, "completed");
  } finally {
    db.close();
    rmSync(storageRoot, { recursive: true, force: true });
  }
});
