/**
 * The resumable upload client for `POST /api/uploads`.
 *
 * `apps/nexus-web/lib/resumable-upload.js` is the contract: a session is created with the purpose, the
 * MIME type, the total size and the digest of the whole file; the bytes travel in 1 MiB parts, each
 * one exactly `chunk_size` long (the last one is the remainder), each one carrying its own
 * `Idempotency-Key`; the session is closed with `/complete`, which assembles the parts, verifies the
 * whole-file digest and only then writes a `media` row.
 *
 * Two native details shape the implementation below:
 *
 * - **Transport.** Parts are sent through `XMLHttpRequest` with the bytes as the request body,
 *   because React Native's `fetch` re-encodes a `Uint8Array` body through a string on some versions
 *   and corrupts binary payloads. XHR is the one path that hands the platform the raw `ArrayBuffer`,
 *   and it also reports real upload progress.
 * - **Digest.** No `SubtleCrypto` exists on this platform, so the file is hashed with the local
 *   streaming SHA-256 (`./sha256`) while it is read through a `FileHandle`, one megabyte at a time.
 *
 * The session id and the parts already accepted are remembered on the device, so an upload that dies
 * because the phone lost signal continues from the last verified part instead of starting over.
 */

import { Directory, File, FileMode, Paths, type FileHandle } from 'expo-file-system';
import { API_ORIGIN } from './apiOrigin';
import { newMutationKey } from './idempotency';
import { authHeaders } from './session';
import { SHA256_BLOCK_BYTES, Sha256 } from './sha256';

/** `LOCAL_UPLOAD_CHUNK_BYTES` / `LOCAL_UPLOAD_MAX_BYTES` of `lib/resumable-upload.js`. */
export const UPLOAD_CHUNK_BYTES = 1024 * 1024;
export const UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

/** `PURPOSES` of `lib/resumable-upload.js`; `message_e2ee_attachment` is used only with its own MIME. */
export type UploadPurpose =
  | 'social_post'
  | 'social_audio'
  | 'story'
  | 'profile_avatar'
  | 'profile_cover'
  | 'message_attachment'
  | 'message_e2ee_attachment'
  | 'watch_video'
  | 'music_master';

export class UploadClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 0,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'UploadClientError';
  }
}

/** The MIME types `MIMES` in `lib/resumable-upload.js` accepts, keyed by the extension the app stores. */
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

/** `MIME_EXTENSIONS` of `lib/media.js`: the extension the stored object gets, by MIME type. */
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.nexus.e2ee': 'nexus',
};

/** The `kind` `storeMedia` derives from the MIME type; `/complete` answers with the same value. */
function kindForMime(mime: string): string {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
}

export function extensionOf(name: string): string {
  return (/\.([a-z0-9]+)$/i.exec(String(name))?.[1] ?? '').toLowerCase();
}

/**
 * The server rejects anything outside its MIME list with `MEDIA_TYPE_UNSUPPORTED`. Refusing it here
 * keeps a HEIC photograph or a MOV clip from being uploaded and then discarded, and the message can
 * name the formats that do work.
 */
export function uploadMimeForName(name: string): string | null {
  return MIME_BY_EXTENSION[extensionOf(name)] ?? null;
}

