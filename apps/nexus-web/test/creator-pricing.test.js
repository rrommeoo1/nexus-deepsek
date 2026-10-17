import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../lib/db.js';
import { createRepo } from '../lib/repo.js';
import { handleRequest } from '../lib/api.js';
import { issueSession } from '../lib/security.js';
import {
  ACTION_SPLIT_VERSION, PRICE_PRESETS, actionAffordability, costPerActionCents, normalizePricingInput,
  pricingAction, pricingFloorCents, pricingView,
} from '../lib/creator-pricing.js';

/**
 * F2.c proves the per-action price the phone prints is the server's number:
 *
 *  * the pure module owns the refusals (a free profile with prices, a price under the settlement
 *    floor, an unknown action) and the split — at 2 JB the creator keeps 1,80 and the fee is 0,10;
 *  * the repository owns the rows, and a write either lands whole or leaves nothing behind;
 *  * a reader sees the price only for a profile the catalog would also let them see.
 *
 * Nothing here mocks money: the split tests read the same `splitAmount` a settlement reads.
 */
function fixture() {
  const db = openDb(':memory:');
  const repo = createRepo(db);
  const creator = repo.createUser({ handle: 'pricing_creator', displayName: 'Pricing Creator' });
  const fan = repo.createUser({ handle: 'pricing_fan', displayName: 'Pricing Fan' });
  for (const user of [creator, fan]) repo.ensurePersona(user.id, 'social', { visibility: 'public' });
  return { db, repo, creator, fan };
}

test('a profile nobody configured is free, with the floor the settlement arithmetic quotes', () => {
  const view = pricingView({});
  assert.equal(view.free, true);
  assert.equal(view.available, true);
  assert.equal(view.debit_enabled, false);
  assert.equal(view.real_payment, false);
  assert.equal(view.floor_cents, 105);
  assert.equal(view.floor_cents, pricingFloorCents(2.1).floor_cents);
  for (const key of ['appreciation', 'comment', 'share']) {
    assert.equal(view.actions[key].chargeable, false);
    assert.equal(view.actions[key].price_cents, 0);
    assert.equal(view.actions[key].product_id, null);
  }
  assert.equal(costPerActionCents({ NEXUS_COST_PER_ACTION_CENTS: '3' }), 3);
  assert.equal(costPerActionCents({ NEXUS_COST_PER_ACTION_CENTS: '' }), 2.1);
});

test('the two presets are 2/3/3 and 3/5/5, and the split is the server\'s', () => {
  const friendly = normalizePricingInput({ free: false, prices: PRICE_PRESETS.prietenos });
  assert.equal(friendly.ok, true);
  assert.deepEqual(friendly.prices, { appreciation: 200, comment: 300, share: 300 });
  const premium = normalizePricingInput({ free: false, prices: PRICE_PRESETS.premium });
  assert.equal(premium.ok, true);
  assert.deepEqual(premium.prices, { appreciation: 300, comment: 500, share: 500 });

  const two = pricingAction({ action: 'appreciation', product: { id: 7, price_cents: 200, split_version: ACTION_SPLIT_VERSION } });
  assert.equal(two.price_cents, 200);
  assert.equal(two.creator_cents, 180);
  assert.equal(two.fee_cents, 10);
  assert.equal(two.reserve_cents, 6);
  assert.equal(two.infra_cents, 4);
  assert.equal(two.creator_cents + two.fee_cents + two.reserve_cents + two.infra_cents, two.price_cents);
  assert.equal(two.product_id, 7);
});

