import {
  PRESET_LABELS, formatJbc, parseJbc, presetPrices, supportErrorMessage, type PresetId,
} from './pricing';

/**
 * F2.c — the creator's per-action prices as the phone is allowed to speak them.
 *
 * `MONETIZATION-SPEC.md` §3.5: a price is a real tip product, the split is the server's, and the
 * client prints numbers it received instead of calculating them. This module therefore owns three
 * things only:
 *
 *   * the shape of `GET/PUT /api/creator/pricing` (normalised, never trusted blindly);
 *   * what the owner typed → the exact body the route accepts, or the refusal to show;
 *   * the fan's side of the same row: what one action costs, what the platform keeps, what the
 *     creator receives, and whether the balance and the session budget can cover it.
 *
 * It is pure and importable from a test runner (no React, no React Native), so the arithmetic that
 * guards a payment is tested without a phone.
 */

export type ActionKey = 'appreciation' | 'comment' | 'share';

/** The order the screen prints, and the only keys the route accepts. */
export const ACTION_KEYS: readonly ActionKey[] = ['appreciation', 'comment', 'share'];

export const ACTION_LABELS: Record<ActionKey, string> = {
  appreciation: 'Apreciere',
  comment: 'Comentariu',
  share: 'Distribuire',
};

export const ACTION_HINTS: Record<ActionKey, string> = {
  appreciation: 'inima de pe o postare',
  comment: 'un comentariu scris de un fan',
  share: 'o redistribuire a postării',
};

/** Server ceiling for `creator_support_products.price_cents`. */
export const MAX_PRICE_CENTS = 100_000_000;

/**
 * The reader's own guardrail: how much one session may spend without asking again. It is a client
 * decision (the server has no session budget), so it is stated here instead of being invented by
 * every screen. 20 JB.
 */
export const SESSION_BUDGET_CENTS = 2_000;

export const FREE_LABEL = 'Totul gratuit';
export const UNAVAILABLE_LABEL = 'Indisponibil';

export type ActionQuote = {
  action: ActionKey;
  label: string;
  product_id: number | null;
  price_cents: number;
  chargeable: boolean;
  creator_cents: number;
  fee_cents: number;
  reserve_cents: number;
  infra_cents: number;
  split_version: string;
};

export type PricingView = {
  available: boolean;
  free: boolean;
  can_edit: boolean;
  currency: string;
  display_currency: string;
  split_version: string;
  cost_per_action_cents: number;
  floor_cents: number;
  max_price_cents: number;
  presets: Record<PresetId, Record<ActionKey, number>>;
  actions: Record<ActionKey, ActionQuote>;
  debit_enabled: boolean;
  real_payment: boolean;
};

/** An API caller shaped like `nexusApi`, so tests can pass a fake one. */
export type PricingApi = <T>(path: string, options?: { method?: string; body?: string }) => Promise<T>;

function wholeCents(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const cents = Number(value);
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}

function emptyQuote(action: ActionKey): ActionQuote {
  return {
    action,
    label: ACTION_LABELS[action],
    product_id: null,
    price_cents: 0,
    chargeable: false,
    creator_cents: 0,
    fee_cents: 0,
    reserve_cents: 0,
    infra_cents: 0,
    split_version: '',
  };
}

function quoteFor(action: ActionKey, raw: unknown): ActionQuote {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const price = wholeCents(source.price_cents) ?? 0;
  const chargeable = source.chargeable === true && price > 0;
  return {
    action,
    label: typeof source.label === 'string' && source.label ? source.label : ACTION_LABELS[action],
    product_id: wholeCents(source.product_id),
    price_cents: price,
    chargeable,
    creator_cents: wholeCents(source.creator_cents) ?? 0,
    fee_cents: wholeCents(source.fee_cents) ?? 0,
    reserve_cents: wholeCents(source.reserve_cents) ?? 0,
    infra_cents: wholeCents(source.infra_cents) ?? 0,
    split_version: typeof source.split_version === 'string' ? source.split_version : '',
  };
}