const MESSAGES: Record<string, string> = {
  UPLOAD_NETWORK: 'Rețeaua nu a răspuns. Încărcarea se reia de unde a rămas; verifică conexiunea și încearcă din nou.',
  UPLOAD_CANCELLED: 'Încărcarea a fost oprită. Poți relua oricând din același ecran.',
  UPLOAD_AUTH: 'Sesiunea a expirat. Autentifică-te din nou, apoi reia încărcarea.',
  UPLOAD_FILE_INVALID: 'Fișierul nu mai poate fi citit din stocarea locală a aplicației.',
  UPLOAD_MIME_UNSUPPORTED: 'Serverul acceptă JPEG, PNG, WebP, MP4, WebM, MP3, WAV și OGG. Formatul ales (de exemplu HEIC sau MOV) nu este acceptat.',
  UPLOAD_SIZE_INVALID: `Fișierul trebuie să aibă cel mult ${Math.round(UPLOAD_MAX_BYTES / (1024 * 1024))} MB.`,
  UPLOAD_PURPOSE_INVALID: 'Scopul încărcării nu este acceptat de server.',
  UPLOAD_CHECKSUM_INVALID: 'Amprenta fișierului nu a putut fi calculată corect.',
  UPLOAD_PART_INVALID: 'Numerotarea bucăților a fost respinsă de server.',
  UPLOAD_PART_SIZE_MISMATCH: 'O bucată a ajuns incompletă la server; încărcarea se reia automat.',
  UPLOAD_PART_TOO_LARGE: 'O bucată a depășit limita acceptată de server.',
  UPLOAD_PART_WRITE_FAILED: 'Serverul nu a putut salva o bucată. Reia încărcarea.',
  UPLOAD_QUOTA_EXCEEDED: 'Ai deja 100 MB sau 20 de încărcări în curs. Așteaptă să se termine una sau anulează-o.',
  UPLOAD_EXPIRED: 'Sesiunea de încărcare a expirat; se pornește una nouă.',
  UPLOAD_NOT_FOUND: 'Sesiunea de încărcare nu mai există pe server; se pornește una nouă.',
  UPLOAD_INCOMPLETE: 'Lipsesc bucăți din fișier; încărcarea continuă.',
  UPLOAD_CHECKSUM_MISMATCH: 'Fișierul s-a schimbat în timpul încărcării. Alege din nou fișierul și reia.',
  UPLOAD_PART_INTEGRITY_FAILED: 'O bucată nu a trecut verificarea de integritate. Reia încărcarea.',
  UPLOAD_STATE_CONFLICT: 'Sesiunea de încărcare nu mai acceptă bucăți; se pornește una nouă.',
  UPLOAD_ASSEMBLY_BUSY: 'Serverul asamblează deja acest fișier. Așteaptă un moment și reia.',
  UPLOAD_ASSEMBLY_FAILED: 'Serverul nu a putut finaliza fișierul. Reia încărcarea.',
  UPLOAD_SERVER: 'Serverul a refuzat încărcarea. Reia; fișierul rămâne pe telefon.',
  MEDIA_TYPE_UNSUPPORTED: 'Serverul acceptă JPEG, PNG, WebP, MP4, WebM, MP3, WAV și OGG. Fișierul ales nu are unul dintre aceste formate.',
  MEDIA_BOUNDARY_CONFLICT: 'Un fișier identic există deja cu altă destinație pe server. Alege alt fișier.',
  RATE_LIMITED: 'Prea multe încărcări într-un minut. Așteaptă puțin și reia.',
  IDEMPOTENCY_CONFLICT: 'Încărcarea a fost deja folosită pentru alt fișier. Se pornește o sesiune nouă.',
  IDEMPOTENCY_KEY_REQUIRED: 'Cererea de încărcare nu a putut fi identificată. Reia.',
  UPLOAD_PART_CONTENT_TYPE: 'Serverul a refuzat bucata de fișier. Reia încărcarea.',
  UPLOAD_PATH_INVALID: 'Serverul nu a putut localiza sesiunea de încărcare. Reia.',
  E2EE_ATTACHMENT_BOUNDARY_INVALID: 'Fișierele criptate necesită propriul tip de conținut. Alege din nou fișierul.',
};

/** Always a full Romanian sentence: a raw server code never reaches the screen. */
export function uploadFailure(code: string, status = 0, retryable = false): UploadClientError {
  return new UploadClientError(code, MESSAGES[code] ?? MESSAGES.UPLOAD_SERVER, status, retryable);
}

