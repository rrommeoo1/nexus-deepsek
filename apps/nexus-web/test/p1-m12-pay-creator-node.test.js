import test from "node:test";
import assert from "node:assert/strict";
import { openDb, SCHEMA } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { handleRequest } from "../lib/api.js";
import { issueSession } from "../lib/security.js";
import { generateWallet } from "../lib/wallet.js";

let sequence = 0;
function request(method, url, body = {}, cookie = "", headers = {}) {
  const raw = Buffer.from(JSON.stringify(body));
  return {
    method, url, socket: { remoteAddress: "127.0.0.212" },
    headers: {
      "content-type": "application/json", cookie,
      ...(new Set(["POST", "PUT", "PATCH", "DELETE"]).has(method) ? { "idempotency-key": `m12-test-${String(++sequence).padStart(12, "0")}` } : {}),
      ...headers,
    },
    on(event, callback) { if (event === "data") process.nextTick(() => callback(raw)); if (event === "end") process.nextTick(callback); return this; },
    once() { return this; }, destroy() {},
  };
}
function response() {
  return {
    statusCode: 200, headers: {}, body: "",
    writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers); },
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { if (value != null) this.body = Buffer.isBuffer(value) ? value.toString("utf8") : String(value); },
  };
}
async function call(state, method, path, body = {}, cookie = "", headers = {}) {
  const res = response();
  await handleRequest(request(method, path, body, cookie, headers), res, state.context);
  return { status: res.statusCode, body: res.body && String(res.headers["content-type"] || "").includes("json") ? JSON.parse(res.body) : res.body, headers: res.headers };
}
function authCookie(repo, userId) {
  const session = issueSession(userId, "social");
  repo.insertSession({ tokenHash: session.tokenHash, userId, persona: "social", expiresAt: session.expiresAt });
  return `nexus_session=${session.token}`;
}
function fixture() {
  const db = openDb(":memory:"), repo = createRepo(db);
  const sse = { publish() { return { subscribers: 0, written: 0 }; }, broadcast() { return { subscribers: 0, written: 0 }; }, subscribe() { return () => {}; } };
  const alice = repo.createUser({ handle: "pay_alice_m12", displayName: "Alice", mvxAddress: generateWallet().address });
  const bob = repo.createUser({ handle: "pay_bob_m12", displayName: "Bob", mvxAddress: generateWallet().address });
  const creator = repo.createUser({ handle: "creator_m12", displayName: "Creator", mvxAddress: generateWallet().address });
  const synthetic = repo.createUser({ handle: "systemtest_m12", displayName: "SYSTEM_TEST M12", mvxAddress: generateWallet().address, trafficClass: "SYSTEM_TEST" });
  for (const user of [alice, bob, creator, synthetic]) repo.ensurePersona(user.id, "social", { visibility: "public" });
  return {
    db, repo, context: { db, repo, sse }, alice, bob, creator, synthetic,
    aliceCookie: authCookie(repo, alice.id), bobCookie: authCookie(repo, bob.id), creatorCookie: authCookie(repo, creator.id), syntheticCookie: authCookie(repo, synthetic.id),
  };
}

