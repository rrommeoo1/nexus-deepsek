/**
 * F4 — can the platform pay for itself? A monthly model, not a promise.
 *
 * Every number that would have to be *known* (Railway, domain, moderation, storage per GB, traffic per
 * GB, video processing per minute) arrives as a parameter and is flagged when the caller did not supply
 * it. The model never invents a price: an unknown cost stays 0 and is reported as unknown, so a
 * scenario with missing inputs says "de completat" instead of "profit".
 *
 * Revenue comes only from what the app actually sells — no advertising:
 *   paid actions (the v3 slices), profile subscriptions, paid posts, tips, creator boosts.
 *
 * Pure module: no database, no clock, no network.
 */
import { POLICY_V3, getPolicy, pricingPolicyParams, splitByPolicy } from "./split-policy.js";

/** The costs a real budget has, with `null` meaning "nobody wrote the price down yet". */
export const COST_INPUTS = Object.freeze([
  "railway_eur_month",
  "domain_eur_month",
  "moderation_eur_month",
  "storage_eur_per_gb_month",
  "traffic_eur_per_gb",
  "video_eur_per_minute",
]);

/** Revenue lines the product can actually produce today. */
export const REVENUE_INPUTS = Object.freeze([
  "paid_action_price_cents",
  "paid_actions_per_payer_day",
  "subscription_share_of_paid_profiles",
  "subscription_price_cents",
  "paid_post_share_of_paid_profiles",
  "paid_post_price_cents",
  "tips_per_payer_day",
  "tip_price_cents",
  "boost_share_of_creators",
  "boost_price_cents",
]);

/** Usage that drives variable cost. Free profiles consume these and pay nothing. */
export const USAGE_INPUTS = Object.freeze([
  "storage_gb_per_user",
  "traffic_gb_per_user_month",
  "video_minutes_per_user_month",
  "infrastructure_cents_per_action",
]);

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/** Normalises a scenario, keeping track of which inputs were actually supplied. */
export function normalizeScenario(input = {}) {
  const scenario = {};
  const unknown = [];
  const assumed = [];
  for (const key of [...COST_INPUTS, ...REVENUE_INPUTS, ...USAGE_INPUTS]) {
    const supplied = input[key] != null && input[key] !== "";
    scenario[key] = num(input[key]);
    if (supplied) continue;
    // A missing *cost* makes the answer unknowable; a missing revenue line is simply "we do not sell
    // that yet", and defaulting it to zero is the conservative reading, not a hidden profit.
    if ([...COST_INPUTS, ...USAGE_INPUTS].includes(key)) unknown.push(key);
    else assumed.push(key);
  }
  scenario.active_users = Math.max(0, Math.floor(num(input.active_users ?? 1000)));
  scenario.paid_profile_share = num(input.paid_profile_share ?? 0.02);
  scenario.policy_version = input.policy_version || POLICY_V3;
  scenario.unknown = unknown;
  scenario.assumed = assumed;
  return scenario;
}

/**
 * One month of one scenario. The creator is paid first (policy v3), then the platform's own slices are
 * summed; the infrastructure slice is the one allowed to pay gas, so gas is reported separately and
 * subtracted from it rather than hidden in "costs".
 */
