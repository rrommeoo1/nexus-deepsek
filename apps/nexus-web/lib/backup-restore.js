import { DatabaseSync, backup } from "node:sqlite";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";

function canonicalValue(value) {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return { blob_hex: Buffer.from(value).toString("hex") };
  if (typeof value === "bigint") return value.toString();
  return value;
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function databaseStateHash(db) {
  const digest = createHash("sha256");
  const objects = db.prepare(`SELECT type, name, sql FROM sqlite_master
    WHERE name NOT LIKE 'sqlite_%' AND type IN ('table','index','trigger','view')
    ORDER BY type, name`).all();
  digest.update(JSON.stringify(objects));
  const tables = objects.filter((item) => item.type === "table").map((item) => item.name);
  for (const table of tables) {
    digest.update(`\0table:${table}\0`);
    const rows = db.prepare(`SELECT * FROM ${quoteIdentifier(table)} ORDER BY rowid`).all();
    for (const row of rows) {
      digest.update(JSON.stringify(Object.fromEntries(Object.entries(row).map(([key, value]) => [key, canonicalValue(value)]))));
      digest.update("\n");
    }
  }
  return digest.digest("hex");
}

function verifyDatabase(path, expectedStateHash = null) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const integrity = db.prepare(`PRAGMA integrity_check`).get().integrity_check;
    if (integrity !== "ok") throw new Error(`backup integrity failed: ${integrity}`);
    const stateHash = databaseStateHash(db);
    if (expectedStateHash && stateHash !== expectedStateHash) throw new Error("restored state hash mismatch");
    return {
      integrity,
      state_hash: stateHash,
      foreign_key_violations: db.prepare(`PRAGMA foreign_key_check`).all().length,
      user_tables: db.prepare(`SELECT count(*) count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).get().count,
    };
  } finally { db.close(); }
}

export async function createVerifiedBackup({ sourceDb, targetPath }) {
  if (!sourceDb || typeof sourceDb.prepare !== "function") throw new Error("open source database required");
  if (existsSync(targetPath)) throw new Error("backup target already exists");
  const sourceStateHash = databaseStateHash(sourceDb);
  await backup(sourceDb, targetPath);
  const verification = verifyDatabase(targetPath, sourceStateHash);
  if (verification.foreign_key_violations !== 0) throw new Error("backup contains foreign key violations");
  return { path: targetPath, source_state_hash: sourceStateHash, ...verification };
}

export async function restoreVerifiedBackup({ backupPath, restorePath, expectedStateHash }) {
  if (!existsSync(backupPath)) throw new Error("backup source missing");
  if (existsSync(restorePath)) throw new Error("restore target already exists");
  const source = new DatabaseSync(backupPath, { readOnly: true });
  try {
    const backupVerification = verifyDatabase(backupPath, expectedStateHash);
    await backup(source, restorePath);
    const restored = verifyDatabase(restorePath, backupVerification.state_hash);
    if (restored.foreign_key_violations !== 0) throw new Error("restored database contains foreign key violations");
    return { backup: backupVerification, restored, identical: restored.state_hash === backupVerification.state_hash };
  } finally { source.close(); }
}
