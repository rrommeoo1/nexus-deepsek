import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openDb, SCHEMA } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { handleRequest } from "../lib/api.js";
import { issueSession } from "../lib/security.js";

let sequence = 0;
function request(method, url, body = {}, cookie = "", idempotencyKey = null) {
  const raw = Buffer.from(JSON.stringify(body));
  return {
    method, url, socket: { remoteAddress: "127.0.0.141" },
    headers: { "content-type": "application/json", cookie, ...(new Set(["POST", "PATCH", "PUT", "DELETE"]).has(method) ? { "idempotency-key": idempotencyKey || `m5-${++sequence}` } : {}) },
    on(event, callback) { if (event === "data") process.nextTick(() => callback(raw)); if (event === "end") process.nextTick(callback); return this; },
    once() { return this; }, destroy() {},
  };
}
function response() {
  return { statusCode: 200, headers: {}, body: "", writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers); }, setHeader(name, value) { this.headers[name] = value; }, end(value) { if (value != null) this.body = Buffer.isBuffer(value) ? value.toString("utf8") : String(value); } };
}
async function call(state, method, path, body, cookie, key = null) {
  const res = response();
  await handleRequest(request(method, path, body, cookie, key), res, state.context);
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : {} };
}
function cookie(repo, userId, persona) {
  const session = issueSession(userId, persona);
  repo.insertSession({ tokenHash: session.tokenHash, userId, persona, expiresAt: session.expiresAt });
  return `nexus_session=${session.token}`;
}
function fixture() {
  const db = openDb(":memory:"); const repo = createRepo(db); const events = [];
  const context = { db, repo, sse: { publish(type, payload, channels) { events.push({ type, payload, channels }); return { subscribers: 0, written: 0 }; }, broadcast() { return { subscribers: 0, written: 0 }; }, subscribe() { return () => {}; } } };
  const owner = repo.createUser({ handle: "m5_owner", displayName: "Owner" });
  const alice = repo.createUser({ handle: "m5_alice", displayName: "Alice" });
  const bob = repo.createUser({ handle: "m5_bob", displayName: "Bob" });
  for (const user of [owner, alice, bob]) { repo.ensurePersona(user.id, "social", { visibility: "public" }); repo.ensurePersona(user.id, "work", { visibility: "public" }); }
  return { db, repo, context, events, owner, alice, bob, ownerWork: cookie(repo, owner.id, "work"), aliceWork: cookie(repo, alice.id, "work"), bobWork: cookie(repo, bob.id, "work"), aliceSocial: cookie(repo, alice.id, "social") };
}

test("M5 Work profile is active-persona bound, validated and replay safe", async () => {
  const state = fixture();
  try {
    const denied = await call(state, "GET", "/api/work/profile", {}, state.aliceSocial);
    assert.equal(denied.status, 404);
    assert.equal(denied.body.code, "WORK_PERSONA_REQUIRED");
    const payload = { headline: "Senior architect", location: "Warsaw", availability: "open", skills: ["Rust", "TypeScript"], experience: [{ title: "Architect", company: "Nexus", period: "2026" }] };
    const first = await call(state, "PATCH", "/api/work/profile", payload, state.aliceWork, "m5-profile-replay");
    const replay = await call(state, "PATCH", "/api/work/profile", payload, state.aliceWork, "m5-profile-replay");
    assert.equal(first.status, 200); assert.deepEqual(replay.body, first.body);
    assert.equal(first.body.viewer_id, state.alice.id); assert.equal(first.body.viewer_persona, "work");
    assert.deepEqual(first.body.profile.skills, ["Rust", "TypeScript"]);
    assert.equal(state.repo.getPersona(state.alice.id, "social").bio, "");
  } finally { state.db.close(); }
});

test("M5 jobs publish/apply journey prevents self and duplicate applications", async () => {
  const state = fixture();
  try {
    const created = await call(state, "POST", "/api/work/jobs", { business_page_id: null, title: "Protocol engineer", company: "Nexus", location: "Remote", workplace_type: "remote", employment_type: "full_time", description: "Build resilient social infrastructure." }, state.ownerWork, "m5-job-create-000001");
    assert.equal(created.status, 201);
    const jobId = created.body.job.id;
    const self = await call(state, "POST", `/api/work/jobs/${jobId}/apply`, { note: "self" }, state.ownerWork, "m5-job-self-000001");
    assert.equal(self.status, 409); assert.equal(self.body.code, "JOB_SELF_APPLICATION");
    const applied = await call(state, "POST", `/api/work/jobs/${jobId}/apply`, { note: "Qualified" }, state.aliceWork, "m5-job-apply-000001");
    assert.equal(applied.status, 201);
    const replay = await call(state, "POST", `/api/work/jobs/${jobId}/apply`, { note: "Qualified" }, state.aliceWork, "m5-job-apply-000001");
    assert.deepEqual(replay.body, applied.body);
    const duplicate = await call(state, "POST", `/api/work/jobs/${jobId}/apply`, { note: "again" }, state.aliceWork, "m5-job-apply-000002");
    assert.equal(duplicate.status, 409); assert.equal(duplicate.body.code, "JOB_ALREADY_APPLIED");
    const received = await call(state, "GET", "/api/work/applications?scope=received", {}, state.ownerWork);
    assert.equal(received.body.applications.length, 1);
    assert.equal(received.body.applications[0].applicant_handle, "m5_alice");
    assert.ok(state.events.length > 0);
    assert.ok(state.repo.listNotifications(state.owner.id, { persona: "work" }).some((item) => item.body === "New Work application"));
  } finally { state.db.close(); }
});

