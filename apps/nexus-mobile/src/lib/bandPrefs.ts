import { Directory, File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';

/**
 * `Banda derulantă`, the reader's own switch (`MIGRATION.md` §20.2).
 *
 * The band used to stop when the system said "reduced motion". The owner asked for the opposite: the
 * band travels unless the reader turns it off, and the switch for that lives in the drawer, next to the
 * build line, because the drawer is the one index this app opens on every screen. Default is on.
 *
 * It is stored as a small JSON file in the app's private documents — the same place and the same
 * write-then-rename as the session (`lib/session.ts`), so a half-written file can never be read as a
 * preference. No new dependency: `expo-file-system` is already the app's store for durable state.
 *
 * Readers in the UI subscribe through `useBandScrolling`, which is `useSyncExternalStore` over the
 * module's value: flipping the switch redraws the band at once, and a screen mounted earlier does not
 * keep a stale answer.
 */
export const BAND_SCROLLING_DEFAULT = true;

const PREFS_DIRECTORY = 'nexus-prefs';
const PREFS_FILE = 'band.json';

export type BandPrefs = { scrolling: boolean };

function prefsDirectory(): Directory {
  return new Directory(Paths.document, PREFS_DIRECTORY);
}

function prefsFile(): File {
  return new File(prefsDirectory(), PREFS_FILE);
}

function isBandPrefs(value: unknown): value is BandPrefs {
  return Boolean(value) && typeof value === 'object' && typeof (value as BandPrefs).scrolling === 'boolean';
}

let cached: boolean | undefined;
const listeners = new Set<() => void>();

/** The current preference, read from disk once and then from memory. A file that cannot be read is "on". */
export function readBandScrolling(): boolean {
  if (cached !== undefined) return cached;
  try {
    const file = prefsFile();
    if (!file.exists) { cached = BAND_SCROLLING_DEFAULT; return cached; }
    const value: unknown = JSON.parse(file.textSync());
    cached = isBandPrefs(value) ? value.scrolling : BAND_SCROLLING_DEFAULT;
  } catch { cached = BAND_SCROLLING_DEFAULT; }
  return cached;
}

/** Flip the switch: it holds for this run even if the file cannot be written. */
export function setBandScrolling(scrolling: boolean): void {
  cached = scrolling;
  try {
    const directory = prefsDirectory();
    directory.create({ idempotent: true, intermediates: true });
    const temporary = new File(directory, `${PREFS_FILE}.tmp`);
    temporary.create({ overwrite: true });
    temporary.write(JSON.stringify({ scrolling }));
    temporary.moveSync(prefsFile(), { overwrite: true });
  } catch { /* the choice still applies until the app is closed */ }
  listeners.forEach((listener) => listener());
}

export function subscribeBandScrolling(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The preference, live. `false` means the band is a static line. */
export function useBandScrolling(): boolean {
  return useSyncExternalStore(subscribeBandScrolling, readBandScrolling, readBandScrolling);
}