/** One Romanian sentence for every failure the provider or the client can raise. */
export function uploadErrorMessage(error: unknown): string {
  if (error instanceof UploadClientError) return error.message;
  if (error instanceof Error && MESSAGES[error.message]) return MESSAGES[error.message];
  return 'Încărcarea nu a putut fi finalizată. Reia; fișierul rămâne pe telefon.';
}

export type UploadPartRow = { part_number: number; size: number; sha256: string };

/** The `publicSession` shape of `lib/resumable-upload.js`. */
export type UploadSession = {
  id: string;
  purpose: string;
  mime: string;
  total_bytes: number;
  expected_sha256: string | null;
  chunk_size: number;
  total_parts: number;
  received_bytes: number;
  status: string;
  media_id: number | null;
  error_code: string | null;
  expires_at: number;
  parts: UploadPartRow[];
};

/** The `media` object `/complete` answers with. */
export type UploadedMedia = {
  id: number;
  hash: string;
  ext: string;
  mime: string;
  kind: string;
  size: number;
  status: string;
  url: string | null;
};

export type UploadProgress = { phase: 'hashing' | 'uploading' | 'verifying' | 'completed'; sent: number; total: number; part?: number };

export type UploadSource = { uri: string; name: string; size?: number };

export type UploadRequest = {
  purpose: UploadPurpose;
  /** `"<userId>:<persona>"`, so a resumed session is never reused by another account or profile. */
  scope: string;
  mime?: string | null;
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
};

/** Session id shape of `safeUploadDirectory`: 16 random bytes, hex. */
const UPLOAD_ID = /^[a-f0-9]{32}$/;
const RESUME_FILE = 'resume.json';
const RESUME_LIMIT = 20;
/** `UPLOAD_TTL_SECONDS` of the server; a record older than this can never be resumed. */
const RESUME_TTL_MS = 24 * 60 * 60 * 1000;

type ResumeRecord = {
  uploadId: string;
  purpose: string;
  mime: string;
  totalBytes: number;
  sha256: string;
  createKey: string;
  parts: number[];
  updatedAt: number;
};

function resumeDirectory(): Directory {
  return new Directory(Paths.document, 'nexus-uploads');
}

function resumeFile(): File {
  return new File(resumeDirectory(), RESUME_FILE);
}

function isResumeRecord(value: unknown): value is ResumeRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.uploadId === 'string' && (record.uploadId === '' || UPLOAD_ID.test(record.uploadId))
    && typeof record.purpose === 'string' && typeof record.mime === 'string'
    && Number.isSafeInteger(record.totalBytes) && (record.totalBytes as number) > 0
    && /^[a-f0-9]{64}$/.test(String(record.sha256 ?? ''))
    && typeof record.createKey === 'string'
    && Array.isArray(record.parts) && record.parts.every((part) => Number.isSafeInteger(part) && (part as number) >= 0)
    && Number.isSafeInteger(record.updatedAt);
}

function readResumeStore(): Record<string, ResumeRecord> {
  const file = resumeFile();
  if (!file.exists) return {};
  try {
    const value: unknown = JSON.parse(file.textSync());
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const store: Record<string, ResumeRecord> = {};
    for (const [key, record] of Object.entries(value as Record<string, unknown>)) {
      if (isResumeRecord(record)) store[key] = record;
    }
    return store;
  } catch { return {}; }
}

/** Newest first, bounded, and everything the server would have expired has already been dropped. */
function writeResumeStore(store: Record<string, ResumeRecord>): void {
  const now = Date.now();
  const kept = Object.entries(store)
    .filter(([, record]) => now - record.updatedAt < RESUME_TTL_MS)
    .sort(([, left], [, right]) => right.updatedAt - left.updatedAt)
    .slice(0, RESUME_LIMIT);
  const directory = resumeDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const temporary = new File(directory, 'resume.tmp');
  temporary.create({ overwrite: true });
  temporary.write(JSON.stringify(Object.fromEntries(kept)));
  temporary.moveSync(resumeFile(), { overwrite: true });
}

