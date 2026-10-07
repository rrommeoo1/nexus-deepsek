import { Directory, File, Paths } from 'expo-file-system';
import {
  emptyPublishing, readPublishing, type PublishingDetails,
} from './publishing';
import {
  AUDIO_ATTRIBUTION_LIMIT, CONTENT_PROVENANCE, CREATOR_AUDIO_RIGHTS, POST_VISIBILITIES,
  type ContentProvenance, type CreatorAudioRights, type PostVisibility,
} from './publishClient';

export type CaptureKind = 'photo' | 'video';
export type CaptureFraming = '9:16' | '3:4';

export interface LocalCapture {
  kind: CaptureKind;
  framing: CaptureFraming;
  uri: string;
  name: string;
  size: number;
}

export interface LocalDraft {
  version: 1;
  captureName: string;
  /**
   * Legacy mirror of `publishing.title`. `loadDraft` migrates a draft written before Etapa 4 into
   * `publishing.title`; the editor writes both from the same field so older builds stay readable.
   */
  title: string;
  description: string;
  overlayText: string;
  overlayX: number;
  overlayY: number;
  /**
   * The exact details the server validates: audience, tags, link and the four switches.
   */
  publishing: PublishingDetails;
  /**
   * The audience the publish body carries (`visibility` of `POST /api/posts`). Written by the editor,
   * kept in the draft, and sent unchanged on both the backup and the publish.
   */
  visibility: PostVisibility;
  /**
   * The author's own declaration about the content (`provenance`). The server prints the declaration;
   * it never claims to have verified it, and neither does this editor.
   */
  provenance: ContentProvenance;
  audioUri?: string;
  audioName?: string;
  /** Required for a phone audio file: `normalizeCreatorAudio` refuses uploaded audio without it. */
  audioRights?: CreatorAudioRights;
  /** The attribution line of the track, at most `AUDIO_ATTRIBUTION_LIMIT` characters. */
  audioAttribution?: string;
  jamendoTrackId?: string;
  jamendoAudioUrl?: string;
  jamendoSelectionToken?: string;
  jamendoAttribution?: string;
  updatedAt: number;
}

const captureName = /^(\d{13})-(photo|video)-(9x16|3x4)-[a-z0-9]+\.(jpg|jpeg|png|webp|heic|mp4|mov|m4v)$/;

function capturesDirectory(): Directory {
  return new Directory(Paths.document, 'nexus-camera-tests');
}

function draftFile(capture: LocalCapture): File {
  return new File(capturesDirectory(), `${capture.name}.draft.json`);
}

export function emptyDraft(capture: LocalCapture): LocalDraft {
  return {
    version: 1, captureName: capture.name, title: '', description: '',
    overlayText: '', overlayX: 0.5, overlayY: 0.5, publishing: emptyPublishing(),
    // The two values the composer's own form starts from: a public post, no declaration made.
    visibility: 'public', provenance: 'NOT_DECLARED', updatedAt: Date.now(),
  };
}

/**
 * The edit stamp of the manifest: every edit moves `updatedAt`, so the backup's key
 * (`draftMutationKey(id, updatedAt)`) is new per change and a retry replays the written row instead of
 * writing a second one. Kept outside the components, like `emptyDraft`, so the stamp is never produced
 * during a render.
 */
export function touchDraft(draft: LocalDraft): LocalDraft {
  return { ...draft, updatedAt: Date.now() };
}

/**
 * A manifest written before Etapa 4 has no audience and no declaration. Reading them tolerantly keeps
 * that draft openable: the defaults the composer's form starts from are used, and nothing typed by the
 * user is invented as a declaration the author never made.
 */
function readVisibility(value: unknown): PostVisibility {
  return POST_VISIBILITIES.includes(value as PostVisibility) ? value as PostVisibility : 'public';
}

function readProvenance(value: unknown): ContentProvenance {
  return CONTENT_PROVENANCE.includes(value as ContentProvenance) ? value as ContentProvenance : 'NOT_DECLARED';
}

function readAudioRights(value: unknown): CreatorAudioRights | undefined {
  return CREATOR_AUDIO_RIGHTS.includes(value as CreatorAudioRights) ? value as CreatorAudioRights : undefined;
}

function readAudioAttribution(value: unknown): string | undefined {
  return typeof value === 'string' ? value.slice(0, AUDIO_ATTRIBUTION_LIMIT) : undefined;
}

export function loadDraft(capture: LocalCapture): LocalDraft {
  const file = draftFile(capture);
  if (!file.exists) return emptyDraft(capture);
  try {
    const value: unknown = JSON.parse(file.textSync());
    if (value && typeof value === 'object' && 'version' in value && value.version === 1
      && 'captureName' in value && value.captureName === capture.name
      && 'title' in value && typeof value.title === 'string'
      && 'description' in value && typeof value.description === 'string'
      && 'overlayText' in value && typeof value.overlayText === 'string'
      && 'overlayX' in value && typeof value.overlayX === 'number'
      && 'overlayY' in value && typeof value.overlayY === 'number') {
      const draft = value as LocalDraft;
      const publishing = readPublishing((value as { publishing?: unknown }).publishing);
      // A draft written before Etapa 4 kept the title only in `title`; the value moves into the
      // publishing details the server actually receives, so nothing typed by the user is lost.
      if (!publishing.title && draft.title) publishing.title = draft.title;
      return {
        ...draft,
        publishing,
        visibility: readVisibility(draft.visibility),
        provenance: readProvenance(draft.provenance),
        audioRights: readAudioRights(draft.audioRights),
        audioAttribution: readAudioAttribution(draft.audioAttribution),
      };
    }
  } catch { /* A corrupt manifest must not hide the original media. */ }
  return emptyDraft(capture);
}