test('every invalid write is refused by name, and a free policy carries no prices', () => {
  assert.equal(normalizePricingInput({ free: 'no', prices: {} }).code, 'PRICING_INVALID');
  assert.equal(normalizePricingInput({ free: true, prices: { appreciation: 200 } }).code, 'FREE_WITH_PRICES');
  assert.deepEqual(normalizePricingInput({ free: true }).prices, { appreciation: 0, comment: 0, share: 0 });
  assert.equal(normalizePricingInput({ free: false, prices: { appreciation: 200, comment: 300 } }).code, 'PRICE_INVALID');
  assert.equal(normalizePricingInput({ free: false, prices: { ...PRICE_PRESETS.prietenos, tip: 200 } }).code, 'PRICING_INVALID');
  const belowFloor = normalizePricingInput({ free: false, prices: { appreciation: 100, comment: 300, share: 300 } });
  assert.equal(belowFloor.ok, false);
  assert.equal(belowFloor.code, 'PRICE_BELOW_SETTLEMENT_COST');
  const atFloor = normalizePricingInput({ free: false, prices: { appreciation: 105, comment: 300, share: 300 } });
  assert.equal(atFloor.ok, true);
  const fractional = normalizePricingInput({ free: false, prices: { appreciation: 200.5, comment: 300, share: 300 } });
  assert.equal(fractional.code, 'PRICE_INVALID');
  const tooBig = normalizePricingInput({ free: false, prices: { appreciation: 100000001, comment: 300, share: 300 } });
  assert.equal(tooBig.code, 'PRICE_INVALID');
});

test('affordability says "demo unpaid" while nothing is debited, and refuses a short balance when it is', () => {
  const pricing = pricingView({ free: false, actions: { appreciation: { id: 1, price_cents: 200 } } });
  const demo = actionAffordability({ pricing, action: 'appreciation', balance_cents: 0 });
  assert.equal(demo.affordable, true);
  assert.equal(demo.reason, 'DEMO_UNPAID');
  assert.equal(demo.price_cents, 200);
  assert.equal(demo.fee_cents, 10);

  const charged = { ...pricing, debit_enabled: true };
  assert.equal(actionAffordability({ pricing: charged, action: 'appreciation', balance_cents: 150 }).reason, 'INSUFFICIENT_FUNDS');
  assert.equal(actionAffordability({ pricing: charged, action: 'appreciation', balance_cents: 200 }).affordable, true);
  const budgeted = actionAffordability({ pricing: charged, action: 'appreciation', balance_cents: 999, session_budget_cents: 500, session_spent_cents: 400 });
  assert.equal(budgeted.affordable, false);
  assert.equal(budgeted.reason, 'SESSION_BUDGET_EXCEEDED');
  assert.equal(actionAffordability({ pricing, action: 'comment', balance_cents: 0 }).chargeable, false);
});

test('a saved price lives in a real tip product, so the catalog and the quote are the same row', () => {
  const { db, repo, creator, fan } = fixture();
  try {
    assert.deepEqual(repo.getCreatorActionPricing(creator.id), {
      free: true, updated_at: null,
      actions: { appreciation: null, comment: null, share: null },
    });

    const saved = repo.setCreatorActionPricing({ creatorId: creator.id, free: false, prices: PRICE_PRESETS.prietenos });
    const view = pricingView(saved);
    assert.equal(view.free, false);
    assert.equal(view.actions.appreciation.price_cents, 200);
    assert.equal(view.actions.appreciation.creator_cents, 180);
    assert.equal(view.actions.appreciation.fee_cents, 10);
    assert.equal(view.actions.share.price_cents, 300);

    const catalog = repo.listCreatorSupportCatalog(fan.id, 'pricing_creator');
    assert.equal(catalog.products.length, 3);
    assert.ok(catalog.products.every((product) => product.kind === 'tip' && product.status === 'active'));
    assert.deepEqual(
      catalog.products.map((product) => product.id).sort((a, b) => a - b),
      Object.values(saved.actions).map((product) => product.id).sort((a, b) => a - b),
    );
  } finally { db.close(); }
});

test('saving again edits the same products instead of piling new ones up', () => {
  const { db, repo, creator } = fixture();
  try {
    repo.setCreatorActionPricing({ creatorId: creator.id, free: false, prices: PRICE_PRESETS.prietenos });
    const firstIds = Object.values(repo.getCreatorActionPricing(creator.id).actions).map((product) => product.id);
    const updated = repo.setCreatorActionPricing({ creatorId: creator.id, free: false, prices: PRICE_PRESETS.premium });
    assert.equal(pricingView(updated).actions.share.price_cents, 500);
    assert.deepEqual(Object.values(updated.actions).map((product) => product.id), firstIds);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM creator_support_products WHERE creator_id = ?').get(creator.id).n, 3);

    const cleared = repo.setCreatorActionPricing({ creatorId: creator.id, free: true });
    assert.equal(cleared.free, true);
    assert.equal(cleared.actions.appreciation, null);
    const row = db.prepare('SELECT * FROM creator_action_prices WHERE creator_id = ?').get(creator.id);
    assert.equal(row.free, 1);
    assert.equal(row.appreciation_product_id, null);
    assert.equal(row.comment_product_id, null);
    assert.equal(row.share_product_id, null);
  } finally { db.close(); }
});

