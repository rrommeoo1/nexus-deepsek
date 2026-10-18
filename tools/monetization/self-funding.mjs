#!/usr/bin/env node
/**
 * Can the platform pay for itself? Three user sizes × three paid-profile shares, with the revenue the
 * app can actually produce and the costs a budget actually has.
 *
 * Nothing here is a price list. A cost that is not passed on the command line is **unknown**, printed
 * as `de completat`, and makes the scenario incomplete instead of profitable:
 *
 *   node tools/monetization/self-funding.mjs --railway-eur-month 20 --users 1000,10000,100000
 *
 * The model itself lives in `apps/nexus-web/lib/self-funding.js` and is covered by its test.
 */
import { parseArgs } from "node:util";
import { breakEvenUsers, monthlyModel, normalizeScenario } from "../../apps/nexus-web/lib/self-funding.js";
import { minimumPriceCents } from "../../apps/nexus-web/lib/split-policy.js";

const { values } = parseArgs({
  options: {
    users: { type: "string", default: "1000,10000,100000" },
    "paid-share": { type: "string", default: "0.02,0.05,0.10" },
    "actions-per-day": { type: "string", default: "3" },
    "price-cents": { type: "string", default: "" },
    "railway-eur-month": { type: "string" },
    "domain-eur-month": { type: "string" },
    "moderation-eur-month": { type: "string" },
    "storage-eur-per-gb-month": { type: "string" },
    "traffic-eur-per-gb": { type: "string" },
    "video-eur-per-minute": { type: "string" },
    "storage-gb-per-user": { type: "string" },
    "traffic-gb-per-user-month": { type: "string" },
    "video-minutes-per-user-month": { type: "string" },
    "infra-cents-per-action": { type: "string" },
    json: { type: "boolean", default: false },
  },
});

const users = values.users.split(",").map((entry) => Number(entry.trim())).filter(Number.isFinite);
const shares = values["paid-share"].split(",").map((entry) => Number(entry.trim())).filter((entry) => Number.isFinite(entry) && entry >= 0 && entry <= 1);
const floor = minimumPriceCents({ batch_size: Number(process.env.NEXUS_BATCH_SIZE || 10) });
const priceCents = values["price-cents"] ? Number(values["price-cents"]) : floor.price_cents;

const base = {
  paid_action_price_cents: priceCents,
  paid_actions_per_payer_day: Number(values["actions-per-day"]),
  railway_eur_month: values["railway-eur-month"],
  domain_eur_month: values["domain-eur-month"],
  moderation_eur_month: values["moderation-eur-month"],
  storage_eur_per_gb_month: values["storage-eur-per-gb-month"],
  traffic_eur_per_gb: values["traffic-eur-per-gb"],
  video_eur_per_minute: values["video-eur-per-minute"],
  storage_gb_per_user: values["storage-gb-per-user"],
  traffic_gb_per_user_month: values["traffic-gb-per-user-month"],
  video_minutes_per_user_month: values["video-minutes-per-user-month"],
  infrastructure_cents_per_action: values["infra-cents-per-action"] ?? floor.infra_needed_cents,
};

const rows = [];
for (const active_users of users) {
  for (const paid_profile_share of shares) {
    rows.push(monthlyModel({ ...base, active_users, paid_profile_share }));
  }
}

const euro = (cents) => `${cents < 0 ? "-" : ""}€${(Math.abs(cents) / 100).toFixed(2)}`;

if (values.json) {
  console.log(JSON.stringify({
    price_cents: priceCents,
    floor: { price_cents: floor.price_cents, gas_cents: floor.infra_needed_cents },
    rows: rows.map((row) => ({
      users: row.users,
      paid_share: row.scenario.paid_profile_share,
      gross_cents: row.revenue.gross_cents,
      creator_cents: row.slices.creator,
      platform_cents: row.slices.infra + row.slices.network_fund + row.slices.founder + row.slices.shareholders + row.slices.burn,
      costs_cents: row.costs.total_cents,
      profit_cents: row.profit_cents,
      complete: row.complete,
      needs: row.needs,
    })),
  }, null, 2));
} else {
  console.log(`# Autofinanțare — preț ${priceCents}¢, ${base.paid_actions_per_payer_day} acțiuni plătite/zi/fan plătitor`);
  console.log("");
  console.log("Costurile nespecificate sunt **de completat**, nu zero:");
  const scenario = normalizeScenario(base);
  console.log(scenario.unknown.length ? `- ${scenario.unknown.join(", ")}` : "- toate costurile au fost date");
  console.log("");
  console.log("| Utilizatori activi | Profiluri cu plată | Venit brut | Creator | Platformă | Costuri | Profit | Sliced? |");
  console.log("|---:|---:|---:|---:|---:|---:|---:|:---:|");
  for (const row of rows) {
    const platform = row.slices.infra + row.slices.network_fund + row.slices.founder + row.slices.shareholders + row.slices.burn;
    console.log(
      `| ${row.users} | ${(row.scenario.paid_profile_share * 100).toFixed(0)}% | ${euro(row.revenue.gross_cents)} | ` +
      `${euro(row.slices.creator)} | ${euro(platform)} | ${euro(row.costs.total_cents)} | ${euro(row.profit_cents)} | ` +
      `${row.complete ? "da" : "**nu**"} |`,
    );
  }
  console.log("");
  const breakEven = breakEvenUsers(base);
  console.log(breakEven == null
    ? `Pragul de rentabilitate: **nu există** la acest mix (niciun venit pe utilizator).`
    : `Pragul de rentabilitate: **${breakEven} utilizatori activi** la acest mix.`);
  console.log("");
  console.log("Profilurile gratuite consumă stocare, trafic și procesare video fără să producă venit: dacă");
  console.log("`storage-gb-per-user` și celelalte nu sunt date, costul real al lor nu apare în tabel.");
  console.log("Măsurile din aplicație care țin costul media jos: limita de durată a clipului, compresia la");
  console.log("înregistrare și re-encodarea la afișare — vezi `docs/MONETIZATION-SPEC.md` §5.");
}
