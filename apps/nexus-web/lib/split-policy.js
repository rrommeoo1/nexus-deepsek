/**
 * F3 — the split policy v3: which part of a paid action goes where, and the lowest price that respects
 * every rule at once.
 *
 * The owner replaced the old "gas ≤ 2 % of the price" rule (which multiplied the floor by 50) and the
 * second floor that always returned 0. A price is now allowed when all of these hold:
 *
 *   I1  the slices add up to the gross, to the cent (nothing invented, nothing lost);
 *   I2  the creator keeps at least `min_creator_bps` (default 60 %; the policy aims at 70 %);
 *   I3  the fixed slices other than the creator stay under `max_fixed_bps` (default 20 %);
 *   I4  the infrastructure slice covers the gas of that action at the configured batch;
 *   I5  no slice is negative.
 *
 * Every number is a parameter, including the EGLD/EUR rate: a hard-coded rate would turn this table
 * into a promise the project cannot keep. The only thing fixed here is the *shape* of policy v3 and
 * the meaning of its invariants.
 *
 * Pure module: no database, no network, no clock.
 */

/** The version string stored on every product and intent priced under this policy. */
export const POLICY_V3 = "SPLIT_V3_70_5_4_4_1";

/** The six buckets of a payment. The creator is always one of them; the rest are company accounts. */
export const SLICE_KEYS = Object.freeze(["creator", "network_fund", "founder", "shareholders", "burn", "infra"]);

/**
 * Policy v3, in basis points of the gross price.
 *
 * `infra` is not a rate: it is whatever is left after the five fixed slices, so rounding leftovers
 * also land there (the owner's rule). At 7000/500/400/400/100 that is ~1600 bps, and it is what pays
 * for gas. `founder` and `shareholders` are accounting accounts of the company — this module never
 * pays a person or a token holder, it only divides a number.
 */
export const SPLIT_POLICIES = Object.freeze({
  [POLICY_V3]: Object.freeze({
    version: POLICY_V3,
    kind: "policy",
    creator_bps: 7000,
    network_fund_bps: 500,
    founder_bps: 400,
    shareholders_bps: 400,
    burn_bps: 100,
    min_creator_bps: 6000,
    max_fixed_bps: 2000,
  }),
  /** Kept so an old product or intent keeps its own arithmetic; never chosen for a new price. */
  CORE_TIP_V1_90_5_3_2: Object.freeze({
    version: "CORE_TIP_V1_90_5_3_2",
    kind: "legacy",
    creator_bps: 9000,
    network_fund_bps: 500,
    founder_bps: 0,
    shareholders_bps: 300,
    burn_bps: 0,
    min_creator_bps: 5000,
    max_fixed_bps: 1000,
  }),
  CORE_MEMBERSHIP_V1_85_10_3_2: Object.freeze({
    version: "CORE_MEMBERSHIP_V1_85_10_3_2",
    kind: "legacy",
    creator_bps: 8500,
    network_fund_bps: 1000,
    founder_bps: 0,
    shareholders_bps: 300,
    burn_bps: 0,
    min_creator_bps: 5000,
    max_fixed_bps: 1500,
  }),
});

/** The two settlement modes the owner asked to keep, batched by default. */
export const SETTLEMENT_MODES = Object.freeze(["batched", "per_action"]);

/**
 * Defaults for the settlement arithmetic. They are *scenarios*, not measurements: the gas limit of an
 * ESDT transfer and of an anchor transaction are protocol values until a devnet transaction says
 * otherwise, and the rate is a parameter the owner sets.
 */
export const SETTLEMENT_DEFAULTS = Object.freeze({
  egld_eur: 30,
  mode: "batched",
  batch_size: 10,
  settlement_gas_limit: 500_000,
  anchor_gas_limit: 150_000,
  per_action_gas_limit: 500_000,
  infra_margin_bps: 2000,
  gas_price_wei: 1_000_000_000,
});

/** Wei in one EGLD; the chain counts 18 decimals. */
const WEI_PER_EGLD = 1_000_000_000_000_000_000n;

