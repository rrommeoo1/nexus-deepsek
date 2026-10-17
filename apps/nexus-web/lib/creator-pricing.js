import { LedgerError, assertPriceAllowed, priceFloorCents, splitAmount } from "./creator-ledger.js";

/**
 * F2.c — the one place where a per-action price becomes a number the app may print.
 *
 * `MONETIZATION-SPEC.md` §3.5: a profile with no paid product cannot receive money, the client never
 * invents a price, and the split is the server's. A per-action price is therefore not a new money
 * path: it is a mapping from an action to a real `creator_support_products` tip product. The price
 * lives in the product row (with its own CHECK), the split comes from the product's `split_version`,
 * and `splitAmount` remains the only division in the codebase.
 *
 * The module is pure: no database, and the settlement cost arrives as a parameter. The repository
 * owns the rows and `api.js` owns the HTTP shape.
 */

/** The three actions a creator may price, in the order the app prints them. */
export const ACTION_KEYS = Object.freeze(["appreciation", "comment", "share"]);

/** What the creator sees, and the title of the product that carries the price. */
export const ACTION_LABELS = Object.freeze({
  appreciation: "Apreciere",
  comment: "Comentariu",
  share: "Distribuire",
});

/**
 * The split a per-action price uses. Tip pricing is the 90/5/3/2 version: at a 2 JB price the creator
 * keeps 1,80 and the platform takes 0,10, the row §3.5.1 prints.
 */
export const ACTION_SPLIT_VERSION = "CORE_TIP_V1_90_5_3_2";

/** Same ceiling as `creator_support_products.price_cents` (100.000.000 cents). */
export const MAX_PRICE_CENTS = 100_000_000;

/** Devnet measurement used by the simulator; the environment may override it. */
export const DEFAULT_COST_PER_ACTION_CENTS = 2.1;

/** The two presets of §3.5, in cents: 2/3/3 and 3/5/5 JB. */
export const PRICE_PRESETS = Object.freeze({
  prietenos: Object.freeze({ appreciation: 200, comment: 300, share: 300 }),
  premium: Object.freeze({ appreciation: 300, comment: 500, share: 500 }),
});

/** The settlement cost per action, read from the environment only when a caller asks for it. */
export function costPerActionCents(env = process.env) {
  const measured = Number(env?.NEXUS_COST_PER_ACTION_CENTS);
  return Number.isFinite(measured) && measured > 0 ? measured : DEFAULT_COST_PER_ACTION_CENTS;
}

/** The floor the creator screen and the API both quote, from the settlement arithmetic (I10). */
export function pricingFloorCents(cost_per_action_cents = costPerActionCents()) {
  return priceFloorCents({ cost_per_action_cents, split_version: ACTION_SPLIT_VERSION });
}

function invalid(code, message) {
  return { ok: false, code, message };
}

/**
 * What the owner sent → the prices that will be stored, or the exact refusal.
 *
 * `free: true` means "no action is paid" and therefore carries no prices; sending both is a
 * contradiction, not a default. `free: false` requires all three prices, because a partial policy
 * would leave the app guessing which action is free.
 */
export function normalizePricingInput({ free, prices, cost_per_action_cents = costPerActionCents() }) {
  if (typeof free !== "boolean") return invalid("PRICING_INVALID", "free must be true or false");
  if (prices != null && (typeof prices !== "object" || Array.isArray(prices))) {
    return invalid("PRICING_INVALID", "prices must be an object keyed by action");
  }
  const input = prices ?? {};
  const unknown = Object.keys(input).filter((key) => !ACTION_KEYS.includes(key));
  if (unknown.length) return invalid("PRICING_INVALID", `unknown action: ${unknown.sort().join(", ")}`);

  if (free) {
    const paid = ACTION_KEYS.filter((key) => input[key] != null && Number(input[key]) !== 0);
    if (paid.length) return invalid("FREE_WITH_PRICES", `a free profile cannot carry a price (${paid.join(", ")})`);
    return { ok: true, free: true, prices: Object.fromEntries(ACTION_KEYS.map((key) => [key, 0])) };
  }

  const normalized = {};
  for (const key of ACTION_KEYS) {
    const price = Number(input[key]);
    if (!Number.isSafeInteger(price)) return invalid("PRICE_INVALID", `${key}: price must be a whole number of cents`);
    if (price > MAX_PRICE_CENTS) return invalid("PRICE_INVALID", `${key}: price must be at most ${MAX_PRICE_CENTS} cents`);
    const allowed = assertPriceAllowed({ price_cents: price, split_version: ACTION_SPLIT_VERSION, cost_per_action_cents });
    if (!allowed.ok) return invalid(allowed.reason, `${key}: ${allowed.message}`);
    normalized[key] = price;
  }
  return { ok: true, free: false, prices: normalized };
}

/** One action of the view: the price, the split the server computed, and where the price lives. */
export function pricingAction({ action, product = null }) {
  const label = ACTION_LABELS[action];
  if (!label) throw new LedgerError("UNKNOWN_ACTION", `unknown priced action ${action}`, 500);
  const price = Number(product?.price_cents ?? 0);
  if (!product || !Number.isSafeInteger(price) || price <= 0) {
    return {
      action, label, product_id: null, price_cents: 0, chargeable: false,
      creator_cents: 0, fee_cents: 0, reserve_cents: 0, infra_cents: 0,
      split_version: ACTION_SPLIT_VERSION,
    };
  }
  const splitVersion = String(product.split_version || ACTION_SPLIT_VERSION);
  const shares = splitAmount(price, splitVersion);
  return {
    action,
    label,
    product_id: Number(product.id),
    price_cents: price,
    chargeable: true,
    creator_cents: shares.creator,
    fee_cents: shares.fee,
    reserve_cents: shares.reserve,
    infra_cents: shares.infra,
    split_version: splitVersion,
  };
}

/**
 * The whole answer: what each action costs, what the server keeps, and the bounds the owner's screen
 * must respect. `debit_enabled` is false on this build — a support intent is `demo_unpaid` and no
 * balance moves — so the client prints the money truthfully instead of pretending a charge happened.
 */
export function pricingView({ free = true, actions = {}, cost_per_action_cents = costPerActionCents(), currency = "TEST-USDC" } = {}) {
  const rows = Object.fromEntries(ACTION_KEYS.map((key) => [key, pricingAction({ action: key, product: actions?.[key] ?? null })]));
  const anyChargeable = ACTION_KEYS.some((key) => rows[key].chargeable);
  const floor = pricingFloorCents(cost_per_action_cents);
  return {
    available: true,
    free: anyChargeable ? Boolean(free) : true,
    currency,
    display_currency: "JB",
    display_decimals: 2,
    split_version: ACTION_SPLIT_VERSION,
    cost_per_action_cents,
    floor_cents: floor.floor_cents,
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
