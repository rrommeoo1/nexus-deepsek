import { createHash, randomUUID } from "node:crypto";
import { sessionSecret } from "./security.js";

const HEX_64 = /^[a-f0-9]{64}$/;

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function commitment(label, value) {
  return hash(`nexus-action-${label}-v1:${sessionSecret()}:${String(value)}`);
}

export function classifyAction(method, target) {
  const path = String(target || "").split("?")[0];
  method = String(method || "").toUpperCase();
  if (!new Set(["POST", "PUT", "PATCH", "DELETE"]).has(method)) return null;
  if (path.startsWith("/api/social/impressions") || /\/typing$/.test(path) || /\/read$/.test(path)) {
    return { action_class: "EPHEMERAL_EXCLUDED", action_type: "EPHEMERAL_TRANSPORT" };
  }
  if (path.startsWith("/api/chat/") || path.startsWith("/api/messages")) {
    return { action_class: "PRIVATE_ACTION", action_type: "CHAT_MUTATION" };
  }
  if (/\/(report|appeal)$/.test(path) || path === "/api/profile/block" || path.startsWith("/api/social/moderation/")) {
    return { action_class: "PRIVATE_ACTION", action_type: "SAFETY_MUTATION" };
  }
  if (path.startsWith("/api/pay/") || path.startsWith("/api/social/private-access/")) {
    return { action_class: "FINANCIAL_ACTION", action_type: "FINANCIAL_INTENT" };
  }
  if (path.startsWith("/api/posts") || path.startsWith("/api/comments") || path.startsWith("/api/stories") ||
      path.startsWith("/api/social/posts") || path === "/api/follow" || path.startsWith("/api/follow/") ||
      path.startsWith("/api/social/live") || path === "/api/listings") {
    return { action_class: "PUBLIC_ACTION", action_type: "SOCIAL_MUTATION" };
  }
  if (path.startsWith("/api/account/") || path.startsWith("/api/persona/") || path === "/api/profile" ||
      path === "/api/claim-username" || path.startsWith("/api/notifications") ||
      path.startsWith("/api/notification-preferences") || path.startsWith("/api/security/")) {
    return { action_class: "PRIVATE_ACTION", action_type: "ACCOUNT_MUTATION" };
  }
  // New authenticated mutation routes fail closed into a private commitment.
  // They cannot silently bypass the ledger while their explicit classification
  // is being reviewed, and no route/body data reaches the chain payload.
  if (path.startsWith("/api/")) return { action_class: "PRIVATE_ACTION", action_type: "UNCLASSIFIED_MUTATION" };
  return null;
}

function actorKind(trafficClass) {
  if (trafficClass === "SYSTEM_TEST") return "SYSTEM_TEST";
  if (trafficClass === "AGENT") return "AGENT";
  return "HUMAN";
}