export class PolicyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PolicyError";
    this.code = code;
  }
}

/** A policy by version, with the version string guaranteed to match the key. */
export function getPolicy(version = POLICY_V3) {
  const policy = SPLIT_POLICIES[version];
  if (!policy) throw new PolicyError("UNKNOWN_POLICY", `unknown split policy ${version}`);
  return policy;
}

/**
 * True when the version divides by policy v3 rules (floor + creator top-up). The legacy versions are
 * listed in this table only so a caller can name them; their arithmetic is still `splitAmount`, and
 * a receipt written under them must never be recomputed with today's rounding.
 */
export function isSplitPolicy(version) {
  return SPLIT_POLICIES[version]?.kind === "policy";
}

function fixedBps(policy) {
  return {
    creator: policy.creator_bps,
    network_fund: policy.network_fund_bps,
    founder: policy.founder_bps,
    shareholders: policy.shareholders_bps,
    burn: policy.burn_bps,
  };
}

/** The static rules of a policy, independent of any price: I3 and a few obvious sanity checks. */
export function policyViolations(policy) {
  const problems = [];
  const fixed = fixedBps(policy);
  const fixedSum = Object.values(fixed).reduce((sum, bps) => sum + bps, 0);
  const nonCreator = fixedSum - fixed.creator;
  if (fixedSum > 10000) problems.push({ code: "SLICES_EXCEED_GROSS", fixedSum });
  if (fixed.creator < policy.min_creator_bps) problems.push({ code: "CREATOR_BELOW_MINIMUM", creator_bps: fixed.creator });
  if (nonCreator > policy.max_fixed_bps) {
    problems.push({ code: "FIXED_SLICES_ABOVE_CAP", non_creator_bps: nonCreator, cap_bps: policy.max_fixed_bps });
  }
  for (const [key, bps] of Object.entries(fixed)) {
    if (!Number.isInteger(bps) || bps < 0) problems.push({ code: "SLICE_NOT_A_RATE", slice: key, bps });
  }
  return problems;
}

/**
 * Divides a gross amount by policy v3. Each slice is floored; the creator is then topped up from the
 * infrastructure remainder if rounding would drop them under `min_creator_bps` (so 4 cents cannot pay
 * the creator 2 = 50 %), and the whole remainder — including every rounding leftover — stays in
 * `infra` (I1). Nothing is invented or lost, and the creator's minimum is a floor, not a hope.
 */
export function splitByPolicy(grossCents, policyVersion = POLICY_V3) {
  const policy = getPolicy(policyVersion);
  if (!Number.isInteger(grossCents) || grossCents < 0) {
    throw new PolicyError("INVALID_AMOUNT", "gross must be a non-negative integer number of cents");
  }
  const shares = {};
  const targetCreator = Math.floor((grossCents * policy.creator_bps) / 10000);
  const minimumCreator = Math.ceil((grossCents * policy.min_creator_bps) / 10000);
  shares.creator = Math.min(grossCents, Math.max(targetCreator, minimumCreator));
  let allocated = shares.creator;
  for (const [key, bps] of Object.entries(fixedBps(policy))) {
    if (key === "creator") continue;
    const cents = Math.floor((grossCents * bps) / 10000);
    shares[key] = cents;
    allocated += cents;
  }
  shares.infra = grossCents - allocated;
  shares.policy_version = policy.version;
  shares.gross_cents = grossCents;
  return shares;
}

