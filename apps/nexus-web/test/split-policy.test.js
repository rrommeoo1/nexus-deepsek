import test from "node:test";
import assert from "node:assert/strict";
import {
  POLICY_V3,
  SETTLEMENT_DEFAULTS,
  checkSplit,
  gasCostCents,
  gasPerActionEgld,
  getPolicy,
  minimumPriceCents,
  policyViolations,
  pricingPolicyParams,
  splitByPolicy,
} from "../lib/split-policy.js";

/**
 * F3 proves the arithmetic the owner asked for, as properties rather than examples:
 *
 *  * every split conserves the cent and no slice is negative (1 000 amounts in a row);
 *  * the creator never drops under 60 %, even where flooring would;
 *  * the infrastructure slice always pays the gas at the batch and rate used;
 *  * the floor is the *lowest* price at which those hold — one cent less fails.
 *
 * The table in docs/PRICING-CALCULUS.md §3 is the literal output of `minimumPriceCents`, so a change
 * in parameters that silently moved a price would show up here first.
 */

test("policy v3 has the owner's slices and no static violation", () => {
  const policy = getPolicy(POLICY_V3);
  assert.equal(policy.creator_bps, 7000);
  assert.equal(policy.network_fund_bps, 500);
  assert.equal(policy.founder_bps, 400);
  assert.equal(policy.shareholders_bps, 400);
  assert.equal(policy.burn_bps, 100);
  assert.equal(policy.min_creator_bps, 6000);
  assert.deepEqual(policyViolations(policy), []);
});

test("conservation holds to the cent for every amount from 1 to 1000", () => {
  for (let gross = 1; gross <= 1000; gross += 1) {
    const shares = splitByPolicy(gross, POLICY_V3);
    const total = shares.creator + shares.network_fund + shares.founder + shares.shareholders + shares.burn + shares.infra;
    assert.equal(total, gross, `amount ${gross} did not conserve`);
    for (const key of ["creator", "network_fund", "founder", "shareholders", "burn", "infra"]) {
      assert.ok(Number.isInteger(shares[key]) && shares[key] >= 0, `${key} at ${gross} is not a natural number`);
    }
  }
});

test("the creator keeps at least 60% at every price, and 70% once rounding allows it", () => {
  for (let gross = 1; gross <= 500; gross += 1) {
    const shares = splitByPolicy(gross, POLICY_V3);
    const bps = Math.floor((shares.creator * 10000) / gross);
    assert.ok(bps >= 6000, `creator got ${bps} bps at ${gross}`);
  }
  // The jagged case the top-up exists for: 70 % of 4 rounds to 2 (50 %), so the creator gets 3.
  assert.equal(splitByPolicy(4).creator, 3);
  assert.equal(splitByPolicy(7).creator, 5);
  assert.equal(splitByPolicy(100).creator, 70);
});

test("a fixed slice never exceeds its rate, and the leftovers stay in infrastructure", () => {
  const shares = splitByPolicy(199);
  assert.equal(shares.network_fund, 9); // 5 % of 199 = 9,95 → 9
  assert.equal(shares.founder, 7); // 4 % = 7,96 → 7
  assert.equal(shares.shareholders, 7);
  assert.equal(shares.burn, 1);
  assert.equal(shares.creator, 139); // 70 % = 139,3 → 139
  assert.equal(shares.infra, 199 - 139 - 9 - 7 - 7 - 1);
  assert.equal(shares.infra, 36);
});
test("gas per action follows the batch, and per_action pays its own transfer", () => {
  const batched = (batch) => gasPerActionEgld({ mode: "batched", batch_size: batch });
  assert.equal(batched(1), 0.00065);
  assert.equal(batched(10), 0.000065);
  assert.equal(batched(50), 0.000013);
  assert.equal(gasPerActionEgld({ mode: "per_action" }), 0.0005);
  assert.ok(batched(10) < 0.0005 / 5);
});

test("gas in cents rounds up so the floor can never be undercharged", () => {
  assert.equal(gasCostCents({ gas_egld: 0.00065, egld_eur: 30 }), 3);
  assert.equal(gasCostCents({ gas_egld: 0.00065, egld_eur: 10 }), 1);
  assert.equal(gasCostCents({ gas_egld: 0.00065, egld_eur: 20 }), 2);
  assert.equal(gasCostCents({ gas_egld: 0.00065, egld_eur: 50 }), 4);
  assert.equal(gasCostCents({ gas_egld: 0.0005, egld_eur: 30, infra_margin_bps: 0 }), 2);
});


test("the minimum price is the lowest one that satisfies every rule", () => {
  const cases = [
    { egld_eur: 10, batch_size: 1, expected: 3 },
    { egld_eur: 20, batch_size: 1, expected: 5 },
    { egld_eur: 30, batch_size: 1, expected: 8 },
    { egld_eur: 50, batch_size: 1, expected: 11 },
    { egld_eur: 10, batch_size: 10, expected: 3 },
    { egld_eur: 50, batch_size: 10, expected: 3 },
    { egld_eur: 50, batch_size: 50, expected: 3 },
  ];
  for (const benchmark of cases) {
    const floor = minimumPriceCents({ egld_eur: benchmark.egld_eur, batch_size: benchmark.batch_size });
    assert.equal(floor.price_cents, benchmark.expected);
    assert.equal(checkSplit(floor.price_cents, { infra_needed_cents: floor.infra_needed_cents }).ok, true);
    assert.equal(checkSplit(floor.price_cents - 1, { infra_needed_cents: floor.infra_needed_cents }).ok, false);
  }
});

test("the table in docs/PRICING-CALCULUS.md is the one this module computes", () => {
  const documented = { 10: [3, 3, 3, 3], 20: [5, 3, 3, 3], 30: [8, 3, 3, 3], 50: [11, 3, 3, 3] };
  for (const rate of Object.keys(documented)) {
    [1, 10, 20, 50].forEach((batch_size, index) => {
      assert.equal(
        minimumPriceCents({ egld_eur: Number(rate), batch_size }).price_cents,
        documented[rate][index],
      );
    });
  }
});

test("0,02 is refused by the gas rule, not by taste", () => {
  const floor = minimumPriceCents();
  assert.equal(floor.price_cents, 3);
  const two = checkSplit(2, { infra_needed_cents: floor.infra_needed_cents });
  assert.equal(two.ok, false);
  assert.ok(two.problems.some((problem) => problem.code === "INFRA_DOES_NOT_COVER_GAS"));
  assert.equal(two.shares.creator, 2);
  assert.equal(two.shares.infra, 0);
});

test("parameters come from the environment, with v3 and batched as the defaults", () => {
  const defaults = pricingPolicyParams({});
  assert.equal(defaults.policyVersion, POLICY_V3);
  assert.equal(defaults.mode, "batched");
  assert.equal(defaults.batch_size, 10);
  assert.equal(defaults.egld_eur, 30);
  assert.equal(defaults.settlement_gas_limit, SETTLEMENT_DEFAULTS.settlement_gas_limit);
  const tuned = pricingPolicyParams({
    NEXUS_EGLD_EUR: "12", NEXUS_SETTLEMENT_MODE: "per_action", NEXUS_BATCH_SIZE: "20", NEXUS_INFRA_MARGIN_BPS: "0",
  });
  assert.equal(tuned.egld_eur, 12);
  assert.equal(tuned.mode, "per_action");
  assert.equal(tuned.batch_size, 20);
  assert.equal(tuned.infra_margin_bps, 0);
  assert.equal(pricingPolicyParams({ NEXUS_SETTLEMENT_MODE: "carrier-pigeon" }).mode, "batched");
});