test('a creator without a social profile cannot save prices, and the refusal writes nothing', () => {
  const { db, repo } = fixture();
  try {
    const stranger = repo.createUser({ handle: 'pricing_noprofile', displayName: 'Pricing No Profile' });
    assert.throws(
      () => repo.setCreatorActionPricing({ creatorId: stranger.id, free: false, prices: PRICE_PRESETS.prietenos }),
      (error) => error.code === 'CREATOR_PROFILE_UNAVAILABLE' && error.status === 409,
    );
    assert.equal(db.prepare('SELECT COUNT(*) n FROM creator_action_prices').get().n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM creator_support_products').get().n, 0);
  } finally { db.close(); }
});

test('a reader sees the quote only where the catalog would be visible', () => {
  const { db, repo, creator, fan } = fixture();
  try {
    repo.setCreatorActionPricing({ creatorId: creator.id, free: false, prices: PRICE_PRESETS.prietenos });
    const seen = repo.getCreatorPricingForViewer(fan.id, '@PRICING_CREATOR');
    assert.equal(seen.creator.handle, 'pricing_creator');
    assert.equal(pricingView(seen.pricing).actions.appreciation.price_cents, 200);
    assert.equal(repo.getCreatorPricingForViewer(fan.id, 'pricing_missing'), null);

    const synthetic = repo.createUser({ handle: 'pricing_synthetic', displayName: 'Pricing Synthetic', trafficClass: 'SYSTEM_TEST' });
    repo.ensurePersona(synthetic.id, 'social', { visibility: 'public' });
    assert.equal(repo.getCreatorPricingForViewer(fan.id, 'pricing_synthetic'), null);
    assert.equal(repo.getCreatorPricingForViewer(synthetic.id, 'pricing_synthetic')?.creator.id, synthetic.id);
  } finally { db.close(); }
});

/**
 * The three routes the phone calls, over the real request handler. These assertions cover what the
 * unit tests above cannot: the body the route accepts, the replay boundary it sits behind, and the
 * reader's read being the owner's write.
 */
function httpFixture() {
  const db = openDb(':memory:');
  const repo = createRepo(db);
  const users = ['http_creator', 'http_fan'].map((handle) => {
    const user = repo.createUser({ handle, displayName: handle });
    repo.ensurePersona(user.id, 'social', { visibility: 'public' });
    const session = issueSession(user.id, 'social');
    repo.insertSession({ tokenHash: session.tokenHash, userId: user.id, persona: 'social', expiresAt: session.expiresAt });
    return { ...user, cookie: `nexus_session=${session.token}` };
  });
  const response = () => ({
    statusCode: 200,
    headers: {},
    body: '',
    writeHead(status, headers = {}) { this.statusCode = status; Object.assign(this.headers, headers); },
    setHeader(name, value) { this.headers[name] = value; },
    getHeader(name) { return this.headers[name]; },
    end(value) { this.body = String(value || ''); },
  });
  let counter = 0;
  return {
    db, repo, users,
    async call(method, path, body = {}, actor = 0, key = `creator-pricing-${++counter}-unique`) {
      const raw = Buffer.from(JSON.stringify(body));
      const req = {
        method,
        url: path,
        headers: { 'content-type': 'application/json', cookie: users[actor].cookie, 'idempotency-key': key },
        socket: { remoteAddress: '127.0.0.242' },
        on(event, callback) { if (event === 'data') process.nextTick(() => callback(raw)); if (event === 'end') process.nextTick(callback); return this; },
        destroy() {},
      };
      const res = response();
      await handleRequest(req, res, { db, repo, sse: { broadcast() {} } });
      return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null };
    },
  };
}