/** I1–I5 for a concrete amount: what a caller may show, plus every rule that fails. */
export function checkSplit(grossCents, { policyVersion = POLICY_V3, infra_needed_cents = 0 } = {}) {
  const policy = getPolicy(policyVersion);
  const shares = splitByPolicy(grossCents, policyVersion);
  const problems = [];
  const total = SLICE_KEYS.reduce((sum, key) => sum + shares[key], 0);
  if (total !== grossCents) problems.push({ code: "CONSERVATION", total, gross: grossCents });
  for (const key of SLICE_KEYS) {
    if (shares[key] < 0) problems.push({ code: "NEGATIVE_SLICE", slice: key, cents: shares[key] });
  }
  const creatorBps = grossCents > 0 ? Math.floor((shares.creator * 10000) / grossCents) : 0;
  if (grossCents > 0 && creatorBps < policy.min_creator_bps) {
    problems.push({ code: "CREATOR_BELOW_MINIMUM", creator_bps: creatorBps, min_bps: policy.min_creator_bps });
  }
  if (shares.infra < infra_needed_cents) {
    problems.push({ code: "INFRA_DOES_NOT_COVER_GAS", infra_cents: shares.infra, needed_cents: infra_needed_cents });
  }
  return { ok: problems.length === 0, shares, problems, creator_bps: creatorBps };
}

/**
 * The gas one paid action has to carry, in EGLD.
 *
 * `batched` (the default): one settlement transaction and one anchor transaction per batch of N
 * actions, so each action carries `(settlement + anchor) / N`.
 * `per_action`: every action pays its own transfer.
 */
export function gasPerActionEgld({
  mode = SETTLEMENT_DEFAULTS.mode,
  batch_size = SETTLEMENT_DEFAULTS.batch_size,
  settlement_gas_limit = SETTLEMENT_DEFAULTS.settlement_gas_limit,
  anchor_gas_limit = SETTLEMENT_DEFAULTS.anchor_gas_limit,
  per_action_gas_limit = SETTLEMENT_DEFAULTS.per_action_gas_limit,
  gas_price_wei = SETTLEMENT_DEFAULTS.gas_price_wei,
} = {}) {
  if (!SETTLEMENT_MODES.includes(mode)) throw new PolicyError("UNKNOWN_MODE", `unknown settlement mode ${mode}`);
  const batch = Math.max(1, Math.floor(Number(batch_size) || 1));
  const gas = mode === "per_action"
    ? Number(per_action_gas_limit)
    : (Number(settlement_gas_limit) + Number(anchor_gas_limit)) / batch;
  if (!Number.isFinite(gas) || gas <= 0) throw new PolicyError("INVALID_GAS", "gas per action must be positive");
  // Gas limit × gas price is exact in wei; EGLD is that divided by 10^18.
  return (gas * Number(gas_price_wei)) / 1e18;
}

/** Gas in cents of a token worth 1 EUR, plus the infrastructure margin. */
export function gasCostCents({ gas_egld, egld_eur, infra_margin_bps = SETTLEMENT_DEFAULTS.infra_margin_bps }) {
  const rate = Number(egld_eur);
  const margin = Number(infra_margin_bps);
  if (!Number.isFinite(rate) || rate <= 0) throw new PolicyError("INVALID_RATE", "egld_eur must be positive");
  if (!Number.isFinite(margin) || margin < 0) throw new PolicyError("INVALID_MARGIN", "infra_margin_bps must be ≥ 0");
  const cents = Number(gas_egld) * rate * 100 * (1 + margin / 10000);
  // The 1e-9 guard keeps floating point from turning 3.0000000001 into a fourth cent.
  return Math.ceil(cents - 1e-9);
}

/**
 * The lowest integer price (in cents) at which every invariant holds at once — recalculated from
 * parameters, never stored. The scan is bounded because a price above a few euro is not a "lowest
 * price" any more; if the rules cannot be met there, the caller gets an exception, not a guess.
 */
