import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { handleRequest } from "../lib/api.js";
import { hashPassword, issueSession } from "../lib/security.js";
import { applyOperationalControl, evaluateOperationalControl, operationalStatus } from "../lib/operational-controls.js";

let sequence = 0;
function request(method, url, cookie, body = {}, key = null) {
  const raw = Buffer.from(JSON.stringify(body));
  return {
    method, url,
    headers: { cookie, "content-type": "application/json", "user-agent": "Nexus incident rehearsal",
      ...(new Set(["POST", "PATCH", "PUT", "DELETE"]).has(method) ? { "idempotency-key": key || `incident-${String(++sequence).padStart(12, "0")}` } : {}) },
    socket: { remoteAddress: "127.0.0.91" },
    on(event, callback) { if (event === "data") process.nextTick(() => callback(raw)); if (event === "end") process.nextTick(callback); return this; },
    once() { return this; }, destroy() {},
  };
}
function response() {
  return { statusCode: 200, headers: {}, body: "",
    writeHead(code, headers = {}) { this.statusCode = code; Object.assign(this.headers, headers); },
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    getHeader(name) { return this.headers[String(name).toLowerCase()]; },
    end(value) { this.body = Buffer.isBuffer(value) ? value.toString("utf8") : String(value ?? ""); } };
}
function fixture() {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const user = repo.createUser({ handle: "incident_actor", displayName: "Incident actor", passwordHash: hashPassword("test-password-123"), trafficClass: "SYSTEM_TEST" });
  repo.ensurePersona(user.id, "social", { visibility: "public" });
  const session = issueSession(user.id, "social");
  repo.insertSession({ tokenHash: session.tokenHash, userId: user.id, persona: "social", expiresAt: session.expiresAt });
  return { db, repo, user, cookie: `nexus_session=${session.token}`, context: { db, repo, sse: { publish() {}, broadcast() {}, subscribe() { return () => {}; } } } };
}
async function call(state, method, path, body = {}, key = null) {
  const res = response();
  await handleRequest(request(method, path, state.cookie, body, key), res, state.context);
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : {}, headers: res.headers };
}

test("operational controls default active and map upload live and UGC independently", () => {
  const db = openDb(":memory:");
  try {
    assert.equal(operationalStatus(db).degraded, false);
    assert.equal(evaluateOperationalControl(db, "POST", "/api/uploads").allowed, true);
    const paused = applyOperationalControl({ db, controlKey: "media_upload", action: "pause", severity: "SEV1", reasonCode: "MALWARE_SPIKE", approvalId: "NX-INC-MALWARE_0001", actor: "sre-primary", now: 100 });
    assert.equal(paused.changed, true);
    assert.equal(evaluateOperationalControl(db, "POST", "/api/uploads").allowed, false);
    assert.equal(evaluateOperationalControl(db, "POST", "/api/posts").allowed, true);
    assert.equal(evaluateOperationalControl(db, "GET", "/api/feed").allowed, true);
  } finally { db.close(); }
});

test("SEV containment blocks idempotently while reports stay available", async () => {
  const state = fixture();
  try {
    const post = state.repo.createPost({ userId: state.user.id, persona: "social", kind: "text", caption: "reportable", visibility: "public" });
    applyOperationalControl({ db: state.db, controlKey: "all_mutations", action: "pause", severity: "SEV0", reasonCode: "AUTH_BYPASS", approvalId: "NX-INC-AUTHBYPASS_01", actor: "incident-commander", now: 200 });
    const health = await call(state, "GET", "/health");
    assert.equal(health.body.status, "degraded");
    assert.equal(JSON.stringify(health.body).includes("AUTH_BYPASS"), false);
    const key = "incident-blocked-replay-0001";
    const blocked = await call(state, "POST", "/api/posts", { caption: "must not publish" }, key);
    const replay = await call(state, "POST", "/api/posts", { caption: "must not publish" }, key);
    assert.equal(blocked.status, 503);
    assert.deepEqual(replay.body, blocked.body);
    assert.equal(state.db.prepare(`SELECT count(*) count FROM posts`).get().count, 1);
    const report = await call(state, "POST", `/api/social/posts/${post.id}/report`, { category: "SCAM_FRAUD", details: "synthetic rehearsal" });
    assert.equal(report.status, 201);
    assert.equal(JSON.stringify(blocked.body).includes("AUTH_BYPASS"), false);
    assert.equal(blocked.headers["retry-after"], "60");
  } finally { state.db.close(); }
});

test("reactivation requires a distinct checker and preserves a tamper-evident event chain", () => {
  const db = openDb(":memory:");
  try {
    const paused = applyOperationalControl({ db, controlKey: "ugc_publish", action: "pause", severity: "SEV1", reasonCode: "HARMFUL_CONTENT", approvalId: "NX-INC-CONTENT_0001", actor: "trust-primary", now: 300 });
    assert.throws(() => applyOperationalControl({ db, controlKey: "ugc_publish", action: "resume", severity: "SEV1", reasonCode: "MITIGATION_VERIFIED", approvalId: "NX-INC-CONTENT_0002", actor: "trust-primary", checker: "trust-primary", incidentId: paused.incident_id, now: 301 }), /distinct checker/);
    const resumed = applyOperationalControl({ db, controlKey: "ugc_publish", action: "resume", severity: "SEV1", reasonCode: "MITIGATION_VERIFIED", approvalId: "NX-INC-CONTENT_0002", actor: "trust-primary", checker: "assurance-checker", incidentId: paused.incident_id, now: 302 });
    assert.equal(resumed.state, "active");
    assert.equal(operationalStatus(db).degraded, false);
    const events = db.prepare(`SELECT * FROM operational_control_events WHERE incident_id = ? ORDER BY id`).all(paused.incident_id);
    assert.equal(events.length, 2);
    assert.equal(events[1].previous_hash, events[0].event_hash);
    assert.notEqual(events[0].actor_hash, events[1].checker_hash);
    assert.equal(JSON.stringify(events).includes("trust-primary"), false);
    assert.equal(db.prepare(`SELECT state FROM operational_incidents WHERE id = ?`).get(paused.incident_id).state, "resolved");
  } finally { db.close(); }
});