function presetsFrom(raw: unknown): PricingView['presets'] {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const read = (id: PresetId): Record<ActionKey, number> => {
    const fallback = presetPrices(id);
    const preset = source[id] && typeof source[id] === 'object' ? source[id] as Record<string, unknown> : {};
    return {
      appreciation: wholeCents(preset.appreciation) ?? fallback.appreciation,
      comment: wholeCents(preset.comment) ?? fallback.comment,
      share: wholeCents(preset.share) ?? fallback.share,
    };
  };
  return { prietenos: read('prietenos'), premium: read('premium') };
}

/**
 * The response of `GET /api/creator/pricing` (or of the `/:handle` read) → a view the screen can
 * print. Anything missing is a refusal, not a zero: an unknown price must never look free.
 */
export function pricingViewFromPayload(payload: unknown): PricingView | null {
  if (!payload || typeof payload !== 'object') return null;
  const source = payload as Record<string, unknown>;
  const rawActions = source.actions && typeof source.actions === 'object' ? source.actions as Record<string, unknown> : null;
  if (!rawActions) return null;
  const actions = Object.fromEntries(ACTION_KEYS.map((key) => [key, quoteFor(key, rawActions[key])])) as Record<ActionKey, ActionQuote>;
  const anyChargeable = ACTION_KEYS.some((key) => actions[key].chargeable);
  return {
    available: source.available !== false,
    free: anyChargeable ? source.free !== false : true,
    can_edit: source.can_edit !== false,
    currency: typeof source.currency === 'string' ? source.currency : '',
    display_currency: typeof source.display_currency === 'string' ? source.display_currency : 'JB',
    split_version: typeof source.split_version === 'string' ? source.split_version : '',
    cost_per_action_cents: Number(source.cost_per_action_cents) || 0,
    floor_cents: wholeCents(source.floor_cents) ?? 0,
    max_price_cents: wholeCents(source.max_price_cents) ?? MAX_PRICE_CENTS,
    presets: presetsFrom(source.presets),
    actions,
    debit_enabled: source.debit_enabled === true,
    real_payment: source.real_payment === true,
  };
}

/** `200` → `2`; `205` → `2,05`; `250` → `2,5`. What an owner types back into the field. */
export function centsToInput(cents: number | null | undefined): string {
  const value = wholeCents(cents);
  if (value === null) return '';
  const whole = Math.floor(value / 100);
  const rest = value % 100;
  if (rest === 0) return String(whole);
  const decimals = String(rest).padStart(2, '0').replace(/0$/, '');
  return `${whole},${decimals}`;
}

export type PricingDraft = { free: boolean } & Record<ActionKey, string>;

export function draftFromView(view: PricingView): PricingDraft {
  return {
    free: view.free,
    appreciation: centsToInput(view.actions.appreciation.price_cents),
    comment: centsToInput(view.actions.comment.price_cents),
    share: centsToInput(view.actions.share.price_cents),
  };
}

/** A draft built from one of the two presets, so a preset tap and a save cannot disagree. */
export function draftFromPreset(preset: Record<ActionKey, number>): PricingDraft {
  return {
    free: false,
    appreciation: centsToInput(preset.appreciation),
    comment: centsToInput(preset.comment),
    share: centsToInput(preset.share),
  };
}

/** Which preset the saved prices are, exactly; `null` when the owner mixed them. */
export function presetOfView(view: PricingView): PresetId | null {
  if (view.free) return null;
  for (const id of Object.keys(view.presets) as PresetId[]) {
    const preset = view.presets[id];
    if (ACTION_KEYS.every((key) => view.actions[key].price_cents === preset[key])) return id;
  }
  return null;
}

/** The preset a draft matches, for the selected state of the two cards. */
export function presetOfDraft(draft: PricingDraft, view: PricingView): PresetId | null {
  if (draft.free) return null;
  for (const id of Object.keys(view.presets) as PresetId[]) {
    const preset = view.presets[id];
    if (ACTION_KEYS.every((key) => parseJbc(draft[key]) === preset[key])) return id;
  }
  return null;
}

