/* global __dirname */
// Pictures on the phone: where the bytes come from, and why they do not come from the URL.
//
// `/media/<hash>.<ext>` sits behind the session. `<Image source={{uri, headers}}>` is documented as
// sending those headers, `expo-video` really does (every clip answered 200/206 in
// `C:\Nexus\logs\server-2026-10-27.log`), and React Native's own image pipeline on the Xiaomi did
// not: 67 of the 70 picture requests arrived at the PC without the session and were answered `401`
// — the black frames, and „Fișierul media nu a putut fi încărcat." after them. `lib/mediaCache.ts`
// answers that by downloading each picture once, with the same headers, and drawing the frame from
// the file. This suite checks that contract against a fake file system, because the real one only
// exists on the device.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve, join, relative } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(ROOT, file), 'utf8');
/** Source without comments: a word inside a note is not a control. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

function loadMediaCache(fs) {
  const source = read('src/lib/mediaCache.ts');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleShim = { exports: {} };
  const requireShim = (id) => {
    if (id === 'expo-file-system') return fs;
    if (id === './socialTypes') return {}; // `MediaSource` is a type: nothing survives compilation
    throw new Error(`mediaCache.ts asked for ${id}`);
  };
  new Function('module', 'exports', 'require', compiled)(moduleShim, moduleShim.exports, requireShim);
  return moduleShim.exports;
}

/**
 * `expo-file-system` as the cache uses it: a `Directory` it creates, a `File` it stats, renames and
 * deletes, and `File.downloadFileAsync` — the one call that carries the session to the server.
 */
function fakeFileSystem(script = {}) {
  const files = new Map();
  const directories = new Set();
  const downloads = [];
  const failures = [...(script.fail ?? [])];
  const uriOf = (parts) => parts
    .map((part) => (typeof part === 'string' ? part : part.uri))
    .map((part, index) => (index === 0 ? part.replace(/\/$/, '') : part.replace(/^\/|\/$/g, '')))
    .join('/');

  class Directory {
    constructor(...parts) { this.uri = uriOf(parts); }
    create() { directories.add(this.uri); }
  }
  class File {
    constructor(...parts) { this.uri = uriOf(parts); }
    get exists() { return files.has(this.uri); }
    get size() { return files.has(this.uri) ? files.get(this.uri) : null; }
    delete() { files.delete(this.uri); }
    moveSync(destination) {
      const size = files.get(this.uri);
      files.delete(this.uri);
      files.set(destination.uri, size);
    }
    static async downloadFileAsync(url, destination, options = {}) {
      downloads.push({ url, destination: destination.uri, headers: { ...(options.headers ?? {}) } });
      const failure = failures.shift();
      if (failure) throw new Error(`download answered ${failure}`);
      files.set(destination.uri, 2048);
      return destination;
    }
  }
  return { expo: { Directory, File, Paths: { cache: 'file:///cache' } }, files, directories, downloads };
}

const HASH = 'a'.repeat(64);
const PICTURE = { uri: `http://192.168.1.153:5000/media/${HASH}.jpg`, headers: { Authorization: 'Bearer t', Cookie: 'nexus_session=t' } };
const CACHED = `file:///cache/nexus-media/${HASH}.jpg`;

function build(script) {
  const disk = fakeFileSystem(script);
  return { cache: loadMediaCache(disk.expo), disk };
}

test('a picture is cached under its own content-addressed name', () => {
  const { cache } = build();
  assert.equal(cache.mediaCacheName(PICTURE.uri), `${HASH}.jpg`);
  // A query string or a fragment is not part of the object: same bytes, same file.
  assert.equal(cache.mediaCacheName(`${PICTURE.uri}?v=2`), `${HASH}.jpg`);
  assert.equal(cache.mediaCacheName(`${PICTURE.uri}#page`), `${HASH}.jpg`);
  // A URL that is not a plain `<hash>.<ext>` is folded into a safe name instead of trusted.
  assert.match(cache.mediaCacheName('http://192.168.1.153:5000/media/a photo.JPG'), /^remote-[0-9a-f]{8}\.bin$/);
  assert.match(cache.mediaCacheName('https://example.test/'), /^remote-[0-9a-f]{8}\.bin$/);
});

