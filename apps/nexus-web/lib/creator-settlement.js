import { randomBytes } from "node:crypto";
import { LedgerError, accountId, splitForStorage } from "./creator-ledger.js";
import { json, readJson, sanitizeText } from "./transport.js";

/**
 * F1.2 — the ledger core of `creator-ledger.js`, written to SQLite.
 *
 * The pure module owns the money arithmetic (splits, floors, the invariants) and its tests own the
 * proof that the arithmetic is right. This module owns the four tables of `MONETIZATION-SPEC.md` §4.1
 * and the four routes of §4.3, so there is exactly one place where a cent is divided and one place
 * where it is stored. Every write happens inside a SAVEPOINT: an entry set either lands whole or not
 * at all, which is what makes "no balance goes negative" (I3) hold under failure and not only under
 * ordinary input.
 *
 * Not here, deliberately: no chain call, no real money, no personal data. The ledger knows ids and
 * amounts; identity stays in `users`.
 */

/** Which ledger account kind belongs to which row of `ledger_accounts`. */
const ACCOUNT_OWNERS = Object.freeze({
  creator: { owner_kind: "user", owner: (ownerRef) => String(ownerRef) },
  fee: { owner_kind: "platform", owner: () => "nexus_fee" },
  reserve: { owner_kind: "reserve", owner: () => "safety" },
  infra: { owner_kind: "infra", owner: () => "network" },
  funding: { owner_kind: "platform", owner: () => "treasury" },
  payout_clearing: { owner_kind: "platform", owner: () => "payout_clearing" },
});

export const DEFAULT_LEDGER_CURRENCY = "TEST-USDC";

/** §3.5: only a build that says so may turn a demo intent into a settled one. */
export function settlementEnabled(env = process.env) {
  return String(env.NEXUS_SETTLE_DEMO ?? "").trim() === "1";
}

/** Runs `work` inside a SAVEPOINT, so a refusal leaves the database exactly as it was. */
function guarded(db, name, work) {
  const savepoint = `nexus_${name}_${randomBytes(4).toString("hex")}`;
  db.exec(`SAVEPOINT ${savepoint}`);
  try {
    const result = work();
    db.exec(`RELEASE ${savepoint}`);
    return result;
  } catch (error) {
    db.exec(`ROLLBACK TO ${savepoint}`);
    db.exec(`RELEASE ${savepoint}`);
    throw error;
  }
}

function ensureAccount(db, kind, ownerRef, currency) {
  const owner = ACCOUNT_OWNERS[kind];
  if (!owner) throw new LedgerError("UNKNOWN_ACCOUNT_KIND", `unknown account kind ${kind}`, 500);
  const id = accountId(kind, owner.owner(ownerRef), currency);
  const existing = db.prepare("SELECT * FROM ledger_accounts WHERE id = ?").get(id);
  if (existing) return existing;
  db.prepare("INSERT INTO ledger_accounts (id, owner_kind, owner_id, currency) VALUES (?, ?, ?, ?)")
    .run(id, owner.owner_kind, owner.owner(ownerRef), currency);
  return db.prepare("SELECT * FROM ledger_accounts WHERE id = ?").get(id);
}

function balanceCents(db, accId) {
  const row = db.prepare(`SELECT COALESCE(SUM(CASE direction WHEN 'credit' THEN amount_cents ELSE -amount_cents END), 0) cents
    FROM ledger_entries WHERE account_id = ?`).get(accId);
  return Number(row.cents);
}

/** Writes the entries of one settlement, refusing the whole set if any account would go negative. */
function postEntries(db, settlementId, rows) {
  const deltas = new Map();
  for (const row of rows) {
    if (!Number.isSafeInteger(row.amount_cents) || row.amount_cents <= 0) {
      throw new LedgerError("INVALID_AMOUNT", "an entry must be a positive integer number of cents", 400);
    }
    const signed = row.direction === "credit" ? row.amount_cents : -row.amount_cents;
    deltas.set(row.account_id, (deltas.get(row.account_id) || 0) + signed);
  }
  for (const [accId, delta] of deltas) {
    if (!db.prepare("SELECT 1 FROM ledger_accounts WHERE id = ?").get(accId)) {
      throw new LedgerError("UNKNOWN_ACCOUNT", `no account ${accId}`, 500);
    }
    if (balanceCents(db, accId) + delta < 0) {
      throw new LedgerError("INSUFFICIENT_FUNDS", `account ${accId} would go negative`, 409);
    }
  }
  const insert = db.prepare(`INSERT INTO ledger_entries (settlement_id, account_id, direction, amount_cents)
    VALUES (?, ?, ?, ?)`);
  const ids = [];
  for (const row of rows) {
    const info = insert.run(settlementId, row.account_id, row.direction, row.amount_cents);
    ids.push(Number(info.lastInsertRowid));
  }
  return ids.map((id) => db.prepare("SELECT * FROM ledger_entries WHERE id = ?").get(id));
}

