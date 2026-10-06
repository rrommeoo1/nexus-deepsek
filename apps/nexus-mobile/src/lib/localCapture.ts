import { Directory, File, Paths } from 'expo-file-system';

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
  title: string;
  description: string;
  overlayText: string;
  overlayX: number;
  overlayY: number;
  audioUri?: string;
  audioName?: string;
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
    overlayText: '', overlayX: 0.5, overlayY: 0.5, updatedAt: Date.now(),
  };
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
      return value as LocalDraft;
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
  temporary.write(JSON.stringify({ ...draft, updatedAt: Date.now() }));
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
