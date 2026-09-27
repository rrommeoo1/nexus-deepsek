// Deterministic local crash-window drill. It never opens a network connection,
// touches production data or submits a chain transaction.
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { reconcileActionLedger } from "../lib/action-ledger.js";
import { completeMutationRecord, prepareMutation } from "../lib/mutation-idempotency.js";
import { createLocalOutboxHandlers, dispatchOutboxBatch } from "../lib/outbox.js";

function prepare(db, userId, key, now) {
  return prepareMutation({
    db, userId, actorPersona: "social", key, method: "POST",
    requestTarget: "/api/posts/17/reaction", body: Buffer.from('{"kind":"LIKE"}'), now,
  });
}

export function runMutationOutboxDrill() {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const checks = {};
  try {
    const user = repo.createUser({ handle: "systemtest_crash_drill", displayName: "SYSTEM_TEST crash drill", trafficClass: "SYSTEM_TEST" });
    repo.ensurePersona(user.id, "social", {});

    const preCommit = prepare(db, user.id, "crash-drill-before-commit-0001", 100);
    checks.before_completion_stays_in_progress = db.prepare("SELECT status FROM mutation_requests WHERE id = ?").get(preCommit.id).status === "in_progress"
      && Number(db.prepare("SELECT count(*) count FROM action_intents WHERE mutation_request_id = ?").get(preCommit.id).count) === 0;

    const atomic = prepare(db, user.id, "crash-drill-atomic-savepoint-0002", 200);
    db.exec(`CREATE TRIGGER fail_crash_drill_outbox BEFORE INSERT ON outbox_events
      WHEN NEW.event_type = 'action.intent.created' BEGIN SELECT RAISE(ABORT, 'SYSTEM_TEST_OUTBOX_CRASH'); END`);
    let atomicFault = false;
    try { completeMutationRecord({ db, mutationId: atomic.id, status: 200, body: '{"ok":true}', now: 201 }); }
    catch (error) { atomicFault = String(error?.message).includes("SYSTEM_TEST_OUTBOX_CRASH"); }
    db.exec("DROP TRIGGER fail_crash_drill_outbox");
    checks.atomic_completion_rollback = atomicFault
      && db.prepare("SELECT status FROM mutation_requests WHERE id = ?").get(atomic.id).status === "in_progress"
      && Number(db.prepare("SELECT count(*) count FROM action_intents WHERE mutation_request_id = ?").get(atomic.id).count) === 0;

    db.prepare("UPDATE mutation_requests SET updated_at = 0 WHERE id = ?").run(atomic.id);
    const recovered = prepare(db, user.id, "crash-drill-atomic-savepoint-0002", 240);
    completeMutationRecord({ db, mutationId: recovered.id, status: 200, body: '{"ok":true}', now: 241 });
    const event = db.prepare("SELECT * FROM outbox_events WHERE event_type = 'action.intent.created' AND aggregate_type = 'action_intent'").get();
    db.prepare("UPDATE outbox_events SET status = 'processing', attempts = 1, locked_by = 'dead-worker', locked_until = 300 WHERE id = ?").run(event.id);
    const beforeLease = dispatchOutboxBatch({ db, handlers: createLocalOutboxHandlers(repo), workerId: "recovery-worker", now: 299 });
    const afterLease = dispatchOutboxBatch({ db, handlers: createLocalOutboxHandlers(repo), workerId: "recovery-worker", now: 300 });
    const afterReplay = dispatchOutboxBatch({ db, handlers: createLocalOutboxHandlers(repo), workerId: "second-worker", now: 301 });
    checks.expired_claim_recovered_once = beforeLease.claimed === 0 && afterLease.published === 1 && afterReplay.claimed === 0
      && db.prepare("SELECT status FROM outbox_events WHERE id = ?").get(event.id).status === "published";
    checks.retry_preserved_single_intent = Number(db.prepare("SELECT count(*) count FROM action_intents WHERE mutation_request_id = ?").get(atomic.id).count) === 1;

    const intent = db.prepare("SELECT id FROM action_intents WHERE mutation_request_id = ?").get(atomic.id);
    db.prepare("DELETE FROM outbox_events WHERE aggregate_type = 'action_intent' AND aggregate_id = ?").run(intent.id);
    db.prepare("DELETE FROM action_intents WHERE id = ?").run(intent.id);
    const detected = reconcileActionLedger(db);
    const repaired = reconcileActionLedger(db, { repair: true, recordRun: true, now: 400 });
    const stable = reconcileActionLedger(db, { repair: true, now: 401 });
    checks.reconciliation_detected_gap = detected.status === "MISMATCH" && detected.mismatches.missing_intent_mutation_ids.includes(atomic.id);
    checks.reconciliation_repaired_once = repaired.status === "PASS" && stable.status === "PASS"
      && Number(db.prepare("SELECT count(*) count FROM action_intents WHERE mutation_request_id = ?").get(atomic.id).count) === 1;

    const passed = Object.values(checks).filter(Boolean).length;
    return {
      schema: "NEXUS_MUTATION_OUTBOX_CRASH_DRILL_V1",
      checks, summary: { total: Object.keys(checks).length, passed, failed: Object.keys(checks).length - passed },
      local_only: true, external_network: false, real_funds: false, incremental_cost: 0,
      chain_claim: "LOCAL_ONLY_NOT_CONFIRMED",
      gate: passed === Object.keys(checks).length ? "PASS_LOCAL" : "FAIL_LOCAL",
    };
  } finally { db.close(); }
}

if (process.argv[1]?.endsWith("mutation-outbox-drill.mjs")) {
  const report = runMutationOutboxDrill();
  console.log(JSON.stringify(report, null, 2));
  if (report.gate !== "PASS_LOCAL") process.exitCode = 1;
}
