/**
 * The phone's half of "log in with xPortal".
 *
 * WalletConnect v2 and the MultiversX provider are browser libraries: the pairing, the relay
 * websocket and the NativeAuth signature all happen in `apps/nexus-web/public/xportal-bridge.html`,
 * loaded in a WebView on the API's own origin (so `/auth/mvx/init` is same-origin and the server's
 * origin attestation matches). That page posts four kinds of message; this module is the only place
 * that reads them, so a malformed or foreign message can never become a session.
 *
 * The NativeAuth token is the one thing the page hands over: `<base64url address>.<base64url init>.
 * <signature>` (the server's `validateNativeAuthToken` is what finally accepts or rejects it). The
 * token is then exchanged for a `nexus_session` by `signInWithXPortalToken` in `lib/session.ts`,
 * exactly the way the email form's answer is turned into a durable session.
 */

/** The page the WebView opens. Served by the API itself, so it shares the API's origin. */
export const XPORTAL_BRIDGE_PATH = '/xportal-bridge.html';

/** The universal link xPortal registers: opening it hands the pairing to the app. */
export const XPORTAL_UNIVERSAL_LINK = 'https://xportal.app.link/wc';

/**
 * What xPortal is told when it is about to send the reader back (`metadata.redirect.native`).
 *
 * Without this field the wallet has no address for us, so an approved login ends on xPortal's home
 * screen and the reader has to find Jungle Book by hand. The app declares `nexusdev` in `app.json`
 * (`scheme`) and its `MainActivity` is `singleTask` with a `nexusdev` VIEW filter, so returning on
 * that scheme reuses the running task and the WebView keeps its WalletConnect session — the approval
 * is then waiting in the page instead of being re-paired.
 */
export function xPortalRedirectScheme(scheme: unknown): string {
  const first = Array.isArray(scheme) ? scheme[0] : scheme;
  const value = typeof first === 'string' ? first.trim().toLowerCase() : '';
  return /^[a-z][a-z0-9+.-]{1,30}$/.test(value) ? `${value}://` : '';
}

export type XPortalRedirect = { native?: string; universal?: string };

export type XPortalBridgeEvent =
  /** The page saying what it is doing, so the sheet can print it verbatim. */
  | { kind: 'status'; message: string }
  /** The pairing exists: `uri` is `wc:…`, `deepLink` is the universal link to open xPortal with. */
  | { kind: 'pairing'; uri: string; deepLink: string }
  /** Which step the page is on: preparing → pairing → signature → token → failed. */
  | { kind: 'phase'; phase: string }
  /** xPortal signed the NativeAuth message; `token` is what the server validates. */
  | { kind: 'token'; token: string; address: string }
  /** The page could not finish, and says why in its own words. */
  | { kind: 'error'; message: string }
  /** The relay websocket's state after the app came back to the foreground. */
  | { kind: 'relay'; connected: boolean; restarted: boolean; error: string }
  /** One diagnostic step from the page. Never carries the pairing URI. */
  | { kind: 'log'; event: string; fields: Record<string, string | number | boolean> }
  /** The answer to `copyPairingLink`. */
  | { kind: 'copied'; ok: boolean };

export class XPortalBridgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XPortalBridgeError';
  }
}

const STATUS_MAX = 240;
const ERROR_MAX = 400;
const ADDRESS = /^erd1[0-9a-z]{58}$/;
/** `<base64url(address)>.<base64url(init)>.<hex signature>` — the shape `buildAccessToken` writes. */
const NATIVE_AUTH_TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[a-f0-9]{128}$/i;

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/**
 * `origin` is the API origin (`lib/apiOrigin.ts`); only an http(s) origin can serve the page. The
 * redirect the page forwards into the WalletConnect metadata is appended here, so the value xPortal
 * remembers is the app's own scheme and not something the page guessed.
 */