export function minimumPriceCents(options = {}) {
  const {
    policyVersion = POLICY_V3,
    egld_eur = SETTLEMENT_DEFAULTS.egld_eur,
    mode = SETTLEMENT_DEFAULTS.mode,
    batch_size = SETTLEMENT_DEFAULTS.batch_size,
    infra_margin_bps = SETTLEMENT_DEFAULTS.infra_margin_bps,
    max_cents = 1_000_000,
  } = options;
  const gas_egld = gasPerActionEgld({ ...options, mode, batch_size });
  const infra_needed_cents = gasCostCents({ gas_egld, egld_eur, infra_margin_bps });
  for (let price = 1; price <= max_cents; price += 1) {
    const check = checkSplit(price, { policyVersion, infra_needed_cents });
    if (check.ok) {
      return {
        price_cents: price,
        floor_cents: price,
        gas_egld_per_action: gas_egld,
        gas_eur_per_action: gas_egld * Number(egld_eur),
        infra_needed_cents,
        creator_cents: check.shares.creator,
        creator_bps: check.creator_bps,
        infra_cents: check.shares.infra,
        policy_version: getPolicy(policyVersion).version,
        mode,
        batch_size: Math.max(1, Math.floor(Number(batch_size) || 1)),
      };
    }
  }
  throw new PolicyError("NO_PRICE_SATISFIES_POLICY", `no price up to ${max_cents} cents satisfies the policy`);
}

/** The parameters of the running server, all overridable, with v3 as the default policy. */
export function pricingPolicyParams(env = process.env) {
  const number = (name, fallback) => {
    const value = Number(env?.[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  const mode = SETTLEMENT_MODES.includes(String(env?.NEXUS_SETTLEMENT_MODE))
    ? String(env.NEXUS_SETTLEMENT_MODE)
    : SETTLEMENT_DEFAULTS.mode;
  const marginValue = Number(env?.NEXUS_INFRA_MARGIN_BPS);
  return {
    policyVersion: POLICY_V3,
    egld_eur: number("NEXUS_EGLD_EUR", SETTLEMENT_DEFAULTS.egld_eur),
    mode,
    batch_size: Math.floor(number("NEXUS_BATCH_SIZE", SETTLEMENT_DEFAULTS.batch_size)),
    settlement_gas_limit: Math.floor(number("NEXUS_SETTLEMENT_GAS_LIMIT", SETTLEMENT_DEFAULTS.settlement_gas_limit)),
    anchor_gas_limit: Math.floor(number("NEXUS_ANCHOR_GAS_LIMIT", SETTLEMENT_DEFAULTS.anchor_gas_limit)),
    per_action_gas_limit: Math.floor(number("NEXUS_PER_ACTION_GAS_LIMIT", SETTLEMENT_DEFAULTS.per_action_gas_limit)),
    // Zero is a legitimate margin (it means "cover the gas exactly"), so it cannot go through `number`.
    infra_margin_bps: Number.isFinite(marginValue) && marginValue >= 0
      ? Math.floor(marginValue)
      : SETTLEMENT_DEFAULTS.infra_margin_bps,
  };
}

/** The exact refusal the API returns, with the rule that failed. */
export function assertPriceAllowedByPolicy(priceCents, { policyVersion = POLICY_V3, infra_needed_cents = 0, floor_cents = null } = {}) {
  if (!Number.isInteger(priceCents) || priceCents <= 0) {
    return { ok: false, reason: "PRICE_INVALID", message: "prețul trebuie să fie un număr întreg de cenți, peste 0" };
  }
  const check = checkSplit(priceCents, { policyVersion, infra_needed_cents });
  if (check.ok) return { ok: true, reason: null, message: null, shares: check.shares };
  const first = check.problems[0];
  if (first.code === "CREATOR_BELOW_MINIMUM") {
    return {
      ok: false,
      reason: "CREATOR_SHARE_TOO_LOW",
      message: `creatorul ar primi ${(check.creator_bps / 100).toFixed(0)}%, sub minimul de ${(first.min_bps / 100).toFixed(0)}%; prețul minim este ${floor_cents ?? 0} cenți`,
      shares: check.shares,
    };
  }
  if (first.code === "INFRA_DOES_NOT_COVER_GAS") {
    return {
      ok: false,
      reason: "PRICE_BELOW_SETTLEMENT_COST",
      message: `rezerva de infrastructură (${first.infra_cents}¢) nu acoperă gazul acțiunii (${first.needed_cents}¢)`,
      shares: check.shares,
    };
  }
  return { ok: false, reason: first.code, message: "prețul nu respectă politica de împărțire", shares: check.shares };
}
