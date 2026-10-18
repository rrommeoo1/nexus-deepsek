import test from "node:test";
import assert from "node:assert/strict";
import { breakEvenUsers, monthlyModel, normalizeScenario } from "../lib/self-funding.js";

/**
 * F4 checks the model's honesty as much as its arithmetic: a scenario missing a price must come back
 * incomplete, the slices must conserve the gross, and a free-only mix must not break even by magic.
 */
const complete = {
  active_users: 10_000,
  paid_profile_share: 0.05,
  paid_action_price_cents: 3,
  paid_actions_per_payer_day: 3,
  railway_eur_month: 20,
  domain_eur_month: 1,
  moderation_eur_month: 0,
  storage_eur_per_gb_month: 0.02,
  traffic_eur_per_gb: 0.01,
  video_eur_per_minute: 0.005,
  storage_gb_per_user: 0.5,
  traffic_gb_per_user_month: 1,
  video_minutes_per_user_month: 2,
  infrastructure_cents_per_action: 1,
};

test("a complete scenario conserves every cent and reports a real profit", () => {
  const model = monthlyModel(complete);
  assert.equal(model.complete, true);
  assert.equal(model.paid_profiles, 500);
  assert.equal(model.actions_per_month, 45_000);
  assert.equal(model.revenue.actions_cents, 135_000);
  const slices = model.slices;
  assert.equal(slices.creator + slices.network_fund + slices.founder + slices.shareholders + slices.burn + slices.infra, model.revenue.gross_cents);
  assert.equal(model.costs.gas_cents, 45_000);
  assert.equal(model.profit_cents, slices.infra - model.costs.fixed_cents - model.costs.variable_cents - model.costs.gas_cents);
  assert.ok(Number.isInteger(model.profit_cents));
});

test("a scenario without prices is incomplete, and says which ones are missing", () => {
  const model = monthlyModel({ active_users: 1000, paid_profile_share: 0.02, paid_action_price_cents: 3 });
  assert.equal(model.complete, false);
  assert.ok(model.needs.includes("railway_eur_month"));
  assert.ok(model.needs.includes("storage_eur_per_gb_month"));
  // The model still computes, but the profit of an incomplete scenario is a floor, not an answer.
  assert.ok(model.costs.fixed_cents === 0);
});

test("free profiles never break even, and at the floor price the margin is exactly zero", () => {
  assert.equal(breakEvenUsers({ ...complete, paid_profile_share: 0, paid_actions_per_payer_day: 0 }), null);
  // 3 cents give the creator 2 and infrastructure 1, which is exactly the gas of one action: nothing
  // is left for Railway, so there is no break-even at the floor. That is a finding, not a bug.
  assert.equal(breakEvenUsers(complete), null);

  // One cent above the floor leaves a margin, and then a finite number of users pays the fixed costs.
  const aboveFloor = { ...complete, paid_action_price_cents: 5 };
  const breakEven = breakEvenUsers(aboveFloor);
  assert.ok(Number.isInteger(breakEven) && breakEven > 0);
  const atBreakEven = monthlyModel({ ...aboveFloor, active_users: breakEven });
  assert.ok(atBreakEven.slices.infra >= atBreakEven.costs.fixed_cents - 2);
});

test("normalisation clamps nonsense instead of inventing it", () => {
  const scenario = normalizeScenario({ active_users: -5, paid_profile_share: "x", railway_eur_month: "20" });
  assert.equal(scenario.active_users, 0);
  assert.equal(scenario.paid_profile_share, 0);
  assert.equal(scenario.railway_eur_month, 20);
  assert.ok(!scenario.unknown.includes("railway_eur_month"));
});
