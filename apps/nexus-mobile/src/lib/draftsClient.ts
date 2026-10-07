/**
 * The remote draft backup: `/api/creator/drafts`.
 *
 * The web keeps a draft twice — in IndexedDB on the device (`public/creator-draft-sync.js`,
 * `bindDraftBackup`) and, when the user asks for it, in the account (`lib/creator-drafts.js`). This
 * module is the native half of the second copy and mirrors both files:
 *
 * - `lib/creator-drafts.js` owns the wire contract (`GET|PUT|DELETE`, the 20 draft and 11 media
 *   caps, the exact `FIELDS` allowlist, the `403` for a media object without an upload grant);
 * - `public/creator-draft-sync.js` owns the client behaviour (`syncCreatorDraft` uploads the source
 *   and the audio first, then `PUT`s `{mode, fields, media}` with a per-write idempotency key, and
 *   reports "Copie locală păstrată" when the online copy could not be written).
 *
 * What is deliberately *not* ported: `hydrateRemoteDraft`. Downloading a backup back into the editor
 * only makes sense together with a draft library screen, and on this client the capture itself is
 * still on the device — the local manifest stays the source of truth, and the account copy is the
 * backup. `GET` is ported so the editor can say honestly whether a copy exists in the account.
 */

import { File } from 'expo-file-system';
import { API_ORIGIN } from './apiOrigin';
import type { PublishingDetails } from './publishing';
import type { ContentProvenance, CreatorAudioRights, PostVisibility } from './publishClient';
import { authHeaders } from './session';
import {
  uploadMediaResumable, type UploadProgress, type UploadPurpose, type UploadSource, type UploadedMedia,
} from './uploadClient';

/** `count>=20` answers `409`; the client stays one draft under the server's own ceiling. */
export const DRAFT_LIMIT = 20;
/** `media.length>11` answers `400 Draft invalid`. */
export const DRAFT_MEDIA_LIMIT = 11;
export const DRAFT_TEXT_LIMIT = 2000;
export const DRAFT_LONG_TEXT_LIMIT = 24000;
export const DRAFT_NAME_LIMIT = 120;
export const DRAFT_MIME_LIMIT = 80;

/**
 * The id rule `public/creator-draft-sync.js:4` enforces (`draft-[a-z0-9-]{8,70}`), which is also the
 * stricter half of the server's own route pattern (`[a-z0-9-]{8,80}`).
 */
export const CREATOR_DRAFT_ID = /^draft-[a-z0-9-]{8,70}$/;

/** `FIELDS` of `lib/creator-drafts.js`: a key outside this set refuses the whole write with `400`. */
export const DRAFT_FIELDS: ReadonlySet<string> = new Set([
  'caption', 'title', 'visibility', 'language', 'provenance', 'persistent', 'duration_hours',
  'studio_aspect', 'studio_filter', 'studio_intensity', 'trim_start', 'trim_end', 'playback_rate',
  'mute_original', 'overlay_text', 'overlay_position', 'overlay_color', 'audio_rights',
  'audio_attribution', 'studio_decorations', 'publishing_json', 'jamendo_track', 'studio_transform',
]);

/** The three fields the server allows to carry 24000 characters instead of 2000. */
export const DRAFT_LONG_FIELDS: ReadonlySet<string> = new Set(['studio_decorations', 'publishing_json', 'jamendo_track']);

export type DraftFieldValue = string | number | boolean;
export type DraftRole = 'source' | 'audio';
export type DraftMode = 'post' | 'story';

/** A media row of the draft, exactly as `lib/creator-drafts.js:36` stores it. */
export type DraftMediaRef = { hash: string; ext: string; role: DraftRole; name: string; mime: string };

/** One `drafts[]` row of the `GET` answer. */
export type RemoteDraft = {
  id: string;
  mode: DraftMode;
  updatedAt: number;
  fields: Record<string, DraftFieldValue>;
  media: DraftMediaRef[];
};

/** The `"<userId>:<persona>"` scope every upload session and resume record is bound to. */
export function draftScope(userId: number, persona: string): string {
  return `${Number(userId)}:${persona}`;
}

export class DraftError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 0,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'DraftError';
  }
}

