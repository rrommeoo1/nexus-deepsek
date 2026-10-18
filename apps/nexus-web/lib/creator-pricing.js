import { LedgerError, splitAmount } from "./creator-ledger.js";
import {
  POLICY_V3,
  assertPriceAllowedByPolicy,
  getPolicy,
  isSplitPolicy,
  minimumPriceCents,
  policyViolations,
  pricingPolicyParams,
  splitByPolicy,
} from "./split-policy.js";

/**
 * F2.c / F3 — the one place where a per-action price becomes a number the app may print.
 *
 * The price lives in a real `creator_support_products` row (with its own CHECK), the split comes from
 * that row's `split_version`, and `splitByPolicy` / `splitAmount` remain the only divisions in the
 * codebase. A new price is written under policy v3; a product priced before it keeps its own version
 * and its own arithmetic, so an old receipt never changes meaning.
 *
 * The module is pure: no database, no clock. The settlement cost and the EGLD rate arrive as
 * parameters (`pricingPolicyParams`), never as magic numbers.
 */

/** The three actions a creator may price, in the order the app prints them. */
export const ACTION_KEYS = Object.freeze(["appreciation", "comment", "share"]);

/** What the creator sees, and the title of the product that carries the price. */
export const ACTION_LABELS = Object.freeze({
  appreciation: "Apreciere",
  comment: "Comentariu",
  share: "Distribuire",
});

/** The split a *new* per-action price uses. Existing products keep the version stored on their row. */
export const ACTION_SPLIT_VERSION = POLICY_V3;

/** Same ceiling as `creator_support_products.price_cents` (100.000.000 cents). */
export const MAX_PRICE_CENTS = 100_000_000;

/** The two presets of §3.5, in cents: 2/3/3 and 3/5/5 JUNGLE. */
export const PRICE_PRESETS = Object.freeze({
  prietenos: Object.freeze({ appreciation: 200, comment: 300, share: 300 }),
  premium: Object.freeze({ appreciation: 300, comment: 500, share: 500 }),
});

/** The policy of this process, with the numbers actually in force (for the screen that explains them). */
export function pricingPolicy(env = process.env) {
  const params = pricingPolicyParams(env);
  const policy = getPolicy(params.policyVersion);
  const floor = minimumPriceCents(params);
  return {
    policy_version: policy.version,
    creator_bps: policy.creator_bps,
    min_creator_bps: policy.min_creator_bps,
    fixed_bps: policy.network_fund_bps + policy.founder_bps + policy.shareholders_bps + policy.burn_bps,
    infra_bps: 10000 - policy.creator_bps - policy.network_fund_bps - policy.founder_bps - policy.shareholders_bps - policy.burn_bps,
    slices: {
      network_fund_bps: policy.network_fund_bps,
      founder_bps: policy.founder_bps,
      shareholders_bps: policy.shareholders_bps,
      burn_bps: policy.burn_bps,
    },
    settlement: {
      mode: floor.mode,
      batch_size: floor.batch_size,
      egld_eur: params.egld_eur,
      gas_egld_per_action: floor.gas_egld_per_action,
      gas_eur_per_action: floor.gas_eur_per_action,
      gas_cents_per_action: floor.infra_needed_cents,
      infra_margin_bps: params.infra_margin_bps,
      settlement_gas_limit: params.settlement_gas_limit,
      anchor_gas_limit: params.anchor_gas_limit,
    },
  };
}

/** The floor the creator screen and the API both quote, recalculated from parameters (F3). */

/**
 * What the owner sent → the prices that will be stored, or the exact refusal.
 *
 * Each action stands alone: a missing key or a `0` means that action is free, and the minimum price
 * applies only to the actions that are actually paid. `free: true` stays the shortcut for "nothing
 * is paid"; sending it together with a non-zero price is still a contradiction, not a default.
 */
