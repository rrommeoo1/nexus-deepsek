import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openDb, SCHEMA } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { handleRequest } from "../lib/api.js";
import { issueSession } from "../lib/security.js";

let sequence = 0;
function request(method, url, body = {}, cookie = "", key = null) {
  const raw = Buffer.from(JSON.stringify(body));
  return { method, url, socket: { remoteAddress: "127.0.0.191" }, headers: { "content-type": "application/json", cookie, ...(new Set(["POST","PUT","PATCH","DELETE"]).has(method) ? { "idempotency-key": key || `m9-test-${String(++sequence).padStart(12,"0")}` } : {}) }, on(event, callback) { if (event === "data") process.nextTick(() => callback(raw)); if (event === "end") process.nextTick(callback); return this; }, once() { return this; }, destroy() {} };
}
function response() { return { statusCode: 200, headers: {}, body: "", writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers); }, setHeader(name, value) { this.headers[name] = value; }, end(value) { if (value != null) this.body = Buffer.isBuffer(value) ? value.toString("utf8") : String(value); } }; }
async function call(state, method, path, body, cookie, key = null) { const res = response(); await handleRequest(request(method, path, body, cookie, key), res, state.context); return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : {} }; }
function authCookie(repo, userId, persona) { const session = issueSession(userId, persona); repo.insertSession({ tokenHash: session.tokenHash, userId, persona, expiresAt: session.expiresAt }); return `nexus_session=${session.token}`; }
function fixture() {
  const db = openDb(":memory:"), repo = createRepo(db), events = [];
  const context = { db, repo, sse: { publish(type, payload, channels) { events.push({ type, payload, channels }); return { subscribers: 0, written: 0 }; }, broadcast() { return { subscribers: 0, written: 0 }; }, subscribe() { return () => {}; } } };
  const alice = repo.createUser({ handle: "dating_alice", displayName: "Alice" });
  const bob = repo.createUser({ handle: "dating_bob", displayName: "Bob" });
  const outsider = repo.createUser({ handle: "dating_outsider", displayName: "Outsider" });
  const synthetic = repo.createUser({ handle: "systemtest_dating", displayName: "SYSTEM_TEST Dating", trafficClass: "SYSTEM_TEST" });
  for (const user of [alice,bob,outsider,synthetic]) for (const persona of ["dating","social"]) repo.ensurePersona(user.id, persona, { visibility: "public" });
  const cookies = new Map(); for (const user of [alice,bob,outsider,synthetic]) for (const persona of ["dating","social"]) cookies.set(`${user.id}:${persona}`, authCookie(repo, user.id, persona));
  return { db, repo, context, events, alice, bob, outsider, synthetic, c: (user, persona) => cookies.get(`${user.id}:${persona}`) };
}
const woman = { display_name: "Alice D", age: 30, gender: "woman", seeking: ["man"], intention: "long_term", interests: ["music","travel"], bio: "Intentional dating", city_bucket: "Warsaw centre", visibility: "discoverable", adult_confirmed: true };
const man = { display_name: "Bob D", age: 32, gender: "man", seeking: ["woman"], intention: "long_term", interests: ["music","hiking"], bio: "Safe meetings", city_bucket: "Warsaw centre", visibility: "discoverable", adult_confirmed: true };

test("M9 Dating isolates its persona, filters mutually and excludes synthetic actors", async () => {
  const state = fixture();
  try {
    const denied = await call(state, "GET", "/api/dating/discovery", {}, state.c(state.alice, "social"));
    assert.equal(denied.status, 404); assert.equal(denied.body.code, "VERTICAL_PERSONA_REQUIRED");
    for (const [user, profile] of [[state.alice,woman],[state.bob,man],[state.synthetic,{ ...man, display_name: "Synthetic" }]]) {
      const saved = await call(state, "PUT", "/api/dating/profile", profile, state.c(user, "dating"));
      assert.equal(saved.status, 200, JSON.stringify(saved.body)); assert.equal(saved.body.privacy, "DATING_ONLY");
    }
    const discovery = await call(state, "GET", "/api/dating/discovery", {}, state.c(state.alice, "dating"));
    assert.equal(discovery.status, 200); assert.equal(discovery.body.policy, "MUTUAL_ELIGIBILITY_NO_DESIRABILITY_SCORE");
    assert.deepEqual(discovery.body.candidates.map((candidate) => candidate.user_id), [state.bob.id]);
    assert.equal(JSON.stringify(discovery.body).includes("seeking_json"), false);
    assert.equal(JSON.stringify(discovery.body).includes("score"), false);
  } finally { state.db.close(); }
});