const DRAFT_MESSAGES: Record<string, string> = {
  DRAFT_ID_INVALID: 'Draftul nu are un identificator acceptat de server. Reia din captură.',
  DRAFT_FIELDS_INVALID: 'Draftul conține un câmp pe care serverul nu îl acceptă.',
  DRAFT_MEDIA_INVALID: 'Fișierul din draft nu aparține acestui cont pentru scopul cerut. Reia încărcarea.',
  DRAFT_AUTH: 'Sesiunea a expirat. Copia în cont nu a putut fi salvată; draftul rămâne pe telefon.',
  DRAFT_RATE_LIMITED: 'Prea multe acțiuni într-un minut. Așteaptă puțin și reia salvarea în cont.',
  DRAFT_LIMIT: `Ai deja ${DRAFT_LIMIT} drafturi în cont. Șterge unul pentru a continua.`,
  DRAFT_NETWORK: 'Rețeaua nu a răspuns. Draftul rămâne pe telefon; reia salvarea în cont.',
  DRAFT_CANCELLED: 'Salvarea în cont a fost oprită. Draftul rămâne pe telefon.',
  DRAFT_SERVER: 'Serverul a refuzat salvarea în cont. Draftul rămâne pe telefon; reia.',
  DRAFT_VERIFY_FAILED: 'Serverul a răspuns, dar copia din cont nu a putut fi confirmată. Reia salvarea.',
};

export function draftFailure(code: string, status = 0, retryable = false): DraftError {
  return new DraftError(code, DRAFT_MESSAGES[code] ?? DRAFT_MESSAGES.DRAFT_SERVER, status, retryable);
}

/** One Romanian sentence for every way the account copy can fail. */
export function draftErrorMessage(error: unknown): string {
  if (error instanceof DraftError) return error.message;
  if (error instanceof Error && DRAFT_MESSAGES[error.message]) return DRAFT_MESSAGES[error.message];
  return 'Draftul nu a putut fi salvat în cont. Copia de pe telefon rămâne intactă; reia.';
}

/**
 * The draft id of a capture, derived from the capture file name so that the same capture always
 * writes to the same account row (a re-save updates the draft instead of filling the 20-draft
 * ceiling with copies). The capture names this app writes are unique — timestamp, kind, framing and
 * six random characters — and their slug is always 14..76 characters of `[a-z0-9-]`.
 */
