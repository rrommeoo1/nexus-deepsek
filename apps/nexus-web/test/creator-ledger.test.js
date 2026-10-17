import test from "node:test";
import assert from "node:assert/strict";

import {
  SPLITS,
  LedgerError,
  createLedger,
  splitAmount,
  priceFloorCents,
  assertPriceAllowed,
  accountId,
  CREATOR_MINIMUM_SHARE,
} from "../lib/creator-ledger.js";

// F1 — the invariants I1–I11 of docs/MONETIZATION-SPEC.md §4.2 and §3.5.4, as properties.
// Deterministic: a small seeded generator, no clock, no network, no database.

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SPLIT_NAMES = Object.keys(SPLITS);

function intent(overrides = {}) {
  return {
    id: "int_1",
    creator_id: "u_creator",
    gross_cents: 200,
    currency: "JB",
    split_version: "CORE_TIP_V1_90_5_3_2",
    status: "settled",
    ...overrides,
  };
}

/** A ledger whose treasury already holds `cents`, the way devnet funds it before settling. */
function fundedLedger(cents = 1_000_000) {
  const ledger = createLedger({ now: () => "2026-10-17T00:00:00.000Z" });
  const funding = ledger.ensureAccount("funding", "platform").id;
  ledger.deposit({ account_id: funding, amount_cents: cents, reference: "devnet:1" });
  return ledger;
}

test("I1 — the four shares always add up to the gross, for any price and both splits", () => {
  const random = rng(11);
  const amounts = [1, 2, 3, 5, 7, 10, 21, 99, 100, 101, 999, 1000];
  for (let i = 0; i < 400; i += 1) amounts.push(1 + Math.floor(random() * 5_000_000));
  for (const version of SPLIT_NAMES) {
    for (const gross of amounts) {
      const shares = splitAmount(gross, version);
      const total = shares.creator + shares.fee + shares.reserve + shares.infra;
      assert.equal(total, gross, `${version} lost a cent at ${gross}`);
      for (const [key, value] of Object.entries(shares)) {
        assert.ok(value >= 0, `${key} went negative at ${gross}`);
        assert.ok(Number.isInteger(value), `${key} is not an integer at ${gross}`);
      }
    }
  }
});

test("I2 — a settlement posts matching debits and credits, and never twice", () => {
  const ledger = fundedLedger();
  const first = ledger.postSettlement({ intent: intent() });
  assert.equal(first.entries.length, 5);
  const debits = first.entries.filter((row) => row.direction === "debit");
  const credits = first.entries.filter((row) => row.direction === "credit");
  assert.equal(debits.reduce((sum, row) => sum + row.amount_cents, 0), 200);
  assert.equal(credits.reduce((sum, row) => sum + row.amount_cents, 0), 200);

  const before = ledger.entries.length;
  assert.throws(
    () => ledger.postSettlement({ intent: intent() }),
    (error) => error instanceof LedgerError && error.code === "ALREADY_SETTLED" && error.status === 409,
  );
  assert.equal(ledger.entries.length, before, "the refused post wrote an entry");
});

test("I3 — no balance ever goes negative: an oversized payout and an empty treasury both refuse", () => {
  const ledger = fundedLedger(150);
  ledger.postSettlement({ intent: intent({ gross_cents: 100 }) });
  const creator = accountId("creator", "u_creator", "JB");
  const available = ledger.balance(creator);
  assert.equal(available, 90);

  assert.throws(
    () => ledger.requestPayout({ creator_id: "u_creator", amount_cents: available + 1 }),
    (error) => error.code === "INSUFFICIENT_FUNDS" && error.status === 409,
  );
  assert.equal(ledger.balance(creator), available, "a refused payout moved money");

  // The treasury is emptied by the first settlement, so the second must refuse and write nothing.
  const entries = ledger.entries.length;
  assert.throws(
    () => ledger.postSettlement({ intent: intent({ id: "int_2", gross_cents: 100 }) }),
    (error) => error.code === "INSUFFICIENT_FUNDS",
  );
  assert.equal(ledger.entries.length, entries);
  assert.equal(ledger.balance(accountId("funding", "platform", "JB")), 50);
});

test("I4 — a refund happens once, with compensating entries whose sum is zero", () => {
  const ledger = fundedLedger();
  ledger.postSettlement({ intent: intent({ gross_cents: 301 }) });
  const creator = accountId("creator", "u_creator", "JB");
  const settlement = ledger.settlements.get("int_1");
  assert.equal(ledger.balance(creator), splitAmount(301, "CORE_TIP_V1_90_5_3_2").creator);

  const refunded = ledger.postRefund({ intent_id: "int_1", reason: "moderated" });
  assert.equal(refunded.entries.length, 5);
  assert.equal(ledger.balance(creator), 0);
  assert.equal(ledger.balance(accountId("funding", "platform", "JB")), 1_000_000);

  const forIntent = ledger.entries.filter(
    (row) => row.settlement_id === settlement.id || row.settlement_id === `refund:${settlement.id}`,
  );
  assert.equal(forIntent.reduce((sum, row) => sum + (row.direction === "credit" ? row.amount_cents : -row.amount_cents), 0), 0);

  assert.throws(
    () => ledger.postRefund({ intent_id: "int_1", reason: "again" }),
    (error) => error.code === "ALREADY_REFUNDED" && error.status === 409,
  );
});