test('the owner reads and writes prices over HTTP, and the fan reads the same numbers', async () => {
  const f = httpFixture();
  try {
    const own = await f.call('GET', '/api/creator/pricing');
    assert.equal(own.status, 200);
    assert.equal(own.body.can_edit, true);
    assert.equal(own.body.free, true);
    assert.equal(own.body.floor_cents, 105);
    assert.deepEqual(own.body.presets.prietenos, { appreciation: 200, comment: 300, share: 300 });
    assert.equal(own.body.actions.appreciation.chargeable, false);

    const publicBefore = await f.call('GET', '/api/creator/pricing/http_creator', {}, 1);
    assert.equal(publicBefore.status, 200);
    assert.equal(publicBefore.body.can_edit, false);
    assert.equal((await f.call('GET', '/api/creator/pricing/http_missing', {}, 1)).status, 404);

    const saved = await f.call('PUT', '/api/creator/pricing', { free: false, prices: PRICE_PRESETS.prietenos });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.free, false);
    assert.equal(saved.body.actions.appreciation.price_cents, 200);
    assert.equal(saved.body.actions.appreciation.creator_cents, 180);
    assert.equal(saved.body.actions.appreciation.fee_cents, 10);
    assert.equal(saved.body.actions.share.price_cents, 300);

    const publicAfter = await f.call('GET', '/api/creator/pricing/@http_creator', {}, 1);
    assert.equal(publicAfter.status, 200);
    assert.equal(publicAfter.body.can_edit, false);
    assert.equal(publicAfter.body.actions.comment.price_cents, 300);
  } finally { f.db.close(); }
});

test('a replayed save returns the first answer, and a reused key with another body is refused', async () => {
  const f = httpFixture();
  try {
    const key = 'creator-pricing-replay-000001';
    const first = await f.call('PUT', '/api/creator/pricing', { free: false, prices: PRICE_PRESETS.prietenos }, 0, key);
    assert.equal(first.status, 200);
    const replay = await f.call('PUT', '/api/creator/pricing', { free: false, prices: PRICE_PRESETS.prietenos }, 0, key);
    assert.equal(replay.status, 200);
    assert.deepEqual(replay.body, first.body);
    const reused = await f.call('PUT', '/api/creator/pricing', { free: false, prices: PRICE_PRESETS.premium }, 0, key);
    assert.equal(reused.status, 409);
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM creator_support_products').get().n, 3);

    const changed = await f.call('PUT', '/api/creator/pricing', { free: false, prices: PRICE_PRESETS.premium });
    assert.equal(changed.body.actions.share.price_cents, 500);
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM creator_support_products').get().n, 3);

    const cleared = await f.call('PUT', '/api/creator/pricing', { free: true });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body.free, true);
    assert.equal(cleared.body.actions.appreciation.chargeable, false);
  } finally { f.db.close(); }
});

test('a mutation without a key, or with a contradictory body, is refused before it writes', async () => {
  const f = httpFixture();
  try {
    const noKey = await f.call('PUT', '/api/creator/pricing', { free: true }, 0, '');
    assert.equal(noKey.status, 400);
    assert.equal(noKey.body.code, 'IDEMPOTENCY_KEY_REQUIRED');

    const both = await f.call('PUT', '/api/creator/pricing', { free: true, prices: PRICE_PRESETS.prietenos });
    assert.equal(both.status, 400);
    assert.equal(both.body.code, 'FREE_WITH_PRICES');

    const unknown = await f.call('PUT', '/api/creator/pricing', { free: false, prices: { appreciation: 200, comment: 300, share: 300, tip: 100 } });
    assert.equal(unknown.status, 400);
    assert.equal(unknown.body.code, 'PRICING_INVALID');

    const extraField = await f.call('PUT', '/api/creator/pricing', { free: true, cap: 100 });
    assert.equal(extraField.status, 400);
    assert.equal(extraField.body.code, 'PRICING_INVALID');

    const belowFloor = await f.call('PUT', '/api/creator/pricing', { free: false, prices: { appreciation: 1, comment: 300, share: 300 } });
    assert.equal(belowFloor.status, 400);
    assert.equal(belowFloor.body.code, 'PRICE_BELOW_SETTLEMENT_COST');

    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM creator_action_prices').get().n, 0);
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM creator_support_products').get().n, 0);
  } finally { f.db.close(); }
});


