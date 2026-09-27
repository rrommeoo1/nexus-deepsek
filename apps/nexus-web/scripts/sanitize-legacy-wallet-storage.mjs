import { DatabaseSync } from "node:sqlite";
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(join(scriptDir, "..", "data", "nexus.sqlite"));
const expectedDbPath = resolve(join(scriptDir, "..", "data", "nexus.sqlite"));
const execute = process.argv.includes("--execute");
const operationId = "NX-WEB-AUTH-P01-LEGACY-STORAGE-SANITIZE-20260823";
const executionToolSha256 = "e45339895995d6098310767ae69d9779dade46e1a274090a8461eb5154872a74";

if (dbPath !== expectedDbPath) throw new Error("LEGACY_STORAGE_DB_TARGET_MISMATCH");
if (!existsSync(dbPath)) throw new Error("LEGACY_STORAGE_DB_NOT_FOUND");
if (execute) throw new Error("LEGACY_STORAGE_SANITIZE_RETIRED");

const db = new DatabaseSync(dbPath);
let result;
let receiptCompletedAt = 0;
try {
  db.exec("PRAGMA secure_delete = ON;");
  const before = Number(db.prepare("SELECT COUNT(*) AS count FROM wallets").get()?.count ?? -1);
  if (before !== 0) throw new Error("LEGACY_STORAGE_LOGICAL_ROWS_REMAIN");
  const integrityBefore = String(db.prepare("PRAGMA integrity_check").get()?.integrity_check ?? "");
  if (integrityBefore !== "ok") throw new Error("LEGACY_STORAGE_INTEGRITY_BEFORE_FAILED");

  const after = Number(db.prepare("SELECT COUNT(*) AS count FROM wallets").get()?.count ?? -1);
  const integrityAfter = String(db.prepare("PRAGMA integrity_check").get()?.integrity_check ?? "");
  const secureDelete = Number(db.prepare("PRAGMA secure_delete").get()?.secure_delete ?? -1);
  const journalMode = String(db.prepare("PRAGMA journal_mode").get()?.journal_mode ?? "").toLowerCase();
  if (after !== 0 || integrityAfter !== "ok") {
    throw new Error("LEGACY_STORAGE_SANITIZE_POSTCONDITION_FAILED");
  }
  const receipt = db.prepare(`
    SELECT operation_id, target, historical_target_count, observed_remaining,
           execution_tool_sha256, completed_at
    FROM maintenance_receipts WHERE operation_id = ?
  `).get(operationId);
  const receiptVerified = receipt?.operation_id === operationId
    && receipt?.target === "wallets:all-legacy-server-keystores:v1"
    && Number(receipt?.historical_target_count) === 6
    && Number(receipt?.observed_remaining) === 0
    && receipt?.execution_tool_sha256 === executionToolSha256
    && Number(receipt?.completed_at) > 0;
  if (!receiptVerified) throw new Error("LEGACY_STORAGE_SANITIZE_RECEIPT_INVALID");
  receiptCompletedAt = Number(receipt.completed_at);
  result = { before, after, integrityBefore, integrityAfter, secureDelete, journalMode, receiptVerified };
} finally {
  db.close();
}

const sidecars = [`${dbPath}-wal`, `${dbPath}-shm`];
const sidecarsAbsent = sidecars.every((sidecar) => !existsSync(sidecar));
const sidecarsPostSanitization = sidecars.every((sidecar) => !existsSync(sidecar)
  || Math.floor(statSync(sidecar).mtimeMs / 1000) >= receiptCompletedAt);
if (!sidecarsPostSanitization) throw new Error("LEGACY_STORAGE_PRE_SANITIZATION_SIDECAR_PRESENT");

console.log(JSON.stringify({
  mode: "VERIFY_ONLY_RETIRED",
  target: "apps/nexus-web/data/nexus.sqlite",
  ...result,
  sidecarsAbsent,
  sidecarsPostSanitization,
  operationId,
  executionToolSha256,
  secretMaterialInspected: false,
}));
