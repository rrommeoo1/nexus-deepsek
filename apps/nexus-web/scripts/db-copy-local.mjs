// Copies the live local dev database without stopping the server (SQLite's own VACUUM INTO), so the
// reconciliation can be practised on a copy. The live file and Railway are never written by this script.
import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

mkdirSync("data/reconcile-copy", { recursive: true });
const source = new DatabaseSync("data/nexus.sqlite");
try {
  source.exec("VACUUM INTO 'data/reconcile-copy/nexus.sqlite'");
  console.log("[copy] data/reconcile-copy/nexus.sqlite scris");
} finally {
  source.close();
}
