import { Directory, File, Paths } from 'expo-file-system';
import type { MediaSource } from './socialTypes';

/**
 * Remote pictures, downloaded once.
 *
 * `<Image source={{uri, headers}}>` is documented as sending those headers with the request, and
 * `expo-video` really does: in `C:\Nexus\logs\server-2026-10-27.log` every clip the phone played
 * answered `200`/`206` with the session attached. React Native's own image pipeline on this device
 * does not. Of the picture requests the phone made, 67 arrived at the PC without the session and
 * `/media/<hash>.<ext>` answered `401` — the black frames, and the honest „Fișierul media nu a putut
 * fi încărcat." that followed.
 *
 * So a picture is not drawn from its URL at all. Its bytes are downloaded once, with the same
 * headers `mediaHeaders()` hands to `fetch`, into the app's own cache directory, and the frame is
 * drawn from that file. The server's rule is untouched: an anonymous request still answers `401`,
 * and a record the reader may not see still answers `404`. What changes is only *where* the app
 * makes the request — the place where headers are honoured.
 *
 * Media on this server is content-addressed (`<sha256>.<ext>`), so a cached file can never go stale
 * and the cache key is the object's own name.
 */
const CACHE_DIRECTORY = 'nexus-media';

/** The directory every downloaded picture lives in (`Paths.cache`, so the system may reclaim it). */
export function mediaCacheDirectory(): Directory {
  return new Directory(Paths.cache, CACHE_DIRECTORY);
}

/**
 * The file name of a cached picture: the last segment of the URL, which is the object's own
 * content-addressed name. A URL that is not a plain `<hash>.<ext>` is folded into a stable,
 * filesystem-safe name instead of trusting whatever the path happens to say.
 */
export function mediaCacheName(uri: string): string {
  const path = uri.split('#')[0].split('?')[0];
  const base = path.slice(path.lastIndexOf('/') + 1);
  if (/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(base) && /\.[A-Za-z0-9]{1,8}$/.test(base)) return base;
  return `remote-${stableHash(uri)}.bin`;
}

/** djb2 over the URL, eight hex digits: short, stable across launches, enough for a file name. */
function stableHash(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0;
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** True for a source that has to travel over the network with its session headers. */
export function isRemoteMediaSource(source?: MediaSource | null): boolean {
  return Boolean(source && /^https?:/i.test(source.uri));
}

/**
 * Names already known to be on disk. `File.exists` crosses into native code, and a grid asks about
 * the same twelve pictures on every render, so the answer is remembered once it is `true` — a file
 * that a reclaimed cache later removes falls back to a stat on the next cold start.
 */
const known = new Set<string>();

/**
 * The copy already on disk, read synchronously so the first paint never waits on the network.
 * `null` for a source that is not remote (a picked photo the app rendered straight from the file).
 */
export function cachedMediaUri(source?: MediaSource | null): string | null {
  if (!isRemoteMediaSource(source)) return null;
  const name = mediaCacheName(source!.uri);
  try {
    const directory = mediaCacheDirectory();
    if (known.has(name)) return new File(directory, name).uri;
    const file = new File(directory, name);
    if (!file.exists || (file.size ?? 0) <= 0) return null;
    known.add(name);
    return file.uri;
  } catch {
    return null;
  }
}

/** Where a source is drawn from when no download is needed: the file itself, or `null`. */
export function immediateMediaUri(source?: MediaSource | null): string | null {
  if (!source) return null;
  return isRemoteMediaSource(source) ? cachedMediaUri(source) : source.uri;
}

/** One download per file, however many surfaces ask for it at once. */
const inflight = new Map<string, Promise<string>>();

/**
 * Download one picture, or join the download already in flight for the same file.
 *
 * The bytes land in `<name>.part` and are renamed only once the download reports success: an
 * interrupted request must never leave a truncated picture under the real name, where it would be
 * mistaken for a cached one and drawn — or fail — forever.
 */
export function downloadMedia(source: MediaSource): Promise<string> {
  const cached = cachedMediaUri(source);
  if (cached) return Promise.resolve(cached);
  const name = mediaCacheName(source.uri);
  const running = inflight.get(name);
  if (running) return running;
  const task = write(source, name).finally(() => { inflight.delete(name); });
  inflight.set(name, task);
  return task;
}

async function write(source: MediaSource, name: string): Promise<string> {
  const directory = mediaCacheDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const file = new File(directory, name);
  const part = new File(directory, `${name}.part`);
  if (part.exists) part.delete();
  const written = await File.downloadFileAsync(source.uri, part, {
    headers: source.headers,
    idempotent: true,
  });
  written.moveSync(file, { overwrite: true });
  known.add(name);
  return file.uri;
}

/** The local file for a source, downloading it when it is not cached yet. */
export function resolveMediaUri(source: MediaSource): Promise<string> {
  const immediate = immediateMediaUri(source);
  return immediate ? Promise.resolve(immediate) : downloadMedia(source);
}
