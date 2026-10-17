#!/usr/bin/env node
/**
 * What a Jungle Book appreciation (or comment, or share) really costs to settle on MultiversX.
 *
 * The gas numbers are read from the DEVNET node itself (`/network/config`); the EGLD/EUR rate is a
 * parameter, never a constant, because a hard-coded rate would make this table a promise the project
 * cannot keep. Nothing here signs, sends or spends anything.
 *
 * Usage:
 *   node tools/monetization/simulate.mjs --egld-eur 30
 *   node tools/monetization/simulate.mjs --egld-eur 30 --json
 *
 * Options:
 *   --egld-eur <n>          how many euro one EGLD is worth for this simulation (required)
 *   --reference-eur-per-jb  the test-only reference value of 1 JB (default 1)
 *   --api <url>             network config endpoint (default devnet)
 *   --payout-gas <n>        gas limit of one EGLD payout transaction (default 70000)
 *   --esdt-payout-gas <n>   gas limit of one ESDT payout transaction (default 250000)
 *   --memo-bytes <n>        bytes of the payout memo that the gas above already covers (default 64)
 *   --batch <list>          settlement batch sizes (default 10,100,1000)
 *   --json                  machine-readable output
 */
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    'egld-eur': { type: 'string' },
    'reference-eur-per-jb': { type: 'string', default: '1' },
    api: { type: 'string', default: 'https://devnet-api.multiversx.com/network/config' },
    'payout-gas': { type: 'string', default: '70000' },
    'esdt-payout-gas': { type: 'string', default: '250000' },
    'memo-bytes': { type: 'string', default: '64' },
    batch: { type: 'string', default: '10,100,1000' },
    json: { type: 'boolean', default: false },
  },
});

/** The cent of the token: the ledger keeps integers, one JB is 100 JBc. */
const CENTS_PER_JB = 100;
/** `CORE_TIP_V1_90_5_3_2` — the versioned split the backend already stores. */
const SPLIT = { creator: 0.9, fee: 0.05, reserve: 0.03, infra: 0.02 };
/** The two presets proposed in docs/MONETIZATION-SPEC.md, in JBc. */
const PRICES = [2, 3];

const egldEur = Number(values['egld-eur']);
const referenceEurPerJb = Number(values['reference-eur-per-jb']);
if (!Number.isFinite(egldEur) || egldEur <= 0) {
  console.error('Pass the EGLD/EUR rate explicitly: --egld-eur <n>. It is a parameter, never a constant.');
  process.exit(1);
}
if (!Number.isFinite(referenceEurPerJb) || referenceEurPerJb <= 0) {
  console.error('--reference-eur-per-jb must be a positive number (the test-only reference value).');
  process.exit(1);
}
const batches = values.batch.split(',').map((entry) => Number(entry.trim())).filter((entry) => Number.isInteger(entry) && entry > 0);
const payoutGas = Number(values['payout-gas']);
const esdtPayoutGas = Number(values['esdt-payout-gas']);

const response = await fetch(values.api);
if (!response.ok) {
  console.error(`Could not read ${values.api}: HTTP ${response.status}. The gas numbers must come from the network.`);
  process.exit(1);
}
const config = (await response.json()).data.config;
const gasPriceWei = Number(config.erd_min_gas_price);
const minGasLimit = Number(config.erd_min_gas_limit);
const gasPerDataByte = Number(config.erd_gas_per_data_byte);
const gasPriceModifier = Number(config.erd_gas_price_modifier);

if (![gasPriceWei, minGasLimit, gasPerDataByte, gasPriceModifier].every(Number.isFinite)) {
  console.error('The network config did not carry the gas fields this simulation needs.');
  process.exit(1);
}

/**
 * A payout transaction costs `gas limit × gas price`. The gas limits are parameters because a plain
 * EGLD transfer and an ESDT transfer do not cost the same; the defaults are the conservative limits a
 * settlement worker reserves, memo included.
 */
const feeEgld = (payoutGas * gasPriceWei) / 1e18;
const feeEur = feeEgld * egldEur;
const esdtFeeEgld = (esdtPayoutGas * gasPriceWei) / 1e18;
const esdtFeeEur = esdtFeeEgld * egldEur;

/** One row of the table: a price, a settlement mode and what it leaves behind. */
function row(priceCents, mode, actionsPerTransaction, costEur) {
  const revenueEur = (priceCents / CENTS_PER_JB) * referenceEurPerJb;
  const costPerAction = costEur / actionsPerTransaction;
  return {
    priceCents,
    mode,
    actionsPerTransaction,
    costPerActionEur: costPerAction,
    costShareOfRevenue: costPerAction / revenueEur,
    creatorCents: priceCents * SPLIT.creator,
    creatorEurAfter: revenueEur * SPLIT.creator - costPerAction,
    withinInfraSlice: costPerAction <= revenueEur * SPLIT.infra,
  };
}

