import { createHash, randomUUID } from "node:crypto";
import { sessionSecret } from "./security.js";

export const OPERATIONAL_CONTROL_KEYS = Object.freeze([
  "all_mutations", "ugc_publish", "media_upload", "live_start", "public_discovery",
]);

const KEY_SET = new Set(OPERATIONAL_CONTROL_KEYS);
const SEVERITIES = new Set(["SEV0", "SEV1", "SEV2", "SEV3"]);

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function actorHash(actor) {
  const clean = String(actor || "").trim();
  if (clean.length < 3 || clean.length > 100) throw new Error("operational actor invalid");
  return hash(`nexus-operational-actor-v1:${sessionSecret()}:${clean}`);
}

function validateApproval(value) {
  const approval = String(value || "").trim();
  if (!/^NX-INC-[A-Z0-9_-]{8,80}$/.test(approval)) throw new Error("scoped incident approval id required");
  return approval;
}

function safeRoute(path) {
  return path === "/api/account/export" || path === "/api/account/deletion-cancel" ||
    /^\/api\/account\/sessions\/[a-f0-9]{24}\/revoke$/.test(path) ||
    /^\/api\/comments\/\d+\/report$/.test(path) ||
    /^\/api\/social\/posts\/\d+\/(report|appeal)$/.test(path) ||
    path === "/api/profile/block";
}

export function controlKeysForRequest(method, path) {
  method = String(method).toUpperCase();
  path = String(path);
  if (!new Set(["POST", "PUT", "PATCH", "DELETE"]).has(method) || safeRoute(path)) return [];
  const keys = ["all_mutations"];
  if (path.startsWith("/api/uploads") || path === "/api/media") keys.push("media_upload");
  if (path.startsWith("/api/social/live")) keys.push("live_start");
  if (path === "/api/posts" || /^\/api\/posts\/\d+\/comments$/.test(path) ||
      /^\/api\/comments\/\d+$/.test(path) || path === "/api/stories") keys.push("ugc_publish");
  return keys;
}

export function evaluateOperationalControl(db, method, path) {
  const keys = controlKeysForRequest(method, path);
  if (!keys.length) return { allowed: true, controls: [] };
  const placeholders = keys.map(() => "?").join(",");
  const paused = db.prepare(`SELECT control_key, reason_code, updated_at FROM operational_controls
    WHERE state = 'paused' AND control_key IN (${placeholders}) ORDER BY control_key`).all(...keys);
  return paused.length ? { allowed: false, controls: paused.map((item) => item.control_key) } : { allowed: true, controls: [] };
}

function previousEventHash(db, incidentId) {
  return db.prepare(`SELECT event_hash FROM operational_control_events WHERE incident_id = ? ORDER BY id DESC LIMIT 1`).get(incidentId)?.event_hash || "GENESIS";
}

export function applyOperationalControl({
  db, controlKey, action, severity, reasonCode, approvalId, actor, checker = null,
  incidentId = null, now = Math.floor(Date.now() / 1000),
}) {
  controlKey = String(controlKey || "");
  action = String(action || "").toLowerCase();
  severity = String(severity || "").toUpperCase();
  reasonCode = String(reasonCode || "").trim().toUpperCase();
  if (!KEY_SET.has(controlKey)) throw new Error("operational control key invalid");
  if (!new Set(["pause", "resume"]).has(action)) throw new Error("operational action invalid");
  if (!SEVERITIES.has(severity)) throw new Error("incident severity invalid");
  if (!/^[A-Z0-9_]{4,80}$/.test(reasonCode)) throw new Error("incident reason code invalid");
  approvalId = validateApproval(approvalId);
  const primaryHash = actorHash(actor);
  const checkerHash = checker ? actorHash(checker) : null;
  if (action === "resume" && (!checkerHash || checkerHash === primaryHash)) throw new Error("resume requires a distinct checker");

  const existingControl = db.prepare(`SELECT * FROM operational_controls WHERE control_key = ?`).get(controlKey);
  if (action === "pause" && existingControl?.state === "paused") {
    return { changed: false, state: "paused", incident_id: existingControl.incident_id, control_key: controlKey };
  }
  if (action === "resume" && existingControl?.state !== "paused") {
    return { changed: false, state: "active", incident_id: existingControl?.incident_id || null, control_key: controlKey };
  }

  const id = action === "pause" ? (incidentId || randomUUID()) : (incidentId || existingControl.incident_id);
  if (!id) throw new Error("incident id required for resume");
  const previousHash = previousEventHash(db, id);
  const eventHash = hash(JSON.stringify({ id, controlKey, action, severity, reasonCode, approvalId, primaryHash, checkerHash, previousHash, now }));
  const evidenceHash = hash(JSON.stringify({ id, severity, reasonCode, primaryHash, openedAt: now }));

  db.exec("BEGIN IMMEDIATE");
  try {
    if (action === "pause") {
      db.prepare(`INSERT INTO operational_incidents
        (id, severity, state, reason_code, commander_hash, opened_at, contained_at, evidence_hash, updated_at)
        VALUES (?, ?, 'contained', ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET state = 'contained', contained_at = excluded.contained_at,
          updated_at = excluded.updated_at`).run(id, severity, reasonCode, primaryHash, now, now, evidenceHash, now);
      db.prepare(`INSERT INTO operational_controls (control_key, state, incident_id, reason_code, updated_at)
        VALUES (?, 'paused', ?, ?, ?) ON CONFLICT(control_key) DO UPDATE SET state = 'paused',
          incident_id = excluded.incident_id, reason_code = excluded.reason_code, updated_at = excluded.updated_at`)
        .run(controlKey, id, reasonCode, now);
    } else {
      const incident = db.prepare(`SELECT * FROM operational_incidents WHERE id = ?`).get(id);
      if (!incident || incident.state === "resolved") throw new Error("active incident not found");
      db.prepare(`UPDATE operational_controls SET state = 'active', reason_code = NULL, updated_at = ? WHERE control_key = ?`).run(now, controlKey);
    }
    db.prepare(`INSERT INTO operational_control_events
      (incident_id, control_key, action, approval_id, actor_hash, checker_hash, reason_code, previous_hash, event_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, controlKey, action, approvalId, primaryHash, checkerHash, reasonCode, previousHash, eventHash, now);
    if (action === "resume") {
      const stillPaused = db.prepare(`SELECT 1 FROM operational_controls WHERE incident_id = ? AND state = 'paused' LIMIT 1`).get(id);
      if (!stillPaused) db.prepare(`UPDATE operational_incidents SET state = 'resolved', resolved_at = ?, updated_at = ? WHERE id = ?`).run(now, now, id);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { changed: true, state: action === "pause" ? "paused" : "active", incident_id: id, control_key: controlKey, event_hash: eventHash };
}

export function operationalStatus(db) {
  const controls = Object.fromEntries(OPERATIONAL_CONTROL_KEYS.map((key) => [key, "active"]));
  for (const row of db.prepare(`SELECT control_key, state, updated_at FROM operational_controls`).all()) {
    if (KEY_SET.has(row.control_key)) controls[row.control_key] = row.state;
  }
  return { controls, degraded: Object.values(controls).some((state) => state === "paused") };
}
