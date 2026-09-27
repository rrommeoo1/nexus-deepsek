import test from "node:test";
import assert from "node:assert/strict";
import { runMigrationBackupRestoreDrill } from "../scripts/migration-backup-restore-drill.mjs";

test("legacy messaging state migrates, backs up, restores and restarts losslessly", async () => {
  const report = await runMigrationBackupRestoreDrill();
  assert.equal(report.schema, "NEXUS_MIGRATION_BACKUP_RESTORE_DRILL_V1");
  assert.equal(report.gate, "PASS_LOCAL");
  assert.deepEqual(report.checks, {
    legacy_migrated_losslessly: true,
    backup_matches_migrated_state: true,
    restored_matches_backup: true,
    restart_is_schema_idempotent: true,
  });
  assert.equal(new Set(Object.values(report.hashes)).size, 1);
  assert.equal(report.integrity, "ok");
  assert.equal(report.foreign_key_violations, 0);
  assert.equal(report.external_network, false);
  assert.equal(report.real_funds, false);
  assert.equal(report.incremental_cost, 0);
});
