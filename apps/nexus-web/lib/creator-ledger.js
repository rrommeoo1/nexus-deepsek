import { createHash } from "node:crypto";

/**
 * F1 — the double-entry core of creator monetisation, without a database.
 *
 * The specification (`docs/MONETIZATION-SPEC.md` §3.5, §4) asks for settlement and balances on top of
 * the support intents that already exist, with the invariants I1–I11 written as tests. This module is
 * that core: pure functions plus an in-memory store, so every rule can be proved before a single row
 * is written to SQLite. The store seam (`accounts`, `entries`, `settlements`, `payouts`, `refunds`)
 * is deliberately narrow: wiring it to `ledger_accounts`, `ledger_entries`, `support_settlements` and
 * `payout_requests` (§4.1) is a translation, not a redesign.
 *
 * Money is integer `*_cents` of the currency in use — `JB` has two decimals, so one `JBc` is one cent.
 * Nothing here signs, broadcasts or talks to a chain: on devnet the funding account is filled with a
 * deposit, and that is the only way money enters.
 */

/** Split versions of the specification, in basis points of the gross amount. */
export const SPLITS = Object.freeze({
  CORE_TIP_V1_90_5_3_2: Object.freeze({ creator: 9000, fee: 500, reserve: 300, infra: 200 }),
  CORE_MEMBERSHIP_V1_85_10_3_2: Object.freeze({ creator: 8500, fee: 1000, reserve: 300, infra: 200 }),
});

/** Intents that must never reach the ledger (I7). */
const NON_SETTLEABLE = new Set(["demo_unpaid", "excluded_synthetic"]);

/** The share of a price the settlement cost may take (I10): 2% of the revenue. */
export const SETTLEMENT_SHARE_OF_PRICE = 0.02;

/** The floor the creator must keep from every payment (I9). */
export const CREATOR_MINIMUM_SHARE = 0.5;

