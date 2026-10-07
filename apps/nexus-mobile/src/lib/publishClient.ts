/**
 * The publish request itself: `POST /api/posts`.
 *
 * This is the native mirror of the web composer's submit (`apps/nexus-web/public/app.js`, the
 * `composerForm` handler) and of the rules `apps/nexus-web/lib/api.js` applies before a post row is
 * written: `requireAuth`, the `Idempotency-Key` boundary of `lib/mutation-idempotency.js`,
 * `normalizePublishing` of `lib/post-publishing.js`, `normalizeCreatorAudio`, the automatic
 * pre-publication assessment and the `socialPostView` answer.
 *
 * Three properties matter more than the shape of the payload:
 *
 * - the request is sent only after the media is already stored server-side, so a refusal leaves the
 *   user with an uploaded object and a re-tryable draft instead of a half post;
 * - the idempotency key belongs to one publish intent: an answer lost on a bad connection is
 *   replayed by the server instead of creating a second post, while any edit makes a new key;
 * - the answer is verified field by field exactly like the web's `validPostResult`, so the editor
 *   never claims "publicat" for a post the server did not confirm.
 */

import { API_ORIGIN } from './apiOrigin';
import { idempotencyKeyIsValid, newMutationKey } from './idempotency';
import { PublishingError, normalizePublishing, type PublishingDetails } from './publishing';
import { authHeaders } from './session';

/** `PROFILE_VISIBILITY` of `lib/repo.js`; anything else is answered with `400 visibility invalid`. */
export type PostVisibility = 'public' | 'followers' | 'friends' | 'private';
export const POST_VISIBILITIES: readonly PostVisibility[] = ['public', 'followers', 'friends', 'private'];

/** The words the web's `select[name="visibility"]` prints (`public/app.js`), kept verbatim. */
export const VISIBILITY_LABELS: Record<PostVisibility, string> = {
  public: 'Public',
  followers: 'Followers',
  friends: 'Friends',
  private: 'Doar eu',
};

/** `normalizeProvenance` of `lib/moderation.js`: the declaration the author makes, nothing more. */
export type ContentProvenance = 'NOT_DECLARED' | 'CAMERA_CAPTURED_DECLARED' | 'AI_ASSISTED' | 'AI_GENERATED';
export const CONTENT_PROVENANCE: readonly ContentProvenance[] = [
  'NOT_DECLARED', 'CAMERA_CAPTURED_DECLARED', 'AI_ASSISTED', 'AI_GENERATED',
];

/** The options and the words of the web's `select[name="provenance"]`, kept verbatim. */
export const PROVENANCE_LABELS: Record<ContentProvenance, string> = {
  NOT_DECLARED: 'Nu declar',
  CAMERA_CAPTURED_DECLARED: 'Creat de mine / cameră (declarație)',
  AI_ASSISTED: 'Asistat de AI',
  AI_GENERATED: 'Generat cu AI',
};

/** `normalizeCreatorAudio` accepts exactly these two declarations; `null` means no audio at all. */
export type CreatorAudioRights = 'ORIGINAL_OWNED' | 'LICENSED_WITH_PERMISSION';
export const CREATOR_AUDIO_RIGHTS: readonly CreatorAudioRights[] = ['ORIGINAL_OWNED', 'LICENSED_WITH_PERMISSION'];

/** The words of the web's `select[name="audio_rights"]`, kept verbatim. */
export const AUDIO_RIGHTS_LABELS: Record<CreatorAudioRights, string> = {
  ORIGINAL_OWNED: 'Originalul meu',
  LICENSED_WITH_PERMISSION: 'Am permisiune/licență',
};

/** `audio_attribution` of `normalizeCreatorAudio`: the line a CC BY track requires. */
export const AUDIO_ATTRIBUTION_LIMIT = 120;

export class PublishError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 0,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'PublishError';
  }
}