const settlementModes = [
  { mode: 'per acțiune', actions: 1 },
  ...batches.map((size) => ({ mode: `lot de ${size}`, actions: size })),
];

function table(title, fee) {
  const rows = [];
  for (const price of PRICES) {
    for (const entry of settlementModes) {
      rows.push(row(price, entry.mode, entry.actions, fee));
    }
  }
  return { title, rows };
}

const egldTable = table('decontare în EGLD', feeEur);
const esdtTable = table('decontare în ESDT', esdtFeeEur);

/** The cheapest batch that keeps the network cost inside the 2% infrastructure slice. */
function minimumBatch(priceCents, fee) {
  const infraEur = (priceCents / CENTS_PER_JB) * referenceEurPerJb * SPLIT.infra;
  return Math.ceil(fee / infraEur);
}

/** A withdrawal is worth doing when its own transaction costs at most 1% of what is withdrawn. */
const withdrawalThresholdCents = Math.ceil((feeEur / 0.01) / referenceEurPerJb * CENTS_PER_JB);
/** The lowest price that still covers a batched action inside the infrastructure slice. */
const minimumPriceCents = Math.ceil((feeEur / Math.max(...batches)) / SPLIT.infra / referenceEurPerJb * CENTS_PER_JB);

function eur(value, digits = 6) {
  return `${value < 0 ? '-' : ''}€${Math.abs(value).toFixed(digits)}`;
}

function percent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function markdownTable(section) {
  const lines = [
    '| Preț | Mod | Acțiuni / tx | Cost / acțiune | Din venit | Creator (JBc) | Creator după cost | În felia de 2% |',
    '| ---: | --- | ---: | ---: | ---: | ---: | ---: | :---: |',
  ];
  for (const entry of section.rows) {
    lines.push(
      `| ${entry.priceCents} JBc | ${entry.mode} | ${entry.actionsPerTransaction} | ${eur(entry.costPerActionEur)} | ` +
      `${percent(entry.costShareOfRevenue)} | ${entry.creatorCents.toFixed(2)} | ${eur(entry.creatorEurAfter)} | ` +
      `${entry.withinInfraSlice ? 'da' : '**nu**'} |`,
    );
  }
  return lines.join('\n');
}

if (values.json) {
  console.log(JSON.stringify({
    network: config.erd_chain_id,
    gas: { minGasLimit, gasPriceWei, gasPerDataByte, gasPriceModifier },
    egldEur,
    referenceEurPerJb,
    payout: { egldGas: payoutGas, egldFeeEgld: feeEgld, esdtGas: esdtPayoutGas, esdtFeeEgld },
    egldTable,
    esdtTable,
    thresholds: {
      minimumBatchAt2Cents: minimumBatch(2, feeEur),
      minimumBatchAt3Cents: minimumBatch(3, feeEur),
      withdrawalCents: withdrawalThresholdCents,
      minimumPriceCents,
    },
  }, null, 2));
} else {
  console.log(`# Costul real al unei acțiuni plătite — MultiversX ${config.erd_chain_id} (devnet)`);
  console.log('');
  console.log(`- gaz: minGasLimit ${minGasLimit}, gasPrice ${gasPriceWei} wei, ${gasPerDataByte} gaz/octet, modificator ${gasPriceModifier}`);
  console.log(`- curs luat ca parametru: 1 EGLD = ${egldEur} EUR`);
  console.log(`- valoare de referință (test): 1 JB = ${referenceEurPerJb} EUR, deci 1 JBc = ${eur(referenceEurPerJb / CENTS_PER_JB)}`);
  console.log(`- o plată EGLD (${payoutGas} gaz): ${feeEgld.toFixed(12)} EGLD = ${eur(feeEur)}`);
  console.log(`- o plată ESDT (${esdtPayoutGas} gaz): ${esdtFeeEgld.toFixed(12)} EGLD = ${eur(esdtFeeEur)}`);
  console.log('');
  console.log(`## ${egldTable.title}`);
  console.log('');
  console.log(markdownTable(egldTable));
  console.log('');
  console.log(`## ${esdtTable.title}`);
  console.log('');
  console.log(markdownTable(esdtTable));
  console.log('');
  console.log('## Praguri');
  console.log('');
  console.log(`- lot minim ca să încapă în felia de 2% la 2 JBc: **${minimumBatch(2, feeEur)}** acțiuni`);
  console.log(`- lot minim ca să încapă în felia de 2% la 3 JBc: **${minimumBatch(3, feeEur)}** acțiuni`);
  console.log(`- prag minim de retragere (o plată ≤ 1% din sumă): **${withdrawalThresholdCents} JBc**`);
  console.log(`- preț minim al unei acțiuni, cu lot de ${Math.max(...batches)}: **${minimumPriceCents} JBc**`);
  console.log('');
  console.log('Costul nu include încă rent-ul de stocare al conturilor noi (ESDT/SFT) și nici rezerva de gaz');
  console.log('pentru un contract care ar plăti în lot: ambele se adaugă la felia de 2% înainte de F1.');
}

