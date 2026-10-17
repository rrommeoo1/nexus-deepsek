/**
 * Money as the client is allowed to speak it.
 *
 * `MONETIZATION-SPEC.md` §3.5: the client never calculates a split, never rounds a price and never
 * shows another currency than the one the server names. What it may do is print the cents it receives,
 * turn what the owner types into cents, and keep the two small presets. Everything else — the split,
 * the fee, what the creator actually gets — comes from the server and is printed as it arrives.
 *
 * The unit is JBc: 2 decimals, 1 JBc = 100 cents, printed as `JB` in front of the amount.
 */
export const CENTS_PER_JBC = 100;
export const CURRENCY_LABEL = 'JB';

/** `200` → `2,00 JB`; `50` → `0,50 JB`; a negative or non-finite amount is refused, not guessed. */
export function formatJbc(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || cents === ('' as unknown as number)) return '—';
  const value = Number(cents);
  if (!Number.isFinite(value) || value < 0) return '—';
  const whole = Math.floor(value / CENTS_PER_JBC);
  const rest = Math.round(value % CENTS_PER_JBC);
  return `${whole.toLocaleString('ro-RO')},${String(rest).padStart(2, '0')} ${CURRENCY_LABEL}`;
}

/**
 * What the owner typed → cents. Accepts `2`, `2,5`, `2.50`; refuses more than two decimals, zero, and
 * anything above the server's own ceiling (100.000.000 cents, `api.js` creator product validation).
 */
export function parseJbc(text: string | number | null | undefined): number | null {
  const raw = String(text ?? '').trim().replace(/\s+/g, '').replace(',', '.');
  if (!raw || !/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const cents = Math.round(Number(raw) * CENTS_PER_JBC);
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 100_000_000) return null;
  return cents;
}

/** The two presets the owner named. Per-action prices, in cents. */
export const PRICE_PRESETS = Object.freeze({
  prietenos: { appreciation: 200, comment: 300, share: 300 },
  premium: { appreciation: 300, comment: 500, share: 500 },
});

export type PresetId = keyof typeof PRICE_PRESETS;
export const PRESET_LABELS: Record<PresetId, string> = { prietenos: 'Prietenos', premium: 'Premium' };

export function presetPrices(id: PresetId): { appreciation: number; comment: number; share: number } {
  return { ...PRICE_PRESETS[id] };
}

/**
 * The session budget: what is left of what the reader said they would spend. Never negative, because a
 * negative budget is not a budget.
 */
export function budgetLeft(budgetCents: number, spentCents: number): number {
  const budget = Number.isFinite(budgetCents) ? Math.max(0, Math.floor(budgetCents)) : 0;
  const spent = Number.isFinite(spentCents) ? Math.max(0, Math.floor(spentCents)) : 0;
  return Math.max(0, budget - spent);
}

/** A price is shown only when it is really above zero — the rule for the like button's own label. */
export function showsPrice(cents: number | null | undefined): cents is number {
  return Number.isFinite(Number(cents)) && Number(cents) > 0;
}

/** Server refusals, said the way a reader can act on them. Unknown codes keep the server's sentence. */
export function supportErrorMessage(code: string | null | undefined, fallback: string): string {
  switch (String(code ?? '')) {
    case 'SETTLEMENT_DISABLED':
      return 'Decontarea este oprită pe această instalare: plata rămâne demonstrativă, fără bani reali.';
    case 'INSUFFICIENT_FUNDS':
      return 'Soldul nu acoperă suma cerută.';
    case 'SPLIT_MISMATCH':
      return 'Împărțirea nu mai corespunde prețului; reîncarcă înainte de a plăti.';
    case 'IDEMPOTENCY_KEY_REQUIRED':
      return 'Cererea a plecat fără cheie de repetare; reîncearcă din ecran.';
    case 'PRICE_BELOW_SETTLEMENT_COST':
      return 'Prețul nu acoperă costul decontării. Urmează pragul afișat.';
    default:
      return fallback || 'Cererea nu a putut fi trimisă.';
  }
}