export function xPortalBridgeUrl(origin: string, redirect: XPortalRedirect = {}): string {
  let parsed: URL;
  try {
    parsed = new URL(String(origin));
  } catch {
    throw new XPortalBridgeError('Adresa serverului nu este validă.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new XPortalBridgeError('Pagina xPortal are nevoie de un server http(s).');
  }
  const url = new URL(`${parsed.origin}${XPORTAL_BRIDGE_PATH}`);
  const native = typeof redirect.native === 'string' ? redirect.native.trim() : '';
  // Only a bare scheme is forwarded: a path or query in `redirect.native` would be a second way to
  // leave the app, and xPortal only needs to know which app to open.
  if (/^[a-z][a-z0-9+.-]{1,30}:\/\/$/i.test(native)) url.searchParams.set('redirect', native);
  const universal = typeof redirect.universal === 'string' ? redirect.universal.trim() : '';
  if (/^https?:\/\//i.test(universal)) url.searchParams.set('universal', universal.slice(0, 300));
  return url.toString();
}

/**
 * What to open so xPortal receives the pairing. The web client builds the same link
 * (`xPortalUniversalLink`, apps/nexus-web/src/wc-client.js) and xPortal is the app registered for it.
 */
export function xPortalDeepLink(uri: string): string {
  const value = pairingUri(uri);
  return `${XPORTAL_UNIVERSAL_LINK}?uri=${encodeURIComponent(value)}`;
}

function pairingUri(uri: string): string {
  const value = String(uri || '').trim();
  // A WalletConnect pairing URI is `wc:<topic>@2?relay-protocol=…&symKey=…`; anything else is not one.
  if (!/^wc:[^\s]{8,2040}$/.test(value)) throw new XPortalBridgeError('WalletConnect nu a dat un URI de pairing.');
  return value;
}

/**
 * What to open, in the order that actually reaches the wallet on Android: xPortal declares the `wc:`
 * scheme itself, then its own `xportal:` scheme, then the Branch universal link the web client uses
 * (the universal link needs the app-link plumbing, and on a warm xPortal it can land on the wallet
 * home without the pairing). The first link the system accepts wins.
 */
export function xPortalWalletLinks(uri: string): string[] {
  const value = pairingUri(uri);
  const encoded = encodeURIComponent(value);
  return [value, `xportal://wc?uri=${encoded}`, `${XPORTAL_UNIVERSAL_LINK}?uri=${encoded}`];
}

export function nativeAuthTokenIsValid(token: unknown): boolean {
  return typeof token === 'string' && NATIVE_AUTH_TOKEN.test(token);
}

/**
 * `wc:<topic>@2?…` → `<topic>`. The rest of the URI carries the pairing's symmetric key, which is
 * why the topic is the only part allowed into a log line.
 */
export function xPortalPairingTopic(uri: string): string {
  const match = /^wc:([^@?]{8,128})@2/.exec(String(uri ?? '').trim());
  return match ? match[1] : '';
}

/**
 * One line per step for `adb logcat --pid=<app>` (ReactNativeJS). Called with the fields the page
 * sent, which `diagnosticFields` has already cut down; nothing here can print a token or a key.
 */
export function logXPortal(event: string, fields: Record<string, string | number | boolean> = {}): void {
  const parts = Object.entries(fields).map(([key, value]) => `${key}=${String(value)}`);
  console.log(`[xportal] ${event}${parts.length ? ` ${parts.join(' ')}` : ''}`);
}

export function xPortalAddressIsValid(address: unknown): boolean {
  return typeof address === 'string' && ADDRESS.test(address);
}

/**
 * Reads one WebView message. Anything that is not this page's own, well-formed event is `null`:
 * a payment or a session is never derived from a guess.
 */
export function parseXPortalBridgeMessage(raw: unknown): XPortalBridgeEvent | null {
  if (typeof raw !== 'string' || !raw) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const event = payload as Record<string, unknown>;
  if (event.source !== 'nexus-xportal') return null;

  if (event.type === 'status') {
    const message = text(event.message, STATUS_MAX);
    return message ? { kind: 'status', message } : null;
  }
  if (event.type === 'pairing') {
    const uri = text(event.uri, 2048);
    if (!/^wc:/.test(uri)) return null;
    const deepLink = text(event.deepLink, 4096);
    if (deepLink) return { kind: 'pairing', uri, deepLink };
    // No link from the page: build it, and drop the event if the URI is not a pairing at all.
    try {
      return { kind: 'pairing', uri, deepLink: xPortalDeepLink(uri) };
    } catch {
      return null;
    }
  }
  if (event.type === 'token') {
    const token = text(event.token, 8192);
    const address = text(event.address, 90);
    if (!nativeAuthTokenIsValid(token) || !xPortalAddressIsValid(address)) return null;
    return { kind: 'token', token, address };
  }
  if (event.type === 'error') {
    const message = text(event.message, ERROR_MAX);
    return message ? { kind: 'error', message } : null;
  }
  if (event.type === 'phase') {
    const phase = text(event.phase, 24);
    return PHASES.includes(phase) ? { kind: 'phase', phase } : null;
  }
  if (event.type === 'relay') {
    return {
      kind: 'relay',
      connected: event.connected === true,
      restarted: event.restarted === true,
      error: text(event.error, STATUS_MAX),
    };
  }
  if (event.type === 'copied') {
    return { kind: 'copied', ok: event.ok === true };
  }
  if (event.type === 'log') {
    const name = text(event.event, 40);
    if (!name) return null;
    return { kind: 'log', event: name, fields: diagnosticFields(event.fields) };
  }
  return null;
}

/** The phases the page reports, in order; anything else is not a phase. */
const PHASES = ['preparing', 'pairing', 'signature', 'token', 'failed'];

/**
 * Only the small, enumerable diagnostics the page sends. A value is cut to 64 characters and a
 * `wc:…` string is dropped, so a symmetric key can never reach the log even if the page changed.
 */
function diagnosticFields(value: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[a-zA-Z]{1,24}$/.test(key)) continue;
    // A key named for the symmetric key is dropped whatever it holds: that secret never leaves the page.
    if (/sym_?key/i.test(key)) continue;
    if (typeof raw === 'boolean') { out[key] = raw; continue; }
    if (typeof raw === 'number' && Number.isFinite(raw)) { out[key] = Math.round(raw); continue; }
    if (typeof raw === 'string') {
      const trimmed = raw.trim().slice(0, 64);
      if (!trimmed || /^wc:/i.test(trimmed) || /symkey|sym_key/i.test(trimmed)) continue;
      out[key] = trimmed;
    }
  }
  return out;
}

