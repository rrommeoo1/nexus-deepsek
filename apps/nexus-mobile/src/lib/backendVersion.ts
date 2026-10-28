/**
 * Which server is answering, asked *before* the app hands it a page.
 *
 * `GET /api/version` is the server naming itself: the commit it was built from, a fingerprint of its
 * source, and a map of what it can store (`apps/nexus-web/lib/build-info.js`). This app needs that
 * answer because of a defect that cost a real publication: on 26 October 2026 the phone sent an
 * authored page to a Railway deployment from 6 October. The old build kept the caption and the
 * photographs, discarded `text_style` — the theme and the blocks of the page — and answered `ok: true`
 * (`JUNGLE_BOOK_PROGRESS.md` §15.3). `publishClient.ts` now refuses to call that answer a publication
 * (`PUBLISH_TEXT_STYLE_LOST`), but refusing *after* the post is written is the second-best ending: the
 * words are already in the feed without the page they were laid out on. This file asks first.
 *
 * Three rules hold everything here:
 *
 * - a capability carries a number, so a later build can demand version 2 of the same field without the
 *   phone having to reason about what a commit hash contains;
 * - an unanswered question is not a permission — no version means no capability, and a page that needs
 *   one is not sent;
 * - the route is public and the answer is cached for five minutes, so a publish loop does not ask on
 *   every keystroke, while a server that redeploys mid-session is met by a fresh answer soon after.
 */
import { API_ORIGIN } from './apiOrigin';

/** The contract these fields follow, as `build-info.js` publishes it in `api_contract`. */
export const API_CONTRACT = 1;
export const VERSION_PATH = '/api/version';

/**
 * What an authored page needs from the server: somewhere to keep the look (`text_style`) and somewhere
 * to keep the order, placement and widths of its blocks (`editorial_document`). Both, or the page the
 * author arranged is not the page the reader sees — which is exactly the failure that has no error
 * message, because the server answers 200.
 */
export const PAGE_CAPABILITIES: Readonly<Record<string, number>> = Object.freeze({
  text_style: 1,
  editorial_document: 1,
});

export type BackendVersion = {
  readonly apiContract: number;
  /** The commit the deployment was built from, or `null` when it cannot name itself. */
  readonly commit: string | null;
  readonly commitShort: string | null;
  /** Which variable (or `git-head`, or `unavailable`) the commit came from. */
  readonly commitSource: string;
  readonly builtAt: string | null;
  /** SHA-256 of the server's own source: two deployments are the same build if these match. */
  readonly fingerprint: string | null;
  readonly capabilities: Readonly<Record<string, number>>;
  readonly runtime: string | null;
};

/**
 * The **number** behind `text_style`, and the one question it answers.
 *
 * `1` is the first allowlist: three faces (`serif`, `sans`, `mono`) and three measures. `2` is the
 * composer's full list — the three faces the owner's own phone draws differently (`slab` /
 * „Mașină", `casual` / „De mână", `condensed` / „Îngust") and the fourth measure (`xlarge`). Every
 * id below is a literal copy of the allowlist in `lib/textStyle.ts`, and `scripts/test-text-faces.cjs`
 * fails if the two lists ever disagree: a capability name that says `2` while the server refuses
 * `slab` would be exactly the lie this file exists to prevent.
 *
 * The version is not a formality. On 28 October 2026 the owner wrote a page in „Mașină" and the
 * server answered *„Stilul textului nu este acceptat de server. Alege o temă din listă și reia."* —
 * a sentence about the theme, for a face the build in front of the phone had never heard of. The
 * theme was fine; the server was old. Asking `text_style >= 2` is how the phone learns that
 * *before* it sends the page, and can say which face is missing.
 */
export const TEXT_STYLE_CAPABILITY = 'text_style';
/** The version of `text_style` that stores the six faces and `xlarge`. */
export const TEXT_STYLE_CAPABILITY_V2 = 2;
/** Faces only a `text_style: 2` server can store. */
export const TEXT_STYLE_V2_FONTS: readonly string[] = Object.freeze(['slab', 'casual', 'condensed']);
/** Measures only a `text_style: 2` server can store. */
export const TEXT_STYLE_V2_SIZES: readonly string[] = Object.freeze(['xlarge']);
/** How each of those faces is named to the author — the labels of `TEXT_FONTS` in `lib/textStyle.ts`. */
export const TEXT_STYLE_V2_FONT_LABELS: Readonly<Record<string, string>> = Object.freeze({
  slab: 'Mașină',
  casual: 'De mână',
  condensed: 'Îngust',
});