test("I5 — what the creator panel prints is the sum of the entries, and the ledger reconciles", () => {
  const ledger = fundedLedger();
  const random = rng(55);
  let gross = 0;
  for (let i = 0; i < 40; i += 1) {
    const amount = 1 + Math.floor(random() * 900);
    gross += amount;
    ledger.postSettlement({
      intent: intent({ id: `int_${i}`, gross_cents: amount, split_version: SPLIT_NAMES[i % 2] }),
    });
  }
  const totals = ledger.totals({ creator_id: "u_creator" });
  const creator = accountId("creator", "u_creator", "JB");
  const fromEntries = ledger.entries
    .filter((row) => row.account_id === creator)
    .reduce((sum, row) => sum + (row.direction === "credit" ? row.amount_cents : -row.amount_cents), 0);
  assert.equal(totals.available_cents, fromEntries);
  assert.ok(totals.earned_cents > 0);
  assert.ok(totals.earned_cents <= gross);

  const report = ledger.reconcile();
  assert.equal(report.ok, true, JSON.stringify(report.differences));
  assert.equal(report.debits, report.credits);
});

test("I6 — replaying the same request does not create a second settlement", () => {
  const ledger = fundedLedger();
  const first = ledger.postSettlement({ intent: intent(), idempotency_key: "key-1" });
  const entries = ledger.entries.length;
  const second = ledger.postSettlement({ intent: intent(), idempotency_key: "key-1" });
  assert.equal(second.settlement.id, first.settlement.id);
  assert.equal(second.replayed, true);
  assert.equal(ledger.entries.length, entries);
  assert.equal(ledger.settlements.size, 1);
});

test("I7 — demo and synthetic intents never reach totals, balances or payouts", () => {
  const ledger = fundedLedger();
  for (let i = 0; i < 10; i += 1) {
    const status = i % 2 === 0 ? "demo_unpaid" : "excluded_synthetic";
    assert.throws(
      () => ledger.postSettlement({ intent: intent({ id: `demo_${i}`, status }) }),
      (error) => error.code === "SETTLEMENT_NOT_ALLOWED" && error.status === 409,
    );
  }
  assert.equal(ledger.entries.length, 1, "only the funding deposit should exist");
  assert.equal(ledger.totals({ creator_id: "u_creator" }).available_cents, 0);
  assert.equal(ledger.totals({ creator_id: "u_creator" }).earned_cents, 0);
  assert.throws(
    () => ledger.requestPayout({ creator_id: "u_creator", amount_cents: 1 }),
    (error) => error.code === "INSUFFICIENT_FUNDS",
  );
});

test("I8 — every entry points at a settlement and an account that exist", () => {
  const ledger = fundedLedger();
  const posted = ledger.postSettlement({ intent: intent() });
  for (const row of posted.entries) {
    assert.ok(ledger.accounts.has(row.account_id), `${row.account_id} is not an account`);
    assert.equal(row.settlement_id, posted.settlement.id);
  }
  assert.throws(
    () => ledger.deleteAccount(accountId("creator", "u_creator", "JB")),
    (error) => error.code === "ACCOUNT_IN_USE" && error.status === 409,
  );
  // An account with no entries can still be removed, so the refusal is about the entries, not the id.
  const idle = ledger.ensureAccount("creator", "u_other").id;
  assert.equal(ledger.deleteAccount(idle), true);
});

test("I9 — the creator keeps at least half of every price, both splits", () => {
  for (const version of SPLIT_NAMES) {
    for (let price = 1; price <= 1000; price += 1) {
      const shares = splitAmount(price, version);
      assert.ok(
        shares.creator / price >= CREATOR_MINIMUM_SHARE,
        `${version} gave the creator ${shares.creator}/${price}`,
      );
    }
  }
});

test("I10 — the price floor is the settlement cost amortised through the batch", () => {
  // §3.5: EGLD at a batch of 10 costs 0,0021 € per action, the 2% slice allows 0,021 € of cost.
  assert.equal(priceFloorCents({ cost_per_action_cents: 2.1 }).cost_floor_cents, 105);
  // A batch of 1000 costs 0,000021 €, so a single JBc (100 cents) already covers it.
  assert.equal(priceFloorCents({ cost_per_action_cents: 0.0021 }).cost_floor_cents, 1);
  // ESDT is 3,6x dearer: at a batch of 10 the floor is 378 cents, which is why the batch moves to 100.
  assert.equal(priceFloorCents({ cost_per_action_cents: 7.5 }).cost_floor_cents, 375);
});

test("I11 — a price that breaks I9 or I10 is refused, with the reason spelled out", () => {
  const tooCheap = assertPriceAllowed({ price_cents: 100, cost_per_action_cents: 2.1 });
  assert.equal(tooCheap.ok, false);
  assert.equal(tooCheap.reason, "PRICE_BELOW_SETTLEMENT_COST");

  const allowed = assertPriceAllowed({ price_cents: 105, cost_per_action_cents: 2.1 });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.shares.creator + allowed.shares.fee + allowed.shares.reserve + allowed.shares.infra, 105);

  const invalid = assertPriceAllowed({ price_cents: 0, cost_per_action_cents: 2.1 });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.reason, "PRICE_INVALID");

  // The two presets of §3.5 (2/3/3 and 3/5/5 JBc) and the minimum withdrawal of 21 JBc.
  for (const cents of [200, 300, 500]) {
    assert.equal(assertPriceAllowed({ price_cents: cents, cost_per_action_cents: 0.21 }).ok, true, `${cents} cents`);
  }
  assert.ok(priceFloorCents({ cost_per_action_cents: 0.21 }).cost_floor_cents <= 200);
});