/**
 * The sentence the sheet prints for a page failure. The page's own text is kept when it is already
 * a sentence; the two failures a reader can actually cause are named in the app's voice.
 */
export function xPortalFailureSentence(message: string): string {
  const detail = String(message || '').trim();
  if (/reject|declin|cancel|anulat|4001/i.test(detail)) return 'Ai anulat conectarea în xPortal. Poți încerca din nou.';
  // The page names the exact origin that has to be allowlisted; that sentence is the instruction a
  // reader has to follow, so it is printed unchanged instead of being replaced by a summary. Three
  // wordings count, because three layers can write it: the web client's refusal (`explainRelayRefusal`),
  // its fallback (`…este permisă în Allowlist`), and the relay watcher in the bridge page. The origin has
  // to be in the sentence — without it the summary below is the honest answer, since a reader cannot act
  // on "allowlist" alone.
  if ((/allowed origins|allowlist|refuză originea/i.test(detail)) && /https?:\/\//i.test(detail)) return detail;
  if (/wc-bundle|project id|allowlist|relay/i.test(detail)) {
    return 'Serverul nu poate deschide conexiunea WalletConnect acum. Verifică Project ID-ul și originea în WalletConnect Dashboard.';
  }
  // The page's own timeouts ("xPortal nu a răspuns în 3 minute", "…a expirat"); a server sentence
  // about an expired *token* is not a timeout and is printed as the server wrote it.
  if (/nu a răspuns|timed out/i.test(detail) || (/expirat/i.test(detail) && /xPortal|WalletConnect|pairing|semnătur|conectare/i.test(detail))) {
    return 'xPortal nu a răspuns la timp. Deschide xPortal și încearcă din nou.';
  }
  return detail || 'Conectarea xPortal a eșuat.';
}

/**
 * What survives a process kill.
 *
 * The pairing cannot survive: it lives in the bridge page's WalletConnect client, which dies with the
 * app. What can be kept is the fact that an attempt was running, so the next open says "the last one
 * was interrupted, starting a new one" instead of silently pretending nothing happened. Only the
 * pairing topic is stored — never the URI, which carries the symmetric key.
 */
export type XPortalAttempt = { topic: string; phase: string; startedAt: number };

/** Older than this, an interrupted attempt cannot still be waiting; xPortal's pairing expires too. */
export const XPORTAL_ATTEMPT_MAX_AGE_MS = 10 * 60 * 1000;

export function isXPortalAttemptFinished(phase: string): boolean {
  return /^(complete|failed|token)$/.test(String(phase || '').trim());
}

/** A record for a fresh attempt, or null when the topic is not a pairing topic. */
export function xPortalAttemptRecord(topic: string, phase: string, now = Date.now()): XPortalAttempt | null {
  const value = String(topic || '').trim();
  if (!/^[A-Za-z0-9:_-]{8,128}$/.test(value)) return null;
  return { topic: value, phase: String(phase || 'pairing').trim().slice(0, 24), startedAt: now };
}

/** '' when there is nothing to tell, otherwise the sentence printed before the new attempt. */
export function describeInterruptedAttempt(value: unknown, now = Date.now()): string {
  if (!value || typeof value !== 'object') return '';
  const record = value as Partial<XPortalAttempt>;
  if (typeof record.topic !== 'string' || !record.topic) return '';
  if (typeof record.startedAt !== 'number' || !Number.isFinite(record.startedAt)) return '';
  if (isXPortalAttemptFinished(String(record.phase || ''))) return '';
  const age = now - record.startedAt;
  if (age < 0 || age > XPORTAL_ATTEMPT_MAX_AGE_MS) return '';
  const minutes = Math.max(1, Math.round(age / 60000));
  return `Ultima conectare cu xPortal a fost întreruptă acum ${minutes} min (sistemul a oprit aplicația). Pornesc una nouă — aprobă în xPortal când apare.`;
}
