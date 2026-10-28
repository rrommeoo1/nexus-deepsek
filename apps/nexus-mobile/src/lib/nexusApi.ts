import { API_ORIGIN } from './apiOrigin';
import { newMutationKey } from './idempotency';
import { authHeaders } from './session';

/** Methods the server wraps in its mutation replay boundary (`prepareMutation`). */
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * How long a JSON call may stay unanswered before the screen is told what happened.
 *
 * Measured on the owner's Xiaomi on 26 October 2026: the profile tab sat on its `ActivityIndicator` for
 * minutes because `fetch` had neither returned nor failed, and `ProfileScreen` waits for a settled
 * attempt before it draws anything (`attempted !== key && !data`). A request that never answers is not a
 * spinner, it is an absence of an answer, and the screen already knows how to print one and offer a
 * retry. Publishing does not travel through here (`lib/publishClient.ts` owns its own deadline), so this
 * bound only covers reads and small mutations.
 */
export const API_TIMEOUT_MS = 20000;

export { API_ORIGIN };

export class NexusApiError extends Error {
  /**
   * `detail` is the server's own payload for a refusal that carries one — the paid-action routes send
   * `{ quote }` on `402 PAYMENT_REQUIRED` and `{ intent }` once a transfer exists (`api.js`
   * `actionPaymentFailure`), and that quote is the only price the confirmation sheet may print.
   */
  constructor(message: string, readonly status: number, readonly code?: string, readonly detail?: unknown) {
    super(message);
  }
}

/**
 * Calls the product API with the durable native session attached. The server accepts the
 * `nexus_session` token as a bearer credential (see apps/nexus-web/lib/api.js `requireAuth`), so
 * every screen reads the same account the web does, without a cookie jar and without a WebView.
 *
 * `timeoutMs` bounds the whole exchange — the headers and the body — and is stripped before the
 * request is made, so it never leaks into `fetch`. An unanswered call ends as `NexusApiError` with
 * `code: 'TIMEOUT'` and `status: 0`, which is the only honest description of a server that said
 * nothing: there is no status to print.
 */
export async function nexusApi<T>(path: string, options: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Cale API invalidă.');
  const { timeoutMs = API_TIMEOUT_MS, ...init } = options;
  const method = String(init.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...authHeaders(),
    ...(init.headers as Record<string, string> | undefined),
  };
  // Same replay boundary as the web client (`public/client.js` `api()`): every authenticated
  // mutation carries an `Idempotency-Key`, minted here unless the caller already set one. Without
  // it the server refuses the call with 400 `IDEMPOTENCY_KEY_REQUIRED` (e.g. `POST /api/persona/switch`).
  if (MUTATION_METHODS.has(method) && !Object.keys(headers).some((name) => name.toLowerCase() === 'idempotency-key')) {
    headers['Idempotency-Key'] = newMutationKey('ui');
  }
  /**
   * A caller's own signal still works: it aborts this controller, so there is one deadline to reason
   * about instead of two. The timer is the app's deadline; the listener is the caller's.
   */
  const controller = new AbortController();
  let timedOut = false;
  const timer = timeoutMs > 0
    ? setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs)
    : null;
  const forwardAbort = () => controller.abort();
  if (init.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener('abort', forwardAbort);
  }
  try {
    const response = await fetch(`${API_ORIGIN}${path}`, { ...init, credentials: 'include', headers, signal: controller.signal });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || !body || typeof body !== 'object' || !('ok' in body) || body.ok !== true) {
      const payload = body && typeof body === 'object'
        ? body as { error?: string; code?: string; detail?: unknown }
        : null;
      throw new NexusApiError(
        payload?.error || `Serverul a răspuns cu ${response.status}.`,
        response.status,
        payload?.code,
        payload?.detail,
      );
    }
    return body as T;
  } catch (reason) {
    if (reason instanceof NexusApiError) throw reason;
    if (timedOut) {
      throw new NexusApiError(
        `Serverul nu a răspuns în ${Math.round(timeoutMs / 1000)} secunde. Reîncearcă.`,
        0,
        'TIMEOUT',
      );
    }
    throw reason;
  } finally {
    if (timer !== null) clearTimeout(timer);
    init.signal?.removeEventListener('abort', forwardAbort);
  }
}

export function mediaUrl(media?: { hash?: string; ext?: string } | null): string | null {
  if (!media || !/^[a-f0-9]{64}$/.test(media.hash || '') || !/^[a-z0-9]{2,8}$/.test(media.ext || '')) return null;
  return `${API_ORIGIN}/media/${media.hash}.${media.ext}`;
}