export type PricingDraftResult =
  | { ok: true; free: boolean; prices: Record<ActionKey, number> | null }
  | { ok: false; action: ActionKey | null; message: string };

/**
 * What the owner typed → the route's body. `Totul gratuit` carries no prices; a paid policy carries
 * all three, because a partial policy would leave the app guessing which action is free.
 */
export function validateDraft(draft: PricingDraft, view: PricingView): PricingDraftResult {
  if (draft.free) return { ok: true, free: true, prices: null };
  const prices = {} as Record<ActionKey, number>;
  for (const key of ACTION_KEYS) {
    const cents = parseJbc(draft[key]);
    if (cents === null) {
      return { ok: false, action: key, message: `Scrie un preț pentru ${ACTION_LABELS[key].toLowerCase()}, cu cel mult două zecimale.` };
    }
    if (cents > view.max_price_cents) {
      return { ok: false, action: key, message: `Prețul maxim este ${formatJbc(view.max_price_cents)}.` };
    }
    if (view.floor_cents > 0 && cents < view.floor_cents) {
      return { ok: false, action: key, message: `Prețul minim care acoperă decontarea este ${formatJbc(view.floor_cents)}.` };
    }
    prices[key] = cents;
  }
  return { ok: true, free: false, prices };
}

export type FanRow = {
  action: ActionKey;
  label: string;
  hint: string;
  price_cents: number;
  fee_cents: number;
  creator_cents: number;
  disabled: boolean;
  chip: string | null;
  note: string;
};

/**
 * "Cum văd fanii": the same three actions as a reader meets them. An action the server did not
 * price (or a creator whose prices cannot be read at all) is drawn disabled and labelled
 * `Indisponibil` — never as a free button that would fail on the next tap.
 */
export function fanPreview(
  view: PricingView | null,
  { balanceCents = null as number | null, sessionBudgetCents = null as number | null, sessionSpentCents = 0 } = {},
): FanRow[] {
  return ACTION_KEYS.map((action) => {
    const quote = view?.actions?.[action] ?? emptyQuote(action);
    const unavailable = !view || !view.available || !quote.chargeable;
    const price = quote.price_cents;
    const spent = Math.max(0, Math.floor(Number(sessionSpentCents) || 0));
    const affordable = !unavailable && (
      view?.debit_enabled !== true
      || ((balanceCents === null || balanceCents >= price)
        && (sessionBudgetCents === null || sessionBudgetCents - spent >= price))
    );
    const note = unavailable
      ? 'Creatorul nu a pornit un preț pentru această acțiune.'
      : view?.debit_enabled !== true
        ? 'Demonstrativ: fanul vede prețul, dar nu se mișcă niciun sold din aplicație.'
        : affordable
          ? `Fanul plătește ${formatJbc(price)}; creatorul primește ${formatJbc(quote.creator_cents)}.`
          : `Soldul sau bugetul de sesiune nu acoperă ${formatJbc(price)}.`;
    return {
      action,
      label: quote.label,
      hint: ACTION_HINTS[action],
      price_cents: price,
      fee_cents: quote.fee_cents,
      creator_cents: quote.creator_cents,
      disabled: unavailable || !affordable,
      chip: unavailable ? UNAVAILABLE_LABEL : !affordable ? 'Peste buget' : null,
      note,
    };
  });
}

export type Confirmation = {
  action: ActionKey | null;
  label: string;
  price_cents: number;
  fee_cents: number;
  creator_cents: number;
  balance_cents: number | null;
  budget_cents: number | null;
  budget_left_cents: number | null;
  demo_unpaid: boolean;
  blockers: string[];
  confirm_label: string;
  disabled: boolean;
};

/**
 * The one confirmation a spending tap goes through. It states the price, the platform fee, what the
 * creator receives, the balance and the session budget, and refuses before the request is sent when
 * any of them cannot cover the action.
 */
