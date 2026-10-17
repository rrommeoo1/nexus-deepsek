import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../lib/db.js';
import { createRepo } from '../lib/repo.js';
import { createLedger, splitAmount } from '../lib/creator-ledger.js';
import {
  creatorLedger, depositTreasury, payCreatorPayout, reconcileCreatorLedger, refundIntent,
  requestCreatorPayout, settleIntent,
} from '../lib/creator-settlement.js';

/**
 * F1.2 proves I1-I8 against the schema a real build runs, not against a mock: the tables, the CHECK
 * constraints, the foreign keys and the SAVEPOINTs are the ones the routes meet. Every test starts
 * from a database that has never seen a row, so a failure here is the code's and not the fixture's.
 */
function fixture({ supporterTraffic = 'HUMAN_ORGANIC', priceCents = 300 } = {}) {
  const db = openDb(':memory:');
  const repo = createRepo(db);
  const creator = repo.createUser({ handle: 'ledger_creator', displayName: 'SYSTEM_TEST Creator' });
  const supporter = repo.createUser({
    handle: supporterTraffic === 'HUMAN_ORGANIC' ? 'ledger_supporter' : 'ledger_synthetic',
    displayName: 'SYSTEM_TEST Supporter',
    trafficClass: supporterTraffic,
  });
  for (const user of [creator, supporter]) repo.ensurePersona(user.id, 'social', { visibility: 'public' });
  const product = repo.createCreatorSupportProduct({ creatorId: creator.id, kind: 'tip', title: 'SYSTEM_TEST tip', priceCents });
  const intent = repo.createCreatorSupportIntent({ supporterId: supporter.id, productId: product.id });
  return { db, repo, creator, supporter, product, intent };
}

test('I1: a settlement credits exactly the split and debits the treasury for the gross', () => {
  const { db, creator, intent } = fixture();
  try {
    depositTreasury({ db, amountCents: 10000 });
    const posted = settleIntent({ db, creatorId: creator.id, intentId: intent.id, allowDemo: true });
    const shares = splitAmount(Number(intent.gross_cents), intent.split_version);
    assert.equal(Number(posted.settlement.gross_cents), Number(intent.gross_cents));
    assert.equal(Number(posted.settlement.creator_share_cents), shares.creator);
    const credits = posted.entries.filter((row) => row.direction === 'credit').reduce((sum, row) => sum + Number(row.amount_cents), 0);
    const debits = posted.entries.filter((row) => row.direction === 'debit').reduce((sum, row) => sum + Number(row.amount_cents), 0);
    assert.equal(credits, Number(intent.gross_cents));
    assert.equal(debits, Number(intent.gross_cents));
    assert.equal(posted.available_cents, shares.creator);
    const intentRow = db.prepare('SELECT status, payout_eligible FROM creator_support_intents WHERE id = ?').get(intent.id);
    assert.deepEqual({ ...intentRow }, { status: 'settled', payout_eligible: 1 });
  } finally { db.close(); }
});

test('I2: the same intent cannot be settled twice, and the second refusal writes nothing', () => {
  const { db, creator, intent } = fixture();
  try {
    depositTreasury({ db, amountCents: 10000 });
    settleIntent({ db, creatorId: creator.id, intentId: intent.id, allowDemo: true });
    const before = db.prepare('SELECT COUNT(*) n FROM ledger_entries').get().n;
    assert.throws(() => settleIntent({ db, creatorId: creator.id, intentId: intent.id, allowDemo: true }),
      (error) => error.code === 'ALREADY_SETTLED' && error.status === 409);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM support_settlements').get().n, 1);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM ledger_entries').get().n, before);
  } finally { db.close(); }
});