test("M12 Pay binds alias, address, chain, token, decimals and atomic amount before one unsigned local intent", async () => {
  const state = fixture();
  try {
    const quote = await call(state, "POST", "/api/pay/quotes", { username: "@pay_bob_m12", asset: "TEST-USDC", amount: "12.340000", purpose: "Dinner" }, state.aliceCookie);
    assert.equal(quote.status, 201, JSON.stringify(quote.body));
    assert.equal(quote.body.quote.alias, "pay_bob_m12");
    assert.equal(quote.body.quote.token_id, "TEST-USDC");
    assert.equal(quote.body.quote.token_decimals, 6);
    assert.equal(quote.body.quote.atomic_amount, "12340000");
    assert.equal(quote.body.quote.display_amount, "12.34");
    assert.equal(quote.body.truth, "LOCAL_COMMITMENT_ONLY_NO_SIGNATURE_NO_FUNDS");

    const key = "m12-pay-intent-replay-0001";
    const payload = { receipt_id: quote.body.quote.id, receipt_hash: quote.body.quote.receipt_hash };
    const intent = await call(state, "POST", "/api/pay/intents", payload, state.aliceCookie, { "idempotency-key": key });
    const replay = await call(state, "POST", "/api/pay/intents", payload, state.aliceCookie, { "idempotency-key": key });
    assert.equal(intent.status, 201, JSON.stringify(intent.body));
    assert.deepEqual(replay.body, intent.body);
    assert.equal(intent.body.intent.status, "local_unsigned");
    assert.equal(intent.body.intent.atomic_amount, "12340000");
    assert.equal(intent.body.authorization.enabled, false);
    assert.equal(state.db.prepare(`SELECT COUNT(*) count FROM pay_transfer_intents`).get().count, 1);

    const history = await call(state, "GET", "/api/pay/history", {}, state.aliceCookie);
    assert.equal(history.body.private, true);
    assert.equal(history.body.transfers[0].direction, "sent");
    assert.equal(history.body.real_settlements, 0);
    assert.equal((await call(state, "POST", "/api/pay/quotes", { username: "pay_alice_m12", asset: "EGLD", amount: "1" }, state.aliceCookie)).status, 404);
    assert.equal((await call(state, "POST", "/api/pay/quotes", { username: "pay_bob_m12", asset: "TEST-USDC", amount: "1.0000001" }, state.aliceCookie)).status, 400);
  } finally { state.db.close(); }
});

test("M12 Pay invalidates a preview when the alias wallet binding changes", async () => {
  const state = fixture();
  try {
    const quote = await call(state, "POST", "/api/pay/quotes", { username: "pay_bob_m12", asset: "EGLD", amount: "0.01" }, state.aliceCookie);
    assert.equal(quote.status, 201);
    state.db.prepare(`UPDATE users SET mvx_address = ? WHERE id = ?`).run(generateWallet().address, state.bob.id);
    const result = await call(state, "POST", "/api/pay/intents", { receipt_id: quote.body.quote.id, receipt_hash: quote.body.quote.receipt_hash }, state.aliceCookie);
    assert.equal(result.status, 409);
    assert.equal(result.body.code, "PAY_RESOLUTION_STALE");
    assert.equal(state.db.prepare(`SELECT status FROM pay_resolution_receipts WHERE id = ?`).get(quote.body.quote.id).status, "invalidated");
    assert.equal(state.db.prepare(`SELECT COUNT(*) count FROM pay_transfer_intents`).get().count, 0);
  } finally { state.db.close(); }
});

test("M12 Creator exposes transparent versioned splits but never pays likes, demos or SYSTEM_TEST traffic", async () => {
  const state = fixture();
  try {
    const product = await call(state, "POST", "/api/creator/products", { kind: "tip", title: "Support direct", price_cents: 1000, interval_days: null }, state.creatorCookie);
    assert.equal(product.status, 201, JSON.stringify(product.body));
    assert.equal(product.body.product.split_version, "CORE_TIP_V1_90_5_3_2");
    const catalog = await call(state, "GET", "/api/creator/catalog?username=creator_m12", {}, state.aliceCookie);
    assert.equal(catalog.body.catalog.products.length, 1);

    const intent = await call(state, "POST", "/api/creator/support-intents", { product_id: product.body.product.id }, state.aliceCookie);
    assert.equal(intent.status, 201);
    assert.deepEqual([
      intent.body.intent.gross_cents, intent.body.intent.creator_share_cents, intent.body.intent.nexus_fee_cents,
      intent.body.intent.safety_reserve_cents, intent.body.intent.infra_cents,
    ], [1000, 900, 50, 30, 20]);
    assert.equal(intent.body.intent.status, "demo_unpaid");
    assert.equal(intent.body.intent.payout_eligible, 0);

    const excluded = await call(state, "POST", "/api/creator/support-intents", { product_id: product.body.product.id }, state.syntheticCookie);
    assert.equal(excluded.body.economic_effect, "ZERO_SYSTEM_TEST");
    assert.deepEqual([
      excluded.body.intent.quoted_cents, excluded.body.intent.gross_cents, excluded.body.intent.creator_share_cents,
      excluded.body.intent.nexus_fee_cents, excluded.body.intent.safety_reserve_cents, excluded.body.intent.infra_cents,
    ], [1000, 0, 0, 0, 0, 0]);

    const dashboard = await call(state, "GET", "/api/creator/dashboard", {}, state.creatorCookie);
    assert.equal(dashboard.body.economics.likes_paid, false);
    assert.equal(dashboard.body.dashboard.totals.creator_available_cents, 0);
    assert.equal(dashboard.body.dashboard.creator_fund.pool_cents, 0);
    assert.equal("supporter_id" in dashboard.body.dashboard.received[0], false);
  } finally { state.db.close(); }
});

