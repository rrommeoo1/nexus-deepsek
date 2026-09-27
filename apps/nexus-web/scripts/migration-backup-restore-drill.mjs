// Current migration + backup/restore compatibility drill over disposable local data.
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { createVerifiedBackup, databaseStateHash, restoreVerifiedBackup } from "../lib/backup-restore.js";

export async function runMigrationBackupRestoreDrill() {
  const root = resolve(mkdtempSync(join(tmpdir(), "nexus-migration-restore-")));
  if (!root.startsWith(resolve(tmpdir()))) throw new Error("unsafe migration drill path");
  const sourcePath = join(root, "legacy.sqlite");
  const backupPath = join(root, "migrated-backup.sqlite");
  const restorePath = join(root, "restored.sqlite");
  try {
    let ids;
    const current = openDb(sourcePath);
    try {
      const repo = createRepo(current);
      const alice = repo.createUser({ handle: "systemtest_migrate_alice", displayName: "SYSTEM_TEST Alice", trafficClass: "SYSTEM_TEST" });
      const bob = repo.createUser({ handle: "systemtest_migrate_bob", displayName: "SYSTEM_TEST Bob", trafficClass: "SYSTEM_TEST" });
      const conversation = repo.createDirectConversation({ creatorId: alice.id, recipientId: bob.id, contextPersona: "social" });
      const message = repo.sendConversationMessage({ conversationId: conversation.id, senderId: alice.id, senderPersona: "social", body: "SYSTEM_TEST legacy message", clientNonce: "migration-restore-message-0001" });
      ids = { alice: alice.id, conversation: conversation.id, message: message.id };
    } finally { current.close(); }

    const legacy = new DatabaseSync(sourcePath);
    try {
      legacy.exec(`
        DROP INDEX IF EXISTS idx_conversations_key_epoch;
        ALTER TABLE users DROP COLUMN chat_key_epoch;
        ALTER TABLE conversations DROP COLUMN key_epoch;
        ALTER TABLE conversations DROP COLUMN key_epoch_changed_at;
        ALTER TABLE message_items DROP COLUMN key_epoch;
        ALTER TABLE message_items DROP COLUMN key_epoch_commitment;
        ALTER TABLE message_items DROP COLUMN encrypted_request_commitment;
      `);
    } finally { legacy.close(); }

    let backup;
    let migratedHash;
    const migrated = openDb(sourcePath);
    try {
      const conversation = migrated.prepare("SELECT * FROM conversations WHERE id = ?").get(ids.conversation);
      const message = migrated.prepare("SELECT * FROM message_items WHERE id = ?").get(ids.message);
      const columnsRestored = Number(migrated.prepare("SELECT chat_key_epoch FROM users WHERE id = ?").get(ids.alice).chat_key_epoch) === 1
        && Number(conversation.key_epoch) === 1 && Number(conversation.key_epoch_changed_at) === Number(conversation.created_at)
        && message.body === "SYSTEM_TEST legacy message" && message.key_epoch == null;
      if (!columnsRestored) throw new Error("legacy state did not migrate losslessly");
      migratedHash = databaseStateHash(migrated);
      backup = await createVerifiedBackup({ sourceDb: migrated, targetPath: backupPath });
    } finally { migrated.close(); }

    const restored = await restoreVerifiedBackup({ backupPath, restorePath, expectedStateHash: backup.state_hash });
    let restartHash;
    let restartSafe = false;
    const restarted = openDb(restorePath);
    try {
      restartHash = databaseStateHash(restarted);
      const row = restarted.prepare("SELECT body, key_epoch FROM message_items WHERE id = ?").get(ids.message);
      restartSafe = restartHash === migratedHash && row?.body === "SYSTEM_TEST legacy message" && row.key_epoch == null
        && restarted.prepare("PRAGMA integrity_check").get().integrity_check === "ok"
        && restarted.prepare("PRAGMA foreign_key_check").all().length === 0;
    } finally { restarted.close(); }

    return {
      schema: "NEXUS_MIGRATION_BACKUP_RESTORE_DRILL_V1",
      checks: {
        legacy_migrated_losslessly: true,
        backup_matches_migrated_state: backup.state_hash === migratedHash,
        restored_matches_backup: restored.identical,
        restart_is_schema_idempotent: restartSafe,
      },
      hashes: { migrated: migratedHash, backup: backup.state_hash, restored: restored.restored.state_hash, restarted: restartHash },
      integrity: restored.restored.integrity,
      foreign_key_violations: restored.restored.foreign_key_violations,
      local_synthetic_only: true, external_network: false, real_funds: false, incremental_cost: 0,
      gate: restartSafe && restored.identical && backup.state_hash === migratedHash ? "PASS_LOCAL" : "FAIL_LOCAL",
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

if (process.argv[1]?.endsWith("migration-backup-restore-drill.mjs")) {
  const report = await runMigrationBackupRestoreDrill();
  console.log(JSON.stringify(report, null, 2));
  if (report.gate !== "PASS_LOCAL") process.exitCode = 1;
}