/** Always a full Romanian sentence: a raw server code never reaches the screen. */
const MESSAGES: Record<string, string> = {
  PUBLISH_NETWORK: 'Rețeaua nu a răspuns. Cererea de publicare nu a plecat; reia când ai semnal.',
  PUBLISH_CANCELLED: 'Publicarea a fost oprită. Draftul rămâne salvat pe telefon.',
  PUBLISH_AUTH: 'Sesiunea a expirat. Autentifică-te din nou; textul rămâne salvat pe telefon.',
  PUBLISH_RATE_LIMITED: 'Prea multe acțiuni într-un minut. Așteaptă puțin și reia.',
  PUBLISH_SERVER: 'Serverul a refuzat publicarea. Fișierul este deja încărcat; reia publicarea.',
  PUBLISH_INVALID: 'Datele trimise nu au trecut verificarea serverului. Verifică titlul, locația și linkul.',
  PUBLISH_MEDIA_REQUIRED: 'Postarea are nevoie de fișierul încărcat.',
  PUBLISH_MEDIA_KIND: 'Fișierul încărcat nu este o fotografie sau un clip acceptat.',
  PUBLISH_MEDIA_UNVERIFIED: 'Fișierul nu este confirmat pe server ca încărcat de acest cont. Reia încărcarea.',
  PUBLISH_MEDIA_DUPLICATE: 'Același fișier apare de două ori în postare.',
  PUBLISH_CAPTION_REQUIRED: 'O postare fără fișier are nevoie de o descriere.',
  PUBLISH_VISIBILITY: 'Audiența aleasă nu este acceptată de server.',
  PUBLISH_PROVENANCE: 'Declarația despre conținut nu este acceptată de server.',
  PUBLISH_LANGUAGE: 'Limba aleasă nu este acceptată de server.',
  PUBLISH_PERSONA: 'Profilul activ nu este cel din care publici. Comută profilul și reia.',
  PUBLISH_AUDIO_RIGHTS_REQUIRED: 'Pentru audio încărcat trebuie declarat dreptul de folosire.',
  PUBLISH_AUDIO_NEEDS_MEDIA: 'Audio se poate publica doar împreună cu o fotografie sau un clip.',
  PUBLISH_AUDIO_CONFLICT: 'O postare are o singură sursă de audio: ori melodia din catalog, ori fișierul încărcat.',
  PUBLISH_AUDIO_ATTRIBUTION: `Atribuirea audio are cel mult ${AUDIO_ATTRIBUTION_LIMIT} caractere.`,
  PUBLISH_JAMENDO_EXPIRED: 'Alegerea din catalogul Jamendo a expirat (este valabilă 2 ore). Alege melodia din nou.',
  PUBLISH_MODERATION: 'Publicarea a fost oprită de o regulă automată de siguranță.',
  PUBLISH_VERIFY_FAILED: 'Serverul a răspuns, dar postarea nu a putut fi confirmată. Verifică profilul: postarea poate exista deja.',
  PUBLISHING_INVALID: 'Detaliile de publicare nu sunt valide.',
  PUBLISHING_TAGS_INVALID: 'Etichetele nu au trecut verificarea serverului.',
  PUBLISHING_LINK_INVALID: 'Linkul nu este o adresă HTTPS publică.',
  CREATOR_STUDIO_MANIFEST_INVALID: 'Manifestul de editare nu trece verificarea serverului.',
  CREATOR_STUDIO_SOURCE_MEDIA_INVALID: 'Fișierul de bază nu aparține acestui cont pentru postare. Reia încărcarea.',
  CREATOR_AUDIO_MEDIA_INVALID: 'Fișierul audio nu aparține acestui cont. Reia încărcarea.',
  CREATOR_AUDIO_SOURCE_CONFLICT: 'Alege o singură sursă de audio.',
  CREATOR_EXTERNAL_AUDIO_REQUIRES_VIDEO: 'Muzica din catalog se publică doar cu fotografie sau clip.',
  MEDIA_UPLOAD_LEGACY_RETIRED: 'Serverul nu mai acceptă încărcarea veche; folosește fluxul reluabil.',
  OPERATIONAL_CONTROL_ACTIVE: 'Acțiunea este temporar oprită pentru protecția comunității; reia mai târziu.',
  ACCOUNT_DELETION_PENDING: 'Contul este în perioada de grație pentru ștergere, deci publicarea este blocată.',
};

