/**
 * The publishing details a post carries, with the same acceptance rules the server applies.
 *
 * `apps/nexus-web/lib/post-publishing.js` normalizes `body.publishing` before the post row is
 * written and answers `400 PUBLISHING_INVALID` / `PUBLISHING_TAGS_INVALID` / `PUBLISHING_LINK_INVALID`
 * when the shape drifts. The native editor validates the exact same way *before* the request, so a
 * user never uploads 20 MB and only then learns that the link was not https.
 */

export type LocationPrecision = 'exact' | 'area' | 'city';

export type PublishingDetails = {
  title: string;
  location: string;
  locationPrecision: LocationPrecision;
  link: string;
  taggedUserIds: number[];
  allowComments: boolean;
  allowRepost: boolean;
  allowDownload: boolean;
  watermark: boolean;
  saveToDevice: boolean;
};

export type PublishingErrorCode = 'PUBLISHING_INVALID' | 'PUBLISHING_TAGS_INVALID' | 'PUBLISHING_LINK_INVALID' | 'CAPTION_FULL';

export class PublishingError extends Error {
  constructor(readonly code: PublishingErrorCode, message: string) {
    super(message);
    this.name = 'PublishingError';
  }
}

export const PUBLISHING_DEFAULTS: PublishingDetails = {
  title: '',
  location: '',
  locationPrecision: 'area',
  link: '',
  taggedUserIds: [],
  allowComments: true,
  allowRepost: true,
  allowDownload: true,
  watermark: true,
  saveToDevice: false,
};

/** The caps `normalizePublishing` enforces, plus the caption cap `sanitizeText(body.caption, 2000)` keeps. */
export const PUBLISHING_LIMITS = {
  title: 100,
  location: 120,
  link: 2048,
  taggedUsers: 20,
  caption: 2000,
  /** The editor accepts a little more than the server keeps, so a paste is not silently truncated. */
  captionInput: 2200,
} as const;

const BOOLEAN_KEYS = ['allowComments', 'allowRepost', 'allowDownload', 'watermark', 'saveToDevice'] as const;
const PRECISIONS: readonly string[] = ['exact', 'area', 'city'];
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i;

/** Hermes implements `normalize`; the fallback keeps an exotic runtime from breaking a publish. */
function nfkc(value: string): string {
  try { return value.normalize('NFKC'); } catch { return value; }
}

export function emptyPublishing(): PublishingDetails {
  return { ...PUBLISHING_DEFAULTS };
}

/**
 * Strict normalization, rule for rule with the server: unknown keys are refused instead of dropped,
 * so a typo in a field name is a caught bug rather than a silently ignored setting.
 */
export function normalizePublishing(value: unknown = {}): PublishingDetails {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PublishingError('PUBLISHING_INVALID', 'Detaliile de publicare nu sunt valide.');
  }
  const source = value as Record<string, unknown>;
  if (Object.keys(source).some((key) => !Object.hasOwn(PUBLISHING_DEFAULTS, key))) {
    throw new PublishingError('PUBLISHING_INVALID', 'Detaliile de publicare conțin câmpuri necunoscute.');
  }
  const result: PublishingDetails = { ...PUBLISHING_DEFAULTS, ...(source as Partial<PublishingDetails>) };
  for (const [key, max] of [['title', PUBLISHING_LIMITS.title], ['location', PUBLISHING_LIMITS.location], ['link', PUBLISHING_LIMITS.link]] as const) {
    const raw = result[key];
    if (typeof raw !== 'string' || raw.length > max) {
      throw new PublishingError('PUBLISHING_INVALID', `Câmpul „${key}” trebuie să aibă cel mult ${max} caractere.`);
    }
    result[key] = nfkc(raw).trim();
  }
  if (!PRECISIONS.includes(result.locationPrecision)) {
    throw new PublishingError('PUBLISHING_INVALID', 'Precizia locației nu este validă.');
  }
  for (const key of BOOLEAN_KEYS) {
    if (typeof result[key] !== 'boolean') throw new PublishingError('PUBLISHING_INVALID', `Opțiunea „${key}” nu este validă.`);
  }
  if (!Array.isArray(result.taggedUserIds) || result.taggedUserIds.length > PUBLISHING_LIMITS.taggedUsers
    || result.taggedUserIds.some((id) => !Number.isSafeInteger(id) || id < 1)) {
    throw new PublishingError('PUBLISHING_TAGS_INVALID', `Poți eticheta cel mult ${PUBLISHING_LIMITS.taggedUsers} persoane.`);
  }
  result.taggedUserIds = [...new Set(result.taggedUserIds)];
  if (result.link) {
    let url: URL;
    try { url = new URL(result.link); } catch {
      throw new PublishingError('PUBLISHING_LINK_INVALID', 'Linkul trebuie să fie o adresă HTTPS validă.');
    }
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') || PRIVATE_HOST.test(url.hostname)) {
      throw new PublishingError('PUBLISHING_LINK_INVALID', 'Linkul trebuie să fie o adresă HTTPS publică.');
    }
    result.link = url.href;
  }
  return result;
}

/**
 * The tolerant reader for a stored draft: a draft written by an older build must still open, so
 * unknown or wrongly typed members fall back to the defaults instead of failing the whole editor.
 */
export function readPublishing(value: unknown): PublishingDetails {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyPublishing();
  const source = value as Record<string, unknown>;
  const result = emptyPublishing();
  for (const key of ['title', 'location', 'link'] as const) {
    if (typeof source[key] === 'string') result[key] = nfkc(source[key] as string).slice(0, PUBLISHING_LIMITS[key]).trim();
  }
  if (typeof source.locationPrecision === 'string' && PRECISIONS.includes(source.locationPrecision)) {
    result.locationPrecision = source.locationPrecision as LocationPrecision;
  }
  for (const key of BOOLEAN_KEYS) if (typeof source[key] === 'boolean') result[key] = source[key] as boolean;
  if (Array.isArray(source.taggedUserIds)) {
    const ids = source.taggedUserIds.filter((id): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0);
    result.taggedUserIds = [...new Set(ids)].slice(0, PUBLISHING_LIMITS.taggedUsers);
  }
  return result;
}

/**
 * Appends a hashtag or a mention to the caption the way the composer does on the web: the token is
 * never duplicated and never cut in half, and the caption keeps its own 2000 character budget.
 */
export function captionWithToken(caption: string, token: string, limit: number = PUBLISHING_LIMITS.caption): string {
  const clean = String(token).replace(/\s+/g, '').slice(0, 120);
  if (!clean) return caption;
  const current = nfkc(String(caption)).slice(0, limit);
  const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'i').test(current)) return current;
  const next = current ? `${current}${current.endsWith(' ') ? '' : ' '}${clean}` : clean;
  if (next.length > limit) {
    throw new PublishingError('CAPTION_FULL', `Descrierea este plină (${limit} caractere); șterge text înainte de a adăuga încă o etichetă.`);
  }
  return next;
}
