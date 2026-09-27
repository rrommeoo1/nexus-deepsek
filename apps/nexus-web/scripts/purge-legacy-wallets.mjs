import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { inspectLegacyWalletRows } from "../lib/legacy-wallet-purge.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const expectedDatabase = resolve(join(scriptDir, "..", "data", "nexus.sqlite"));
const execute = process.argv.includes("--execute");
if (execute) throw new Error("LEGACY_WALLET_PURGE_RETIRED");

const db = new DatabaseSync(expectedDatabase, { readOnly: true });
try {
  const inspection = inspectLegacyWalletRows(db);
  console.log(JSON.stringify({ mode: "VERIFY_ONLY", target: "local wallets table", ...inspection }));
} finally {
  db.close();
}
