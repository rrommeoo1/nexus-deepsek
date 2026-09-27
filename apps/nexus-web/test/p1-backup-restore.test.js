import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { createVerifiedBackup, databaseStateHash, restoreVerifiedBackup } from "../lib/backup-restore.js";

function tempFixture() {
  const root = mkdtempSync(join(tmpdir(), "nexus-backup-test-"));
  const resolved = resolve(root);
  if (!resolved.startsWith(resolve(tmpdir()))) throw new Error("unsafe test temp path");
  return { root: resolved, source: join(resolved, "source.sqlite"), backup: join(resolved, "backup.sqlite"), restored: join(resolved, "restored.sqlite") };
}

test("verified backup restores an identical current-schema state into a fresh database", async () => {
  const paths = tempFixture();
  try {
    const db = openDb(paths.source);
    let created;
    try {
      const repo = createRepo(db);
      const user = repo.createUser({ handle: "systemtest_backup", displayName: "SYSTEM_TEST Backup", trafficClass: "SYSTEM_TEST" });
      repo.ensurePersona(user.id, "social", { visibility: "private" });
      repo.createPost({ userId: user.id, persona: "social", kind: "text", caption: "recovery payload", visibility: "private" });
      created = await createVerifiedBackup({ sourceDb: db, targetPath: paths.backup });
      assert.equal(created.source_state_hash, databaseStateHash(db));
    } finally { db.close(); }
    const result = await restoreVerifiedBackup({ backupPath: paths.backup, restorePath: paths.restored, expectedStateHash: created.state_hash });
    assert.equal(result.identical, true);
    assert.equal(result.restored.integrity, "ok");
    assert.equal(result.restored.foreign_key_violations, 0);
    const restored = openDb(paths.restored);
    try {
      assert.equal(restored.prepare(`SELECT caption FROM posts`).get().caption, "recovery payload");
      assert.equal(databaseStateHash(restored), created.state_hash);
    } finally { restored.close(); }
  } finally { rmSync(paths.root, { recursive: true, force: true }); }
});

test("restore rejects a modified backup and never overwrites an existing target", async () => {
  const paths = tempFixture();
  try {
    const db = openDb(paths.source);
    let created;
    try {
      const repo = createRepo(db);
      repo.createUser({ handle: "systemtest_tamper", displayName: "SYSTEM_TEST Tamper", trafficClass: "SYSTEM_TEST" });
      created = await createVerifiedBackup({ sourceDb: db, targetPath: paths.backup });
    } finally { db.close(); }
    const tampered = new DatabaseSync(paths.backup);
    tampered.prepare(`UPDATE users SET display_name = 'tampered'`).run();
    tampered.close();
    await assert.rejects(restoreVerifiedBackup({ backupPath: paths.backup, restorePath: paths.restored, expectedStateHash: created.state_hash }), /state hash mismatch/);
    const occupied = new DatabaseSync(paths.restored); occupied.close();
    await assert.rejects(restoreVerifiedBackup({ backupPath: paths.backup, restorePath: paths.restored, expectedStateHash: null }), /target already exists/);
  } finally { rmSync(paths.root, { recursive: true, force: true }); }
});
