import { Directory, File, Paths } from 'expo-file-system';
import { API_ORIGIN } from './apiOrigin';
import { signInFailureMessage } from './emailAuth';
import { newMutationKey } from './idempotency';
import {
  identifierSubmissionValue, passwordSubmissionValue, type LocalAccountDraft,
} from './loginFields';

/**
 * Durable native session.
 *
 * The web product authenticates with the `nexus_session` cookie. The same server accepts that
 * token as `Authorization: Bearer <token>` (apps/nexus-web/lib/api.js `requireAuth`), so the
 * Android client can hold a real, durable session without a WebView: the token issued at login is
 * kept in the app's private document directory and replayed on every request.
 *
 * Nothing here stores the password. `signIn` keeps the credentials in memory for the length of the
 * single request and the raw response bodies are never written to disk.
 */
export type SessionUser = {
  id: number;
  handle: string;
  email?: string;
  display_name?: string;
};

export type StoredSession = {
  /** `nexus_session` token, when the response header could be read. */
  token: string | null;
  /** `nexus_device_id` cookie, replayed so the server keeps binding this installation. */
  deviceId: string | null;
  /** True when authentication relies on the platform cookie jar instead of the captured token. */
  cookieSession: boolean;
  savedAt: number;
};

const SESSION_DIRECTORY = 'nexus-session';
const SESSION_FILE = 'session.json';

function sessionDirectory(): Directory {
  return new Directory(Paths.document, SESSION_DIRECTORY);
}

function sessionFile(): File {
  return new File(sessionDirectory(), SESSION_FILE);
}

let cached: StoredSession | null | undefined;

function isStoredSession(value: unknown): value is StoredSession {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (candidate.token === null || typeof candidate.token === 'string')
    && (candidate.deviceId === null || typeof candidate.deviceId === 'string')
    && typeof candidate.cookieSession === 'boolean'
    && typeof candidate.savedAt === 'number';
}

export function readSession(): StoredSession | null {
  if (cached !== undefined) return cached;
  try {
    const file = sessionFile();
    if (!file.exists) { cached = null; return cached; }
    const value: unknown = JSON.parse(file.textSync());
    cached = isStoredSession(value) ? value : null;
  } catch { cached = null; }
  return cached;
}

export function writeSession(session: Omit<StoredSession, 'savedAt'>): StoredSession {
  const value: StoredSession = { ...session, savedAt: Date.now() };
  const directory = sessionDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const temporary = new File(directory, `${SESSION_FILE}.tmp`);
  temporary.create({ overwrite: true });
  temporary.write(JSON.stringify(value));
  temporary.moveSync(sessionFile(), { overwrite: true });
  cached = value;
  return value;
}

export function clearSession(): void {
  cached = null;
  try {
    const file = sessionFile();
    if (file.exists) file.delete();
  } catch { /* a session file that cannot be removed still expires server-side */ }
}

/**
 * Headers that carry the stored session, without ever exposing it in the UI.
 *
 * `Origin` is sent explicitly because React Native has no browsing context: `fetch` never adds the
 * header a browser adds on its own, and every authenticated native call carries the
 * `nexus_device_id` cookie below. The server refuses a cookie-bearing mutation that arrives without
 * an `Origin` (`apps/nexus-web/lib/api.js` → 403 `origin obligatoriu pentru mutații autentificate`),
 * so a native publish would be turned away before it reached any route. The value is the origin the
 * API is served from, which is exactly what `externalOrigin(req)` compares against; a browser
 * cannot forge that header, so the cross-site guard keeps rejecting every other origin.
 */
export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Origin: API_ORIGIN };
  const session = readSession();
  if (!session) return headers;
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  if (session.deviceId) headers.Cookie = `nexus_device_id=${session.deviceId}`;
  return headers;
}

/**
 * The subset of `authHeaders` a media request needs.
 *
 * `GET /media/<hash>.<ext>` sits behind the same session as the rest of the product: on production
 * an anonymous request answers `401` while the same URL answers `200` as soon as it carries either
 * `Authorization: Bearer <nexus_session>` or `Cookie: nexus_session=…`. `<Image source={{uri,headers}}>`
 * and `expo-video`'s `VideoSource.headers` accept exactly such a map, so this is what makes remote
 * media resolve inside the app instead of failing silently behind an empty frame.
 *
 * `Origin` is deliberately absent: it is only required by the mutation replay boundary
 * (`assertEmailAuthIdempotencyKey`), never by a read of a static asset.
 */
export function mediaHeaders(): Record<string, string> {
  const session = readSession();
  if (!session) return {};
  const headers: Record<string, string> = {};
  const cookies: string[] = [];
  if (session.token) {
    headers.Authorization = `Bearer ${session.token}`;
    cookies.push(`nexus_session=${session.token}`);
  }
  if (session.deviceId) cookies.push(`nexus_device_id=${session.deviceId}`);
  if (cookies.length) headers.Cookie = cookies.join('; ');
  return headers;
}

