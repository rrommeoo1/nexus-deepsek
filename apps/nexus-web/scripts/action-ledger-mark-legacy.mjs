// Local, on a copy only: the derived intents whose route the classifier never learned keep their row,
// and are marked in place — `action_type` becomes `LEGACY_ROUTE_UNMAPPED`, the class stays
// `PRIVATE_ACTION` (the classifier's own default for an unknown `/api/` route), and a `legacy_note`
// column says why. Nothing is deleted, no mutation audit row is touched, and Railway is not opened.
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("data/reconcile-copy/nexus.sqlite");
try {
  db.exec("BEGIN IMMEDIATE");
  const columns = db.prepare("PRAGMA table_info(action_intents)").all().map((row) => row.name);
  if (!columns.includes("legacy_note")) db.exec("ALTER TABLE action_intents ADD COLUMN legacy_note TEXT");
  const marked = db.prepare(`UPDATE action_intents
    SET action_type = 'LEGACY_ROUTE_UNMAPPED',
        action_class = 'PRIVATE_ACTION',
        legacy_note = 'route unmapped at write time; defaulted to PRIVATE_ACTION on a local copy'
    WHERE action_type = 'UNCLASSIFIED_MUTATION'`).run();
  db.exec("COMMIT");
  const left = db.prepare("SELECT COUNT(*) n FROM action_intents WHERE action_type = 'UNCLASSIFIED_MUTATION'").get().n;
  const note = db.prepare("SELECT COUNT(*) n FROM action_intents WHERE action_type = 'LEGACY_ROUTE_UNMAPPED'").get().n;
  console.log(`[mark] marked=${marked.changes} left_unclassified=${left} marked_total=${note}`);
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
} finally {
  db.close();
}