export type BackendVersionErrorCode =
  | 'BACKEND_VERSION_UNREACHABLE'
  | 'BACKEND_VERSION_UNREADABLE'
  | 'BACKEND_OUTDATED'
  | 'BACKEND_TEXT_STYLE_OLDER';

export class BackendVersionError extends Error {
  constructor(
    readonly code: BackendVersionErrorCode,
    message: string,
    readonly status = 0,
  ) {
    super(message);
    this.name = 'BackendVersionError';
  }
}

/**
 * The words for each refusal. They are full Romanian sentences because they are shown to the author as
 * they are (the editor prints `error.message` for this error, exactly as it does for an upload refusal),
 * and each one says what happened to the draft: nothing left the phone.
 */
const MESSAGES: Record<BackendVersionErrorCode, string> = {
  BACKEND_VERSION_UNREACHABLE: 'Serverul nu a răspuns când a fost întrebat ce versiune rulează, deci pagina nu a fost trimisă. Textul rămâne salvat pe telefon; reia când ai semnal.',
  BACKEND_VERSION_UNREADABLE: 'Serverul a răspuns, dar nu a spus ce versiune rulează, deci pagina nu a fost trimisă. Textul rămâne salvat pe telefon; reia după ce serverul este actualizat.',
  BACKEND_OUTDATED: 'Serverul rulează o versiune mai veche decât aplicația și nu știe să păstreze tema și aranjamentul paginii, deci postarea nu a fost trimisă. Textul rămâne salvat pe telefon; publică după ce serverul este actualizat.',
  BACKEND_TEXT_STYLE_OLDER: 'Serverul rulează o versiune mai veche decât aplicația și nu cunoaște litera aleasă, deci pagina nu a fost trimisă. Textul rămâne salvat pe telefon: alege Serif, Sans sau Mono, ori publică după ce serverul este actualizat.',
};

const HASH = /^[0-9a-f]{7,40}$/;
const FINGERPRINT = /^[0-9a-f]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * The answer as a value, or `null` when it is not one.
 *
 * A malformed capability map is refused whole rather than read in part: a server that answers
 * `{"text_style": "yes"}` has not told us that it can keep a page, and guessing yes would produce a
 * publication without its layout — the one outcome this file exists to prevent.
 */
export function readBackendVersion(answer: unknown): BackendVersion | null {
  const record = isRecord(answer) ? answer : null;
  if (!record || record.ok !== true) return null;
  const contract = Number(record.api_contract);
  if (!Number.isInteger(contract) || contract < 1) return null;
  const map = isRecord(record.capabilities) ? record.capabilities : null;
  if (!map) return null;
  const capabilities: Record<string, number> = {};
  for (const [name, value] of Object.entries(map)) {
    const version = Number(value);
    if (!Number.isInteger(version) || version < 0) return null;
    capabilities[name] = version;
  }
  const commit = typeof record.commit === 'string' && HASH.test(record.commit.trim())
    ? record.commit.trim().toLowerCase()
    : null;
  return {
    apiContract: contract,
    commit,
    commitShort: typeof record.commit_short === 'string' && HASH.test(record.commit_short.trim())
      ? record.commit_short.trim().toLowerCase()
      : (commit ? commit.slice(0, 7) : null),
    commitSource: typeof record.commit_source === 'string' && record.commit_source.trim()
      ? record.commit_source.trim()
      : 'unavailable',
    builtAt: typeof record.built_at === 'string' && !Number.isNaN(new Date(record.built_at).getTime())
      ? record.built_at
      : null,
    fingerprint: typeof record.source_fingerprint === 'string' && FINGERPRINT.test(record.source_fingerprint)
      ? record.source_fingerprint
      : null,
    capabilities: Object.freeze(capabilities),
    runtime: typeof record.runtime === 'string' && record.runtime.trim() ? record.runtime.trim() : null,
  };
}

/** The version this server advertises for `name`, or `0` — never a version, always the absence of one. */
export function capabilityVersion(version: BackendVersion | null, name: string): number {
  const value = version ? version.capabilities[name] : 0;
  return Number.isInteger(value) && value >= 1 ? Number(value) : 0;
}

