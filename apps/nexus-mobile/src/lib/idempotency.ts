/**
 * The replay boundary every authenticated mutation needs.
 *
 * `apps/nexus-web/lib/api.js` wraps all `POST`/`PUT`/`PATCH`/`DELETE` routes outside `/api/uploads`
 * in `prepareMutation`, which refuses a request without an `Idempotency-Key` (16-128 characters from
 * `A-Za-z0-9._:-`) and replays the stored answer for a key it already saw. The web client fills the
 * header for every call in `public/client.js`; this module is the native equivalent, so a retried
 * tap on a slow network returns the first result instead of creating a second post.
 *
 * React Native has no `crypto.randomUUID`, so the key is built from `Math.random` — enough for a
 * key that only has to be unique for one account and one hour, and never trusted as a secret.
 */

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** The exact shape `cleanKey` (mutation-idempotency) and `cleanIdempotencyKey` (resumable-upload) accept. */
export const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{16,128}$/;

export function idempotencyKeyIsValid(value: unknown): boolean {
  return typeof value === 'string' && IDEMPOTENCY_KEY.test(value);
}

/**
 * Builds `<prefix>-<time>-<random>` with a prefix reduced to safe characters, so every key stays
 * inside the accepted alphabet and remains readable in the server logs.
 */
export function newMutationKey(prefix: string): string {
  const scope = String(prefix || 'mutation').replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 60) || 'mutation';
  let random = '';
  for (let index = 0; index < 24; index++) random += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  const key = `nexus-mobile-${scope}-${Date.now().toString(36)}-${random}`;
  return idempotencyKeyIsValid(key) ? key : `nexus-mobile-${Date.now().toString(36)}-${random}${random}`;
}