/** The resume key the web client builds as `uploadResumeStorageKey(file, purpose, checksum)`. */
export function uploadResumeStorageKey(input: { scope: string; purpose: string; name: string; size: number; sha256: string }): string {
  return `nexus-upload-v1:${input.scope}:${input.purpose}:${input.name}:${input.size}:${input.sha256}`;
}

export function readUploadResume(key: string): ResumeRecord | null {
  return readResumeStore()[key] ?? null;
}

export function persistUploadResume(key: string, record: Omit<ResumeRecord, 'updatedAt'>): ResumeRecord {
  const value: ResumeRecord = { ...record, updatedAt: Date.now() };
  const store = readResumeStore();
  store[key] = value;
  writeResumeStore(store);
  return value;
}

export function clearUploadResume(key: string): void {
  const store = readResumeStore();
  if (!(key in store)) return;
  delete store[key];
  writeResumeStore(store);
}

/**
 * A stored session may only be reused for the same bytes: a different size, digest or purpose means
 * the record belongs to another file and the upload starts clean.
 */
export function isValidUploadSession(upload: UploadSession, expected: { sha256: string; size: number; purpose: string }): boolean {
  return UPLOAD_ID.test(upload.id)
    && upload.purpose === expected.purpose
    && Number(upload.total_bytes) === expected.size
    && (!upload.expected_sha256 || upload.expected_sha256 === expected.sha256)
    && Number.isSafeInteger(upload.chunk_size) && upload.chunk_size > 0
    && Number.isSafeInteger(upload.total_parts) && upload.total_parts > 0;
}

type ApiAnswer = { status: number; body: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Leaving the editor is not a server failure, so a cancelled upload keeps its session for later. */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw uploadFailure('UPLOAD_CANCELLED');
}

type RequestOptions = {
  method: 'GET' | 'POST' | 'PUT';
  path: string;
  key?: string;
  body?: string | ArrayBuffer;
  contentType?: string;
  signal?: AbortSignal;
  onSent?: (sent: number, total: number) => void;
};

/**
 * One request over `XMLHttpRequest`.
 *
 * `fetch` is used everywhere else in this app, but a part body is binary: on React Native the
 * `fetch` implementation converts a typed array body into a string, which rewrites every byte above
 * 0x7f. XHR passes the `ArrayBuffer` straight to the platform, and `xhr.upload.onprogress` is the
 * only way to show a real percentage for a 20 MB video.
 */
function sendRequest(options: RequestOptions): Promise<ApiAnswer> {
  return new Promise<ApiAnswer>((resolve, reject) => {
    let settled = false;
    const xhr = new XMLHttpRequest();
    const finish = () => options.signal?.removeEventListener('abort', abort);
    const abort = () => xhr.abort();
    const fail = (error: UploadClientError) => {
      if (settled) return;
      settled = true;
      finish();
      reject(error);
    };
    try {
      xhr.open(options.method, `${API_ORIGIN}${options.path}`, true);
      xhr.setRequestHeader('Accept', 'application/json');
      for (const [name, value] of Object.entries(authHeaders())) xhr.setRequestHeader(name, value);
      if (options.contentType) xhr.setRequestHeader('Content-Type', options.contentType);
      if (options.key) xhr.setRequestHeader('Idempotency-Key', options.key);
    } catch {
      fail(uploadFailure('UPLOAD_NETWORK', 0, true));
      return;
    }
    xhr.onabort = () => fail(uploadFailure('UPLOAD_CANCELLED'));
    xhr.onerror = () => fail(uploadFailure('UPLOAD_NETWORK', 0, true));
    xhr.ontimeout = () => fail(uploadFailure('UPLOAD_NETWORK', 0, true));
    xhr.onload = () => {
      if (settled) return;
      settled = true;
      finish();
      let body: unknown = null;
      const text = typeof xhr.responseText === 'string' ? xhr.responseText : '';
      if (text) { try { body = JSON.parse(text); } catch { body = null; } }
      resolve({ status: xhr.status, body });
    };
    if (options.onSent && xhr.upload) {
      xhr.upload.onprogress = (event: ProgressEvent) => {
        if (event.lengthComputable) options.onSent?.(event.loaded, event.total);
      };
    }
    if (options.signal) {
      if (options.signal.aborted) { fail(uploadFailure('UPLOAD_CANCELLED')); return; }
      options.signal.addEventListener('abort', abort);
    }
    try {
      xhr.send(options.body ?? null);
    } catch {
      fail(uploadFailure('UPLOAD_NETWORK', 0, true));
    }
  });
}