test("M12 Node remains honest D0 while candidate manifests build a hash-linked local evidence chain", async () => {
  const state = fixture();
  try {
    const initial = await call(state, "GET", "/api/node/status", {}, state.aliceCookie);
    assert.equal(initial.body.network.mode, "D0_GENESIS");
    assert.equal(initial.body.network.active_nodes, 1);
    assert.equal(initial.body.network.decentralization_claim, false);
    assert.equal(initial.body.rewards.enabled, false);

    const key = "m12-node-manifest-replay-0001";
    const body = { trust_class: "T0", protocol_version: "1.0.0", service_roles: ["storage", "index"] };
    const manifest = await call(state, "POST", "/api/node/manifests", body, state.aliceCookie, { "idempotency-key": key });
    const replay = await call(state, "POST", "/api/node/manifests", body, state.aliceCookie, { "idempotency-key": key });
    assert.equal(manifest.status, 201, JSON.stringify(manifest.body));
    assert.deepEqual(replay.body, manifest.body);
    assert.equal(manifest.body.online, false);
    assert.equal(manifest.body.advertised, false);

    const nodeId = manifest.body.manifest.node_id;
    const first = await call(state, "POST", "/api/node/commitments", { node_id: nodeId, event_count: 3, range_start: 1, range_end: 3, payload_hash: "a".repeat(64) }, state.aliceCookie);
    const second = await call(state, "POST", "/api/node/commitments", { node_id: nodeId, event_count: 2, range_start: 4, range_end: 5, payload_hash: "b".repeat(64) }, state.aliceCookie);
    assert.equal(first.body.commitment.previous_commitment, "0".repeat(64));
    assert.equal(second.body.commitment.previous_commitment, first.body.commitment.root_hash);
    assert.equal((await call(state, "POST", "/api/node/commitments", { node_id: nodeId, event_count: 1, range_start: 6, range_end: 6, payload_hash: "c".repeat(64) }, state.bobCookie)).status, 404);

    const checkpoint = await call(state, "POST", "/api/node/checkpoints", {
      node_id: nodeId, shard_key: "social:local", event_from: 1, event_to: 5, reducer_version: "1.0.0",
      state_root: "d".repeat(64), backup_receipt_hash: "e".repeat(64),
    }, state.aliceCookie);
    assert.equal(checkpoint.status, 201, JSON.stringify(checkpoint.body));
    assert.equal(checkpoint.body.replica_verified, false);
    const after = await call(state, "GET", "/api/node/status", {}, state.aliceCookie);
    assert.equal(after.body.network.active_nodes, 1);
    assert.equal(after.body.network.candidate_manifests, 1);
    assert.equal(after.body.network.decentralization_claim, false);
    assert.equal((await call(state, "POST", "/api/node/manifests", { trust_class: "T0", protocol_version: "1.0.0", service_roles: ["unknown"] }, state.aliceCookie)).status, 400);
  } finally { state.db.close(); }
});

test("M12 schema fixes local payment lineage, split conservation and D0 checkpoint evidence", () => {
  for (const table of ["pay_resolution_receipts", "pay_transfer_intents", "creator_support_products", "creator_support_intents", "creator_reward_epochs", "nexus_node_manifests", "nexus_node_event_commitments", "nexus_node_checkpoints"]) {
    assert.match(SCHEMA, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(SCHEMA, /gross_cents = creator_share_cents \+ nexus_fee_cents \+ safety_reserve_cents \+ infra_cents/);
  assert.match(SCHEMA, /LOCAL_COMMITMENT_ONLY/);
  assert.match(SCHEMA, /LOCAL_NO_ADVERTISEMENT/);
  assert.match(SCHEMA, /nexus-genesis-local/);
});
