/**
 * The money one tap is allowed to move, as the phone reads it.
 *
 * `apps/nexus-web/lib/action-payments.js` is the only place a price, a split and a devnet leg are
 * decided:
 *
 *   GET  /api/posts/:id/action-quote?action=appreciation   `quoteAction` (`api.js:2797`)
 *   POST /api/posts/:id/action-payment { action }          `payForAction` (`api.js:2809`)
 *   GET  /api/action-payments/:id                          `reconcileIntent` (`api.js:2830`)
 *
 * and the write routes then accept the ledger row it returns as `payment_intent_id`
 * (`api.js:4006` for a LIKE, `api.js:4108` for a comment). This module owns what the client may do
 * with those answers: normalise them, add two EGLD amounts without a float, and turn a refusal into
 * a sentence a reader can act on. Nothing here invents a price — an amount the server did not send
 * is printed as `—`.
 *
 * The client never decides *whether* something is paid either: it sends the write, and when the
 * server answers `402 PAYMENT_REQUIRED` the refusal carries `detail.quote`, which is exactly what
 * the confirmation sheet prints (`paymentRequired`). A free creator, a zero price and the
 * creator's own post never see this sheet, because those writes simply succeed.
 *
 * Pure — no React, no `fetch` — so `scripts/test-action-payments.cjs` runs it without a phone.
 */
export type PaidAction = 'appreciation' | 'comment';

/** The two priced actions of the network (`ACTION_KEYS` minus the free share). */
export const PAID_ACTIONS: readonly PaidAction[] = ['appreciation', 'comment'];

/** How the sheet names the action it is about to pay for. */
export const ACTION_WORDS: Record<PaidAction, string> = { appreciation: 'aprecierea', comment: 'comentariul' };

/** `creator-pricing.js` `ACTION_LABELS`, kept only as a fallback when a quote omits the word. */
const ACTION_LABELS: Record<string, string> = { appreciation: 'Apreciere', comment: 'Comentariu', share: 'Distribuire' };

export type ChainQuote = {
  /** `devnet` signs and broadcasts; `simulated` only writes the ledger row; `unknown` is a payload we cannot trust. */
  mode: 'devnet' | 'simulated' | 'unknown';
  /** Why the leg is simulated (`FORCED_SIMULATED`, `PAYER_WALLET_MISSING`, …), as the server named it. */
  reason: string | null;
  chain_id: string | null;
  amount_egld: string | null;
  amount_wei: string | null;
  network_fee_egld: string | null;
  network_fee_wei: string | null;
  balance_egld: string | null;
  /** `null` when the devnet balance could not be read — the sheet says so instead of pretending. */
  can_afford: boolean | null;
  shortfall_egld: string | null;
  payer_address: string | null;
  payee_address: string | null;
  faucet_url: string | null;
  explorer: string | null;
};

export type ActionQuote = {
  action: string;
  label: string;
  /** `true` only when the server says there is a price to collect. */
  chargeable: boolean;
  free: boolean;
  price_cents: number;
  currency: string;
  source: 'creator' | 'platform' | null;
  /** The platform default applied because the creator never saved a price. */
  defaulted: boolean;
  self_payment: boolean;
  creator_handle: string | null;
  chain: ChainQuote | null;
};