export function normalizePricingInput({ free, prices, params = pricingPolicyParams() } = {}) {
  if (typeof free !== "boolean") return invalid("PRICING_INVALID", "free must be true or false");
  if (prices != null && (typeof prices !== "object" || Array.isArray(prices))) {
    return invalid("PRICING_INVALID", "prices must be an object keyed by action");
  }
  const input = prices ?? {};
  const unknown = Object.keys(input).filter((key) => !ACTION_KEYS.includes(key));
  if (unknown.length) return invalid("PRICING_INVALID", `unknown action: ${unknown.sort().join(", ")}`);

  const policy = getPolicy(params.policyVersion);
  const policyProblems = policyViolations(policy);
  if (policyProblems.length) {
    return invalid(
      "PRICING_POLICY_INVALID",
      `policy ${policy.version} violates its own rules: ${policyProblems.map((problem) => problem.code).join(", ")}`,
    );
  }
  const floor = minimumPriceCents(params);

  const normalized = Object.fromEntries(ACTION_KEYS.map((key) => [key, 0]));
  for (const key of ACTION_KEYS) {
    if (input[key] == null) continue;
    const price = Number(input[key]);
    if (!Number.isSafeInteger(price)) return invalid("PRICE_INVALID", `${key}: price must be a whole number of cents`);
    if (price < 0) return invalid("PRICE_INVALID", `${key}: price cannot be negative`);
    if (price > MAX_PRICE_CENTS) return invalid("PRICE_INVALID", `${key}: price must be at most ${MAX_PRICE_CENTS} cents`);
    if (price === 0) continue;
    const allowed = assertPriceAllowedByPolicy(price, {
      policyVersion: params.policyVersion,
      infra_needed_cents: floor.infra_needed_cents,
      floor_cents: floor.price_cents,
    });
    if (!allowed.ok) return invalid(allowed.reason, `${key}: ${allowed.message}`);
    normalized[key] = price;
  }
  const monetized = ACTION_KEYS.some((key) => normalized[key] > 0);
  if (free && monetized) {
    const paid = ACTION_KEYS.filter((key) => normalized[key] > 0);
    return invalid("FREE_WITH_PRICES", `a free profile cannot carry a price (${paid.join(", ")})`);
  }
  return { ok: true, free: !monetized, monetized, prices: normalized, floor_cents: floor.price_cents };
}

export function pricingFloorCents(params = pricingPolicyParams()) {
  return minimumPriceCents(params);
}

function invalid(code, message) {
  return { ok: false, code, message };
}

/** The slices of a price already stored, whatever version wrote it (v3 or a legacy tip/membership). */
export function pricingSlices(priceCents, splitVersion = ACTION_SPLIT_VERSION) {
  if (!Number.isSafeInteger(priceCents) || priceCents <= 0) return null;
  if (isSplitPolicy(splitVersion)) {
    const shares = splitByPolicy(priceCents, splitVersion);
    return {
      policy_version: shares.policy_version,
      creator_cents: shares.creator,
      network_fund_cents: shares.network_fund,
      founder_cents: shares.founder,
      shareholders_cents: shares.shareholders,
      burn_cents: shares.burn,
      infra_cents: shares.infra,
    };
  }
  // A legacy split (90/5/3/2 or 85/10/3/2) is mapped onto the same six buckets without pretending
  // it was v3: `fee` is the network slice, `reserve` the company slice, the rest infrastructure.
  const shares = splitAmount(priceCents, splitVersion);
  return {
    policy_version: splitVersion,
    creator_cents: shares.creator,
    network_fund_cents: shares.fee,
    founder_cents: 0,
    shareholders_cents: shares.reserve,
    burn_cents: 0,
    infra_cents: shares.infra,
  };
}

/** One action of the view: the price, the slices the server computed, and where the price lives. */
export function pricingAction({ action, product = null }) {
  const label = ACTION_LABELS[action];
  if (!label) throw new LedgerError("UNKNOWN_ACTION", `unknown priced action ${action}`, 500);
  const price = Number(product?.price_cents ?? 0);
  if (!product || !Number.isSafeInteger(price) || price <= 0) {
    return {
      action, label, product_id: null, price_cents: 0, chargeable: false,
      creator_cents: 0, fee_cents: 0, reserve_cents: 0, infra_cents: 0,
      split_version: ACTION_SPLIT_VERSION,
      slices: null,
    };
  }
  const splitVersion = String(product.split_version || ACTION_SPLIT_VERSION);
  const slices = pricingSlices(price, splitVersion);
  return {
    action,
    label,
    product_id: Number(product.id),
    price_cents: price,
    chargeable: true,
    creator_cents: slices.creator_cents,
    // `fee_cents` is the network slice; `reserve_cents` the company accounts (founder + shareholders
    // + burn); together with the creator and infrastructure they always add up to the price.
    fee_cents: slices.network_fund_cents,
    reserve_cents: slices.founder_cents + slices.shareholders_cents + slices.burn_cents,
    infra_cents: slices.infra_cents,
    split_version: splitVersion,
    slices,
  };
}