test("M9 reciprocal like creates one private match and Dating conversation", async () => {
  const state = fixture();
  try {
    await call(state, "PUT", "/api/dating/profile", woman, state.c(state.alice, "dating"));
    await call(state, "PUT", "/api/dating/profile", man, state.c(state.bob, "dating"));
    const first = await call(state, "POST", "/api/dating/decisions", { target_user_id: state.bob.id, action: "like" }, state.c(state.alice, "dating"), "m9-like-alice-0001");
    assert.equal(first.status, 200); assert.equal(first.body.match, null); assert.equal(first.body.privacy, "DECISION_PRIVATE_UNLESS_MUTUAL_MATCH");
    const second = await call(state, "POST", "/api/dating/decisions", { target_user_id: state.alice.id, action: "like" }, state.c(state.bob, "dating"), "m9-like-bob-000001");
    assert.equal(second.status, 200); assert.equal(second.body.match.status, "active"); assert.ok(second.body.match.conversation_id > 0);
    const aliceMatches = await call(state, "GET", "/api/dating/matches", {}, state.c(state.alice, "dating"));
    const outsiderMatches = await call(state, "GET", "/api/dating/matches", {}, state.c(state.outsider, "dating"));
    assert.equal(aliceMatches.body.matches.length, 1); assert.equal(aliceMatches.body.matches[0].other_user_id, state.bob.id);
    assert.equal(outsiderMatches.body.matches.length, 0);
    const conversation = state.repo.getConversation(second.body.match.conversation_id);
    assert.equal(conversation.context_persona, "dating"); assert.equal(conversation.status, "active");
    const closed = await call(state, "PATCH", `/api/dating/matches/${second.body.match.id}`, { action: "block" }, state.c(state.alice, "dating"), "m9-block-match-0001");
    assert.equal(closed.body.match.status, "blocked"); assert.equal(state.repo.getConversation(conversation.id).status, "declined");
    assert.equal(state.repo.listDatingMatches(state.bob.id).length, 0);
  } finally { state.db.close(); }
});

test("M9 meet plans expose only an approximate zone and require both PIN confirmations", () => {
  const state = fixture();
  try {
    state.repo.upsertDatingProfile({ userId: state.alice.id, displayName: "Alice", age: 30, gender: "woman", seeking: ["man"], intention: "long_term", interests: ["music"], bio: "", cityBucket: "Warsaw", visibility: "discoverable" });
    state.repo.upsertDatingProfile({ userId: state.bob.id, displayName: "Bob", age: 31, gender: "man", seeking: ["woman"], intention: "long_term", interests: ["music"], bio: "", cityBucket: "Warsaw", visibility: "discoverable" });
    state.repo.makeDatingDecision({ actorId: state.alice.id, targetId: state.bob.id, action: "like" });
    const mutual = state.repo.makeDatingDecision({ actorId: state.bob.id, targetId: state.alice.id, action: "like" });
    const now = Math.floor(Date.now() / 1000), scheduledAt = now + 7200;
    const plan = state.repo.createDatingMeetPlan({ viewerId: state.alice.id, matchId: mutual.match.id, zoneBucket: "Central public café", scheduledAt, pin: "4821" });
    assert.equal(Object.hasOwn(plan, "pin_hash"), false); assert.equal(plan.status, "proposed");
    const accepted = state.repo.transitionDatingMeetPlan({ viewerId: state.bob.id, planId: plan.id, action: "accept", atSeconds: now });
    assert.equal(accepted.status, "accepted");
    assert.throws(() => state.repo.transitionDatingMeetPlan({ viewerId: state.bob.id, planId: plan.id, action: "confirm", pin: "1111", atSeconds: scheduledAt }), { code: "DATING_MEET_PIN_OR_WINDOW_INVALID" });
    const first = state.repo.transitionDatingMeetPlan({ viewerId: state.alice.id, planId: plan.id, action: "confirm", pin: "4821", atSeconds: scheduledAt });
    const completed = state.repo.transitionDatingMeetPlan({ viewerId: state.bob.id, planId: plan.id, action: "confirm", pin: "4821", atSeconds: scheduledAt });
    assert.equal(first.status, "accepted"); assert.equal(completed.status, "completed"); assert.equal(completed.low_confirmed + completed.high_confirmed, 2);
    assert.equal(Object.hasOwn(completed, "pin_hash"), false);
  } finally { state.db.close(); }
});

test("M9 Privé remains fail-closed and the UI makes no explicit-content or payment claim", async () => {
  const state = fixture();
  try {
    const status = await call(state, "GET", "/api/prive/status", {}, state.c(state.alice, "dating"));
    assert.equal(status.status, 423); assert.equal(status.body.code, "PRIVE_EXTERNAL_GATES_REQUIRED");
    assert.equal(status.body.explicit_media_available, false); assert.equal(status.body.real_payments, false);
    const ui = readFileSync(new URL("../public/dating-module.js", import.meta.url), "utf8"), app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
    assert.match(ui, /Fără scor de atractivitate/); assert.match(ui, /PRIVE_EXTERNAL_GATES_REQUIRED/); assert.doesNotMatch(ui, /Serious Intent · 92/);
    assert.match(app, /renderDatingWorkspace/); assert.doesNotMatch(app, /Demo Serious Intent/);
  } finally { state.db.close(); }
});

test("M9 schema has explicit pair, privacy and PIN integrity constraints", () => {
  const schema = String(SCHEMA);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS dating_profiles/);
  assert.match(schema, /CHECK\(age BETWEEN 18 AND 99\)/);
  assert.match(schema, /PRIMARY KEY \(actor_id, target_id\)/);
  assert.match(schema, /UNIQUE\(user_low_id, user_high_id\)/);
  assert.match(schema, /pin_hash TEXT NOT NULL/);
  assert.match(schema, /idx_dating_profiles_discovery/);
});