test('I3: an unfunded treasury and an oversized payout are both refused with nothing written', () => {
  const { db, creator, intent } = fixture();
  try {
    assert.throws(() => settleIntent({ db, creatorId: creator.id, intentId: intent.id, allowDemo: true }),
      (error) => error.code === 'INSUFFICIENT_FUNDS' && error.status === 409);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM support_settlements').get().n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM ledger_entries').get().n, 0);
    assert.equal(db.prepare('SELECT status FROM creator_support_intents WHERE id = ?').get(intent.id).status, 'demo_unpaid');

    depositTreasury({ db, amountCents: 10000 });
    const posted = settleIntent({ db, creatorId: creator.id, intentId: intent.id, allowDemo: true });
    assert.throws(() => requestCreatorPayout({ db, creatorId: creator.id, amountCents: posted.available_cents + 1 }),
      (error) => error.code === 'INSUFFICIENT_FUNDS');
    assert.equal(creatorLedger({ db, creatorId: creator.id }).totals.available_cents, posted.available_cents);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM payout_requests').get().n, 0);
test('I4: a refund happens once, nets to zero, and gives back exactly what was credited', () => {
  const { db, creator, intent } = fixture();
  try {
    depositTreasury({ db, amountCents: 10000 });
    const posted = settleIntent({ db, creatorId: creator.id, intentId: intent.id, allowDemo: true });
    assert.throws(() => refundIntent({ db, creatorId: creator.id, intentId: intent.id, reason: '' }),
      (error) => error.code === 'REASON_REQUIRED');
    const refunded = refundIntent({ db, creatorId: creator.id, intentId: intent.id, reason: 'SYSTEM_TEST refund' });
    assert.equal(refunded.available_cents, 0);
    const net = refunded.entries.reduce((sum, row) => sum + (row.direction === 'credit' ? Number(row.amount_cents) : -Number(row.amount_cents)), 0);
    assert.equal(net, 0);
    assert.throws(() => refundIntent({ db, creatorId: creator.id, intentId: intent.id, reason: 'SYSTEM_TEST again' }),
      (error) => error.code === 'ALREADY_REFUNDED');
    assert.equal(db.prepare('SELECT status FROM creator_support_intents WHERE id = ?').get(intent.id).status, 'refunded');
    const linked = db.prepare('SELECT COUNT(*) n FROM ledger_entries WHERE settlement_id = ?').get(`refund:${posted.settlement.id}`).n;
    assert.equal(linked, refunded.entries.length);
  } finally { db.close(); }
});

test('I5: totals are the sum of the entries, and reconcile sees a difference when one is tampered with', () => {
  const { db, creator, intent } = fixture();
  try {
    depositTreasury({ db, amountCents: 10000 });
    const posted = settleIntent({ db, creatorId: creator.id, intentId: intent.id, allowDemo: true });
    const ledger = creatorLedger({ db, creatorId: creator.id });
    const credits = ledger.entries.filter((row) => row.direction === 'credit').reduce((sum, row) => sum + Number(row.amount_cents), 0);
    assert.equal(ledger.totals.earned_cents, credits);
    assert.equal(ledger.totals.available_cents, posted.available_cents);
    assert.equal(ledger.entries.length, 1, 'the creator account only receives; the treasury carries the debit');
    assert.equal(reconcileCreatorLedger(db).ok, true);

    db.prepare("INSERT INTO ledger_entries (settlement_id, account_id, direction, amount_cents) VALUES ('tamper', ?, 'credit', 999)").run(ledger.account.id);
    const broken = reconcileCreatorLedger(db);
    assert.equal(broken.ok, false);
    assert.ok(broken.differences.some((difference) => difference.kind === 'unbalanced'));
  } finally { db.close(); }
});

test('I6: one settlement per intent is a constraint of the database, not a convention of the code', () => {
  const { db, creator, intent } = fixture();
  try {
    depositTreasury({ db, amountCents: 10000 });
    const posted = settleIntent({ db, creatorId: creator.id, intentId: intent.id, allowDemo: true });
    assert.throws(() => db.prepare(`INSERT INTO support_settlements
      (id, intent_id, creator_id, currency, gross_cents, creator_share_cents, nexus_fee_cents, safety_reserve_cents, infra_cents, split_version)
      VALUES ('stl_duplicate', ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(intent.id, creator.id, posted.settlement.currency, posted.settlement.gross_cents, posted.settlement.creator_share_cents,
        posted.settlement.nexus_fee_cents, posted.settlement.safety_reserve_cents, posted.settlement.infra_cents, posted.settlement.split_version),
      /UNIQUE|constraint/i);
  } finally { db.close(); }
});

  } finally { db.close(); }
});
test('I7: synthetic traffic never settles, and demo settlements stay off without the switch', () => {
  const demo = fixture();
  try {
    depositTreasury({ db: demo.db, amountCents: 10000 });
    assert.throws(() => settleIntent({ db: demo.db, creatorId: demo.creator.id, intentId: demo.intent.id }),
      (error) => error.code === 'SETTLEMENT_DISABLED');
    assert.equal(demo.db.prepare('SELECT COUNT(*) n FROM support_settlements').get().n, 0);
  } finally { demo.db.close(); }

  const synthetic = fixture({ supporterTraffic: 'SYSTEM_TEST' });
  try {
    assert.equal(synthetic.intent.status, 'excluded_synthetic');
    depositTreasury({ db: synthetic.db, amountCents: 10000 });
    assert.throws(() => settleIntent({ db: synthetic.db, creatorId: synthetic.creator.id, intentId: synthetic.intent.id, allowDemo: true }),
      (error) => error.code === 'SETTLEMENT_NOT_ALLOWED');
    assert.equal(synthetic.db.prepare('SELECT COUNT(*) n FROM ledger_entries').get().n, 1, 'only the deposit exists');
    assert.equal(creatorLedger({ db: synthetic.db, creatorId: synthetic.creator.id }).totals.available_cents, 0);
  } finally { synthetic.db.close(); }
});

test('I8: an entry cannot name an account that does not exist', () => {
  const { db } = fixture();
  try {
    assert.throws(() => db.prepare("INSERT INTO ledger_entries (settlement_id, account_id, direction, amount_cents) VALUES ('x', 'creator:999:TEST-USDC', 'credit', 5)").run(),
      /FOREIGN KEY|constraint/i);
  } finally { db.close(); }
});

test('payouts: requested, paid once, and the balance is the difference', () => {
  const { db, creator, intent } = fixture({ priceCents: 1000 });
  try {
    depositTreasury({ db, amountCents: 10000 });
    const posted = settleIntent({ db, creatorId: creator.id, intentId: intent.id, allowDemo: true });
    const requested = requestCreatorPayout({ db, creatorId: creator.id, amountCents: 300 });
    assert.equal(requested.payout.status, 'requested');
    assert.equal(requested.available_cents, posted.available_cents);
    const paid = payCreatorPayout({ db, creatorId: creator.id, payoutId: requested.payout.id });
    assert.equal(paid.payout.status, 'paid');
    assert.equal(creatorLedger({ db, creatorId: creator.id }).totals.available_cents, posted.available_cents - 300);
    assert.throws(() => payCreatorPayout({ db, creatorId: creator.id, payoutId: requested.payout.id }),
      (error) => error.code === 'ALREADY_PAID');
    assert.equal(reconcileCreatorLedger(db).ok, true);
  } finally { db.close(); }
});

test('the SQL ledger and the pure ledger agree on the same scenario', () => {
  const { db, creator, intent } = fixture({ priceCents: 500 });
  try {
    depositTreasury({ db, amountCents: 10000 });
    const sql = settleIntent({ db, creatorId: creator.id, intentId: intent.id, allowDemo: true });
    const pure = createLedger();
    pure.deposit({ account_id: pure.ensureAccount('funding', 'platform', intent.currency).id, amount_cents: 10000, reference: 'devnet' });
    pure.postSettlement({
      intent: {
        id: intent.id, creator_id: creator.id, status: 'settled',
        gross_cents: Number(intent.gross_cents), split_version: intent.split_version, currency: intent.currency,
      },
    });
    const pureTotals = pure.totals({ creator_id: creator.id, currency: intent.currency });
    assert.equal(sql.available_cents, pureTotals.available_cents);
    assert.equal(Number(sql.settlement.creator_share_cents), pureTotals.earned_cents);
    assert.equal(pure.reconcile().ok, true);
  } finally { db.close(); }
});