/** Whether the server can do `name` at least at `minimum`. A server that was never asked cannot. */
export function hasCapability(version: BackendVersion | null, name: string, minimum = 1): boolean {
  return capabilityVersion(version, name) >= Math.max(1, minimum);
}

/** What of `required` this server cannot do, in the order it was asked for. */
export function missingCapabilities(
  version: BackendVersion | null,
  required: Readonly<Record<string, number>> = PAGE_CAPABILITIES,
): string[] {
  return Object.entries(required)
    .filter(([name, minimum]) => !hasCapability(version, name, minimum))
    .map(([name]) => name);
}

/** Whether a page published to this server comes back as the page it was arranged on. */
export function supportsPage(version: BackendVersion | null): boolean {
  return missingCapabilities(version).length === 0;
}

export type VersionOptions = {
  /** The server to ask; `API_ORIGIN` unless a build points somewhere else. */
  origin?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** The clock the cache is kept on; only a test sets it. */
  now?: number;
  /** Ask again instead of trusting an answer less than five minutes old. */
  fresh?: boolean;
};

/** How long an answer is trusted: long enough to not ask on every keystroke, short enough to notice a redeploy. */
const CACHE_TTL_MS = 5 * 60_000;
/** A version question must never be the reason the publish button hangs. */
const REQUEST_TIMEOUT_MS = 4_000;

let cached: { version: BackendVersion; at: number } | null = null;

/** Forget what was asked: a deployment changed under this process, or a test's first act. */
export function resetBackendVersionCache(): void {
  cached = null;
}

/**
 * The one request of this file.
 *
 * Deliberately no cookie and no `credentials: 'include'`: the route is public, and an answer about the
 * build must never depend on who is signed in — the app asks it before it knows.
 */
async function ask(url: string, options: VersionOptions): Promise<Response> {
  const timeout = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller && timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null;
  const relay = () => controller?.abort();
  options.signal?.addEventListener?.('abort', relay);
  try {
    return await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller ? controller.signal : options.signal,
    });
  } finally {
    if (timer) clearTimeout(timer);
    options.signal?.removeEventListener?.('abort', relay);
  }
}

/**
 * What the server says about itself, from the cache when the answer is recent.
 *
 * Throws `BACKEND_VERSION_UNREACHABLE` when nothing came back and `BACKEND_VERSION_UNREADABLE` when
 * something came back that is not a version (a deployment older than this route answers 401 to it,
 * because unknown routes go through `requireAuth`). It never invents an answer.
 */
export async function fetchBackendVersion(options: VersionOptions = {}): Promise<BackendVersion> {
  const now = options.now ?? Date.now();
  if (!options.fresh && cached && now - cached.at < CACHE_TTL_MS) return cached.version;
  const origin = (options.origin ?? API_ORIGIN).replace(/\/+$/, '');
  let response: Response;
  try {
    response = await ask(`${origin}${VERSION_PATH}`, options);
  } catch {
    throw new BackendVersionError('BACKEND_VERSION_UNREACHABLE', MESSAGES.BACKEND_VERSION_UNREACHABLE);
  }
  const answer: unknown = await response.json().catch(() => null);
  const version = response.ok ? readBackendVersion(answer) : null;
  if (!version) {
    throw new BackendVersionError('BACKEND_VERSION_UNREADABLE', MESSAGES.BACKEND_VERSION_UNREADABLE, response.status);
  }
  cached = { version, at: now };
  return version;
}

/**
 * The question the TEXT editor asks before it uploads a single byte.
 *
 * It throws when the server *answered* and cannot keep a page: `BACKEND_OUTDATED` names the missing
 * capabilities, `BACKEND_VERSION_UNREADABLE` is the older deployment that does not have the route at
 * all. Both mean the same thing to the author — the page would be published as a caption with
 * photographs — and both happen before the media is uploaded, so nothing is left behind on a server
 * that cannot use it.
 *
 * A server that did not answer at all returns `null` rather than throwing: silence is not a refusal,
 * the POST would fail on the same connection, and `publishPost` still refuses to confirm a page that
 * came back without its layout (`PUBLISH_TEXT_STYLE_LOST`) — the net stays under both.
 *
 * The answer is asked fresh once per publication: a cached "yes" from before the server was rolled
 * back is precisely the answer that must not be trusted at this moment.
 */