/** Every `Set-Cookie` value a fetch response may expose, across React Native versions. */
function readSetCookie(headers: Headers): string[] {
  const values: string[] = [];
  const withSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withSetCookie.getSetCookie === 'function') {
    try { values.push(...withSetCookie.getSetCookie()); } catch { /* fall through */ }
  }
  const single = headers.get('set-cookie');
  if (single) values.push(single);
  return values;
}

function cookieValue(values: string[], name: string): string | null {
  const pattern = new RegExp(`(?:^|[,\\s])${name}=([^;,\\s]+)`);
  for (const value of values) {
    const match = pattern.exec(value);
    if (match?.[1]) return match[1];
  }
  return null;
}

export type LoginResult = { user: SessionUser; emailVerified: boolean };

type LoginBody = { ok: true; user: SessionUser; email_verified?: boolean };

/**
 * Signs in with the existing email endpoint and turns the response into a durable session.
 * The response is checked on the server side; nothing is trusted from the client.
 */
export async function signInWithEmail(email: string, password: string): Promise<LoginResult> {
  // `/auth/email/login` sits behind the same replay boundary as every mutation
  // (`assertEmailAuthIdempotencyKey`): without a 16–128 character `Idempotency-Key` the server
  // answers 400 `IDEMPOTENCY_KEY_REQUIRED` and the session never opens. The web form sends the same
  // header (`public/app.js` `data-login-key`). One key per attempt, exactly like the browser.
  const response = await fetch(`${API_ORIGIN}/auth/email/login`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      // The device cookie from an earlier visit can still be attached to this call, so the server
      // asks for the origin of the client; React Native never adds it (see `authHeaders`).
      Origin: API_ORIGIN,
      'Idempotency-Key': newMutationKey('email-login'),
    },
    body: JSON.stringify({ email, password }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== 'object' || (body as { ok?: boolean }).ok !== true) {
    // Translated here, once, so every caller prints the same sentence (`lib/emailAuth.ts`): the wire
    // text of a 401 is English and belongs in the log, not in the middle of a Romanian form.
    const payload = body && typeof body === 'object' ? body as { error?: string; code?: string } : null;
    throw new Error(signInFailureMessage(response.status, String(payload?.code ?? ''), String(payload?.error ?? '')));
  }
  const cookies = readSetCookie(response.headers);
  const token = cookieValue(cookies, 'nexus_session');
  const deviceId = cookieValue(cookies, 'nexus_device_id');
  writeSession({ token, deviceId, cookieSession: !token });
  const payload = body as LoginBody;
  return { user: payload.user, emailVerified: Boolean(payload.email_verified) };
}

/**
 * Signs in with an xPortal NativeAuth token, which the WebView bridge produced
 * (`lib/xportalLogin.ts`): the wallet signed the server's own challenge, so the token is the proof.
 *
 * The server validates the signature, the chain, the origin and the expiry (`validateNativeAuthToken`
 * in `apps/nexus-web/lib/api.js`), then answers with a session cookie — the same answer the email
 * form gets, so the session is kept the same way and every later request carries the same bearer
 * token. The phone never decides who the wallet is; it only delivers what xPortal signed.
 */
export async function signInWithXPortalToken(token: string): Promise<LoginResult> {
  const response = await fetch(`${API_ORIGIN}/auth/mvx/native`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Origin: API_ORIGIN,
      // One key per signature: a retried delivery of the same token replays the first answer instead
      // of opening a second session for it.
      'Idempotency-Key': newMutationKey('xportal-login'),
    },
    body: JSON.stringify({ token }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== 'object' || (body as { ok?: boolean }).ok !== true) {
    const payload = body && typeof body === 'object' ? body as { error?: string } : null;
    throw new Error(payload?.error || `Serverul a răspuns cu ${response.status}.`);
  }
  const cookies = readSetCookie(response.headers);
  const sessionToken = cookieValue(cookies, 'nexus_session');
  const deviceId = cookieValue(cookies, 'nexus_device_id');
  writeSession({ token: sessionToken, deviceId, cookieSession: !sessionToken });
  const payload = body as LoginBody & { address?: string };
  return { user: payload.user, emailVerified: Boolean(payload.email_verified) };
}

