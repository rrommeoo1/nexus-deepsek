/* global __dirname */
// Banii unei aprecieri și ai unui comentariu, așa cum are voie telefonul să-i citească
// (`src/lib/actionPayments.ts`). Prețul, suma în EGLD și comisionul vin din răspunsul serverului;
// testul verifică doar ce face clientul cu ele: le tipărește, le adună ca întregi și preface refuzurile
// în propoziții. Nimic aici nu are voie să inventeze o sumă.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');

const payments = (() => {
  const source = readFileSync(resolve(ROOT, 'src/lib/actionPayments.ts'), 'utf8');
  const code = ts.transpileModule(source, {
    fileName: 'actionPayments.ts',
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const shim = { exports: {} };
  new Function('module', 'exports', 'require', code)(shim, shim.exports, require);
  return shim.exports;
})();

/** The shape `quoteAction` answers with (`lib/action-payments.js:201`) for a 3-cent appreciation. */
function devnetQuote(overrides = {}) {
  return {
    ok: true, action: 'appreciation', label: 'Apreciere', chargeable: true, free: false,
    price_cents: 3, currency: 'TEST-USDC', source: 'creator', defaulted: false,
    split_version: 1, creator: { id: 7, handle: 'maria' }, self_payment: false,
    chain: {
      mode: 'devnet', reason: null, chain_id: 'D',
      amount_wei: '1000000000000000', amount_egld: '0.001', gas_limit: '50000',
      network_fee_wei: '50000000000000', network_fee_egld: '0.00005',
      payer_address: 'erd1payer', payee_address: 'erd1payee',
      balance_wei: '1500000000000000', balance_egld: '0.0015', can_afford: true, shortfall_egld: null,
      faucet_url: 'https://devnet-wallet.multiversx.com/faucet',
      explorer: 'https://devnet-explorer.multiversx.com',
    },
    ...overrides,
  };
}

/** The `402 PAYMENT_REQUIRED` body the write routes answer with (`requirePaidAction`). */
function requiredFailure(quote = devnetQuote()) {
  return {
    status: 402,
    code: 'PAYMENT_REQUIRED',
    message: `acțiunea costă ${quote.price_cents ?? 0} cenți`,
    detail: { quote },
  };
}
test('un citat de devnet se citește cu prețul, suma și portofelul lui', () => {
  const quote = payments.readActionQuote(devnetQuote());
  assert.equal(quote.action, 'appreciation');
  assert.equal(quote.chargeable, true);
  assert.equal(quote.free, false);
  assert.equal(quote.price_cents, 3);
  assert.equal(quote.creator_handle, 'maria');
  assert.equal(quote.source, 'creator');
  assert.equal(quote.chain.mode, 'devnet');
  assert.equal(quote.chain.amount_egld, '0.001');
  assert.equal(quote.chain.network_fee_egld, '0.00005');
  assert.equal(quote.chain.balance_egld, '0.0015');
  assert.equal(quote.chain.can_afford, true);
  assert.match(quote.chain.faucet_url, /faucet/);
  assert.equal(payments.totalEgld(quote), '0.00105', 'prețul plus gazul, nu doar prețul');
});

test('sumele se recalculează din wei, nu din zecimalele primite', () => {
  assert.equal(payments.egldFromWei('1000000000000000'), '0.001');
  assert.equal(payments.egldFromWei('1000000000000000000'), '1');
  assert.equal(payments.egldFromWei('1234567890123456789'), '1.234567');
  assert.equal(payments.egldFromWei('0'), '0');
  assert.equal(payments.egldFromWei(null), null);
  assert.equal(payments.egldFromWei('12,5'), null, 'o zecimală nu este wei');
  const stale = devnetQuote({ chain: { ...devnetQuote().chain, amount_egld: '9.999' } });
  assert.equal(payments.readActionQuote(stale).chain.amount_egld, '0.001', 'wei wins over the server string');
});

test('ce lipsește se tipărește cu liniuță, iar totalul rămâne necunoscut', () => {
  const blind = devnetQuote({
    chain: {
      ...devnetQuote().chain,
      amount_wei: null, amount_egld: null, network_fee_wei: null, network_fee_egld: null,
      balance_wei: null, balance_egld: null,
    },
  });
  const quote = payments.readActionQuote(blind);
  assert.equal(payments.totalEgld(quote), null);
  const labels = payments.quoteLines(quote).map((line) => line.label);
  assert.deepEqual(labels, ['Preț', 'Sursa prețului', 'Pe rețea', 'Comision de rețea', 'Total din portofel', 'Sold devnet']);
  const line = (name) => payments.quoteLines(quote).find((entry) => entry.label === name).value;
  assert.equal(line('Pe rețea'), '—');
  assert.equal(line('Total din portofel'), '—');
  assert.equal(line('Sold devnet'), '—');
  assert.equal(line('Preț'), '0,03 JUNGLE');
  assert.equal(line('Comision de rețea'), '—');
  const noChain = payments.readActionQuote({ ok: true, action: 'comment', price_cents: 4, chargeable: true });
  assert.equal(payments.totalEgld(noChain), null, 'fără chain nu există total');
  assert.equal(payments.paymentWarnings(noChain).length, 1, 'rețeaua necunoscută se spune înainte de aprobare');
});

test('un profil gratuit nu cere nimic și nu blochează nimic', () => {
  const free = payments.readActionQuote({
    ok: true, action: 'appreciation', label: 'Apreciere', chargeable: false, free: true,
    price_cents: 0, currency: 'TEST-USDC', creator: { id: 7, handle: 'maria' },
  });
  assert.equal(free.chargeable, false);
  assert.equal(free.free, true);
  assert.equal(free.price_cents, 0);
  assert.equal(free.chain, null);
  assert.deepEqual(payments.paymentBlockers(free), []);
  assert.equal(payments.readActionQuote(null), null);
  assert.equal(payments.readActionQuote('devnet'), null);
});

test('butonul de aprobare spune prețul serverului, apoi ce iese din portofel', () => {
  const quote = payments.readActionQuote(devnetQuote());
  assert.equal(payments.confirmLabel(quote), 'Plătește 0,03 JUNGLE · 0.00105 EGLD');
  const blocked = payments.readActionQuote(devnetQuote({
    chain: { ...devnetQuote().chain, balance_wei: '0', balance_egld: '0', can_afford: false, shortfall_egld: '0.00105' },
  }));
  const blockers = payments.paymentBlockers(blocked);
  assert.equal(blockers.length, 1);
  assert.match(blockers[0], /nu acoperă 0\.00105 EGLD/);
  assert.match(blockers[0], /lipsesc 0\.00105 EGLD/);
});

test('un citat fără portofel de semnare nu lasă butonul de plată activ', () => {
  // The server sent a devnet quote but has no payer wallet: the approval would be refused after the tap,
  // so the sheet says so before it and keeps the button disabled.
  const quote = payments.readActionQuote(devnetQuote({
    chain: { ...devnetQuote().chain, payer_address: null, balance_wei: null, balance_egld: null, can_afford: null, shortfall_egld: null },
  }));
  const blockers = payments.paymentBlockers(quote);
  assert.equal(blockers.length, 1);
  assert.match(blockers[0], /nu poate semna acum transferul devnet/);
  // The simulated row is the demonstration, and it stays approvable with its warning.
  const simulated = payments.readActionQuote(devnetQuote({
    chain: { ...devnetQuote().chain, mode: 'simulated', payer_address: null, can_afford: null },
  }));
  assert.deepEqual(payments.paymentBlockers(simulated), []);
});

test('plata simulată se spune, cu motivul serverului', () => {
  const quote = payments.readActionQuote(devnetQuote({
    chain: { ...devnetQuote().chain, mode: 'simulated', reason: 'PAYER_WALLET_MISSING', amount_wei: null, amount_egld: null },
  }));
  const warnings = payments.paymentWarnings(quote);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /fără să mute EGLD/);
  assert.match(warnings[0], /PAYER_WALLET_MISSING/);
  assert.deepEqual(payments.paymentBlockers(quote), [], 'simulat nu blochează aprobarea');
});

test('doar 402 PAYMENT_REQUIRED deschide foaia de plată, și aduce citatul serverului', () => {
  const cause = requiredFailure();
  assert.equal(payments.failureCode(cause), 'PAYMENT_REQUIRED');
  const quote = payments.paymentRequired(cause);
  assert.ok(quote, 'the refusal carries the price');
  assert.equal(quote.price_cents, 3);
  assert.equal(payments.paymentRequired({ status: 402, code: 'PAYMENT_FAILED', detail: {} }), null);
  assert.equal(payments.paymentRequired({ status: 403, code: 'COMMENTS_DISABLED' }), null);
  assert.equal(payments.paymentRequired(new Error('network')), null);
  assert.equal(payments.paymentRequired(null), null);
});

test('plata deja folosită își aduce citatul nou și rândul cheltuit', () => {
  const used = {
    status: 409,
    code: 'PAYMENT_ALREADY_USED',
    message: 'plata a fost deja folosită pentru această acțiune',
    detail: {
      quote: devnetQuote({ price_cents: 4, action: 'comment', label: 'Comentariu' }),
      intent: {
        id: 'a'.repeat(24), action: 'comment', post_id: 12, price_cents: 4,
        status: 'confirmed', chain_mode: 'devnet', consumed_at: 1760000000,
      },
    },
  };
  assert.equal(payments.paymentRequired(used), null, 'nu este un refuz de preț: plata există deja');
  assert.equal(payments.quoteFromFailure(used).price_cents, 4);
  const intent = payments.intentFromFailure(used);
  assert.equal(intent.id, 'a'.repeat(24));
  assert.equal(intent.consumed_at, 1760000000);
  assert.equal(payments.intentIsPaid(intent), true);
  assert.match(payments.paymentSentence('PAYMENT_ALREADY_USED'), /deja folosită/);
});

test('răspunsul plății este rândul pe care scrierea îl poartă mai departe', () => {
  const hash = 'b'.repeat(64);
  const answer = {
    ok: true, post_id: 12, action: 'appreciation', real_funds: true,
    payment: {
      id: 'c'.repeat(24), action: 'appreciation', post_id: 12, price_cents: 3, status: 'broadcast',
      chain_mode: 'devnet', tx_hash: hash,
      explorer_url: `https://devnet-explorer.multiversx.com/transactions/${hash}`,
      failure: null, consumed_at: null, confirmed_at: null,
    },
  };
  const intent = payments.readPaymentIntent(answer);
  assert.equal(intent.status, 'broadcast');
  assert.equal(intent.chain_mode, 'devnet');
  assert.equal(intent.tx_hash, hash);
  assert.match(intent.explorer_url, /devnet-explorer/);
  assert.equal(payments.intentIsPaid(intent), true, 'broadcast este deja plătit');
  assert.equal(payments.paymentTitle('appreciation', intent), 'Plătit: aprecierea');
  assert.equal(payments.paymentTitle('appreciation', null), 'Plătești aprecierea');
  assert.equal(payments.readPaymentIntent({ ok: true, payment: { tx_hash: hash } }), null, 'fără id nu este rând');
  const badHash = payments.readPaymentIntent({ ok: true, payment: { id: 'd'.repeat(24), status: 'broadcast', tx_hash: 'nothex' } });
  assert.equal(badHash.tx_hash, null, 'un hash care nu e hash nu se tipărește');
  assert.equal(payments.intentIsPaid(null), false);
  assert.equal(payments.intentIsPaid({ id: 'x', status: 'quoted' }), false);
  assert.equal(payments.intentIsPaid({ id: 'x', status: 'failed' }), false);
});

test('cheia de aprobare se schimbă doar când serverul a închis rândul plății', () => {
  const spent = [
    'IDEMPOTENCY_CONFLICT', 'PAYMENT_ALREADY_USED', 'PAYMENT_FAILED',
    'CHAIN_TRANSACTION_FAILED', 'CHAIN_BROADCAST_REFUSED', 'CHAIN_INSUFFICIENT_FUNDS',
  ];
  for (const code of spent) assert.equal(payments.paymentKeyRotates(code), true, code);
  // A dropped connection is not spent: replaying the same key is how a transfer that left the phone is
  // recovered instead of paid twice. `PAYMENT_REQUIRED` is the price being named, not a closed row.
  for (const code of ['', null, undefined, 'PAYMENT_REQUIRED', 'SELF_PAYMENT', 'ACTION_FREE', 'CEVA_NOU']) {
    assert.equal(payments.paymentKeyRotates(code), false, String(code));
  }
  const sheet = readFileSync(resolve(ROOT, 'src/components/ActionPaymentSheet.tsx'), 'utf8');
  assert.match(sheet, /paymentKeyRotates\(code\)/, 'fila își schimbă cheia după refuzurile definitive');
  assert.doesNotMatch(sheet, /IDEMPOTENCY_CONFLICT' \|\|/, 'lista de coduri nu se ține în două locuri');
});

test('după faucet, soldul se poate reciti fără să închizi foaia', () => {
  const sheet = readFileSync(resolve(ROOT, 'src/components/ActionPaymentSheet.tsx'), 'utf8');
  assert.match(sheet, /const needsFunds = quote\?\.chain\?\.can_afford === false/);
  assert.match(sheet, /Am primit EGLD · verifică din nou/);
  assert.match(sheet, /onPress=\{refresh\}/);
  assert.match(sheet, /const refresh = useCallback\(/, 'recitirea nu inventează o plată nouă');
});

test('fiecare refuz are o propoziție care spune ce poate face cititorul', () => {
  assert.match(payments.paymentSentence('PAYMENT_REQUIRED'), /plătește/);
  assert.match(payments.paymentSentence('CHAIN_INSUFFICIENT_FUNDS'), /EGLD/);
  assert.equal(payments.paymentSentence('CEVA_NOU', 'serverul a spus altceva'), 'serverul a spus altceva');
  assert.match(payments.paymentSentence('', ''), /Încearcă din nou/);
  for (const action of payments.PAID_ACTIONS) {
    assert.match(payments.ACTION_WORDS[action], /\S/);
    assert.match(payments.paymentTitle(action, null), new RegExp(payments.ACTION_WORDS[action]));
  }
  assert.deepEqual(payments.PAID_ACTIONS, ['appreciation', 'comment'], 'distribuirea este gratuită');
});