export function monthlyModel(input = {}, params = pricingPolicyParams()) {
  const scenario = normalizeScenario(input);
  const users = scenario.active_users;
  const paidProfiles = users * scenario.paid_profile_share;
  const payers = paidProfiles;
  const days = 30;

  const actionRevenue = Math.round(payers * scenario.paid_actions_per_payer_day * days * Math.round(scenario.paid_action_price_cents));
  const subscriptionRevenue = Math.round(paidProfiles * scenario.subscription_share_of_paid_profiles * scenario.subscription_price_cents);
  const paidPostRevenue = Math.round(paidProfiles * scenario.paid_post_share_of_paid_profiles * scenario.paid_post_price_cents);
  const tipRevenue = Math.round(payers * scenario.tips_per_payer_day * days * scenario.tip_price_cents);
  const boostRevenue = Math.round(paidProfiles * scenario.boost_share_of_creators * scenario.boost_price_cents);
  const grossCents = actionRevenue + subscriptionRevenue + paidPostRevenue + tipRevenue + boostRevenue;

  // Every revenue line is split on its own, with the integer arithmetic that will actually run: a 3-cent
  // action gives the creator 2 and infrastructure 1, which is 33 % of that action, not 16 %.
  const lines = [
    { key: "actions", price_cents: Math.round(scenario.paid_action_price_cents), revenue_cents: actionRevenue },
    { key: "subscriptions", price_cents: scenario.subscription_price_cents, revenue_cents: subscriptionRevenue },
    { key: "paid_posts", price_cents: scenario.paid_post_price_cents, revenue_cents: paidPostRevenue },
    { key: "tips", price_cents: scenario.tip_price_cents, revenue_cents: tipRevenue },
    { key: "boosts", price_cents: scenario.boost_price_cents, revenue_cents: boostRevenue },
  ];
  const slices = { creator: 0, network_fund: 0, founder: 0, shareholders: 0, burn: 0, infra: 0 };
  for (const line of lines) {
    if (line.revenue_cents <= 0) continue;
    const price = Math.max(1, Math.round(line.price_cents));
    const perPayment = splitByPolicy(price, scenario.policy_version);
    const payments = Math.max(1, Math.round(line.revenue_cents / price));
    for (const key of Object.keys(slices)) slices[key] += perPayment[key] * payments;
  }
  // A cent that the per-line multiplication cannot place (prices that do not divide the revenue) is
  // kept in the infrastructure slice, so the month still adds up to its gross.
  const placed = slices.creator + slices.network_fund + slices.founder + slices.shareholders + slices.burn + slices.infra;
  if (grossCents - placed > 0) slices.infra += grossCents - placed;

  const fixedCents = Math.round(100 * (scenario.railway_eur_month + scenario.domain_eur_month + scenario.moderation_eur_month));
  const variableCents = Math.round(100 * (
    users * scenario.storage_gb_per_user * scenario.storage_eur_per_gb_month
    + users * scenario.traffic_gb_per_user_month * scenario.traffic_eur_per_gb
    + users * scenario.video_minutes_per_user_month * scenario.video_eur_per_minute
  ));
  const actions = Math.round(payers * scenario.paid_actions_per_payer_day * days);
  const gasCents = Math.round(actions * scenario.infrastructure_cents_per_action);
  const costCents = fixedCents + variableCents;

  return {
    scenario,
    users,
    paid_profiles: Math.round(paidProfiles),
    actions_per_month: actions,
    revenue: {
      actions_cents: actionRevenue,
      subscriptions_cents: subscriptionRevenue,
      paid_posts_cents: paidPostRevenue,
      tips_cents: tipRevenue,
      boosts_cents: boostRevenue,
      gross_cents: grossCents,
    },
    slices,
    costs: { fixed_cents: fixedCents, variable_cents: variableCents, gas_cents: gasCents, total_cents: costCents + gasCents },
    profit_cents: slices.infra - costCents - gasCents,
    profit_margin: grossCents > 0 ? (slices.infra - costCents - gasCents) / grossCents : null,
    // A scenario is only a result when every cost is a number somebody supplied.
    complete: scenario.unknown.length === 0,
    needs: scenario.unknown,
    params,
  };
}

/**
 * How many active users this revenue mix needs to break even at the same assumptions. The arithmetic is
 * per user and in fractions of a cent, so a single user's revenue is not lost to rounding. Returns
 * `null` when the mix cannot pay for fixed costs at all (no payer, or an infrastructure slice of
 * nothing).
 */
export function breakEvenUsers(input = {}, params = pricingPolicyParams()) {
  const scenario = normalizeScenario(input);
  const infraOf = (cents) => (cents > 0 ? splitByPolicy(cents, scenario.policy_version).infra : 0);
  const perPayerCents = scenario.paid_profile_share * (
    30 * scenario.paid_actions_per_payer_day * infraOf(scenario.paid_action_price_cents)
    + scenario.subscription_share_of_paid_profiles * infraOf(scenario.subscription_price_cents)
    + scenario.paid_post_share_of_paid_profiles * infraOf(scenario.paid_post_price_cents)
    + 30 * scenario.tips_per_payer_day * infraOf(scenario.tip_price_cents)
    + scenario.boost_share_of_creators * infraOf(scenario.boost_price_cents)
  );
  const gasPerUser = scenario.infrastructure_cents_per_action * scenario.paid_profile_share
    * scenario.paid_actions_per_payer_day * 30;
  const perUserCents = perPayerCents - gasPerUser;
  if (perUserCents <= 0) return null;
  const fixedCents = 100 * (scenario.railway_eur_month + scenario.domain_eur_month + scenario.moderation_eur_month);
  return Math.ceil(fixedCents / perUserCents);
}

