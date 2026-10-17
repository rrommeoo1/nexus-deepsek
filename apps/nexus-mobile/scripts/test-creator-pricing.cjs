/* global __dirname */
// F2.c pe telefon: prețul pe acțiune ca marfă a serverului. Testul ridică exact modulele pe care le
// importă ecranul (`creatorPricing.ts` peste `pricing.ts`), cu un `require` care știe doar de cele două,
// apoi verifică ce se trimite, ce se refuză și ce vede fanul.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');

/** Transpile one module and run it with a `require` that answers only from the registry. */
function load(relative, fileName, registry = {}) {
  const source = readFileSync(resolve(ROOT, relative), 'utf8');
  const code = ts.transpileModule(source, {
    fileName,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const shim = { exports: {} };
  const localRequire = (id) => {
    if (id === './pricing') return registry.pricing;
    throw new Error(`unexpected import ${id}`);
  };
  new Function('module', 'exports', 'require', code)(shim, shim.exports, localRequire);
  return shim.exports;
}

const pricing = load('src/lib/pricing.ts', 'pricing.ts');
const creatorPricing = load('src/lib/creatorPricing.ts', 'creatorPricing.ts', { pricing });

/** A payload shaped like `GET /api/creator/pricing` for a profile that charges. */
function paidPayload(overrides = {}) {
  const quote = (action, label, price, creator, fee) => ({
    action, label, product_id: 41, price_cents: price, chargeable: true,
    creator_cents: creator, fee_cents: fee, reserve_cents: 6, infra_cents: 4,
    split_version: 'CORE_TIP_V1_90_5_3_2',
  });
  return {
    ok: true,
    available: true,
    free: false,
    can_edit: true,
    currency: 'TEST-USDC',
    display_currency: 'JB',
    split_version: 'CORE_TIP_V1_90_5_3_2',
    cost_per_action_cents: 2.1,
    floor_cents: 3,
    max_price_cents: 100000000,
    presets: {
      prietenos: { appreciation: 200, comment: 300, share: 300 },
      premium: { appreciation: 300, comment: 500, share: 500 },
    },
    actions: {
      appreciation: quote('appreciation', 'Apreciere', 200, 180, 10),
      comment: quote('comment', 'Comentariu', 300, 270, 15),
      share: quote('share', 'Distribuire', 300, 270, 15),
    },
    debit_enabled: false,
    real_payment: false,
    ...overrides,
  };
}

function freePayload() {
  const empty = (action, label) => ({
    action, label, product_id: null, price_cents: 0, chargeable: false,
    creator_cents: 0, fee_cents: 0, reserve_cents: 0, infra_cents: 0, split_version: '',
  });
  return {
    ok: true, available: true, free: true, can_edit: true, currency: 'TEST-USDC', display_currency: 'JB',
    split_version: 'CORE_TIP_V1_90_5_3_2', cost_per_action_cents: 2.1, floor_cents: 3, max_price_cents: 100000000,
    presets: {
      prietenos: { appreciation: 200, comment: 300, share: 300 },
      premium: { appreciation: 300, comment: 500, share: 500 },
    },
    actions: {
      appreciation: empty('appreciation', 'Apreciere'),
      comment: empty('comment', 'Comentariu'),
      share: empty('share', 'Distribuire'),
    },
    debit_enabled: false, real_payment: false,
  };
}

test('un profil fără prețuri este «totul gratuit», nu un preț inventat', () => {
  const view = creatorPricing.pricingViewFromPayload(freePayload());
  assert.equal(view.free, true);
  assert.equal(view.actions.appreciation.chargeable, false);
  assert.deepEqual(creatorPricing.fanPreview(view).map((row) => row.chip),
    ['Indisponibil', 'Indisponibil', 'Indisponibil']);
  assert.equal(creatorPricing.validateDraft({ free: true, appreciation: '', comment: '', share: '' }, view).ok, true);
});

test('prețurile se citesc din payload, iar un răspuns fără acțiuni este refuzat', () => {
  const view = creatorPricing.pricingViewFromPayload(paidPayload());
  assert.equal(view.actions.appreciation.price_cents, 200);
  assert.equal(view.actions.appreciation.creator_cents, 180);
  assert.equal(view.actions.appreciation.fee_cents, 10);
  assert.equal(view.floor_cents, 3);
  assert.equal(view.debit_enabled, false);
  assert.equal(creatorPricing.pricingViewFromPayload({ ok: true }), null);
  assert.equal(creatorPricing.pricingViewFromPayload(null), null);
});

test('un preț care lipsește nu devine niciodată gratuit', () => {
  const payload = paidPayload();
  delete payload.actions.comment;
  const view = creatorPricing.pricingViewFromPayload(payload);
  assert.equal(view.actions.comment.chargeable, false);
  assert.equal(view.actions.comment.price_cents, 0);
  const row = creatorPricing.fanPreview(view).find((item) => item.action === 'comment');
  assert.equal(row.disabled, true);
  assert.equal(row.chip, 'Indisponibil');
});

test('presetarea se recunoaște exact: 2/3/3, 3/5/5, sau niciuna', () => {
  const friendly = creatorPricing.pricingViewFromPayload(paidPayload());
  assert.equal(creatorPricing.presetOfView(friendly), 'prietenos');
  const premium = creatorPricing.pricingViewFromPayload(paidPayload({
    actions: {
      appreciation: { ...friendly.actions.appreciation, price_cents: 300 },
      comment: { ...friendly.actions.comment, price_cents: 500 },
      share: { ...friendly.actions.share, price_cents: 500 },
    },
  }));
  assert.equal(creatorPricing.presetOfView(premium), 'premium');
  const mixed = creatorPricing.pricingViewFromPayload(paidPayload({
    actions: { ...friendly.actions, share: { ...friendly.actions.share, price_cents: 400 } },
  }));
  assert.equal(creatorPricing.presetOfView(mixed), null);
  assert.equal(creatorPricing.presetOfDraft(creatorPricing.draftFromPreset(friendly.presets.premium), friendly), 'premium');
});

test('ce tastează ownerul se întoarce în banii serverului, cu două zecimale', () => {
  const view = creatorPricing.pricingViewFromPayload(paidPayload());
  assert.equal(creatorPricing.centsToInput(200), '2');
  assert.equal(creatorPricing.centsToInput(205), '2,05');
  assert.equal(creatorPricing.centsToInput(250), '2,5');
  assert.equal(creatorPricing.centsToInput(null), '');
  const draft = creatorPricing.draftFromView(view);
  assert.deepEqual(draft, { free: false, appreciation: '2', comment: '3', share: '3' });
  const result = creatorPricing.validateDraft({ ...draft, appreciation: '2,5' }, view);
  assert.deepEqual(result, { ok: true, free: false, prices: { appreciation: 250, comment: 300, share: 300 } });
});

test('un preț sub prag sau peste plafon este refuzat cu motivul lui', () => {
  const view = creatorPricing.pricingViewFromPayload(paidPayload());
  const low = creatorPricing.validateDraft({ free: false, appreciation: '0,02', comment: '3', share: '3' }, view);
  assert.equal(low.ok, false);
  assert.match(low.message, /Prețul minim/);
  const capped = creatorPricing.pricingViewFromPayload(paidPayload({ max_price_cents: 10000 }));
  const high = creatorPricing.validateDraft({ free: false, appreciation: '3', comment: '3', share: '200' }, capped);
  assert.equal(high.ok, false);
  assert.match(high.message, /Prețul maxim/);
  const empty = creatorPricing.validateDraft({ free: false, appreciation: '', comment: '3', share: '3' }, view);
  assert.equal(empty.ok, false);
  assert.equal(empty.action, 'appreciation');
});

test('salvarea trimite exact corpul rutei: «totul gratuit» fără prețuri, plătit cu toate trei', async () => {
  const calls = [];
  const api = async (path, options) => {
    calls.push({ path, options });
    return paidPayload();
  };
  await creatorPricing.saveOwnPricing(api, { free: true, prices: { appreciation: 200, comment: 300, share: 300 } });
  await creatorPricing.saveOwnPricing(api, { free: false, prices: { appreciation: 300, comment: 500, share: 500 } });
  assert.equal(calls[0].path, '/api/creator/pricing');
  assert.equal(calls[0].options.method, 'PUT');
  assert.deepEqual(JSON.parse(calls[0].options.body), { free: true });
  assert.deepEqual(JSON.parse(calls[1].options.body),
    { free: false, prices: { appreciation: 300, comment: 500, share: 500 } });
});

test('citirea proprie și cea a fanului trec prin aceeași normalizare', async () => {
  const seen = [];
  const api = async (path) => { seen.push(path); return paidPayload(); };
  await creatorPricing.loadOwnPricing(api);
  await creatorPricing.loadCreatorPricing(api, 'ana maria');
  assert.deepEqual(seen, ['/api/creator/pricing', '/api/creator/pricing/ana%20maria']);
  await assert.rejects(() => creatorPricing.loadOwnPricing(async () => ({ ok: true })), /prețurile profilului/);
});

test('previzualizarea fanului arată prețul, comisionul și ce primește creatorul', () => {
  const view = creatorPricing.pricingViewFromPayload(paidPayload());
  const rows = creatorPricing.fanPreview(view);
  assert.deepEqual(rows.map((row) => row.price_cents), [200, 300, 300]);
  assert.deepEqual(rows.map((row) => row.creator_cents), [180, 270, 270]);
  assert.deepEqual(rows.map((row) => row.chip), [null, null, null]);
  assert.match(rows[0].note, /Demonstrativ/);
  const blocked = creatorPricing.fanPreview(
    creatorPricing.pricingViewFromPayload(paidPayload({ debit_enabled: true })),
    { balanceCents: 100, sessionBudgetCents: 2000 },
  );
  assert.deepEqual(blocked.map((row) => row.chip), ['Peste buget', 'Peste buget', 'Peste buget']);
});


test('confirmarea spune prețul, comisionul, soldul și bugetul, și blochează ce nu încape', () => {
  const demo = creatorPricing.confirmationFor(creatorPricing.pricingViewFromPayload(paidPayload()), 'appreciation', {
    balanceCents: 0, sessionBudgetCents: 2000, sessionSpentCents: 0,
  });
  assert.equal(demo.price_cents, 200);
  assert.equal(demo.fee_cents, 10);
  assert.equal(demo.creator_cents, 180);
  assert.equal(demo.demo_unpaid, true);
  assert.equal(demo.blockers.length, 0);
  assert.equal(demo.confirm_label, 'Am înțeles');
  assert.equal(demo.disabled, false);
  assert.equal(demo.budget_left_cents, 2000);

  const paidView = creatorPricing.pricingViewFromPayload(paidPayload({ debit_enabled: true }));
  const poor = creatorPricing.confirmationFor(paidView, 'comment', { balanceCents: 250, sessionBudgetCents: 2000 });
  assert.equal(poor.disabled, true);
  assert.deepEqual(poor.blockers, ['Soldul nu acoperă prețul.']);
  assert.equal(poor.confirm_label, 'Confirmă 3,00 JUNGLE');

  const spent = creatorPricing.confirmationFor(paidView, 'share',
    { balanceCents: 5000, sessionBudgetCents: 400, sessionSpentCents: 350 });
  assert.equal(spent.disabled, true);
  assert.deepEqual(spent.blockers, ['Bugetul de sesiune nu acoperă prețul.']);
  assert.equal(spent.budget_left_cents, 50);

  const absent = creatorPricing.confirmationFor(creatorPricing.pricingViewFromPayload(freePayload()), 'appreciation');
  assert.equal(absent.action, null);
  assert.equal(absent.disabled, true);
  assert.match(absent.blockers[0], /nu a pornit un preț/);
});

test('refuzurile serverului au text românesc, iar cele necunoscute păstrează mesajul serverului', () => {
  assert.match(creatorPricing.pricingErrorWords('PRICING_INVALID', ''), /nu sunt valide/);
  assert.match(creatorPricing.pricingErrorWords('PRICING_UNAVAILABLE', ''), /nu sunt disponibile/);
  assert.match(creatorPricing.pricingErrorWords('PRICING_FLOOR', ''), /pragul afișat/);
  assert.match(creatorPricing.pricingErrorWords('DEMO_UNPAID', ''), /demonstrativă/);
  assert.equal(creatorPricing.pricingErrorWords('SOMETHING_ELSE', 'mesajul serverului'), 'mesajul serverului');
  assert.equal(creatorPricing.SESSION_BUDGET_CENTS, 2000);
  assert.equal(creatorPricing.FREE_LABEL, 'Totul gratuit');
  assert.equal(creatorPricing.UNAVAILABLE_LABEL, 'Indisponibil');
});
