// Local, zero-funds Action Ledger reconciliation. The default invocation is
// observational after startup migrations. Repair is derived, hash-only and
// requires a separate explicit control so an operator cannot mutate by typo.
import { DB_PATH, openDb } from "../lib/db.js";
import { reconcileActionLedger } from "../lib/action-ledger.js";

const repair = process.argv.includes("--repair");
if (repair && process.env.NEXUS_ACTION_RECONCILE_REPAIR !== "1") {
  console.error("[action-ledger] repair denied: set NEXUS_ACTION_RECONCILE_REPAIR=1 for this local run");
  process.exitCode = 2;
} else {
  const db = openDb(DB_PATH);
  try {
    const report = reconcileActionLedger(db, { repair, recordRun: repair });
    const safe = {
      status: report.status,
      mode: repair ? "LOCAL_DERIVED_REPAIR" : "READ_ONLY_RECONCILIATION",
      counts: report.counts,
      mismatch_counts: Object.fromEntries(Object.entries(report.mismatches).map(([key, value]) => [key, value.length])),
      pii_findings: report.pii_findings,
      chain_claim: report.chain_claim,
      report_hash: report.report_hash,
      external_network: false,
      real_funds: false,
      incremental_cost: 0,
    };
    console.log(JSON.stringify(safe, null, 2));
    if (report.status !== "PASS") process.exitCode = 1;
  } finally {
    db.close();
  }
}