/** The `reason` texts of the blocking rules in `lib/moderation.js`, kept verbatim. */
const REASON_LABELS: Record<string, string> = {
  CREDENTIAL_THEFT_SOLICITATION: 'Solicitare explicită de secret de portofel',
  DIRECT_VIOLENT_THREAT: 'Amenințare directă explicită detectată',
  EXPLICIT_ILLEGAL_DRUG_SALE: 'Ofertă explicită pentru bunuri ilegale detectată',
};

/** The one-to-one map of the English `error` strings of `POST /api/posts` onto the local codes. */
const SERVER_ERRORS: Record<string, string> = {
  'visibility invalid': 'PUBLISH_VISIBILITY',
  'provenance invalid': 'PUBLISH_PROVENANCE',
  'language invalid': 'PUBLISH_LANGUAGE',
  'active profile does not match post profile': 'PUBLISH_PERSONA',
  'uploaded media required': 'PUBLISH_MEDIA_REQUIRED',
  'unsupported media kind': 'PUBLISH_MEDIA_KIND',
  'duplicate media in post': 'PUBLISH_MEDIA_DUPLICATE',
  'one video per post': 'PUBLISH_MEDIA_KIND',
  'a video post carries one media': 'PUBLISH_MEDIA_KIND',
  'text post cannot be empty': 'PUBLISH_CAPTION_REQUIRED',
  'verified media upload required': 'PUBLISH_MEDIA_UNVERIFIED',
  'verified creator audio upload required': 'PUBLISH_MEDIA_UNVERIFIED',
  'creator audio requires image or video': 'PUBLISH_AUDIO_NEEDS_MEDIA',
  'choose one audio source': 'PUBLISH_AUDIO_CONFLICT',
  'Jamendo selection invalid or expired': 'PUBLISH_JAMENDO_EXPIRED',
  'Jamendo audio requires media': 'PUBLISH_AUDIO_NEEDS_MEDIA',
  'audio attribution invalid': 'PUBLISH_AUDIO_ATTRIBUTION',
};

export function publishFailure(code: string, status = 0, retryable = false): PublishError {
  return new PublishError(code, MESSAGES[code] ?? MESSAGES.PUBLISH_SERVER, status, retryable);
}

