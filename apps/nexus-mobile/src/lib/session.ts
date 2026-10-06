import { Directory, File, Paths } from 'expo-file-system';
import { API_ORIGIN } from './apiOrigin';

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

/** Headers that carry the stored session, without ever exposing it in the UI. */
export function authHeaders(): Record<string, string> {
  const session = readSession();
  if (!session) return {};
  const headers: Record<string, string> = {};
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  if (session.deviceId) headers.Cookie = `nexus_device_id=${session.deviceId}`;
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
  const response = await fetch(`${API_ORIGIN}/auth/email/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== 'object' || (body as { ok?: boolean }).ok !== true) {
    const payload = body && typeof body === 'object' ? body as { error?: string } : null;
    throw new Error(payload?.error || `Serverul a răspuns cu ${response.status}.`);
  }
  const cookies = readSetCookie(response.headers);
  const token = cookieValue(cookies, 'nexus_session');
  const deviceId = cookieValue(cookies, 'nexus_device_id');
  writeSession({ token, deviceId, cookieSession: !token });
  const payload = body as LoginBody;
  return { user: payload.user, emailVerified: Boolean(payload.email_verified) };
}

export async function signOut(): Promise<void> {
  const headers = authHeaders();
  clearSession();
  try {
    await fetch(`${API_ORIGIN}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', ...headers },
    });
  } catch { /* the local session is already gone; the remote one expires on its own */ }
}
