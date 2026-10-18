import { Directory, File, Paths } from 'expo-file-system';
import type { XPortalAttempt } from './xportalLogin';

/**
 * The interrupted-attempt note, kept next to the session file.
 *
 * It is written when a pairing starts and removed when the attempt ends, so a process kill leaves
 * exactly one record behind: "an attempt was running". The file holds the public pairing topic only.
 */
const ATTEMPT_DIRECTORY = 'nexus-session';
const ATTEMPT_FILE = 'xportal-attempt.json';

function attemptDirectory(): Directory {
  return new Directory(Paths.document, ATTEMPT_DIRECTORY);
}

function attemptFile(): File {
  return new File(attemptDirectory(), ATTEMPT_FILE);
}

export function readXPortalAttempt(): XPortalAttempt | null {
  try {
    const file = attemptFile();
    if (!file.exists) return null;
    const value: unknown = JSON.parse(file.textSync());
    if (!value || typeof value !== 'object') return null;
    const record = value as Partial<XPortalAttempt>;
    if (typeof record.topic !== 'string' || typeof record.phase !== 'string' || typeof record.startedAt !== 'number') return null;
    if (!record.topic || !Number.isFinite(record.startedAt)) return null;
    return { topic: record.topic, phase: record.phase, startedAt: record.startedAt };
  } catch { return null; }
}

export function writeXPortalAttempt(record: XPortalAttempt | null): void {
  if (!record) return;
  try {
    const directory = attemptDirectory();
    directory.create({ idempotent: true, intermediates: true });
    const temporary = new File(directory, `${ATTEMPT_FILE}.tmp`);
    temporary.create({ overwrite: true });
    temporary.write(JSON.stringify(record));
    temporary.moveSync(attemptFile(), { overwrite: true });
  } catch { /* the note is a convenience; a failed write never blocks a login */ }
}

export function clearXPortalAttempt(): void {
  try {
    const file = attemptFile();
    if (file.exists) file.delete();
  } catch { /* nothing to clear */ }
}