export async function requirePageCapabilities(options: VersionOptions = {}): Promise<BackendVersion | null> {
  let version: BackendVersion;
  try {
    version = await fetchBackendVersion({ ...options, fresh: options.fresh ?? true });
  } catch (error) {
    if (error instanceof BackendVersionError && error.code === 'BACKEND_VERSION_UNREACHABLE') return null;
    throw error;
  }
  const missing = missingCapabilities(version);
  if (missing.length) {
    throw new BackendVersionError(
      'BACKEND_OUTDATED',
      `${MESSAGES.BACKEND_OUTDATED} Lipsește: ${missing.join(', ')}.`,
    );
  }
  return version;
}

/**
 * Whether this page needs the *second* allowlist of `text_style`.
 *
 * Only the three faces and the one measure that were added after the first contract need it: a page
 * set in `serif`, `sans` or `mono` at `small`/`medium`/`large` publishes to a `text_style: 1` server
 * exactly as it always did, which is what keeps an older deployment usable for ordinary pages instead
 * of turning every publication into a version fight.
 */
export function textStyleNeedsV2(style?: { font?: unknown; size?: unknown } | null): boolean {
  if (!style) return false;
  const font = typeof style.font === 'string' ? style.font : '';
  const size = typeof style.size === 'string' ? style.size : '';
  return TEXT_STYLE_V2_FONTS.includes(font) || TEXT_STYLE_V2_SIZES.includes(size);
}

/**
 * The face (or measure) an older server cannot store, named the way the author chose it.
 *
 * `Mașină` rather than `slab`: the sentence is read by the person who pressed the chip, and the chip
 * says „Mașină". The id is kept beside it in parentheses for whoever reads the log.
 */
export function textStyleV2Refusal(style?: { font?: unknown; size?: unknown } | null): string {
  const font = typeof style?.font === 'string' ? style.font : '';
  if (TEXT_STYLE_V2_FONTS.includes(font)) {
    const label = TEXT_STYLE_V2_FONT_LABELS[font] ?? font;
    return `litera „${label}" (${font})`;
  }
  const size = typeof style?.size === 'string' ? style.size : '';
  if (TEXT_STYLE_V2_SIZES.includes(size)) return `mărimea „${size}"`;
  return '';
}

/**
 * The question asked before a page set in „Mașină" (or „De mână", „Îngust", `xlarge`) is sent.
 *
 * Three answers, and only one of them blocks:
 *
 * - the server answered `text_style >= 2` — send it;
 * - the server answered a lower version — refuse here, in a sentence that names the face, because the
 *   POST would be refused anyway (`TEXT_STYLE_INVALID`, which the editor can only print as a generic
 *   *„Alege o temă din listă"* — a sentence about the wrong field, and the defect of 28 October 2026);
 * - the server did not answer at all — `null`, not a refusal. Silence is the same connection the POST
 *   would use, `requirePageCapabilities` has the same rule, and turning a network hiccup into a
 *   blocked publication would be a second defect in the name of the first.
 *
 * A page that needs no v2 field returns immediately: no request, no cache entry, no new way to fail.
 */
export async function requireTextStyleContract(
  style?: { font?: unknown; size?: unknown } | null,
  options: VersionOptions = {},
): Promise<BackendVersion | null> {
  if (!textStyleNeedsV2(style)) return null;
  let version: BackendVersion;
  try {
    version = await fetchBackendVersion({ ...options, fresh: options.fresh ?? true });
  } catch (error) {
    if (error instanceof BackendVersionError && error.code === 'BACKEND_VERSION_UNREACHABLE') return null;
    throw error;
  }
  if (hasCapability(version, TEXT_STYLE_CAPABILITY, TEXT_STYLE_CAPABILITY_V2)) return version;
  const refused = textStyleV2Refusal(style);
  throw new BackendVersionError(
    'BACKEND_TEXT_STYLE_OLDER',
    `${MESSAGES.BACKEND_TEXT_STYLE_OLDER} Serverul cunoaște ${TEXT_STYLE_CAPABILITY} v${capabilityVersion(version, TEXT_STYLE_CAPABILITY)}, pagina are nevoie de v${TEXT_STYLE_CAPABILITY_V2}${refused ? ` (${refused})` : ''}.`,
  );
}