test('the session travels with the bytes, and the frame is drawn from the file', async () => {
  const { cache, disk } = build();
  assert.equal(cache.cachedMediaUri(PICTURE), null, 'nothing is cached before the first download');
  assert.equal(cache.immediateMediaUri(PICTURE), null);

  const local = await cache.downloadMedia(PICTURE);

  assert.equal(disk.downloads.length, 1, 'one request for one picture');
  assert.equal(disk.downloads[0].url, PICTURE.uri);
  assert.deepEqual(disk.downloads[0].headers, PICTURE.headers, 'the session is on the request');
  assert.equal(local, CACHED);
  assert.equal(cache.cachedMediaUri(PICTURE), CACHED, 'the next paint reads the cache');
  assert.equal(disk.files.has(`${CACHED}.part`), false, 'nothing is left half-written');
});

test('a refused download leaves nothing behind, and the next ask tries again', async () => {
  const { cache, disk } = build({ fail: [401] });
  await assert.rejects(cache.downloadMedia(PICTURE), /401/);
  assert.equal(cache.cachedMediaUri(PICTURE), null, 'a failed attempt is not a cached picture');
  assert.equal(disk.files.has(`${CACHED}.part`), false, 'a truncated file never takes the real name');
  assert.equal(disk.directories.has('file:///cache/nexus-media'), true, 'the directory is prepared once');

  const local = await cache.downloadMedia(PICTURE);
  assert.equal(local, CACHED);
  assert.equal(disk.downloads.length, 2, 'the refusal did not poison the cache');
  assert.equal(cache.cachedMediaUri(PICTURE), CACHED);
});

test('one download, however many surfaces ask at once', async () => {
  const { cache, disk } = build();
  const grid = [cache.downloadMedia(PICTURE), cache.downloadMedia(PICTURE), cache.downloadMedia(PICTURE)];
  const uris = await Promise.all(grid);
  assert.equal(disk.downloads.length, 1, 'a grid asks about the same cell from three surfaces');
  assert.deepEqual(new Set(uris), new Set([CACHED]));
});

test('a photo picked on the device is drawn where it lies', async () => {
  const { cache, disk } = build();
  const picked = { uri: 'file:///data/user/0/app.nexus.mobile.dev/cache/pick.jpg', headers: {} };
  assert.equal(cache.isRemoteMediaSource(picked), false);
  assert.equal(await cache.resolveMediaUri(picked), picked.uri);
  assert.equal(cache.immediateMediaUri(picked), picked.uri);
  assert.equal(disk.downloads.length, 0, 'the session is not needed for a local file');
});

test('no surface draws a remote picture into a native frame', () => {
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(resolve(ROOT, directory), { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name)) files.push(path);
    }
  };
  walk('src');

  // `PostMedia.tsx` is the one place allowed to hold a picture: it owns the download and the frame.
  // `ProfileCoverPhoto.tsx` can take any source, so it must stay unwired until it reads the cache.
  const owning = new Set(['src/components/PostMedia.tsx', 'src/components/ProfileCoverPhoto.tsx']);
  const remote = /mediaSourceFor(Path)?\(|mediaItemUrl\(/;
  for (const file of files) {
    const text = code(read(file));
    if (!text.includes('<Image') || owning.has(file)) continue;
    assert.ok(!remote.test(text), `${file} hands a remote media source to a native frame`);
  }

  const postMedia = code(read('src/components/PostMedia.tsx'));
  assert.match(postMedia, /export function useMediaFile/, 'the hook every picture is drawn through exists');
  assert.match(postMedia, /source=\{\{ uri \}\}/, 'the frame is drawn from the resolved file');
  assert.match(postMedia, /downloadMedia|resolveMediaUri/, 'the hook asks the cache for the bytes');
  assert.doesNotMatch(postMedia, /source=\{source\}/, 'a remote source never reaches a native frame');

  // The cover component is not wired anywhere: no surface can reach it and lose the session again.
  for (const file of files) {
    if (file === 'src/components/ProfileCoverPhoto.tsx') continue;
    assert.ok(!code(read(file)).includes('ProfileCoverPhoto'), `${file} wires an unwired cover`);
  }
});

test('the editorial reader measures the file it draws', () => {
  const editorial = code(read('src/components/EditorialPage.tsx'));
  assert.doesNotMatch(editorial, /getSizeWithHeaders/, 'the native size probe drops the session too');
  assert.match(editorial, /resolveMediaUri\(\{ uri: entry\.uri, headers: mediaHeaders\(\) \}\)/);
  assert.match(editorial, /Image\.getSize\(local, done, fail\)/);
});
