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

const captureName = /^(\d{13})-(photo|video)-(9x16|3x4)-[a-z0-9]+\.(jpg|mp4)$/;

function capturesDirectory(): Directory {
  return new Directory(Paths.document, 'nexus-camera-tests');
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