/** One Romanian sentence for every refusal the network, the server or the local rules produce. */
export function publishErrorMessage(error: unknown): string {
  if (error instanceof PublishError) return error.message;
  if (error instanceof PublishingError) return error.message;
  if (error instanceof Error && MESSAGES[error.message]) return MESSAGES[error.message];
  return 'Postarea nu a putut fi publicată. Textul și fișierul rămân salvate pe telefon; reia.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** The `{hash, ext}` pair `media_items` carries, exactly as the web composer sends it. */
export type MediaRef = { hash: string; ext: string };
const MEDIA_REF = { hash: /^[a-f0-9]{64}$/, ext: /^[a-z0-9]{2,5}$/ };

/** The one `MIME_EXTENSIONS` value a post kind may carry, as `lib/media.js` stores it. */
export type PostKind = 'image' | 'video';

/** Everything the editor knows when the user presses "Publică"; mirrors the web's `body` object. */
export type PublishIntent = {
  persona: string;
  caption: string;
  visibility: PostVisibility;
  language?: string | null;
  provenance: ContentProvenance;
  publishing?: PublishingDetails | null;
  /** The uploaded source object; absent for a text-only post, which this editor does not offer. */
  media?: MediaRef | null;
  kind?: PostKind | null;
  /** Uploaded audio, `social_audio` purpose. Mutually exclusive with the Jamendo selection. */
  audio?: MediaRef | null;
  audioRights?: CreatorAudioRights | null;
  audioAttribution?: string | null;
};

/** The verified answer of `POST /api/posts`; only fields the server really confirmed are kept. */
export type PublishedPost = {
  id: number;
  userId: number;
  persona: string;
  kind: string;
  contentCommitment: string;
  createdAt: number | null;
  media: MediaRef[];
};

const CONTENT_COMMITMENT = /^[a-f0-9]{64}$/;

/**
 * The exact body of `apps/nexus-web/public/app.js:7390`, in the order the web builds it. The
 * `undefined` members drop out of `JSON.stringify`, which is how the web omits an absent media
 * item, an absent Jamendo token and an absent `publishing` object.
 */
export function publishBody(intent: PublishIntent): Record<string, unknown> {
  const audioAttribution = (intent.audioAttribution ?? '').trim();
  return {
    caption: intent.caption,
    persona: intent.persona,
    kind: intent.media ? (intent.kind ?? 'image') : 'text',
    media_hash: intent.media?.hash,
    media_ext: intent.media?.ext,
    media_items: intent.media ? [intent.media] : undefined,
    visibility: intent.visibility,
    language: intent.language ?? null,
    provenance: intent.provenance,
    publishing: intent.publishing ?? undefined,
    studio_manifest: null,
    audio_hash: intent.audio?.hash,
    audio_ext: intent.audio?.ext,
    audio_rights: intent.audio ? (intent.audioRights ?? null) : null,
    audio_attribution: intent.audio ? audioAttribution : '',
  };
}

/**
 * The rules `normalizeCreatorAudio` and `sanitizeText` apply server-side, checked locally first so a
 * refusal arrives before a byte is uploaded. Nothing here is stricter than the server, except the
 * one case the server cannot check: an object it never received.
 */
export function assertPublishable(intent: PublishIntent): void {
  const caption = nfkcString(intent.caption).slice(0, 2000).trim();
  if (!intent.media && !caption) throw publishFailure('PUBLISH_CAPTION_REQUIRED', 0);
  if (intent.audio) {
    if (!intent.media) throw publishFailure('PUBLISH_AUDIO_NEEDS_MEDIA', 0);
    if (!intent.audioRights || !CREATOR_AUDIO_RIGHTS.includes(intent.audioRights)) {
      throw publishFailure('PUBLISH_AUDIO_RIGHTS_REQUIRED', 0);
    }
    if ((intent.audioAttribution ?? '').trim().length > AUDIO_ATTRIBUTION_LIMIT) {
      throw publishFailure('PUBLISH_AUDIO_ATTRIBUTION', 0);
    }
  }
}

function nfkcString(value: string): string {
  try { return String(value).normalize('NFKC'); } catch { return String(value); }
}

function readMediaList(value: unknown): MediaRef[] {
  if (!Array.isArray(value)) return [];
  const items: MediaRef[] = [];
  for (const item of value) {
    if (isRecord(item) && MEDIA_REF.hash.test(String(item.hash ?? '')) && MEDIA_REF.ext.test(String(item.ext ?? ''))) {
      items.push({ hash: String(item.hash), ext: String(item.ext) });
    }
  }
  return items;
}

/**
 * The field-by-field confirmation of `public/app.js:7415` (`validPostResult`). The editor says
 * "publicat" only for an answer that names this account, this profile, this action, a signed
 * content commitment and the same audio the user chose.
 */
export function readPublishedPost(
  answer: unknown,
  expected: { userId: number; persona: string; audio?: MediaRef | null; audioRights?: CreatorAudioRights | null; audioAttribution?: string | null },
): PublishedPost | null {
  if (!isRecord(answer) || answer.ok !== true) return null;
  const post = answer.post;
  if (!isRecord(post)) return null;
  const chain = answer.chain;
  if (!isRecord(chain) || chain.status !== 'not_submitted' || Number(chain.value) !== 0) return null;
  if (answer.action !== 'post_published' || answer.owner_persona !== expected.persona) return null;
  if (Number(answer.owner_id) !== Number(expected.userId)) return null;
  if (Number(post.user_id) !== Number(expected.userId) || post.persona !== expected.persona) return null;
  if (!CONTENT_COMMITMENT.test(String(post.content_commitment ?? ''))) return null;
  if (expected.audio) {
    const audio = isRecord(post.audio) ? post.audio : null;
    if (!audio || String(audio.hash) !== expected.audio.hash || String(audio.ext) !== expected.audio.ext) return null;
    if (post.audio_rights !== (expected.audioRights ?? null)) return null;
    if (post.audio_attribution !== (expected.audioAttribution ?? '').trim()) return null;
  }
  const id = Number(post.id);
  if (!Number.isSafeInteger(id) || id < 1) return null;
  return {
    id,
    userId: Number(post.user_id),
    persona: String(post.persona),
    kind: typeof post.kind === 'string' ? post.kind : 'image',
    contentCommitment: String(post.content_commitment),
    createdAt: Number.isSafeInteger(Number(post.created_at)) ? Number(post.created_at) : null,
    media: readMediaList(post.media),
  };
}

/** 401 and 429 are decided before the body is read: the body of a rate-limited answer is generic. */
function failureFromAnswer(answer: unknown, status: number): PublishError {
  if (status === 401) return publishFailure('PUBLISH_AUTH', status);
  if (status === 429) return publishFailure('PUBLISH_RATE_LIMITED', status, true);
  const record = isRecord(answer) ? answer : null;
  const reasons = record && isRecord(record.statement_of_reasons) ? record.statement_of_reasons : null;
  const reason = reasons && typeof reasons.reason === 'string' ? reasons.reason : null;
  if (reason && REASON_LABELS[reason]) {
    return new PublishError('PUBLISH_MODERATION', `${MESSAGES.PUBLISH_MODERATION} Motiv: ${REASON_LABELS[reason]}.`, status);
  }
  if (record && (record.prepublication_reconsideration_available === true
    || reasons?.prepublication_reconsideration_available === true)) {
    return new PublishError('PUBLISH_MODERATION', MESSAGES.PUBLISH_MODERATION, status);
  }
  const code = record && typeof record.code === 'string' && MESSAGES[record.code] ? record.code : null;
  if (code) return publishFailure(code, status);
  const error = record && typeof record.error === 'string' ? record.error : '';
  if (error && SERVER_ERRORS[error]) return publishFailure(SERVER_ERRORS[error], status);
  if (status >= 500) return publishFailure('PUBLISH_SERVER', status, true);
  if (status >= 400) return publishFailure('PUBLISH_INVALID', status);
  return publishFailure('PUBLISH_SERVER', status);
}

function isAbort(error: unknown): boolean {
  return Boolean(error) && typeof error === 'object' && (error as { name?: string }).name === 'AbortError';
}

export type PublishRequest = {
  intent: PublishIntent;
  /**
   * `Idempotency-Key` of this publish intent. Repeated verbatim when only the answer was lost, so
   * the server replays the post it already wrote instead of writing a second one.
   */
  key: string;
  /** The signed-in account, from `/api/me`, compared against `owner_id` in the answer. */
  userId: number;
  signal?: AbortSignal;
};

/** A fresh key for a fresh publish intent; the editor keeps it until something is edited. */
export function publishIntentKey(): string {
  return newMutationKey('post');
}

/**
 * One publish attempt: local validation, `POST /api/posts`, then the field-by-field confirmation of
 * the answer. Everything that leaves this function is either a confirmed post or a `PublishError`
 * whose message is a full Romanian sentence — never a half-success and never a raw server code.
 */
export async function publishPost(request: PublishRequest): Promise<PublishedPost> {
  const { intent } = request;
  if (!idempotencyKeyIsValid(request.key)) throw publishFailure('PUBLISH_INVALID', 0);
  assertPublishable(intent);
  const body = publishBody({
    ...intent,
    // The same normalization the server applies to `body.publishing`; a bad link or a 21st tag is
    // refused here, before the media is uploaded and long before the post row would be written.
    publishing: intent.publishing ? normalizePublishing(intent.publishing) : undefined,
  });
  let response: Response;
  try {
    response = await fetch(`${API_ORIGIN}/api/posts`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': request.key,
        ...authHeaders(),
      },
      body: JSON.stringify(body),
      signal: request.signal,
    });
  } catch (error) {
    if (isAbort(error)) throw publishFailure('PUBLISH_CANCELLED', 0, true);
    throw publishFailure('PUBLISH_NETWORK', 0, true);
  }
  const answer: unknown = await response.json().catch(() => null);
  if (!response.ok) throw failureFromAnswer(answer, response.status);
  const post = readPublishedPost(answer, {
    userId: request.userId,
    persona: intent.persona,
    audio: intent.audio ?? null,
    audioRights: intent.audioRights ?? null,
    audioAttribution: intent.audioAttribution ?? '',
  });
  // A 200 that does not confirm the post is not a publication: the answer is shown as a failure so
  // the user checks the profile instead of believing a post that may never have been written.
  if (!post) throw publishFailure('PUBLISH_VERIFY_FAILED', response.status);
  return post;
}