/** The server answers `{ ok:false, code, error, retryable }` for everything it refuses. */
function failureFromAnswer(answer: ApiAnswer): UploadClientError {
  const body = isRecord(answer.body) ? answer.body : {};
  const code = typeof body.code === 'string' && body.code ? body.code : '';
  if (answer.status === 401 || answer.status === 403) return uploadFailure('UPLOAD_AUTH', answer.status);
  if (code) return uploadFailure(code, answer.status, body.retryable === true);
  if (answer.status === 429) return uploadFailure('RATE_LIMITED', answer.status, true);
  if (answer.status === 413) return uploadFailure('UPLOAD_SIZE_INVALID', answer.status);
  if (answer.status >= 500) return uploadFailure('UPLOAD_SERVER', answer.status, true);
  return uploadFailure('UPLOAD_SERVER', answer.status);
}

async function callApi(options: RequestOptions): Promise<Record<string, unknown>> {
  const answer = await sendRequest(options);
  if (answer.status < 200 || answer.status >= 300) throw failureFromAnswer(answer);
  if (!isRecord(answer.body) || answer.body.ok !== true) throw uploadFailure('UPLOAD_SERVER', answer.status, true);
  return answer.body;
}

function numberOr(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** `{ ok, upload }` — the exact `publicSession` of the server, refused when a field is missing. */
function sessionFrom(body: Record<string, unknown>): UploadSession {
  const upload = body.upload;
  if (!isRecord(upload) || typeof upload.id !== 'string' || !UPLOAD_ID.test(upload.id)) {
    throw uploadFailure('UPLOAD_SERVER', 0, true);
  }
  const parts: UploadPartRow[] = Array.isArray(upload.parts)
    ? upload.parts.filter(isRecord).map((part) => ({
      part_number: numberOr(part.part_number, -1),
      size: numberOr(part.size, 0),
      sha256: String(part.sha256 ?? ''),
    })).filter((part) => part.part_number >= 0 && part.size > 0)
    : [];
  return {
    id: upload.id,
    purpose: String(upload.purpose ?? ''),
    mime: String(upload.mime ?? ''),
    total_bytes: numberOr(upload.total_bytes),
    expected_sha256: typeof upload.expected_sha256 === 'string' ? upload.expected_sha256 : null,
    chunk_size: numberOr(upload.chunk_size, UPLOAD_CHUNK_BYTES),
    total_parts: numberOr(upload.total_parts),
    received_bytes: numberOr(upload.received_bytes),
    status: String(upload.status ?? ''),
    media_id: typeof upload.media_id === 'number' ? upload.media_id : null,
    error_code: typeof upload.error_code === 'string' ? upload.error_code : null,
    expires_at: numberOr(upload.expires_at),
    parts,
  };
}

/**
 * The media row `POST /complete` wrote, or the same row rebuilt from a session this device already
 * finished. `lib/media.js` stores each object under the digest of its own bytes, so a completed
 * session plus the local digest and MIME type is the whole answer, with no extra round trip.
 */
function mediaFrom(input: {
  id: number; sha256: string; mime: string; size: number; status?: string; url?: string | null;
}): UploadedMedia {
  const status = input.status ?? 'ready_local_validation';
  const available = status === 'ready_local_validation' || status === 'ready_client_encrypted';
  const ext = EXTENSION_BY_MIME[input.mime] ?? '';
  return {
    id: input.id,
    hash: input.sha256,
    ext,
    mime: input.mime,
    kind: kindForMime(input.mime),
    size: input.size,
    status,
    url: input.url ?? (available && ext ? `/media/${input.sha256}.${ext}` : null),
  };
}

function answerMedia(body: Record<string, unknown>): UploadedMedia | null {
  const media = body.media;
  if (!isRecord(media) || typeof media.hash !== 'string' || !/^[a-f0-9]{64}$/.test(media.hash)) return null;
  return mediaFrom({
    id: numberOr(media.id),
    sha256: media.hash,
    mime: String(media.mime ?? ''),
    size: numberOr(media.size),
    status: typeof media.status === 'string' ? media.status : 'ready_local_validation',
    url: typeof media.url === 'string' ? media.url : null,
  });
}

/** Deterministic per part: a replayed `PUT` must carry the key the server already stored. */
function partKey(uploadId: string, index: number): string {
  return `nexus-mobile-part-${uploadId}-${index}`;
}

function completionKey(uploadId: string): string {
  return `nexus-mobile-done-${uploadId}`;
}

/** `POST /api/uploads` — the digest of the whole file is declared here, before the first part. */
async function openSession(input: {
  purpose: UploadPurpose; mime: string; size: number; sha256: string; key: string; signal?: AbortSignal;
}): Promise<UploadSession> {
  const body = await callApi({
    method: 'POST',
    path: '/api/uploads',
    key: input.key,
    contentType: 'application/json',
    signal: input.signal,
    body: JSON.stringify({
      purpose: input.purpose,
      mime: input.mime,
      total_bytes: input.size,
      expected_sha256: input.sha256,
    }),
  });
  return sessionFrom(body);
}

async function fetchSession(uploadId: string, signal?: AbortSignal): Promise<UploadSession> {
  return sessionFrom(await callApi({ method: 'GET', path: `/api/uploads/${uploadId}`, signal }));
}

/** `PUT /api/uploads/:id/parts/:n` — one exactly sized part, answered with the refreshed session. */
async function putPart(input: {
  uploadId: string; index: number; bytes: Uint8Array; key: string;
  signal?: AbortSignal; onSent?: (sent: number, total: number) => void;
}): Promise<UploadSession> {
  const body = await callApi({
    method: 'PUT',
    path: `/api/uploads/${input.uploadId}/parts/${input.index}`,
    key: input.key,
    contentType: 'application/octet-stream',
    signal: input.signal,
    onSent: input.onSent,
    body: toArrayBuffer(input.bytes),
  });
  return sessionFrom(body);
}

/** `POST /api/uploads/:id/complete` — the server stitches the parts, checks the digest, writes media. */
async function finishSession(uploadId: string, key: string, signal?: AbortSignal): Promise<UploadedMedia> {
  const body = await callApi({ method: 'POST', path: `/api/uploads/${uploadId}/complete`, key, signal });
  const media = answerMedia(body);
  if (!media) throw uploadFailure('UPLOAD_SERVER', 0, true);
  return media;
}

/** Drops the parts the server still holds, so an abandoned session stops using the account quota. */
export async function cancelResumableUpload(uploadId: string, key: string = newMutationKey('upload-cancel')): Promise<void> {
  if (!UPLOAD_ID.test(uploadId)) return;
  await callApi({ method: 'POST', path: `/api/uploads/${uploadId}/cancel`, key });
}

/**
 * XHR hands the platform bytes, never a string. A part read out of a `FileHandle` is already its own
 * allocation, except when it happens to span the whole file, and then the buffer is copied once.
 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const exact = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength;
  return (exact ? bytes.buffer : bytes.slice().buffer) as ArrayBuffer;
}

/**
 * The digest of a whole file, computed while the bytes are read.
 *
 * `SubtleCrypto` does not exist on React Native, and a second in-memory copy of a 20 MB video is
 * avoidable, so the local streaming hasher consumes one `SHA256_BLOCK_BYTES` window at a time.
 */
export function sha256OfFile(
  file: File,
  onHashed?: (hashed: number, total: number) => void,
  signal?: AbortSignal,
): string {
  const size = Number(file.size);
  if (!Number.isSafeInteger(size) || size < 0) throw uploadFailure('UPLOAD_FILE_INVALID');
  const hasher = new Sha256();
  const handle = file.open(FileMode.ReadOnly);
  try {
    let offset = 0;
    while (offset < size) {
      throwIfAborted(signal);
      const length = Math.min(SHA256_BLOCK_BYTES, size - offset);
      handle.offset = offset;
      const bytes = handle.readBytes(length);
      if (bytes.length !== length) throw uploadFailure('UPLOAD_FILE_INVALID');
      hasher.update(bytes);
      offset += length;
      if (onHashed) onHashed(offset, size);
    }
  } finally {
    handle.close();
  }
  return hasher.digestHex();
}

function readChunk(handle: FileHandle, start: number, length: number): Uint8Array {
  handle.offset = start;
  const bytes = handle.readBytes(length);
  if (bytes.length !== length) throw uploadFailure('UPLOAD_FILE_INVALID');
  return bytes;
}

/** A session in one of these states can never accept another part, so the local record is dropped. */
const DEAD_SESSION_CODES = new Set([
  'UPLOAD_STATE_CONFLICT', 'UPLOAD_EXPIRED', 'UPLOAD_NOT_FOUND', 'IDEMPOTENCY_CONFLICT',
]);

/**
 * Uploads one local file and answers the `media` row that a draft or a post then references.
 *
 * The flow is the one the server describes: create a session with the digest of the whole file,
 * `PUT` the parts in order, `POST /complete`, receive the stored media row. Three details make it
 * survive a phone that loses signal in the middle of a 20 MB video:
 *
 * - the part boundaries are the server's own `LOCAL_UPLOAD_CHUNK_BYTES`, so a resumed session is
 *   always filled with exactly sized parts, including the shorter last one;
 * - every part key is derived from the session id and the part number, so a replayed `PUT` is
 *   recognised by the server instead of being stored twice;
 * - the session id, the create key and the confirmed part numbers are written to the device before
 *   each request, so the next attempt continues from the last verified part.
 */
export async function uploadMediaResumable(source: UploadSource, request: UploadRequest): Promise<UploadedMedia> {
  const name = String(source.name ?? '').trim().slice(0, 120);
  const mime = request.mime ?? uploadMimeForName(name);
  if (!name || !mime || !EXTENSION_BY_MIME[mime]) throw uploadFailure('UPLOAD_MIME_UNSUPPORTED', 415);
  throwIfAborted(request.signal);

  const file = new File(source.uri);
  if (!file.exists) throw uploadFailure('UPLOAD_FILE_INVALID');
  const size = Number(source.size ?? file.size);
  if (!Number.isSafeInteger(size) || size < 1) throw uploadFailure('UPLOAD_FILE_INVALID');
  if (size > UPLOAD_MAX_BYTES) throw uploadFailure('UPLOAD_SIZE_INVALID', 413);

  request.onProgress?.({ phase: 'hashing', sent: 0, total: size });
  const sha256 = sha256OfFile(
    file,
    (hashed, total) => request.onProgress?.({ phase: 'hashing', sent: hashed, total }),
    request.signal,
  );
  const storageKey = uploadResumeStorageKey({ scope: request.scope, purpose: request.purpose, name, size, sha256 });
  const stored = readUploadResume(storageKey);
  const record = stored && stored.purpose === request.purpose && stored.mime === mime && stored.totalBytes === size
    ? stored
    : null;
  let createKey = record?.createKey ?? '';
  let upload: UploadSession | null = null;

  if (record?.uploadId) {
    upload = await fetchSession(record.uploadId, request.signal).catch((error: unknown) => {
      if (error instanceof UploadClientError && DEAD_SESSION_CODES.has(error.code)) return null;
      throw error;
    });
    if (upload && (!isValidUploadSession(upload, { sha256, size, purpose: request.purpose })
      || upload.chunk_size !== UPLOAD_CHUNK_BYTES
      || !['initiated', 'uploading', 'completed'].includes(upload.status))) {
      upload = null;
    }
    if (upload?.status === 'completed') {
      // The digest and the MIME type are the address of the object, so this is the whole answer.
      clearUploadResume(storageKey);
      request.onProgress?.({ phase: 'completed', sent: size, total: size });
      return mediaFrom({ id: upload.media_id ?? 0, sha256, mime, size });
    }
  }
  if (!upload) {
    if (!createKey) createKey = newMutationKey('upload');
    // Written before the request: a create whose answer is lost is replayed by the same key instead
    // of counting a second session against the active-upload quota.
    persistUploadResume(storageKey, { uploadId: '', purpose: request.purpose, mime, totalBytes: size, sha256, createKey, parts: [] });
    try {
      upload = await openSession({ purpose: request.purpose, mime, size, sha256, key: createKey, signal: request.signal });
    } catch (error) {
      if (error instanceof UploadClientError && !error.retryable) clearUploadResume(storageKey);
      throw error;
    }
    if (upload.chunk_size !== UPLOAD_CHUNK_BYTES || Number(upload.total_bytes) !== size || Number(upload.total_parts) < 1) {
      clearUploadResume(storageKey);
      throw uploadFailure('UPLOAD_SERVER');
    }
    persistUploadResume(storageKey, { uploadId: upload.id, purpose: request.purpose, mime, totalBytes: size, sha256, createKey, parts: [] });
  }
  const session: UploadSession | null = upload;
  if (!session) throw uploadFailure('UPLOAD_SERVER');

  const done = new Set(session.parts.map((part) => part.part_number));
  let submitted = session.parts.reduce((total, part) => total + part.size, 0);
  const handle = file.open(FileMode.ReadOnly);
  request.onProgress?.({ phase: 'uploading', sent: submitted, total: size });
  try {
    for (let index = 0; index < session.total_parts; index++) {
      if (done.has(index)) continue;
      throwIfAborted(request.signal);
      const start = index * UPLOAD_CHUNK_BYTES;
      const length = Math.min(UPLOAD_CHUNK_BYTES, size - start);
      await putPart({
        uploadId: session.id,
        index,
        bytes: readChunk(handle, start, length),
        // The key names the part, so a part whose answer was lost is replayed, never stored twice.
        key: partKey(session.id, index),
        signal: request.signal,
        onSent: (loaded) => request.onProgress?.({
          phase: 'uploading', sent: submitted + Math.min(loaded, length), total: size, part: index,
        }),
      });
      submitted += length;
      done.add(index);
      persistUploadResume(storageKey, {
        uploadId: session.id,
        purpose: request.purpose,
        mime,
        totalBytes: size,
        sha256,
        createKey,
        parts: [...done].sort((left, right) => left - right),
      });
      request.onProgress?.({ phase: 'uploading', sent: submitted, total: size, part: index });
    }
  } catch (error) {
    if (error instanceof UploadClientError && DEAD_SESSION_CODES.has(error.code)) clearUploadResume(storageKey);
    throw error;
  } finally {
    handle.close();
  }

  request.onProgress?.({ phase: 'verifying', sent: size, total: size });
  const media = await finishSession(session.id, completionKey(session.id), request.signal);
  clearUploadResume(storageKey);
  request.onProgress?.({ phase: 'completed', sent: size, total: size });
  return media;
}