export function creatorDraftId(captureName: string): string {
  const slug = String(captureName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
  const id = `draft-${slug}`;
  if (!CREATOR_DRAFT_ID.test(id)) {
    throw new DraftError('DRAFT_ID_INVALID', DRAFT_MESSAGES.DRAFT_ID_INVALID);
  }
  return id;
}

/** The key `public/creator-draft-sync.js:69` sends: one key per local edit, reused on a retry. */
export function draftMutationKey(id: string, updatedAt: number): string {
  return `draft-${id}-${Number(updatedAt)}`;
}

/** The `fields` rules of `lib/creator-drafts.js:26`, checked before the request so nothing is lost. */
export function draftFieldsAreValid(fields: Record<string, DraftFieldValue>): boolean {
  return Object.entries(fields).every(([key, value]) => DRAFT_FIELDS.has(key)
    && (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number')
    && (typeof value !== 'string'
      || value.length <= (DRAFT_LONG_FIELDS.has(key) ? DRAFT_LONG_TEXT_LIMIT : DRAFT_TEXT_LIMIT)));
}

/** The per-item rules of `lib/creator-drafts.js:29`. */
export function draftMediaIsValid(item: DraftMediaRef): boolean {
  return /^[a-f0-9]{64}$/.test(item.hash)
    && /^[a-z0-9]{2,5}$/.test(item.ext)
    && (item.role === 'source' || item.role === 'audio')
    && item.name.length <= DRAFT_NAME_LIMIT
    && item.mime.length <= DRAFT_MIME_LIMIT;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readFields(value: unknown): Record<string, DraftFieldValue> | null {
  if (!isRecord(value)) return null;
  const fields: Record<string, DraftFieldValue> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' || typeof item === 'boolean' || typeof item === 'number') fields[key] = item;
  }
  return draftFieldsAreValid(fields) ? fields : null;
}

function readMedia(value: unknown): DraftMediaRef[] | null {
  if (!Array.isArray(value) || value.length > DRAFT_MEDIA_LIMIT) return null;
  const media: DraftMediaRef[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const ref: DraftMediaRef = {
      hash: String(item.hash ?? '').toLowerCase(),
      ext: String(item.ext ?? '').toLowerCase(),
      role: item.role === 'audio' ? 'audio' : 'source',
      name: String(item.name ?? 'media').slice(0, DRAFT_NAME_LIMIT),
      mime: String(item.mime ?? '').slice(0, DRAFT_MIME_LIMIT),
    };
    if (!draftMediaIsValid(ref)) return null;
    media.push(ref);
  }
  return media;
}

/**
 * The `GET` answer of `lib/creator-drafts.js:16`. `null` means the answer does not belong to the
 * account and profile that asked for it; rows that do not pass the same rules the server wrote them
 * with are dropped, exactly as the web's `safeDraftRecord` drops them.
 */
export function readRemoteDrafts(answer: unknown, expected: { userId: number; persona: string }): RemoteDraft[] | null {
  if (!isRecord(answer) || answer.ok !== true) return null;
  if (Number(answer.owner_id) !== Number(expected.userId) || answer.owner_persona !== expected.persona) return null;
  if (!Array.isArray(answer.drafts)) return null;
  const drafts: RemoteDraft[] = [];
  for (const row of answer.drafts) {
    if (!isRecord(row)) continue;
    const id = String(row.id ?? '');
    if (!CREATOR_DRAFT_ID.test(id)) continue;
    if (row.mode !== 'post' && row.mode !== 'story') continue;
    const updatedAt = Number(row.updatedAt);
    if (!Number.isSafeInteger(updatedAt) || updatedAt < 1) continue;
    const fields = readFields(row.fields);
    const media = readMedia(row.media ?? []);
    if (!fields || !media) continue;
    drafts.push({ id, mode: row.mode, updatedAt, fields, media });
  }
  return drafts;
}

type DraftRequestOptions = { signal?: AbortSignal };

/** One `fetch` for every call of this module: same headers, same abort and error translation. */
async function draftFetch(path: string, init: RequestInit, signal?: AbortSignal): Promise<{ status: number; answer: unknown }> {
  let response: Response;
  try {
    response = await fetch(`${API_ORIGIN}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
        ...authHeaders(),
      },
      signal,
    });
  } catch (error) {
    const name = error && typeof error === 'object' ? (error as { name?: string }).name : '';
    if (name === 'AbortError') throw draftFailure('DRAFT_CANCELLED', 0, true);
    throw draftFailure('DRAFT_NETWORK', 0, true);
  }
  const answer: unknown = await response.json().catch(() => null);
  return { status: response.status, answer };
}

/** The four refusals `lib/creator-drafts.js` can answer, by status and by its own `error` string. */
function draftFailureFromAnswer(answer: unknown, status: number): DraftError {
  const error = isRecord(answer) && typeof answer.error === 'string' ? answer.error : '';
  if (error === 'Draft media invalid') return draftFailure('DRAFT_MEDIA_INVALID', status);
  if (error === 'Draft invalid') return draftFailure('DRAFT_FIELDS_INVALID', status);
  if (status === 401) return draftFailure('DRAFT_AUTH', status);
  if (status === 403) return draftFailure('DRAFT_MEDIA_INVALID', status);
  if (status === 409) return draftFailure('DRAFT_LIMIT', status);
  if (status === 429) return draftFailure('DRAFT_RATE_LIMITED', status, true);
  if (status >= 500) return draftFailure('DRAFT_SERVER', status, true);
  return draftFailure('DRAFT_SERVER', status);
}

/**
 * The account copy of every draft of this profile, newest first — the same 20 rows `GET` answers.
 * The editor uses it only to state, honestly, whether a backup of the current capture exists.
 */
export async function fetchCreatorDrafts(
  expected: { userId: number; persona: string },
  options: DraftRequestOptions = {},
): Promise<RemoteDraft[]> {
  const { status, answer } = await draftFetch('/api/creator/drafts', { method: 'GET' }, options.signal);
  if (status !== 200) throw draftFailureFromAnswer(answer, status);
  const drafts = readRemoteDrafts(answer, expected);
  if (!drafts) throw draftFailure('DRAFT_VERIFY_FAILED', status);
  return drafts;
}

/** The size `expo-file-system` reports for a local object, or `0` when it cannot be read. */
export function localFileSize(uri: string): number {
  try {
    const file = new File(uri);
    return Number.isSafeInteger(file.size) && file.size > 0 ? file.size : 0;
  } catch { return 0; }
}

/**
 * Objects already uploaded by this session, keyed by scope, purpose, uri and size. Pressing "Salvează
 * în cont" twice — or publishing after a backup — must not upload 20 MB twice: `/complete` already
 * answered with the media row the next request references. The size is part of the key because a
 * changed object changes its size; an unknown size is never cached.
 */
const uploadedDrafts = new Map<string, UploadedMedia>();

export function forgetDraftUploads(): void {
  uploadedDrafts.clear();
}

export type DraftUploadRequest = {
  /** `"<userId>:<persona>"`, so a resumed session is never reused by another account or profile. */
  scope: string;
  purpose: UploadPurpose;
  source: UploadSource;
  mime?: string | null;
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
};

/** Uploads one object for a draft or for a publish, reusing an identical earlier upload. */
export async function uploadDraftMedia(request: DraftUploadRequest): Promise<UploadedMedia> {
  const size = Number(request.source.size ?? 0);
  const key = `${request.scope}|${request.purpose}|${request.source.uri}|${size}`;
  const cached = size > 0 ? uploadedDrafts.get(key) : undefined;
  if (cached) return cached;
  const media = await uploadMediaResumable(request.source, {
    purpose: request.purpose,
    scope: request.scope,
    mime: request.mime ?? null,
    signal: request.signal,
    onProgress: request.onProgress,
  });
  if (size > 0) {
    if (uploadedDrafts.size >= 32) uploadedDrafts.clear();
    uploadedDrafts.set(key, media);
  }
  return media;
}

/** The `media[]` row a draft or a post references, from the object `/complete` verified. */
export function draftMediaRef(media: UploadedMedia, role: DraftRole, name: string, mime: string): DraftMediaRef {
  return {
    hash: media.hash,
    ext: media.ext,
    role,
    name: String(name || 'media').slice(0, DRAFT_NAME_LIMIT),
    mime: String(mime || media.mime || '').slice(0, DRAFT_MIME_LIMIT),
  };
}

/** The `PUT` and `DELETE` answers of `lib/creator-drafts.js` name the row they wrote: verify it. */
function draftAnswerConfirms(answer: unknown, expected: { id: string; userId: number; persona: string }): boolean {
  return isRecord(answer) && answer.ok === true && answer.id === expected.id
    && Number(answer.owner_id) === Number(expected.userId) && answer.owner_persona === expected.persona;
}

export type DraftWriteRequest = {
  id: string;
  mode: DraftMode;
  fields: Record<string, DraftFieldValue>;
  media: DraftMediaRef[];
  /** `draftMutationKey(id, updatedAt)`: the same key while nothing changed, a new one on every edit. */
  key: string;
  expected: { userId: number; persona: string };
  signal?: AbortSignal;
};

/**
 * Writes (or overwrites) the account copy: `PUT /api/creator/drafts/<id>` with `{mode, fields, media}`.
 * `lib/creator-drafts.js` refuses an unknown field, a media object without an upload grant for the
 * right purpose, and a twenty-first draft; all three are checked here first so the refusal carries a
 * sentence the user can act on instead of a bare `400`.
 */
export async function saveCreatorDraft(request: DraftWriteRequest): Promise<void> {
  if (!CREATOR_DRAFT_ID.test(request.id)) {
    throw new DraftError('DRAFT_ID_INVALID', DRAFT_MESSAGES.DRAFT_ID_INVALID);
  }
  if (!draftFieldsAreValid(request.fields)) {
    throw new DraftError('DRAFT_FIELDS_INVALID', DRAFT_MESSAGES.DRAFT_FIELDS_INVALID);
  }
  if (request.media.length > DRAFT_MEDIA_LIMIT || request.media.some((item) => !draftMediaIsValid(item))) {
    throw new DraftError('DRAFT_MEDIA_INVALID', DRAFT_MESSAGES.DRAFT_MEDIA_INVALID);
  }
  const { status, answer } = await draftFetch(`/api/creator/drafts/${request.id}`, {
    method: 'PUT',
    headers: { 'Idempotency-Key': request.key },
    body: JSON.stringify({ mode: request.mode, fields: request.fields, media: request.media }),
  }, request.signal);
  if (status !== 200) throw draftFailureFromAnswer(answer, status);
  const expected = { ...request.expected, id: request.id };
  if (!draftAnswerConfirms(answer, expected)) throw draftFailure('DRAFT_VERIFY_FAILED', status);
}

/**
 * Removes the account copy, exactly as the web does after a published post (`app.js:7433`). A
 * failure is reported as `false` instead of thrown: the post is already published by then, and a
 * leftover backup must never be shown as a failed publication.
 */
export async function deleteCreatorDraft(
  id: string,
  expected: { userId: number; persona: string },
  options: DraftRequestOptions = {},
): Promise<boolean> {
  if (!CREATOR_DRAFT_ID.test(id)) return false;
  try {
    const { status, answer } = await draftFetch(`/api/creator/drafts/${id}`, { method: 'DELETE' }, options.signal);
    return status === 200 && draftAnswerConfirms(answer, { ...expected, id });
  } catch { return false; }
}

/**
 * The `overlay_position` the web's studio expects — `TOP|CENTER|BOTTOM`, from
 * `creator-studio-markup.js:8`. The native editor moves the text freely, so the nearest of the three
 * is written online and the exact position stays in the local draft.
 */
export function overlayPosition(y: number): 'TOP' | 'CENTER' | 'BOTTOM' {
  if (!Number.isFinite(y) || y > 0.66) return 'BOTTOM';
  if (y < 0.34) return 'TOP';
  return 'CENTER';
}

export type DraftFieldSource = {
  caption: string;
  visibility: PostVisibility;
  provenance: ContentProvenance;
  publishing: PublishingDetails;
  overlayText: string;
  overlayY: number;
  /** Only when an audio file was uploaded with the draft; the declaration is then required. */
  audioRights?: CreatorAudioRights | null;
  audioAttribution?: string | null;
  /** The catalog track, serialized the way the web's composer keeps it in `jamendo_track`. */
  jamendoTrack?: Record<string, unknown> | null;
};

/**
 * The `fields` object of a native draft, using only keys `FIELDS` accepts and only values the server
 * keeps. `publishing_json` carries the whole publishing details object, which is exactly what the
 * web's `readPublishing` reads back from the composer form.
 */
export function draftFieldsFrom(source: DraftFieldSource): Record<string, DraftFieldValue> {
  const fields: Record<string, DraftFieldValue> = {
    caption: source.caption.slice(0, DRAFT_TEXT_LIMIT),
    title: source.publishing.title.slice(0, DRAFT_TEXT_LIMIT),
    visibility: source.visibility,
    provenance: source.provenance,
    overlay_text: source.overlayText.slice(0, 120),
    overlay_position: overlayPosition(source.overlayY),
    publishing_json: JSON.stringify(source.publishing).slice(0, DRAFT_LONG_TEXT_LIMIT),
  };
  if (source.audioRights) {
    fields.audio_rights = source.audioRights;
    fields.audio_attribution = String(source.audioAttribution ?? '').slice(0, 120);
  }
  if (source.jamendoTrack) fields.jamendo_track = JSON.stringify(source.jamendoTrack).slice(0, DRAFT_LONG_TEXT_LIMIT);
  return fields;
}

export type DraftSyncRequest = {
  id: string;
  mode: DraftMode;
  fields: Record<string, DraftFieldValue>;
  expected: { userId: number; persona: string };
  key: string;
  /** The capture itself: `social_post` for a post, `story` for a story. */
  source?: { uri: string; name: string; mime: string | null; size: number } | null;
  /** An audio file from the phone, `social_audio`. A catalog track has no local object to upload. */
  audio?: { uri: string; name: string; mime: string | null; size: number } | null;
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
};

export type DraftSyncResult = { id: string; media: DraftMediaRef[] };

/**
 * The native `syncCreatorDraft` of `public/creator-draft-sync.js:59`: upload the objects the draft
 * needs, then write the draft that references them. The local manifest was already written by the
 * editor, so a failure here never loses a keystroke — it only means the account copy is older.
 */
export async function syncCreatorDraft(request: DraftSyncRequest): Promise<DraftSyncResult> {
  const scope = draftScope(request.expected.userId, request.expected.persona);
  const media: DraftMediaRef[] = [];
  if (request.source) {
    const uploaded = await uploadDraftMedia({
      scope,
      purpose: request.mode === 'story' ? 'story' : 'social_post',
      source: { uri: request.source.uri, name: request.source.name, size: request.source.size },
      mime: request.source.mime,
      signal: request.signal,
      onProgress: request.onProgress,
    });
    media.push(draftMediaRef(uploaded, 'source', request.source.name, request.source.mime ?? ''));
  }
  if (request.audio) {
    const uploaded = await uploadDraftMedia({
      scope,
      purpose: 'social_audio',
      source: { uri: request.audio.uri, name: request.audio.name, size: request.audio.size },
      mime: request.audio.mime,
      signal: request.signal,
      onProgress: request.onProgress,
    });
    media.push(draftMediaRef(uploaded, 'audio', request.audio.name, request.audio.mime ?? ''));
  }
  await saveCreatorDraft({
    id: request.id, mode: request.mode, fields: request.fields, media,
    key: request.key, expected: request.expected, signal: request.signal,
  });
  return { id: request.id, media };
}