export function recordActionIntentForMutation(db, mutationId, createdAt = Math.floor(Date.now() / 1000)) {
  const mutation = db.prepare(`SELECT m.*, u.traffic_class FROM mutation_requests m
    LEFT JOIN users u ON u.id = m.user_id WHERE m.id = ?`).get(mutationId);
  const outcomeStatus = Number(mutation?.outcome_status ?? mutation?.response_status);
  if (!mutation || mutation.status !== "completed" || outcomeStatus < 200 || outcomeStatus >= 300) return null;
  const existing = db.prepare(`SELECT * FROM action_intents WHERE mutation_request_id = ?`).get(mutationId);
  if (existing) return existing;
  const classification = classifyAction(mutation.method, mutation.request_target);
  if (!classification) return null;
  const kind = actorKind(mutation.traffic_class);
  const id = randomUUID();
  const chainStatus = kind === "SYSTEM_TEST" ? "EXCLUDED_SYNTHETIC"
    : classification.action_class === "EPHEMERAL_EXCLUDED" ? "EPHEMERAL_EXCLUDED"
      : "LOCAL_ACCEPTED_CHAIN_DISABLED";
  const actorCommitment = commitment("actor", `${mutation.user_id}:${mutation.actor_persona}`);
  const objectCommitment = commitment("object", `${mutation.method}:${String(mutation.request_target).split("?")[0]}`);
  const idempotencyCommitment = commitment("idempotency", mutation.idempotency_key);
  db.prepare(`INSERT INTO action_intents
    (id, mutation_request_id, user_id, actor_persona, actor_kind, action_type, action_class,
     actor_commitment, object_commitment, payload_hash, idempotency_commitment, chain_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, mutation.id, mutation.user_id, mutation.actor_persona, kind, classification.action_type,
      classification.action_class, actorCommitment, objectCommitment, mutation.request_sha256,
      idempotencyCommitment, chainStatus, createdAt);
  db.prepare(`INSERT INTO outbox_events
    (aggregate_type, aggregate_id, event_type, payload_json, status, available_at, created_at)
    VALUES ('action_intent', ?, 'action.intent.created', ?, 'pending', ?, ?)
    ON CONFLICT(aggregate_type, aggregate_id, event_type) DO NOTHING`)
    .run(id, JSON.stringify({
      intent_id: id, actor_kind: kind, action_type: classification.action_type,
      action_class: classification.action_class, payload_hash: mutation.request_sha256,
      chain_status: chainStatus,
    }), createdAt, createdAt);
  return db.prepare(`SELECT * FROM action_intents WHERE id = ?`).get(id);
}

function intentPiiFinding(intent, event) {
  const exactHashes = [intent.actor_commitment, intent.object_commitment, intent.payload_hash, intent.idempotency_commitment];
  if (exactHashes.some((value) => !HEX_64.test(String(value || "")))) return true;
  if (intent.tx_hash != null && !HEX_64.test(String(intent.tx_hash))) return true;
  let payload;
  try { payload = JSON.parse(event?.payload_json || "{}"); } catch { return true; }
  const allowed = new Set(["intent_id", "actor_kind", "action_type", "action_class", "payload_hash", "chain_status"]);
  return Object.keys(payload).some((key) => !allowed.has(key)) || !HEX_64.test(String(payload.payload_hash || ""));
}

export function reconcileActionLedger(db, { repair = false, recordRun = false, now = Math.floor(Date.now() / 1000) } = {}) {
  const completed = db.prepare(`SELECT id FROM mutation_requests WHERE status = 'completed'
    AND COALESCE(outcome_status, response_status) >= 200
    AND COALESCE(outcome_status, response_status) < 300 ORDER BY id`).all();
  if (repair) for (const mutation of completed) recordActionIntentForMutation(db, mutation.id, now);
  const missing = db.prepare(`SELECT m.id FROM mutation_requests m LEFT JOIN action_intents a ON a.mutation_request_id = m.id
    WHERE m.status = 'completed' AND COALESCE(m.outcome_status, m.response_status) >= 200
      AND COALESCE(m.outcome_status, m.response_status) < 300
      AND a.id IS NULL ORDER BY m.id`).all().map((item) => item.id);
  const duplicates = db.prepare(`SELECT mutation_request_id id, count(*) count FROM action_intents
    GROUP BY mutation_request_id HAVING count(*) <> 1`).all();
  const intents = db.prepare(`SELECT * FROM action_intents ORDER BY created_at, id`).all();
  const orphaned = [];
  const failedEvents = [];
  let piiFindings = 0;
  for (const intent of intents) {
    const event = db.prepare(`SELECT * FROM outbox_events WHERE aggregate_type = 'action_intent'
      AND aggregate_id = ? AND event_type = 'action.intent.created'`).get(intent.id);
    if (!event) orphaned.push(intent.id);
    if (event?.status === "failed") failedEvents.push(intent.id);
    if (intentPiiFinding(intent, event)) piiFindings += 1;
  }
  const devnet = db.prepare(`SELECT id, payload_hash, tx_hash, status FROM devnet_actions ORDER BY id`).all();
  const invalidDevnet = devnet.filter((item) => !HEX_64.test(String(item.payload_hash || "")) || !HEX_64.test(String(item.tx_hash || "")));
  const duplicateTx = db.prepare(`SELECT tx_hash, count(*) count FROM devnet_actions GROUP BY tx_hash HAVING count(*) > 1`).all();
  const unclassified = intents.filter((intent) => intent.action_type === "UNCLASSIFIED_MUTATION").map((intent) => intent.id);
  const mismatchCount = missing.length + duplicates.length + orphaned.length + failedEvents.length +
    invalidDevnet.length + duplicateTx.length + unclassified.length;
  const report = {
    status: mismatchCount === 0 && piiFindings === 0 ? "PASS" : "MISMATCH",
    counts: { completed_mutations: completed.length, action_intents: intents.length, devnet_actions: devnet.length },
    mismatches: {
      missing_intent_mutation_ids: missing,
      duplicate_intent_mutation_ids: duplicates.map((item) => item.id),
      orphaned_intent_event_ids: orphaned,
      failed_intent_event_ids: failedEvents,
      unclassified_intent_ids: unclassified,
      invalid_devnet_action_ids: invalidDevnet.map((item) => item.id),
      duplicate_devnet_tx_hashes: duplicateTx.map((item) => commitment("duplicate-tx", item.tx_hash)),
    },
    pii_findings: piiFindings,
    chain_claim: "LOCAL_ONLY_NOT_CONFIRMED",
  };
  const reportHash = hash(JSON.stringify(report));
  if (recordRun) {
    db.prepare(`INSERT INTO action_reconciliation_runs
      (id, status, completed_mutations, action_intents, mismatches, pii_findings, report_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(randomUUID(), report.status, completed.length, intents.length, mismatchCount, piiFindings, reportHash, now);
  }
  return { ...report, report_hash: reportHash };
}