export async function signOut(): Promise<void> {
  const headers = authHeaders();
  clearSession();
  try {
    await fetch(`${API_ORIGIN}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Idempotency-Key': newMutationKey('email-logout'), ...headers },
    });
  } catch { /* the local session is already gone; the remote one expires on its own */ }
}

/**
 * What this backend can actually do for a login, asked before anyone signs in.
 *
 * The two flows below only exist on a local development server (`apps/nexus-web/lib/local-account.js`),
 * and the phone must not offer a button that the server will refuse: `/api/auth-capabilities` is the
 * one honest answer, and a null here means "could not ask", never "yes".
 */
export type AuthCapabilities = {
  registration: string;
  passwordRecovery: string;
  localAccounts: boolean;
  wallet: { ready: boolean; origin: string; missing: string[] } | null;
  /** Round 37: the mail flows this server really has (`configured`, `delivery`, `missing`). */
  email: { configured: boolean; delivery: string; provider: string; missing: string[] };
};

export async function readAuthCapabilities(): Promise<AuthCapabilities | null> {
  try {
    const response = await fetch(`${API_ORIGIN}/api/auth-capabilities`, {
      headers: { Accept: 'application/json', Origin: API_ORIGIN },
    });
    if (!response.ok) return null;
    const body = await response.json() as {
      ok?: boolean;
      registration?: string;
      password_recovery?: string;
      local_accounts?: { enabled?: boolean };
      wallet?: { ready?: boolean; origin?: string; missing?: string[] } | null;
      email?: { configured?: boolean; delivery?: string; provider?: string; missing?: string[] } | null;
    };
    if (!body || body.ok !== true) return null;
    return {
      registration: String(body.registration ?? ''),
      passwordRecovery: String(body.password_recovery ?? ''),
      localAccounts: Boolean(body.local_accounts?.enabled),
      wallet: body.wallet
        ? { ready: Boolean(body.wallet.ready), origin: String(body.wallet.origin ?? ''), missing: [...(body.wallet.missing ?? [])] }
        : null,
      email: {
        configured: Boolean(body.email?.configured),
        delivery: String(body.email?.delivery ?? 'unconfigured'),
        provider: String(body.email?.provider ?? ''),
        missing: [...(body.email?.missing ?? [])],
      },
    };
  } catch {
    return null;
  }
}

/** A readable sentence for any failed auth call, never a raw body and never a stack trace. */
async function authError(response: Response, fallback: string): Promise<Error> {
  const body: unknown = await response.json().catch(() => null);
  const message = body && typeof body === 'object' ? String((body as { error?: string }).error ?? '') : '';
  if (message) return new Error(message);
  if (response.status === 404) return new Error(`${fallback} Serverul de la ${API_ORIGIN} nu are fluxul de cont local.`);
  return new Error(`${fallback} (${response.status})`);
}

/**
 * Creates a Nexus account on a local development server: handle + password, email optional, no mail
 * verification and no browser wallet. The password reaches the server exactly as typed
 * (`lib/loginFields.ts`), is hashed there with scrypt, and never comes back. A 201 hands back the same
 * session cookie the login form gets, so the app is signed in without a second round trip.
 */
export async function registerWithLocalAccount(draft: LocalAccountDraft): Promise<LoginResult> {
  const response = await fetch(`${API_ORIGIN}/auth/local/register`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Origin: API_ORIGIN,
      'Idempotency-Key': newMutationKey('local-register'),
    },
    body: JSON.stringify({
      handle: identifierSubmissionValue(draft.handle).replace(/^@/, '').toLowerCase(),
      email: identifierSubmissionValue(draft.email),
      password: passwordSubmissionValue(draft.password),
    }),
  });
  if (!response.ok) throw await authError(response, 'Contul nu a putut fi creat.');
  const body: unknown = await response.json().catch(() => null);
  if (!body || typeof body !== 'object' || (body as { ok?: boolean }).ok !== true) {
    throw new Error('Contul nu a putut fi creat.');
  }
  const cookies = readSetCookie(response.headers);
  const token = cookieValue(cookies, 'nexus_session');
  const deviceId = cookieValue(cookies, 'nexus_device_id');
  writeSession({ token, deviceId, cookieSession: !token });
  const payload = body as LoginBody;
  return { user: payload.user, emailVerified: Boolean(payload.email_verified) };
}

/**
 * Local development recovery: identifies the account by email or handle and sets a new password.
 *
 * The server answers 404 for an unknown identifier and 409 for an account that never had a password
 * (a migrated social identity or a wallet-only account: those are recovered through xPortal, not from
 * an unauthenticated form). Every session of the account is revoked server-side, so the phone's stored
 * session is dropped here as well instead of being kept in the hope it still works.
 */
export async function resetLocalPassword(identifier: string, password: string): Promise<{ handle: string }> {
  const response = await fetch(`${API_ORIGIN}/auth/local/password-reset`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Origin: API_ORIGIN,
      'Idempotency-Key': newMutationKey('local-reset'),
    },
    body: JSON.stringify({
      identifier: identifierSubmissionValue(identifier),
      password: passwordSubmissionValue(password),
    }),
  });
  if (!response.ok) throw await authError(response, 'Parola nu a putut fi schimbată.');
  const body: unknown = await response.json().catch(() => null);
  if (!body || typeof body !== 'object' || (body as { ok?: boolean }).ok !== true) {
    throw new Error('Parola nu a putut fi schimbată.');
  }
  clearSession();
  return { handle: String((body as { handle?: string }).handle ?? '') };
}

/**
 * The mail-backed account calls (round 37). Every request goes to **our backend**
 * (`apps/nexus-web/lib/email/`), which is the only place a provider key ever exists: the phone never
 * talks to Resend or Brevo, and no credential of either is compiled into the app.
 *
 * The password is sent exactly as typed (`passwordSubmissionValue` is the identity function); only the
 * address is tidied.
 */
export type EmailDelivery = { sent: boolean; delivered: boolean; delivery: string; provider: string; expires_in_minutes: number; code?: string; note?: string };

export type EmailRegistrationResult = {
  user: SessionUser;
  emailVerified: boolean;
  verification: EmailDelivery | null;
  /** `true` only in development: production refuses to sign in an unconfirmed address. */
  loginAllowed: boolean;
  created: boolean;
};

function emailJson(path: string, body: Record<string, unknown>, keyPrefix: string): Promise<Response> {
  return fetch(`${API_ORIGIN}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Origin: API_ORIGIN,
      'Idempotency-Key': newMutationKey(keyPrefix),
    },
    body: JSON.stringify(body),
  });
}