export class LedgerError extends Error {
  constructor(code, message, status = 409) {
    super(message);
    this.name = "LedgerError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Splits a gross amount by largest remainder, so the four shares always add up to the gross (I1).
 * Integer arithmetic only: a cent may not be invented or lost at the boundary.
 */
export function splitAmount(grossCents, splitVersion) {
  const split = SPLITS[splitVersion];
  if (!split) throw new LedgerError("UNKNOWN_SPLIT", `unknown split version ${splitVersion}`, 500);
  if (!Number.isInteger(grossCents) || grossCents <= 0) {
    throw new LedgerError("INVALID_AMOUNT", "gross must be a positive integer number of cents", 400);
  }
  const parts = Object.entries(split).map(([key, bps]) => {
    const exact = (grossCents * bps) / 10000;
    return { key, cents: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let left = grossCents - parts.reduce((sum, part) => sum + part.cents, 0);
  const order = [...parts].sort((a, b) => b.remainder - a.remainder || a.key.localeCompare(b.key));
  for (const part of order) {
    if (left <= 0) break;
    part.cents += 1;
    left -= 1;
  }
  const shares = {};
  for (const part of parts) shares[part.key] = part.cents;
  const total = Object.values(shares).reduce((sum, cents) => sum + cents, 0);
  if (total !== grossCents) throw new LedgerError("SPLIT_MISMATCH", "the split lost or invented a cent", 500);
  return shares;
}

/**
 * The lowest price that pays for its own settlement at the assumed batch (I10), and the price above
 * which the creator keeps at least half (I9). Both are returned, and the caller refuses below either.
 */
export function priceFloorCents({ cost_per_action_cents, split_version = "CORE_TIP_V1_90_5_3_2" }) {
  const split = SPLITS[split_version];
  if (!split) throw new LedgerError("UNKNOWN_SPLIT", `unknown split version ${split_version}`, 500);
  const costFloor = Math.ceil(Number(cost_per_action_cents || 0) / SETTLEMENT_SHARE_OF_PRICE);
  const creatorShare = split.creator / 10000;
  const shareFloor = creatorShare >= CREATOR_MINIMUM_SHARE ? 0 : Math.ceil(0);
  return { cost_floor_cents: costFloor, creator_floor_cents: shareFloor, floor_cents: Math.max(costFloor, shareFloor) };
}

/** I11: the exact refusal the product needs, with the reason spelled out. */
export function assertPriceAllowed({ price_cents, split_version = "CORE_TIP_V1_90_5_3_2", cost_per_action_cents }) {
  const { floor_cents, cost_floor_cents } = priceFloorCents({ cost_per_action_cents, split_version });
  if (!Number.isInteger(price_cents) || price_cents <= 0) {
    return { ok: false, reason: "PRICE_INVALID", message: "price must be a positive integer number of cents" };
  }
  if (price_cents < cost_floor_cents) {
    return {
      ok: false,
      reason: "PRICE_BELOW_SETTLEMENT_COST",
      message: `price must be at least ${cost_floor_cents} cents so settlement does not exceed ` +
        `${SETTLEMENT_SHARE_OF_PRICE * 100}% of it`,
    };
  }
  if (price_cents < floor_cents) {
    return { ok: false, reason: "PRICE_BELOW_FLOOR", message: `price must be at least ${floor_cents} cents` };
  }
  const shares = splitAmount(price_cents, split_version);
  if (shares.creator / price_cents < CREATOR_MINIMUM_SHARE) {
    return { ok: false, reason: "CREATOR_SHARE_TOO_LOW", message: "the creator must keep at least half" };
  }
  return { ok: true, reason: null, message: null, shares };
}

/** Account names are ids, never identities: no email, handle or wallet address in the ledger (§4.1). */
export function accountId(kind, ownerId, currency) {
  if (!new Set(["creator", "fee", "reserve", "infra", "funding", "payout_clearing"]).has(kind)) {
    throw new LedgerError("UNKNOWN_ACCOUNT_KIND", `unknown account kind ${kind}`, 500);
  }
  return `${kind}:${ownerId}:${currency}`;
}

/**
 * The in-memory implementation of the four tables in §4.1.
 *
 * Everything is synchronous and total: a call either writes every entry it describes or writes
 * nothing at all, which is what makes "no balance goes negative" (I3) a property and not a hope.
 */
export function createLedger({ now = () => new Date().toISOString(), currency = "JB" } = {}) {
  const accounts = new Map();
  const entries = [];
  const settlements = new Map();
  const refunds = new Map();
  const payouts = new Map();
  const idempotent = new Map();
  let sequence = 0;

  const nextId = (prefix) => `${prefix}_${String((sequence += 1)).padStart(6, "0")}`;

  function ensureAccount(kind, ownerId, cur = currency) {
    const id = accountId(kind, ownerId, cur);
    if (!accounts.has(id)) {
      accounts.set(id, { id, kind, owner_id: String(ownerId), currency: cur, created_at: now() });
    }
    return accounts.get(id);
  }

  function balance(accId) {
    let cents = 0;
    for (const entry of entries) {
      if (entry.account_id !== accId) continue;
      cents += entry.direction === "credit" ? entry.amount_cents : -entry.amount_cents;
    }
    return cents;
  }

  /** Writes a set of entries as one step: balances are checked first, then everything is appended. */
  function post(settlementId, rows) {
    const deltas = new Map();
    for (const row of rows) {
      const signed = row.direction === "credit" ? row.amount_cents : -row.amount_cents;
      deltas.set(row.account_id, (deltas.get(row.account_id) || 0) + signed);
    }
    for (const [accId, delta] of deltas) {
      if (!accounts.has(accId)) throw new LedgerError("UNKNOWN_ACCOUNT", `no account ${accId}`, 500);
      if (balance(accId) + delta < 0) {
        throw new LedgerError("INSUFFICIENT_FUNDS", `account ${accId} would go negative`, 409);
      }
    }
    return rows.map((row) => {
      const entry = {
        id: nextId("entry"),
        settlement_id: settlementId,
        account_id: row.account_id,
        direction: row.direction,
        amount_cents: row.amount_cents,
        created_at: now(),
      };
      entries.push(entry);
      return entry;
    });
  }

  function replay(key) {
    return key ? idempotent.get(key) || null : null;
  }

  function remember(key, value) {
    if (key) idempotent.set(key, value);
    return value;
  }

  function deposit({ account_id, amount_cents, reference }) {
    if (!accounts.has(account_id)) throw new LedgerError("UNKNOWN_ACCOUNT", `no account ${account_id}`, 500);
    if (!Number.isInteger(amount_cents) || amount_cents <= 0) {
      throw new LedgerError("INVALID_AMOUNT", "deposit must be a positive integer number of cents", 400);
    }
    return post(`deposit:${reference || nextId("dep")}`, [
      { account_id, direction: "credit", amount_cents },
    ]);
  }

  function postSettlement({ intent, idempotency_key: key }) {
    const previous = replay(key);
    if (previous) return { ...previous, replayed: true };
    if (!intent || !intent.id) throw new LedgerError("INVALID_INTENT", "an intent is required", 400);
    if (NON_SETTLEABLE.has(intent.status)) {
      throw new LedgerError(
        "SETTLEMENT_NOT_ALLOWED",
        `intent ${intent.id} is ${intent.status} and never reaches the ledger`,
        409,
      );
    }
    if (settlements.has(intent.id)) {
      throw new LedgerError("ALREADY_SETTLED", `intent ${intent.id} already has a settlement`, 409);
    }
    const gross = intent.gross_cents;
    const shares = splitAmount(gross, intent.split_version);
    const cur = intent.currency || currency;
    const settlementId = nextId("stl");
    const funding = ensureAccount("funding", "platform", cur).id;
    const rows = [
      { account_id: funding, direction: "debit", amount_cents: gross },
      { account_id: ensureAccount("creator", intent.creator_id, cur).id, direction: "credit", amount_cents: shares.creator },
      { account_id: ensureAccount("fee", "platform", cur).id, direction: "credit", amount_cents: shares.fee },
      { account_id: ensureAccount("reserve", "platform", cur).id, direction: "credit", amount_cents: shares.reserve },
      { account_id: ensureAccount("infra", "platform", cur).id, direction: "credit", amount_cents: shares.infra },
    ];
    const written = post(settlementId, rows);
    const settlement = {
      id: settlementId,
      intent_id: intent.id,
      creator_id: String(intent.creator_id),
      status: "posted",
      currency: cur,
      gross_cents: gross,
      split_version: intent.split_version,
      shares,
      posted_at: now(),
    };
    settlements.set(intent.id, settlement);
    return remember(key, { settlement, entries: written, replayed: false });
  }
  /** I4: compensating entries, once, and the sum of everything for that intent goes back to zero. */
  function postRefund({ intent_id, reason, idempotency_key: key }) {
    const previous = replay(key);
    if (previous) return { ...previous, replayed: true };
    const settlement = settlements.get(intent_id);
    if (!settlement) throw new LedgerError("NOT_SETTLED", `intent ${intent_id} has no settlement`, 404);
    if (refunds.has(intent_id)) {
      throw new LedgerError("ALREADY_REFUNDED", `intent ${intent_id} was already refunded`, 409);
    }
    if (!reason || !String(reason).trim()) throw new LedgerError("REASON_REQUIRED", "a reason is required", 400);
    const cur = settlement.currency;
    const rows = [
      { account_id: accountId("creator", settlement.creator_id, cur), direction: "debit", amount_cents: settlement.shares.creator },
      { account_id: accountId("fee", "platform", cur), direction: "debit", amount_cents: settlement.shares.fee },
      { account_id: accountId("reserve", "platform", cur), direction: "debit", amount_cents: settlement.shares.reserve },
      { account_id: accountId("infra", "platform", cur), direction: "debit", amount_cents: settlement.shares.infra },
      { account_id: accountId("funding", "platform", cur), direction: "credit", amount_cents: settlement.gross_cents },
    ];
    const written = post(`refund:${settlement.id}`, rows);
    settlement.status = "refunded";
    const refund = {
      settlement_id: settlement.id,
      intent_id,
      reason: String(reason).trim(),
      currency: cur,
      gross_cents: settlement.gross_cents,
      refunded_at: now(),
    };
    refunds.set(intent_id, refund);
    return remember(key, { settlement, refund, entries: written, replayed: false });
  }

  /** I3: a payout above what the creator has is refused before a single entry is written. */
  function requestPayout({ creator_id, amount_cents, currency: cur = currency, idempotency_key: key }) {
    const previous = replay(key);
    if (previous) return { ...previous, replayed: true };
    if (!Number.isInteger(amount_cents) || amount_cents <= 0) {
      throw new LedgerError("INVALID_AMOUNT", "a payout must be a positive integer number of cents", 400);
    }
    const creator = ensureAccount("creator", creator_id, cur);
    const available = balance(creator.id);
    if (amount_cents > available) {
      throw new LedgerError(
        "INSUFFICIENT_FUNDS",
        `payout of ${amount_cents} exceeds the available ${available}`,
        409,
      );
    }
    const payout = {
      id: nextId("pay"),
      creator_id: String(creator_id),
      amount_cents,
      currency: cur,
      status: "requested",
      requested_at: now(),
      decided_by: null,
      decided_at: null,
    };
    payouts.set(payout.id, payout);
    return remember(key, { payout, replayed: false });
  }
  function payPayout({ payout_id, idempotency_key: key }) {
    const previous = replay(key);
    if (previous) return { ...previous, replayed: true };
    const payout = payouts.get(payout_id);
    if (!payout) throw new LedgerError("NOT_FOUND", `no payout ${payout_id}`, 404);
    if (payout.status === "paid") throw new LedgerError("ALREADY_PAID", `payout ${payout_id} was paid`, 409);
    const creator = accountId("creator", payout.creator_id, payout.currency);
    const clearing = ensureAccount("payout_clearing", "platform", payout.currency).id;
    const written = post(`payout:${payout.id}`, [
      { account_id: creator, direction: "debit", amount_cents: payout.amount_cents },
      { account_id: clearing, direction: "credit", amount_cents: payout.amount_cents },
    ]);
    payout.status = "paid";
    payout.decided_at = now();
    return remember(key, { payout, entries: written, replayed: false });
  }

  /** I5: what the dashboard prints must be the sum of the entries, not a number computed elsewhere. */
  function totals({ creator_id, currency: cur = currency }) {
    const creator = accountId("creator", creator_id, cur);
    const earned = entries
      .filter((entry) => entry.account_id === creator && entry.direction === "credit")
      .reduce((sum, entry) => sum + entry.amount_cents, 0);
    return { available_cents: balance(creator), earned_cents: earned, currency: cur };
  }

  function reconcile() {
    const differences = [];
    let debits = 0;
    let credits = 0;
    let external = 0;
    for (const entry of entries) {
      // A deposit is money arriving from outside the ledger (the devnet treasury), so it is the one
      // credit that has no debit: it is counted separately instead of unbalancing the report.
      if (String(entry.settlement_id).startsWith("deposit:")) {
        external += entry.amount_cents;
        continue;
      }
      if (entry.direction === "debit") debits += entry.amount_cents;
      else credits += entry.amount_cents;
    }
    // Deposits are excluded from both sides: money entering the ledger has no counterparty entry.
    if (debits !== credits) differences.push({ kind: "unbalanced", debits, credits, external });
    for (const account of accounts.values()) {
      if (account.kind !== "creator") continue;
      const settled = [...settlements.values()]
        .filter((row) => row.status === "posted" && accountId("creator", row.creator_id, row.currency) === account.id)
        .reduce((sum, row) => sum + row.shares.creator, 0);
      const actual = balance(account.id);
      if (actual < 0) differences.push({ kind: "negative", account: account.id, actual });
      if (actual !== settled) differences.push({ kind: "creator_total", account: account.id, settled, actual });
    }
    return { ok: differences.length === 0, differences, entries: entries.length, debits, credits, external };
  }

  /** I8: an account that already appears in the ledger cannot be deleted out from under it. */
  function deleteAccount(accId) {
    if (entries.some((entry) => entry.account_id === accId)) {
      throw new LedgerError("ACCOUNT_IN_USE", `account ${accId} has entries`, 409);
    }
    return accounts.delete(accId);
  }

  return {
    accounts,
    entries,
    settlements,
    refunds,
    payouts,
    ensureAccount,
    balance,
    deposit,
    postSettlement,
    postRefund,
    requestPayout,
    payPayout,
    totals,
    reconcile,
    deleteAccount,
  };
}



