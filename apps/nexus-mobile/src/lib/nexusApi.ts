import { API_ORIGIN } from './apiOrigin';
import { newMutationKey } from './idempotency';
import { authHeaders } from './session';

/** Methods the server wraps in its mutation replay boundary (`prepareMutation`). */
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export { API_ORIGIN };

export class NexusApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

/**
 * Calls the product API with the durable native session attached. The server accepts the
 * `nexus_session` token as a bearer credential (see apps/nexus-web/lib/api.js `requireAuth`), so
 * every screen reads the same account the web does, without a cookie jar and without a WebView.
 */
export async function nexusApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Cale API invalidă.');
  const method = String(options.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...authHeaders(),
    ...(options.headers as Record<string, string> | undefined),
  };
  // Same replay boundary as the web client (`public/client.js` `api()`): every authenticated
  // mutation carries an `Idempotency-Key`, minted here unless the caller already set one. Without
  // it the server refuses the call with 400 `IDEMPOTENCY_KEY_REQUIRED` (e.g. `POST /api/persona/switch`).
  if (MUTATION_METHODS.has(method) && !Object.keys(headers).some((name) => name.toLowerCase() === 'idempotency-key')) {
    headers['Idempotency-Key'] = newMutationKey('ui');
  }
  const response = await fetch(`${API_ORIGIN}${path}`, { ...options, credentials: 'include', headers });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== 'object' || !('ok' in body) || body.ok !== true) {
    const payload = body && typeof body === 'object' ? body as { error?: string; code?: string } : null;
    throw new NexusApiError(payload?.error || `Serverul a răspuns cu ${response.status}.`, response.status, payload?.code);
  }
  return body as T;
}

export function mediaUrl(media?: { hash?: string; ext?: string } | null): string | null {
  if (!media || !/^[a-f0-9]{64}$/.test(media.hash || '') || !/^[a-z0-9]{2,8}$/.test(media.ext || '')) return null;
  return `${API_ORIGIN}/media/${media.hash}.${media.ext}`;
}