/**
 * Creates an account with an address and asks the server to mail the confirmation. No session is
 * stored: the account exists but the app must not pretend the person is signed in before the address
 * is confirmed (in production the server would refuse the login anyway).
 */
export async function registerEmailAccount(draft: { email: string; handle: string; password: string }): Promise<EmailRegistrationResult> {
  const response = await emailJson('/auth/email/register', {
    email: identifierSubmissionValue(draft.email),
    handle: identifierSubmissionValue(draft.handle).replace(/^@/, ''),
    password: passwordSubmissionValue(draft.password),
  }, 'email-register');
  if (!response.ok) throw await authError(response, 'Contul nu a putut fi creat.');
  const body: unknown = await response.json().catch(() => null);
  const payload = body && typeof body === 'object' ? body as {
    ok?: boolean; user?: SessionUser; email_verified?: boolean; login_allowed?: boolean; created?: boolean;
    verification?: EmailDelivery | null;
  } : null;
  if (!payload || payload.ok !== true || !payload.user) throw new Error('Contul nu a putut fi creat.');
  return {
    user: payload.user,
    emailVerified: Boolean(payload.email_verified),
    verification: payload.verification ?? null,
    loginAllowed: payload.login_allowed !== false,
    created: payload.created !== false,
  };
}

/** Asks for the confirmation mail again. The server answers the same for any address. */
export async function requestEmailVerification(email: string): Promise<void> {
  const response = await emailJson('/auth/email/verification/send', { email: identifierSubmissionValue(email) }, 'email-verify-send');
  if (!response.ok) throw await authError(response, 'Mesajul nu a putut fi cerut.');
}

/** Spends the token from the emailed link. The answer names the handle it confirmed. */
export async function confirmEmailVerification(token: string): Promise<{ handle: string }> {
  const response = await emailJson('/auth/email/verification/confirm', { token: String(token) }, 'email-verify-confirm');
  if (!response.ok) throw await authError(response, 'Linkul nu a putut fi folosit.');
  const body: unknown = await response.json().catch(() => null);
  if (!body || typeof body !== 'object') throw new Error('Linkul nu a putut fi folosit.');
  return { handle: String((body as { handle?: string }).handle ?? '') };
}

/** Asks for a reset link. Privacy-preserving by construction: the answer never says if the account exists. */
export async function requestEmailPasswordReset(email: string): Promise<void> {
  const response = await emailJson('/auth/email/reset-request', { email: identifierSubmissionValue(email) }, 'email-reset-request');
  if (!response.ok) throw await authError(response, 'Linkul de resetare nu a putut fi cerut.');
}

/**
 * Sets the new password with the token from the email. Every session of the account is revoked
 * server-side, so the stored session is dropped here too instead of being kept in hope.
 */
export async function confirmEmailPasswordReset(token: string, password: string): Promise<{ handle: string }> {
  const response = await emailJson('/auth/email/reset-confirm', {
    token: String(token),
    password: passwordSubmissionValue(password),
  }, 'email-reset-confirm');
  if (!response.ok) throw await authError(response, 'Parola nu a putut fi schimbată.');
  const body: unknown = await response.json().catch(() => null);
  if (!body || typeof body !== 'object' || (body as { ok?: boolean }).ok !== true) {
    throw new Error('Parola nu a putut fi schimbată.');
  }
  clearSession();
  return { handle: String((body as { handle?: string }).handle ?? '') };
}