/**
 * Fills the treasury, the way devnet does before anything can be settled. Not a route: an endpoint
 * that mints balance would be the one hole every other invariant here is meant to close.
 */
export function depositTreasury({ db, amountCents, reference = "devnet", currency = DEFAULT_LEDGER_CURRENCY }) {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new LedgerError("INVALID_AMOUNT", "a deposit must be a positive integer number of cents", 400);
  }
  return guarded(db, "deposit", () => {
    const funding = ensureAccount(db, "funding", null, currency);
    const settlementId = `deposit:${sanitizeText(String(reference), 60) || "devnet"}:${randomBytes(6).toString("hex")}`;
    const [entry] = postEntries(db, settlementId, [
      { account_id: funding.id, direction: "credit", amount_cents: amountCents },
    ]);
    return { account: funding, entry, balance_cents: balanceCents(db, funding.id) };
  });
}

/**
 * Turns one support intent into a posted settlement (§4.3, `POST .../:id/settle`).
 *
 * `allowDemo` is the `NEXUS_SETTLE_DEMO=1` switch and nothing else: without it a `demo_unpaid` intent
 * stays out of the ledger, which is invariant I7. `excluded_synthetic` is refused in both cases --
 * synthetic traffic must not be able to become revenue by any path.
 */
export function settleIntent({ db, creatorId, intentId, allowDemo = false, currency = DEFAULT_LEDGER_CURRENCY }) {
  const intent = db.prepare("SELECT * FROM creator_support_intents WHERE id = ?").get(String(intentId ?? ""));
  if (!intent || Number(intent.creator_id) !== Number(creatorId)) {
    throw new LedgerError("NOT_FOUND", "support intent not found", 404);
  }
  if (intent.status === "excluded_synthetic") {
    throw new LedgerError("SETTLEMENT_NOT_ALLOWED", "synthetic traffic cannot be settled", 409);
  }
  if (intent.status === "demo_unpaid" && !allowDemo) {
    throw new LedgerError("SETTLEMENT_DISABLED", "demo settlements are disabled", 409);
  }
  if (intent.status !== "demo_unpaid") {
    throw new LedgerError("ALREADY_SETTLED", `intent is ${intent.status}`, 409);
  }
  const gross = Number(intent.gross_cents);
  const expected = splitForStorage(gross, intent.split_version);
  if (expected.creator !== Number(intent.creator_share_cents) || expected.fee !== Number(intent.nexus_fee_cents)
    || expected.reserve !== Number(intent.safety_reserve_cents) || expected.infra !== Number(intent.infra_cents)) {
    throw new LedgerError("SPLIT_MISMATCH", "the stored split no longer matches its version", 409);
  }
  const cur = String(intent.currency || currency);
  return guarded(db, "settle", () => {
    const id = `stl_${randomBytes(10).toString("hex")}`;
    const funding = ensureAccount(db, "funding", null, cur);
    const rows = [
      { account_id: funding.id, direction: "debit", amount_cents: gross },
      { account_id: ensureAccount(db, "creator", creatorId, cur).id, direction: "credit", amount_cents: expected.creator },
      { account_id: ensureAccount(db, "fee", null, cur).id, direction: "credit", amount_cents: expected.fee },
      { account_id: ensureAccount(db, "reserve", null, cur).id, direction: "credit", amount_cents: expected.reserve },
      { account_id: ensureAccount(db, "infra", null, cur).id, direction: "credit", amount_cents: expected.infra },
    ].filter((row) => row.amount_cents > 0);
    db.prepare(`INSERT INTO support_settlements
      (id, intent_id, creator_id, currency, gross_cents, creator_share_cents, nexus_fee_cents, safety_reserve_cents, infra_cents, split_version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, intent.id, creatorId, cur, gross, expected.creator, expected.fee, expected.reserve, expected.infra, intent.split_version);
    const entries = postEntries(db, id, rows);
    db.prepare("UPDATE creator_support_intents SET status = 'settled', payout_eligible = 1 WHERE id = ?").run(intent.id);
    return {
      settlement: db.prepare("SELECT * FROM support_settlements WHERE id = ?").get(id),
      entries,
      available_cents: balanceCents(db, accountId("creator", creatorId, cur)),
    };
  });
}

/**
 * Reverses a settlement once (§4.3, `POST .../:id/refund`), with compensating entries whose sum is
 * zero: the creator gives back exactly what was credited, so no account is richer or poorer than
 * before the settlement and no refund can be paid twice (I4).
 */
export function refundIntent({ db, creatorId, intentId, reason, currency = DEFAULT_LEDGER_CURRENCY }) {
  const settlement = db.prepare("SELECT * FROM support_settlements WHERE intent_id = ?").get(String(intentId ?? ""));
  if (!settlement || Number(settlement.creator_id) !== Number(creatorId)) {
    throw new LedgerError("NOT_FOUND", "settlement not found", 404);
  }
  if (settlement.status !== "posted") {
    throw new LedgerError("ALREADY_REFUNDED", `settlement is ${settlement.status}`, 409);
  }
  const why = sanitizeText(String(reason ?? ""), 120);
  if (why.length < 3) throw new LedgerError("REASON_REQUIRED", "a refund needs a reason", 400);
  const cur = String(settlement.currency || currency);
  return guarded(db, "refund", () => {
    const funding = ensureAccount(db, "funding", null, cur);
    const rows = [
      { account_id: ensureAccount(db, "creator", creatorId, cur).id, direction: "debit", amount_cents: Number(settlement.creator_share_cents) },
      { account_id: ensureAccount(db, "fee", null, cur).id, direction: "debit", amount_cents: Number(settlement.nexus_fee_cents) },
      { account_id: ensureAccount(db, "reserve", null, cur).id, direction: "debit", amount_cents: Number(settlement.safety_reserve_cents) },
      { account_id: ensureAccount(db, "infra", null, cur).id, direction: "debit", amount_cents: Number(settlement.infra_cents) },
      { account_id: funding.id, direction: "credit", amount_cents: Number(settlement.gross_cents) },
    ].filter((row) => row.amount_cents > 0);
    const entries = postEntries(db, `refund:${settlement.id}`, rows);
    db.prepare("UPDATE support_settlements SET status = 'refunded', refund_reason = ?, reversed_at = unixepoch() WHERE id = ?")
      .run(why, settlement.id);
    db.prepare("UPDATE creator_support_intents SET status = 'refunded', payout_eligible = 0 WHERE id = ?").run(settlement.intent_id);
    return {
      settlement: db.prepare("SELECT * FROM support_settlements WHERE id = ?").get(settlement.id),
      entries,
      available_cents: balanceCents(db, accountId("creator", creatorId, cur)),
    };
  });
}

/**
 * What the creator panel shows (§4.3, `GET /api/creator/ledger`). Every number here is a sum of
 * entries of that same creator account, never a counter maintained elsewhere (I5).
 */
export function creatorLedger({ db, creatorId, currency = DEFAULT_LEDGER_CURRENCY }) {
  const accId = accountId("creator", creatorId, currency);
  const account = db.prepare("SELECT * FROM ledger_accounts WHERE id = ?").get(accId) || null;
  const entries = db.prepare("SELECT * FROM ledger_entries WHERE account_id = ? ORDER BY id").all(accId);
  const earned = entries.filter((row) => row.direction === "credit").reduce((sum, row) => sum + Number(row.amount_cents), 0);
  const paidOut = entries.filter((row) => row.direction === "debit").reduce((sum, row) => sum + Number(row.amount_cents), 0);
  const settlements = db.prepare(`SELECT id, intent_id, gross_cents, creator_share_cents, currency, split_version, status, posted_at, reversed_at
    FROM support_settlements WHERE creator_id = ? ORDER BY posted_at DESC, id LIMIT 100`).all(creatorId);
  return {
    account,
    entries,
    settlements,
    totals: { available_cents: earned - paidOut, earned_cents: earned, paid_out_cents: paidOut, currency },
  };
}

/** A payout request is a claim on the available balance, refused the moment it exceeds it (I3). */
export function requestCreatorPayout({ db, creatorId, amountCents, currency = DEFAULT_LEDGER_CURRENCY }) {
  const amount = Number(amountCents);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new LedgerError("INVALID_AMOUNT", "a payout must be a positive integer number of cents", 400);
  }
  const available = balanceCents(db, accountId("creator", creatorId, currency));
  if (amount > available) {
    throw new LedgerError("INSUFFICIENT_FUNDS", "payout exceeds the available balance", 409);
  }
  const id = `pay_${randomBytes(10).toString("hex")}`;
  db.prepare("INSERT INTO payout_requests (id, creator_id, currency, amount_cents) VALUES (?, ?, ?, ?)")
    .run(id, creatorId, currency, amount);
  return { payout: db.prepare("SELECT * FROM payout_requests WHERE id = ?").get(id), available_cents: available };
}

export function listCreatorPayouts({ db, creatorId }) {
  return db.prepare("SELECT * FROM payout_requests WHERE creator_id = ? ORDER BY created_at DESC, id DESC LIMIT 100").all(creatorId);
}

/**
 * Paying a payout moves the money to the clearing account: the creator's balance goes down, nothing
 * else changes, and a payout cannot be paid twice.
 */
export function payCreatorPayout({ db, creatorId, payoutId, decidedBy = null, currency = DEFAULT_LEDGER_CURRENCY }) {
  const payout = db.prepare("SELECT * FROM payout_requests WHERE id = ?").get(String(payoutId ?? ""));
  if (!payout || Number(payout.creator_id) !== Number(creatorId)) {
    throw new LedgerError("NOT_FOUND", "payout not found", 404);
  }
  if (payout.status === "paid") throw new LedgerError("ALREADY_PAID", "payout was paid", 409);
  if (payout.status === "rejected") throw new LedgerError("PAYOUT_REJECTED", "payout was rejected", 409);
  return guarded(db, "payout", () => {
    const cur = String(payout.currency || currency);
    const entries = postEntries(db, `payout:${payout.id}`, [
      { account_id: ensureAccount(db, "creator", creatorId, cur).id, direction: "debit", amount_cents: Number(payout.amount_cents) },
      { account_id: ensureAccount(db, "payout_clearing", null, cur).id, direction: "credit", amount_cents: Number(payout.amount_cents) },
    ]);
    db.prepare("UPDATE payout_requests SET status = 'paid', decided_by = ?, decided_at = unixepoch() WHERE id = ?")
      .run(decidedBy, payout.id);
    return { payout: db.prepare("SELECT * FROM payout_requests WHERE id = ?").get(payout.id), entries };
  });
}

/**
 * Re-derives the whole ledger from its entries: debits must equal credits (deposits are the one
 * credit without a counterparty), no account may be negative, and every posted settlement must have
 * its four credits and one debit present. Any difference is returned, never repaired here (`I5`).
 */
export function reconcileCreatorLedger(db) {
  const differences = [];
  const totals = db.prepare(`SELECT COALESCE(SUM(CASE direction WHEN 'debit' THEN amount_cents ELSE 0 END), 0) debits,
    COALESCE(SUM(CASE direction WHEN 'credit' THEN amount_cents ELSE 0 END), 0) credits
    FROM ledger_entries WHERE settlement_id NOT LIKE 'deposit:%'`).get();
  const external = db.prepare(`SELECT COALESCE(SUM(amount_cents), 0) cents FROM ledger_entries WHERE settlement_id LIKE 'deposit:%'`).get();
  if (Number(totals.debits) !== Number(totals.credits)) {
    differences.push({ kind: "unbalanced", debits: Number(totals.debits), credits: Number(totals.credits) });
  }
  for (const account of db.prepare("SELECT * FROM ledger_accounts ORDER BY id").all()) {
    if (balanceCents(db, account.id) < 0) differences.push({ kind: "negative", account: account.id });
  }
  const posted = db.prepare("SELECT * FROM support_settlements WHERE status = 'posted'").all();
  for (const settlement of posted) {
    const credits = Number(db.prepare(`SELECT COALESCE(SUM(amount_cents), 0) cents FROM ledger_entries
      WHERE settlement_id = ? AND direction = 'credit'`).get(settlement.id).cents);
    const debits = Number(db.prepare(`SELECT COALESCE(SUM(amount_cents), 0) cents FROM ledger_entries
      WHERE settlement_id = ? AND direction = 'debit'`).get(settlement.id).cents);
    if (credits !== Number(settlement.gross_cents) || debits !== Number(settlement.gross_cents)) {
      differences.push({ kind: "settlement", settlement: settlement.id, credits, debits, gross: Number(settlement.gross_cents) });
    }
  }
  return {
    ok: differences.length === 0,
    differences,
    debits: Number(totals.debits),
    credits: Number(totals.credits),
    deposits_cents: Number(external.cents),
    settlements: posted.length,
  };
}

const SETTLEMENT_ROUTE = /^\/api\/creator\/support-intents\/([A-Za-z0-9_-]{4,80})\/(settle|refund)$/;

/**
 * The five routes of §4.3. Everything a caller can get wrong is answered with a code and a status,
 * never with a stack trace; a ledger refusal that is not a `LedgerError` is re-thrown, because it
 * would be a bug and silence would hide it.
 */
export async function handleCreatorSettlement({ req, res, method, path, repo, auth }) {
  const db = repo.db;
  const owner = Number(auth.user.id);
  const guardedWrite = (work) => {
    try {
      return work();
    } catch (error) {
      if (error instanceof LedgerError) {
        json(res, error.status, { ok: false, code: error.code, error: error.message, real_payment: false, real_settlements: 0 });
        return null;
      }
      throw error;
    }
  };

  if (method === "GET" && path === "/api/creator/ledger") {
    const ledger = creatorLedger({ db, creatorId: owner });
    return json(res, 200, { ok: true, owner_id: owner, private: true, ...ledger, real_payment: false, real_settlements: 0 }), true;
  }

  if (path === "/api/creator/payouts") {
    if (method === "GET") {
      return json(res, 200, { ok: true, owner_id: owner, private: true, payouts: listCreatorPayouts({ db, creatorId: owner }), real_payment: false }), true;
    }
    if (method !== "POST") return json(res, 405, { ok: false, error: "method not allowed" }), true;
    const body = await readJson(req);
    const amount = Number(body?.amount_cents);
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => key !== "amount_cents")
      || !Number.isSafeInteger(amount) || amount <= 0) {
      return json(res, 400, { ok: false, error: "payout amount invalid" }), true;
    }
    const result = guardedWrite(() => requestCreatorPayout({ db, creatorId: owner, amountCents: amount }));
    if (result) json(res, 201, { ok: true, ...result, real_payment: false, real_settlements: 0 });
    return true;
  }

  const match = SETTLEMENT_ROUTE.exec(path);
  if (!match || method !== "POST") return false;
  const [, intentId, action] = match;

  if (action === "settle") {
    if (!settlementEnabled()) {
      return json(res, 409, { ok: false, code: "SETTLEMENT_DISABLED", error: "settlements are disabled on this build", real_payment: false, real_settlements: 0 }), true;
    }
    const body = await readJson(req);
    if (body && typeof body === "object" && !Array.isArray(body) && Object.keys(body).length > 0) {
      return json(res, 400, { ok: false, error: "settle takes no fields" }), true;
    }
    const result = guardedWrite(() => settleIntent({ db, creatorId: owner, intentId, allowDemo: true }));
    if (result) json(res, 201, { ok: true, ...result, currency: result.settlement.currency, real_payment: false, real_settlements: 0 });
    return true;
  }

  const body = await readJson(req);
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => key !== "reason")) {
    return json(res, 400, { ok: false, error: "refund fields invalid" }), true;
  }
  const result = guardedWrite(() => refundIntent({ db, creatorId: owner, intentId, reason: body.reason }));
  if (result) json(res, 201, { ok: true, ...result, currency: result.settlement.currency, real_payment: false, real_settlements: 0 });
  return true;
}