export function confirmationFor(view: PricingView | null, action: ActionKey, {
  balanceCents = null as number | null,
  sessionBudgetCents = null as number | null,
  sessionSpentCents = 0,
} = {}): Confirmation {
  const quote = view?.actions?.[action] ?? emptyQuote(action);
  const spent = Math.max(0, Math.floor(Number(sessionSpentCents) || 0));
  const budgetLeft = sessionBudgetCents === null ? null : Math.max(0, Math.floor(sessionBudgetCents) - spent);
  const blockers: string[] = [];
  if (!view || !view.available) blockers.push('Prețurile creatorului nu sunt disponibile.');
  else if (!quote.chargeable) blockers.push('Creatorul nu a pornit un preț pentru această acțiune.');
  else if (view.debit_enabled) {
    if (balanceCents !== null && balanceCents < quote.price_cents) blockers.push('Soldul nu acoperă prețul.');
    if (budgetLeft !== null && budgetLeft < quote.price_cents) blockers.push('Bugetul de sesiune nu acoperă prețul.');
  }
  const demoUnpaid = !view || !quote.chargeable ? false : !view.debit_enabled;
  return {
    action: quote.chargeable ? action : null,
    label: quote.label,
    price_cents: quote.price_cents,
    fee_cents: quote.fee_cents,
    creator_cents: quote.creator_cents,
    balance_cents: balanceCents,
    budget_cents: sessionBudgetCents,
    budget_left_cents: budgetLeft,
    demo_unpaid: demoUnpaid,
    blockers,
    confirm_label: demoUnpaid ? 'Am înțeles' : `Confirmă ${formatJbc(quote.price_cents)}`,
    disabled: blockers.length > 0,
  };
}


/** The reads and writes the screen performs, in one place so the body cannot drift from the route. */
export async function loadOwnPricing(api: PricingApi): Promise<PricingView> {
  const payload = await api<unknown>('/api/creator/pricing');
  const view = pricingViewFromPayload(payload);
  if (!view) throw new Error('Serverul nu a trimis prețurile profilului.');
  return view;
}

export async function loadCreatorPricing(api: PricingApi, handle: string): Promise<PricingView> {
  const payload = await api<unknown>(`/api/creator/pricing/${encodeURIComponent(handle)}`);
  const view = pricingViewFromPayload(payload);
  if (!view) throw new Error('Serverul nu a trimis prețurile creatorului.');
  return view;
}

/** `null` prices travel as `{ free: true }`: the route refuses a free policy that also carries prices. */
export async function saveOwnPricing(
  api: PricingApi,
  input: { free: boolean; prices: Record<ActionKey, number> | null },
): Promise<PricingView> {
  const body = input.free || !input.prices ? { free: true } : { free: false, prices: input.prices };
  const payload = await api<unknown>('/api/creator/pricing', { method: 'PUT', body: JSON.stringify(body) });
  const view = pricingViewFromPayload(payload);
  if (!view) throw new Error('Serverul a răspuns fără prețuri; reîncarcă ecranul.');
  return view;
}

/** Server refusals said the way an owner or a reader can act on them. */
export function pricingErrorWords(code: string | null | undefined, fallback: string): string {
  switch (String(code ?? '')) {
    case 'PRICING_INVALID':
      return 'Prețurile trimise nu sunt valide. Verifică cele trei sume și încearcă din nou.';
    case 'PRICING_UNAVAILABLE':
      return 'Prețurile acestui profil nu sunt disponibile acum.';
    case 'PRICING_FLOOR':
    case 'PRICE_BELOW_SETTLEMENT_COST':
      return 'Prețul nu acoperă costul decontării. Urmează pragul afișat.';
    case 'PRICING_TOO_HIGH':
      return 'Prețul depășește plafonul acceptat de server.';
    case 'DEMO_UNPAID':
      return 'Plata este demonstrativă pe această instalare: nu se mișcă niciun sold.';
    default:
      return supportErrorMessage(code, fallback);
  }
}

export { PRESET_LABELS };
export type { PresetId };


