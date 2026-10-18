#!/usr/bin/env node
/**
 * Prints the price floor table of policy v3: for each EGLD/EUR rate and each batch size, the lowest
 * price at which the creator keeps 60 % and the infrastructure slice pays for the gas.
 *
 * Nothing is measured here: the gas limits are parameters (`--settlement-gas`, `--anchor-gas`), and
 * the rate is passed in. A measured devnet value replaces them once a transaction exists.
 */
import { minimumPriceCents, gasPerActionEgld, gasCostCents, SPLIT_POLICIES, POLICY_V3 } from "../../apps/nexus-web/lib/split-policy.js";

const rates = (process.argv[2] || "10,20,30,50").split(",").map(Number);
const batches = (process.argv[3] || "1,10,20,50").split(",").map(Number);
const gas = Number(process.argv[4] || 500000);
const anchor = Number(process.argv[5] || 150000);

const rows = [];
for (const egld_eur of rates) {
  for (const batch_size of batches) {
    const result = minimumPriceCents({ egld_eur, batch_size, settlement_gas_limit: gas, anchor_gas_limit: anchor });
    rows.push({ egld_eur, batch_size, ...result });
  }
}

const header = ["| EGLD (€) | N = 1 | N = 10 | N = 20 | N = 50 |", "|---:|---:|---:|---:|---:|"];
const lines = [];
for (const egld_eur of rates) {
  const cells = batches.map((batch_size) => {
    const found = rows.find((row) => row.egld_eur === egld_eur && row.batch_size === batch_size);
    return `${(found.price_cents / 100).toFixed(2)}`;
  });
  lines.push(`| ${egld_eur} | ${cells.join(" | ")} |`);
}

console.log(header.concat(lines).join("\n"));
console.log("");
console.log(`policy: ${POLICY_V3} = ${JSON.stringify(SPLIT_POLICIES[POLICY_V3])}`);
console.log(`settlement gas limit ${gas}, anchor ${anchor}`);
for (const egld_eur of rates) {
  const perAction = gasPerActionEgld({ egld_eur, batch_size: 1, settlement_gas_limit: gas, anchor_gas_limit: anchor });
  const cents1 = gasCostCents({ gas_egld: perAction, egld_eur });
  const perActionBatched = gasPerActionEgld({ egld_eur, batch_size: 10, settlement_gas_limit: gas, anchor_gas_limit: anchor });
  console.log(`EGLD ${egld_eur} €: N=1 gaz ${perAction.toFixed(9)} EGLD (${cents1}¢ cu marjă), N=10 ${perActionBatched.toFixed(9)} EGLD (${gasCostCents({ gas_egld: perActionBatched, egld_eur })}¢)`);
}
console.log("");
console.log(rows.map((row) => `EGLD ${row.egld_eur} N=${row.batch_size}: ${row.price_cents}¢ → creator ${row.creator_cents}¢ (${(row.creator_bps / 100).toFixed(2)}%), infra ${row.infra_cents}¢, nevoie ${row.infra_needed_cents}¢`).join("\n"));
