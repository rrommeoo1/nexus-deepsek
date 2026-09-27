// GDPR purge worker. Dry-run is the default and never mutates state.
// Execution requires two explicit deployment controls so an operator cannot
// erase accounts by adding --execute accidentally.
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { runEligibleAccountPurges } from "../lib/account-lifecycle.js";

const execute = process.argv.includes("--execute");
const now = Math.floor(Date.now() / 1000);
const db = openDb();

try {
  const summary = db.prepare(`SELECT
    count(*) eligible,
    sum(CASE WHEN state = 'blocked_legal_hold' THEN 1 ELSE 0 END) blocked,
    sum(CASE WHEN state = 'purging' THEN 1 ELSE 0 END) retrying
    FROM account_deletion_requests
    WHERE state IN ('requested','blocked_legal_hold','purging') AND execute_after <= ?`).get(now);

  if (!execute) {
    console.log(JSON.stringify({
      mode: "dry_run",
      eligible: Number(summary.eligible || 0),
      blocked_state: Number(summary.blocked || 0),
      retrying: Number(summary.retrying || 0),
      mutated: false,
    }, null, 2));
    process.exitCode = 0;
  } else {
    const approval = String(process.env.NEXUS_ACCOUNT_PURGE_APPROVAL_ID || "");
    if (process.env.NEXUS_ACCOUNT_PURGE_EXECUTE !== "1" || !/^NX-GDPR-PURGE-[A-Z0-9_-]{8,80}$/.test(approval)) {
      throw new Error("purge execution denied: require NEXUS_ACCOUNT_PURGE_EXECUTE=1 and a scoped NX-GDPR-PURGE-* approval id");
    }
    const results = runEligibleAccountPurges({ db, repo: createRepo(db), now, limit: 25 });
    console.log(JSON.stringify({ mode: "execute", approval_id: approval, processed: results.length, results }, null, 2));
  }
} finally {
  db.close();
}
