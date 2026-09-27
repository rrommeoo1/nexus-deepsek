import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateMediaUploadGrantsKey, openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";

const keyColumns = (db) => db.prepare(`PRAGMA table_info(media_upload_grants)`).all()
  .filter((column) => Number(column.pk) > 0)
  .sort((left, right) => Number(left.pk) - Number(right.pk))
  .map((column) => column.name);

function replaceWithLegacyGrantTable(db) {
  db.exec(`
    PRAGMA foreign_keys = OFF;
    BEGIN IMMEDIATE;
    ALTER TABLE media_upload_grants RENAME TO media_upload_grants_current;
    CREATE TABLE media_upload_grants (
      media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL,
      actor_persona TEXT NOT NULL DEFAULT 'social',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (media_id, user_id, purpose)
    );
    INSERT INTO media_upload_grants SELECT * FROM media_upload_grants_current;
    DROP TABLE media_upload_grants_current;
    COMMIT;
    PRAGMA foreign_keys = ON;
  `);
}

test("legacy media grant key migration is atomic, persona-aware and restart-safe", () => {
  const directory = mkdtempSync(join(tmpdir(), "nexus-media-grant-migration-"));
  const path = join(directory, "fixture.sqlite");
  try {
    const seeded = openDb(path);
    const repo = createRepo(seeded);
    const user = repo.createUser({ handle: "migration-owner", displayName: "Migration owner" });
    repo.ensurePersona(user.id, "social", {});
    repo.ensurePersona(user.id, "work", {});
    const media = repo.insertMedia({
      hash: "b".repeat(64), ext: "jpg", mime: "image/jpeg", detectedMime: "image/jpeg", kind: "image", size: 8,
      uploadedBy: user.id, purpose: "social_post", actorPersona: "social",
      scanStatus: "ready_local_validation", scanReason: "SYSTEM_TEST fixture",
    });
    seeded.close();

    const legacy = new DatabaseSync(path);
    legacy.exec("PRAGMA foreign_keys = ON;");
    replaceWithLegacyGrantTable(legacy);
    legacy.prepare(`INSERT INTO media_upload_grants (media_id, user_id, purpose, actor_persona) VALUES (?, ?, 'story', 'UNKNOWN')`).run(media.id, user.id);
    assert.deepEqual(keyColumns(legacy), ["media_id", "user_id", "purpose"]);

    assert.throws(
      () => migrateMediaUploadGrantsKey(legacy, { beforeCommit() { throw new Error("SYSTEM_TEST_MIGRATION_CRASH"); } }),
      /SYSTEM_TEST_MIGRATION_CRASH/,
    );
    assert.deepEqual(keyColumns(legacy), ["media_id", "user_id", "purpose"]);
    assert.equal(legacy.prepare(`SELECT COUNT(*) count FROM media_upload_grants`).get().count, 2);
    legacy.close();

    const migrated = openDb(path);
    assert.deepEqual(keyColumns(migrated), ["media_id", "user_id", "purpose", "actor_persona"]);
    assert.equal(migrated.prepare(`SELECT actor_persona FROM media_upload_grants WHERE purpose = 'story'`).get().actor_persona, "social");
    migrated.prepare(`INSERT INTO media_upload_grants (media_id, user_id, purpose, actor_persona) VALUES (?, ?, 'social_post', 'work')`).run(media.id, user.id);
    assert.throws(
      () => migrated.prepare(`INSERT INTO media_upload_grants (media_id, user_id, purpose, actor_persona) VALUES (?, ?, 'social_post', 'social')`).run(media.id, user.id),
      /constraint/i,
    );
    assert.equal(migrated.prepare(`SELECT COUNT(*) count FROM media_upload_grants WHERE media_id = ? AND purpose = 'social_post'`).get(media.id).count, 2);
    assert.deepEqual(migrated.prepare(`PRAGMA foreign_key_check`).all(), []);
    migrated.close();

    const restarted = openDb(path);
    assert.deepEqual(keyColumns(restarted), ["media_id", "user_id", "purpose", "actor_persona"]);
    assert.equal(restarted.prepare(`SELECT COUNT(*) count FROM media_upload_grants WHERE media_id = ?`).get(media.id).count, 3);
    assert.deepEqual(restarted.prepare(`PRAGMA foreign_key_check`).all(), []);
    restarted.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("legacy comments gain version/tombstone columns and immutable history on restart", () => {
  const directory = mkdtempSync(join(tmpdir(), "nexus-comment-migration-"));
  const path = join(directory, "fixture.sqlite");
  try {
    const seeded = openDb(path);
    const repo = createRepo(seeded);
    const user = repo.createUser({ handle: "comment-migration-owner", displayName: "Comment migration" });
    repo.ensurePersona(user.id, "social", { visibility: "public" });
    const post = repo.createPost({ userId: user.id, persona: "social", caption: "legacy", visibility: "public" });
    const comment = repo.addSocialComment({ userId: user.id, actorPersona: "social", postId: post.id, body: "legacy comment" });
    seeded.close();

    const legacy = new DatabaseSync(path);
    legacy.exec(`
      PRAGMA foreign_keys = OFF;
      BEGIN IMMEDIATE;
      DROP TABLE comment_versions;
      DROP TABLE comment_reactions;
      ALTER TABLE comments RENAME TO comments_current;
      CREATE TABLE comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        actor_persona TEXT NOT NULL DEFAULT 'social',
        parent_id INTEGER REFERENCES comments(id) ON DELETE SET NULL,
        body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        content_commitment TEXT,
        edited_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
      INSERT INTO comments (id, post_id, user_id, actor_persona, parent_id, body, status, content_commitment, edited_at, created_at)
      SELECT id, post_id, user_id, actor_persona, parent_id, body, status, content_commitment, edited_at, created_at FROM comments_current;
      DROP TABLE comments_current;
      COMMIT;
      PRAGMA foreign_keys = ON;
    `);
    assert.equal(legacy.prepare(`PRAGMA table_info(comments)`).all().some((column) => column.name === "version"), false);
    legacy.close();

    const migrated = openDb(path);
    const columns = new Set(migrated.prepare(`PRAGMA table_info(comments)`).all().map((column) => column.name));
    assert.equal(columns.has("version"), true);
    assert.equal(columns.has("withdrawn_at"), true);
    assert.equal(columns.has("pinned_at"), true);
    const restored = migrated.prepare(`SELECT * FROM comments WHERE id = ?`).get(comment.id);
    assert.equal(restored.body, "legacy comment");
    assert.equal(restored.version, 1);
    const version = migrated.prepare(`SELECT * FROM comment_versions WHERE comment_id = ?`).get(comment.id);
    assert.equal(version.body, "legacy comment");
    assert.equal(version.content_commitment, restored.content_commitment);
    assert.deepEqual(migrated.prepare(`PRAGMA foreign_key_check`).all(), []);
    migrated.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("legacy chat rows gain epoch bindings without rewriting historical ciphertext", () => {
  const directory = mkdtempSync(join(tmpdir(), "nexus-chat-epoch-migration-"));
  const path = join(directory, "fixture.sqlite");
  try {
    const seeded = openDb(path);
    const repo = createRepo(seeded);
    const alice = repo.createUser({ handle: "epoch-migrate-a", displayName: "Alice" });
    const bob = repo.createUser({ handle: "epoch-migrate-b", displayName: "Bob" });
    const conversation = repo.createDirectConversation({ creatorId: alice.id, recipientId: bob.id, contextPersona: "social" });
    const message = repo.sendConversationMessage({
      conversationId: conversation.id, senderId: alice.id, senderPersona: "social",
      body: "legacy row", clientNonce: "legacy-chat-epoch-row",
    });
    seeded.close();

    const legacy = new DatabaseSync(path);
    legacy.exec(`
      DROP INDEX IF EXISTS idx_conversations_key_epoch;
      ALTER TABLE users DROP COLUMN chat_key_epoch;
      ALTER TABLE conversations DROP COLUMN key_epoch;
      ALTER TABLE conversations DROP COLUMN key_epoch_changed_at;
      ALTER TABLE message_items DROP COLUMN key_epoch;
      ALTER TABLE message_items DROP COLUMN key_epoch_commitment;
      ALTER TABLE message_items DROP COLUMN encrypted_request_commitment;
    `);
    assert.equal(legacy.prepare("PRAGMA table_info(conversations)").all().some((column) => column.name === "key_epoch"), false);
    legacy.close();

    const migrated = openDb(path);
    assert.equal(migrated.prepare("SELECT chat_key_epoch FROM users WHERE id = ?").get(alice.id).chat_key_epoch, 1);
    const restoredConversation = migrated.prepare("SELECT * FROM conversations WHERE id = ?").get(conversation.id);
    assert.equal(restoredConversation.key_epoch, 1);
    assert.equal(restoredConversation.key_epoch_changed_at, restoredConversation.created_at);
    const restoredMessage = migrated.prepare("SELECT * FROM message_items WHERE id = ?").get(message.id);
    assert.equal(restoredMessage.body, "legacy row");
    assert.equal(restoredMessage.key_epoch, null);
    assert.equal(restoredMessage.key_epoch_commitment, null);
    assert.equal(restoredMessage.encrypted_request_commitment, null);
    assert.deepEqual(migrated.prepare("PRAGMA foreign_key_check").all(), []);
    migrated.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