/**
 * The whole answer: what each action costs, what the server keeps, and the bounds the owner's screen
 * must respect. `debit_enabled` is false on this build — a support intent is `demo_unpaid` and no
 * balance moves — so the client prints the money truthfully instead of pretending a charge happened.
 *
 * `floor_cents` is recalculated on every call from the parameters in force, and `floor_basis` carries
 * the arithmetic that produced it, so no client has to guess why the minimum is what it is.
 */
export function pricingView({ free = true, actions = {}, currency = "TEST-USDC", env = process.env } = {}) {
  const rows = Object.fromEntries(ACTION_KEYS.map((key) => [key, pricingAction({ action: key, product: actions?.[key] ?? null })]));
  const anyChargeable = ACTION_KEYS.some((key) => rows[key].chargeable);
  const policy = pricingPolicy(env);
  const floor = minimumPriceCents(pricingPolicyParams(env));
  return {
    available: true,
    free: !anyChargeable,
    monetized: anyChargeable,
    currency,
    display_currency: "JUNGLE",
    display_decimals: 2,
    split_version: policy.policy_version,
    policy,
    policy_version: policy.policy_version,
    floor_cents: floor.price_cents,
    floor_reason: "POLICY_V3",
    floor_basis: {
      policy_version: policy.policy_version,
      creator_bps: policy.creator_bps,
      min_creator_bps: policy.min_creator_bps,
      fixed_bps: policy.fixed_bps,
      infra_bps: policy.infra_bps,
      gas_cents: floor.infra_needed_cents,
      gas_egld_per_action: floor.gas_egld_per_action,
      egld_eur: policy.settlement.egld_eur,
      mode: floor.mode,
      batch_size: floor.batch_size,
      message: `Prețul minim acoperă gazul (${floor.infra_needed_cents}¢) și păstrează creatorului minim ` +
        `${(policy.min_creator_bps / 100).toFixed(0)}%: ${(floor.price_cents / 100).toFixed(2)} JUNGLE`,
    },
    // Kept for clients written before policy v3; it is the gas of one action, not the price.
    cost_per_action_cents: floor.infra_needed_cents,
    max_price_cents: MAX_PRICE_CENTS,
    presets: PRICE_PRESETS,
    actions: rows,
    debit_enabled: false,
    real_payment: false,
  };
}

/**
 * What a reader would pay for one action, and whether their balance covers it.
 *
 * The split is already inside the price — the fan pays `price_cents`, not price plus fee — so
 * affordability is a comparison, not an addition. With `debit_enabled: false` there is nothing to
 * afford, and the function says so (`DEMO_UNPAID`) instead of inventing a refusal.
 */
export function actionAffordability({ pricing, action, balance_cents = null, session_budget_cents = null, session_spent_cents = 0 }) {
  const row = pricing?.actions?.[action];
  if (!row || !row.chargeable) {
    return { chargeable: false, price_cents: 0, fee_cents: 0, affordable: true, reason: null, budget_after_cents: null };
  }
  const debit = Boolean(pricing?.debit_enabled);
  const balance = balance_cents == null ? null : Number(balance_cents);
  const budget = session_budget_cents == null ? null : Number(session_budget_cents);
  const spent = Number.isFinite(Number(session_spent_cents)) ? Math.max(0, Math.floor(Number(session_spent_cents))) : 0;
  const budgetAfter = budget == null ? null : Math.max(0, Math.floor(budget) - spent - row.price_cents);
  if (!debit) {
    return { chargeable: true, price_cents: row.price_cents, fee_cents: row.fee_cents, affordable: true, reason: "DEMO_UNPAID", budget_after_cents: budgetAfter };
  }
  if (Number.isFinite(balance) && balance < row.price_cents) {
    return { chargeable: true, price_cents: row.price_cents, fee_cents: row.fee_cents, affordable: false, reason: "INSUFFICIENT_FUNDS", budget_after_cents: budgetAfter };
  }
  if (budget != null && Number.isFinite(budget) && budget - spent < row.price_cents) {
    return { chargeable: true, price_cents: row.price_cents, fee_cents: row.fee_cents, affordable: false, reason: "SESSION_BUDGET_EXCEEDED", budget_after_cents: 0 };
  }
  return { chargeable: true, price_cents: row.price_cents, fee_cents: row.fee_cents, affordable: true, reason: null, budget_after_cents: budgetAfter };
}