test("M5 Beauty slot has one winner, zero real settlement and private appointment reads", async () => {
  const state = fixture();
  try {
    const page = await call(state, "POST", "/api/business/pages", { name: "Nexus Hair", category: "hair_salon", location: "Warsaw", description: "Synthetic local salon." }, state.ownerWork, "m5-page-create-000001");
    assert.equal(page.status, 201); assert.equal(page.body.verification, "UNVERIFIED_LOCAL");
    const service = await call(state, "POST", `/api/business/pages/${page.body.page.id}/services`, { title: "Haircut", category: "haircut", duration_minutes: 45, price_cents: 2500, deposit_cents: 500 }, state.ownerWork, "m5-service-create-000001");
    assert.equal(service.status, 201); assert.equal(service.body.settlement, "LOCAL_DEMO_NO_PAYMENT");
    const startsAt = Math.floor(Date.now() / 1000) + 3600;
    const slot = await call(state, "POST", `/api/business/services/${service.body.service.id}/slots`, { staff_name: "Alex", starts_at: startsAt }, state.ownerWork, "m5-slot-create-000001");
    assert.equal(slot.status, 201);
    const winner = await call(state, "POST", `/api/business/slots/${slot.body.slot.id}/book`, {}, state.aliceWork, "m5-book-alice-000001");
    assert.equal(winner.status, 201); assert.equal(winner.body.real_value, 0); assert.equal(winner.body.settlement, "LOCAL_DEMO_NO_PAYMENT");
    const loser = await call(state, "POST", `/api/business/slots/${slot.body.slot.id}/book`, {}, state.bobWork, "m5-book-bob-000001");
    assert.equal(loser.status, 409); assert.equal(loser.body.code, "SLOT_NOT_AVAILABLE");
    const alice = await call(state, "GET", "/api/business/appointments", {}, state.aliceWork);
    const owner = await call(state, "GET", "/api/business/appointments", {}, state.ownerWork);
    const bob = await call(state, "GET", "/api/business/appointments", {}, state.bobWork);
    assert.equal(alice.body.appointments.length, 1); assert.equal(alice.body.appointments[0].viewer_role, "customer");
    assert.equal(owner.body.appointments.length, 1); assert.equal(owner.body.appointments[0].viewer_role, "owner");
    assert.equal(bob.body.appointments.length, 0);
    const intrusion = await call(state, "PATCH", `/api/business/appointments/${winner.body.appointment.id}`, { action: "cancel" }, state.bobWork, "m5-intrusion-000001");
    assert.equal(intrusion.status, 404);
    const complete = await call(state, "PATCH", `/api/business/appointments/${winner.body.appointment.id}`, { action: "complete" }, state.ownerWork, "m5-complete-000001");
    assert.equal(complete.status, 200); assert.equal(complete.body.appointment.status, "completed");
  } finally { state.db.close(); }
});

test("M5 database constraints and UI expose the executable Work/Beauty journey", () => {
  const schema = String(SCHEMA);
  assert.match(schema, /UNIQUE\(job_id, applicant_id\)/);
  assert.match(schema, /slot_id INTEGER NOT NULL UNIQUE/);
  assert.match(schema, /CHECK\(deposit_cents BETWEEN 0 AND price_cents\)/);
  const ui = readFileSync(new URL("../public/work-module.js", import.meta.url), "utf8");
  const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(ui, /\/api\/work\/profile/);
  assert.match(ui, /\/api\/work\/jobs/);
  assert.match(ui, /\/api\/business\/catalog/);
  assert.match(ui, /data-book-slot/);
  assert.match(app, /activeModule = persona === "social" \? "clips" : persona === "travel" \? "stay" : persona/);
  assert.match(app, /function renderWork\(vp\) \{ renderWorkWorkspace/);
});
