// Deterministic local-only recovery drill. It creates synthetic state in a
// dedicated temporary directory, backs it up, restores it into a fresh file and
// deletes the bounded drill directory. It never opens the Nexus demo database.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { createVerifiedBackup, restoreVerifiedBackup } from "../lib/backup-restore.js";

const root = mkdtempSync(join(tmpdir(), "nexus-recovery-drill-"));
const resolvedRoot = resolve(root);
if (!resolvedRoot.startsWith(resolve(tmpdir()))) throw new Error("unsafe recovery drill path");
const sourcePath = join(root, "synthetic-source.sqlite");
const backupPath = join(root, "verified-backup.sqlite");
const restorePath = join(root, "fresh-restore.sqlite");

try {
  const db = openDb(sourcePath);
  let created;
  try {
    const repo = createRepo(db);
    const user = repo.createUser({ handle: "systemtest_restore_drill", displayName: "SYSTEM_TEST Restore Drill", trafficClass: "SYSTEM_TEST" });
    repo.ensurePersona(user.id, "social", { visibility: "private" });
    repo.createPost({ userId: user.id, persona: "social", kind: "text", caption: "synthetic recovery checkpoint", visibility: "private" });
    created = await createVerifiedBackup({ sourceDb: db, targetPath: backupPath });
  } finally { db.close(); }
  const restored = await restoreVerifiedBackup({ backupPath, restorePath, expectedStateHash: created.state_hash });
  console.log(JSON.stringify({
    gate: restored.identical ? "PASS" : "FAIL",
    environment: "local_synthetic_only",
    source_state_hash: created.source_state_hash,
    backup_state_hash: created.state_hash,
    restored_state_hash: restored.restored.state_hash,
    integrity: restored.restored.integrity,
    foreign_key_violations: restored.restored.foreign_key_violations,
    demo_database_opened: false,
    external_network: false,
    real_funds: false,
    incremental_cost: 0
  }, null, 2));
  if (!restored.identical) process.exitCode = 1;
} finally {
  rmSync(resolvedRoot, { recursive: true, force: true });
}