export type PaymentIntent = {
  id: string;
  action: string;
  post_id: number | null;
  price_cents: number | null;
  status: string;
  chain_mode: string;
  tx_hash: string | null;
  explorer_url: string | null;
  failure: string | null;
  consumed_at: number | null;
  confirmed_at: number | null;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function wei(value: unknown): bigint | null {
  const digits = String(value ?? '').trim();
  return /^\d+$/.test(digits) ? BigInt(digits) : null;
}

function time(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** One EGLD is 10^18 wei; every amount below is an integer count of these. */
const WEI_PER_EGLD = 10n ** 18n;

/**
 * Wei → the server's own EGLD string (`devnet-payments.js:104` `formatEgld`): whole units plus at
 * most six decimals, with the trailing zeros trimmed. Recomputed from `*_wei` so that a total the
 * sheet prints is the sum of the same integers the transfer is signed with.
 */
export function egldFromWei(value: unknown): string | null {
  const amount = wei(value);
  if (amount === null) return null;
  const whole = amount / WEI_PER_EGLD;
  const fraction = (amount % WEI_PER_EGLD).toString().padStart(18, '0').slice(0, 6).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
}

export function readChainQuote(payload: unknown): ChainQuote | null {
  const raw = record(payload);
  if (!raw) return null;
  const mode = raw.mode === 'devnet' || raw.mode === 'simulated' ? raw.mode : 'unknown';
  return {
    mode,
    reason: text(raw.reason),
    chain_id: text(raw.chain_id),
    amount_egld: egldFromWei(raw.amount_wei) ?? text(raw.amount_egld),
    amount_wei: wei(raw.amount_wei) === null ? null : String(raw.amount_wei),
    network_fee_egld: egldFromWei(raw.network_fee_wei) ?? text(raw.network_fee_egld),
    network_fee_wei: wei(raw.network_fee_wei) === null ? null : String(raw.network_fee_wei),
    balance_egld: egldFromWei(raw.balance_wei) ?? text(raw.balance_egld),
    can_afford: typeof raw.can_afford === 'boolean' ? raw.can_afford : null,
    shortfall_egld: text(raw.shortfall_egld),
    payer_address: text(raw.payer_address),
    payee_address: text(raw.payee_address),
    faucet_url: text(raw.faucet_url),
    explorer: text(raw.explorer),
  };
}

/** What leaves the wallet for one action: the price in EGLD plus the transfer's gas, from the wei. */
export function totalEgld(quote: ActionQuote | ChainQuote | null | undefined): string | null {
  if (!quote) return null;
  const chain = (quote as ActionQuote).chain ?? (quote as ChainQuote);
  if (!chain) return null;
  const amount = wei(chain.amount_wei ?? chain.amount_egld);
  if (amount === null) return null;
  return egldFromWei((amount + (wei(chain.network_fee_wei) ?? 0n)).toString());
}

/** The answer of `GET /api/posts/:id/action-quote`, or `null` when it is not a quote at all. */
export function readActionQuote(payload: unknown): ActionQuote | null {
  const raw = record(payload);
  if (!raw) return null;
  const action = text(raw.action) || 'appreciation';
  const chargeable = raw.chargeable === true && raw.free !== true;
  const cents = Number(raw.price_cents);
  const creator = record(raw.creator);
  return {
    action,
    label: text(raw.label) || ACTION_LABELS[action] || 'Acțiune',
    chargeable,
    free: raw.free === true || !chargeable,
    price_cents: Number.isFinite(cents) && cents > 0 ? Math.round(cents) : 0,
    currency: text(raw.currency) || 'TEST-USDC',
    source: raw.source === 'creator' || raw.source === 'platform' ? raw.source : null,
    defaulted: raw.defaulted === true,
    self_payment: raw.self_payment === true,
    creator_handle: text(creator?.handle),
    chain: readChainQuote(raw.chain),
  };
}

/** The answer of `POST /api/posts/:id/action-payment` (`{ payment }`) and of the intent read. */
export function readPaymentIntent(payload: unknown): PaymentIntent | null {
  const raw = record(payload);
  if (!raw) return null;
  const source = record(raw.payment) ?? record(record(raw.detail)?.intent) ?? raw;
  const id = text(source.id);
  if (!id) return null;
  const hash = String(source.tx_hash ?? '');
  const cents = Number(source.price_cents);
  const postId = Number(source.post_id);
  return {
    id,
    action: text(source.action) || '',
    post_id: Number.isSafeInteger(postId) && postId > 0 ? postId : null,
    price_cents: Number.isFinite(cents) && cents > 0 ? Math.round(cents) : null,
    status: text(source.status) || 'quoted',
    chain_mode: text(source.chain_mode) || 'unknown',
    tx_hash: /^[a-f0-9]{64}$/.test(hash) ? hash : null,
    explorer_url: text(source.explorer_url),
    failure: text(source.failure),
    consumed_at: time(source.consumed_at),
    confirmed_at: time(source.confirmed_at),
  };
}

/** A transfer that exists on the ledger; the write may now carry its id. */
export function intentIsPaid(intent: PaymentIntent | null | undefined): intent is PaymentIntent {
  return Boolean(intent) && ['broadcast', 'confirmed'].includes(String(intent?.status));
}

/** The failure's `detail.quote` — the price the server refused the write with. */
export function quoteFromFailure(cause: unknown): ActionQuote | null {
  const detail = record(record(cause)?.detail);
  return readActionQuote(detail?.quote);
}

/** The failure's `detail.intent` — the ledger row of a transfer that already exists. */
export function intentFromFailure(cause: unknown): PaymentIntent | null {
  const detail = record(record(cause)?.detail);
  return readPaymentIntent(detail?.intent ?? detail);
}

/** The server's code of a failed call, when it sent one. */
export function failureCode(cause: unknown): string {
  const code = record(cause)?.code;
  return typeof code === 'string' ? code : '';
}

/** Only a `402 PAYMENT_REQUIRED` means "this write is a priced action"; every other refusal is not money. */
export function paymentRequired(cause: unknown): ActionQuote | null {
  if (failureCode(cause) !== 'PAYMENT_REQUIRED') return null;
  return quoteFromFailure(cause);
}


/** One line of the sheet: the label the reader sees and the value the server sent. */
export type QuoteLine = { label: string; value: string; strong?: boolean };

/** `3` → `0,03 JUNGLE`, the same words the creator's own pricing screen prints (`pricing.ts`). */
export function formatCents(cents: number | null | undefined): string {
  const value = Number(cents);
  if (!Number.isFinite(value) || value < 0) return '—';
  const whole = Math.floor(value / 100);
  const rest = Math.round(value % 100);
  return `${whole.toLocaleString('ro-RO')},${String(rest).padStart(2, '0')} JUNGLE`;
}

export function quoteLines(quote: ActionQuote): QuoteLine[] {
  const chain = quote.chain;
  const total = totalEgld(quote);
  const lines: QuoteLine[] = [{ label: 'Preț', value: formatCents(quote.price_cents), strong: true }];
  if (quote.defaulted) lines.push({ label: 'Sursa prețului', value: 'Implicit pe platformă' });
  else if (quote.source === 'creator') lines.push({ label: 'Sursa prețului', value: 'Prețul creatorului' });
  lines.push({ label: 'Pe rețea', value: chain?.amount_egld ? `${chain.amount_egld} EGLD` : '—' });
  lines.push({ label: 'Comision de rețea', value: chain?.network_fee_egld ? `${chain.network_fee_egld} EGLD` : '—' });
  lines.push({ label: 'Total din portofel', value: total ? `${total} EGLD` : '—', strong: true });
  lines.push({ label: 'Sold devnet', value: chain?.balance_egld ? `${chain.balance_egld} EGLD` : '—' });
  if (chain?.shortfall_egld) lines.push({ label: 'Lipsește', value: `${chain.shortfall_egld} EGLD` });
  return lines;
}

/** What the sheet must say before it is safe to approve: a devnet leg that is not really devnet. */
export function paymentWarnings(quote: ActionQuote): string[] {
  const chain = quote.chain;
  if (!chain) return ['Serverul nu a spus pe ce rețea se plătește. Reîncarcă înainte de a aproba.'];
  const warnings: string[] = [];
  if (chain.mode === 'simulated') {
    warnings.push(
      `Plata rămâne în registru, fără să mute EGLD: devnet nu poate fi semnat aici${chain.reason ? ` (${chain.reason})` : ''}.`,
    );
  }
  if (chain.mode === 'devnet' && chain.can_afford === null) {
    warnings.push('Soldul devnet nu a putut fi citit; rețeaua poate refuza transferul.');
  }
  return warnings;
}

/** Reasons the confirm button must stay closed, in the reader's words. */
export function paymentBlockers(quote: ActionQuote): string[] {
  const blockers: string[] = [];
  if (quote.self_payment) blockers.push('Postarea îți aparține: nu ai ce plăti pentru ea.');
  const chain = quote.chain;
  if (chain?.can_afford === false) {
    const total = totalEgld(quote);
    blockers.push(
      `Portofelul devnet nu acoperă ${total ?? 'suma'} EGLD${chain.shortfall_egld ? ` (lipsesc ${chain.shortfall_egld} EGLD)` : ''}.`,
    );
  }
  // A quote with no payer address means the server has no wallet to sign with: approving would only be
  // refused after the tap, so the button waits instead of promising a transfer that cannot happen.
  if (chain?.mode === 'devnet' && !chain.payer_address) {
    blockers.push('Serverul nu poate semna acum transferul devnet. Încearcă din nou peste puțin timp.');
  }
  return blockers;
}


/** The server's refusal, said the way a reader can act on it. Unknown codes keep the server's sentence. */
const PAYMENT_WORDS: Record<string, string> = {
  PAYMENT_REQUIRED: 'Acțiunea se plătește întâi, apoi se scrie.',
  PAYMENT_ALREADY_USED: 'Plata a fost deja folosită pentru o acțiune. Aprobă o plată nouă.',
  PAYMENT_FAILED: 'Transferul nu a trecut pe devnet; nu s-a scris nimic.',
  PAYMENT_NOT_FOUND: 'Plata nu mai există pe acest cont. Începe din nou.',
  SELF_PAYMENT: 'Postarea îți aparține, deci nu plătești nimic.',
  ACTION_FREE: 'Acțiunea nu se plătește pe acest profil.',
  ACTION_INVALID: 'Acțiunea cerută nu există pe acest server.',
  CREATOR_UNAVAILABLE: 'Creatorul nu mai este disponibil.',
  IDEMPOTENCY_KEY_REQUIRED: 'Cererea a plecat fără cheie de repetare; încearcă din nou.',
  IDEMPOTENCY_CONFLICT: 'Cheia plății a fost folosită pentru altă acțiune. Reîncarcă și încearcă din nou.',
  CHAIN_INSUFFICIENT_FUNDS: 'Portofelul devnet nu are destul EGLD pentru această plată.',
  CHAIN_BROADCAST_REFUSED: 'Devnet a refuzat tranzacția. Încearcă din nou.',
  CHAIN_TRANSACTION_FAILED: 'Tranzacția a eșuat pe devnet; nu s-a scris nimic.',
  POST_UNAVAILABLE: 'Postarea nu mai este disponibilă pentru tine.',
};

export function paymentSentence(code: string | null | undefined, fallback: string = ''): string {
  const known = PAYMENT_WORDS[String(code ?? '')];
  return known || fallback || 'Plata nu a putut fi făcută. Încearcă din nou.';
}

/**
 * The codes after which the approval key is spent and the next tap must be a genuinely new payment:
 * the server already closed this key's ledger row (the transfer failed, devnet refused it, the wallet
 * was empty, or the key bought another action), and `payForAction` answers a `failed` row with
 * `PAYMENT_FAILED` for ever. A dropped connection is deliberately absent: replaying that key is how a
 * transfer that left the phone is recovered instead of paid twice.
 */
const KEY_IS_SPENT = new Set([
  'IDEMPOTENCY_CONFLICT',
  'PAYMENT_ALREADY_USED',
  'PAYMENT_FAILED',
  'CHAIN_TRANSACTION_FAILED',
  'CHAIN_BROADCAST_REFUSED',
  'CHAIN_INSUFFICIENT_FUNDS',
]);

export function paymentKeyRotates(code: string | null | undefined): boolean {
  return KEY_IS_SPENT.has(String(code ?? ''));
}

/** The title of the confirmation sheet. */
export function paymentTitle(action: PaidAction, intent: PaymentIntent | null): string {
  if (intentIsPaid(intent)) return `Plătit: ${ACTION_WORDS[action]}`;
  return `Plătești ${ACTION_WORDS[action]}`;
}

/** The label of the confirm button: the price the server named, then what leaves the wallet. */
export function confirmLabel(quote: ActionQuote): string {
  const total = totalEgld(quote);
  return total ? `Plătește ${formatCents(quote.price_cents)} · ${total} EGLD` : `Plătește ${formatCents(quote.price_cents)}`;
}
