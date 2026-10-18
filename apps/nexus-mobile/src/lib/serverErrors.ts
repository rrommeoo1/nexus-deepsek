/**
 * What a failed read sounds like to a reader of this app.
 *
 * The owner's rule (18 October 2026): a server that does not have the route yet must not print the raw
 * `not found` the transport gave us. Each case gets a sentence a person can act on: the route is missing
 * (404), the server has not implemented it (501), the server is down or busy (503), or there was no answer
 * at all (a network failure). Everything else falls back to the server's own words.
 *
 * It is pure and importable from a test runner: no React, no React Native, no knowledge of `fetch`.
 */
export const MONETIZATION_NOT_DEPLOYED = 'Monetizarea nu este încă activată pe server.';

/**
 * A refusal about money is not a broken screen. These are the codes `lib/action-payments.js` sends with
 * its `paymentError`, worded the same way the payment sheet words them (`actionPayments.ts`
 * `paymentSentence`) so a reader never learns two vocabularies for one transfer. Kept as literals here
 * rather than imported: this module stays importable by the test runner on its own.
 */
const MONEY_WORDS: Record<string, string> = {
  PAYMENT_REQUIRED: 'Acțiunea se plătește întâi, apoi se scrie.',
  PAYMENT_ALREADY_USED: 'Plata a fost deja folosită pentru o acțiune. Aprobă o plată nouă.',
  PAYMENT_FAILED: 'Transferul nu a trecut pe devnet; nu s-a scris nimic.',
  PAYMENT_NOT_FOUND: 'Plata nu mai există pe acest cont. Începe din nou.',
  SELF_PAYMENT: 'Postarea îți aparține, deci nu plătești nimic.',
  ACTION_FREE: 'Acțiunea nu se plătește pe acest profil.',
  IDEMPOTENCY_CONFLICT: 'Cheia plății a fost folosită pentru altă acțiune. Reîncarcă și încearcă din nou.',
  CHAIN_INSUFFICIENT_FUNDS: 'Portofelul devnet nu are destul EGLD pentru această plată.',
  CHAIN_BROADCAST_REFUSED: 'Devnet a refuzat tranzacția. Încearcă din nou.',
  CHAIN_TRANSACTION_FAILED: 'Tranzacția a eșuat pe devnet; nu s-a scris nimic.',
};

export type ServerFailure = {
  status?: number | null;
  code?: string | null;
  message?: string | null;
};

function failureOf(cause: unknown): ServerFailure | null {
  if (!cause || typeof cause !== 'object') return null;
  return cause as ServerFailure;
}

/** `true` for a failure that never reached the server: a fetch rejection has no status and no code. */
export function isNetworkFailure(cause: unknown): boolean {
  const failure = failureOf(cause);
  if (!failure) return false;
  const status = Number(failure.status ?? 0);
  if (Number.isFinite(status) && status > 0) return false;
  return true;
}

/**
 * The sentence for a failed read of a screen's own data. `fallback` is used for a failure the table does
 * not recognise, so a server that explains itself is never overwritten by a guess. `missing` is the
 * screen's own way of saying "this feature is not on this server yet", so the wallet can name the wallet
 * instead of borrowing the monetisation sentence.
 */
export function serverErrorWords(
  cause: unknown,
  fallback: string,
  missing: string = MONETIZATION_NOT_DEPLOYED,
): string {
  const failure = failureOf(cause);
  const status = Number(failure?.status ?? 0);
  const code = String(failure?.code ?? '');

  if (status === 404 || code === 'NOT_FOUND') {
    return `${missing} Ruta lipsește de pe această instalare (404).`;
  }
  if (status === 501 || code === 'NOT_IMPLEMENTED') {
    return `${missing} Serverul nu are încă funcția (501).`;
  }
  if (status === 503 || code === 'UNAVAILABLE' || code === 'SERVICE_UNAVAILABLE') {
    return `${missing} Serverul este oprit sau ocupat (503). Încearcă din nou peste un minut.`;
  }
  if (isNetworkFailure(cause)) {
    return 'Serverul nu răspunde. Verifică legătura de internet și încearcă din nou.';
  }
  if (status === 401 || status === 403) {
    return 'Sesiunea nu mai este valabilă. Intră din nou în cont.';
  }
  // Money comes after the session check: a 402 with a dead session is still a dead session.
  const money = Object.prototype.hasOwnProperty.call(MONEY_WORDS, code) ? MONEY_WORDS[code] : '';
  if (money) return money;
  return fallback;
}