export function saveDraft(capture: LocalCapture, draft: LocalDraft): void {
  if (draft.captureName !== capture.name) throw new Error('Draftul nu aparține capturii curente.');
  const directory = capturesDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const temporary = new File(directory, `${capture.name}.draft.tmp`);
  temporary.create({ overwrite: true });
  // The stamp is the one the draft already carries (the editor bumps it on every edit), so the file on
  // disk and the in-memory draft the backup key is derived from always agree.
  temporary.write(JSON.stringify(draft));
  temporary.moveSync(draftFile(capture), { overwrite: true });
}

export function discardCapture(capture: LocalCapture): void {
  const audioUri = loadDraft(capture).audioUri;
  if (audioUri) {
    const audio = new File(audioUri);
    if (audio.exists && audio.uri.startsWith(capturesDirectory().uri)) audio.delete();
  }
  const manifest = draftFile(capture);
  if (manifest.exists) manifest.delete();
  const temporary = new File(capturesDirectory(), `${capture.name}.draft.tmp`);
  if (temporary.exists) temporary.delete();
  const media = new File(capturesDirectory(), capture.name);
  if (media.exists) media.delete();
}

function captureFromFile(file: File): LocalCapture | null {
  const match = captureName.exec(file.name);
  if (!match || !file.exists) return null;
  return {
    kind: match[2] as CaptureKind,
    framing: match[3] === '9x16' ? '9:16' : '3:4',
    uri: file.uri,
    name: file.name,
    size: file.size,
  };
}

export function loadLatestCapture(): LocalCapture | null {
  const directory = capturesDirectory();
  if (!directory.exists) return null;
  const files = directory.list().filter((entry): entry is File => entry instanceof File);
  files.sort((a, b) => b.name.localeCompare(a.name));
  for (const file of files) {
    const capture = captureFromFile(file);
    if (capture) return capture;
  }
  return null;
}

export async function persistCapture(
  temporaryPath: string,
  kind: CaptureKind,
  framing: CaptureFraming,
): Promise<LocalCapture> {
  const directory = capturesDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const source = new File(temporaryPath.startsWith('file://') ? temporaryPath : `file://${temporaryPath}`);
  const framingName = framing === '9:16' ? '9x16' : '3x4';
  const extension = kind === 'photo' ? 'jpg' : 'mp4';
  const name = `${Date.now()}-${kind}-${framingName}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const destination = new File(directory, name);
  await source.move(destination);
  const capture = captureFromFile(destination);
  if (!capture) throw new Error('Fișierul capturat nu a putut fi verificat în stocarea locală.');
  return capture;
}

export async function persistImportedCapture(
  uri: string, kind: CaptureKind, framing: CaptureFraming, mimeType?: string | null,
): Promise<LocalCapture> {
  const allowed = kind === 'photo' ? ['jpg', 'jpeg', 'png', 'webp', 'heic'] : ['mp4', 'mov', 'm4v'];
  const fromUri = /\.([a-z0-9]+)(?:\?|$)/i.exec(uri)?.[1]?.toLowerCase();
  const fromMime = mimeType?.split('/')[1]?.toLowerCase();
  const extension = allowed.find((item) => item === fromUri)
    ?? allowed.find((item) => item === fromMime)
    ?? (kind === 'photo' ? 'jpg' : 'mp4');
  const directory = capturesDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const name = `${Date.now()}-${kind}-${framing === '9:16' ? '9x16' : '3x4'}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const destination = new File(directory, name);
  await new File(uri).copy(destination);
  const capture = captureFromFile(destination);
  if (!capture) throw new Error('Fișierul ales nu a putut fi copiat în stocarea locală.');
  return capture;
}

export async function persistLocalAudio(uri: string, capture: LocalCapture, fileName: string, mimeType?: string | null): Promise<{ uri: string; name: string }> {
  const extension = /\.(mp3|m4a|aac|wav|ogg)$/i.exec(fileName)?.[1]?.toLowerCase()
    ?? /^(?:audio)\/(mpeg|mp4|aac|wav|ogg)$/i.exec(mimeType ?? '')?.[1]?.toLowerCase().replace('mpeg', 'mp3').replace('mp4', 'm4a');
  if (!extension) throw new Error('Alege un fișier audio MP3, M4A, AAC, WAV sau OGG.');
  const directory = capturesDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const destination = new File(directory, `${capture.name}.audio.${extension}`);
  await new File(uri).copy(destination);
  return { uri: destination.uri, name: fileName };
}
