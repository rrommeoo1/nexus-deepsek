/* global __dirname */
// Where the phone's requests go.
//
// Jungle Book's backend is this PC: `tools/local-backend`, port 5000, data under `C:\Nexus\data`. The app
// used to fall back to a hosted Railway deployment whenever `EXPO_PUBLIC_NEXUS_API_URL` was missing, so a
// development build whose shell had forgotten the variable quietly read *and wrote* production while the
// PC sat idle. Round 34 removed that fallback (`JUNGLE_BOOK_PROGRESS.md` §34.2): the resolution is now the
// variable, then the host Metro served the bundle from, then the phone's own loopback through
// `adb reverse tcp:5000` — and that last one says so on the console. No remote address is written in any
// source file, and the test below fails if one ever comes back.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(ROOT, file), 'utf8');

function loadApiOrigin({ configured, hostUri } = {}) {
  const compiled = ts.transpileModule(read('src/lib/apiOrigin.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const warnings = [];
  const moduleShim = { exports: {} };
  const requireShim = (id) => {
    if (id === 'expo-constants') {
      // Marked as an ES module so the transpiled `default` import lands on the shim itself.
      return { __esModule: true, default: { expoConfig: hostUri === undefined ? null : { hostUri } } };
    }
    throw new Error(`apiOrigin.ts asked for ${id}`);
  };
  const previous = process.env.EXPO_PUBLIC_NEXUS_API_URL;
  if (configured === undefined) delete process.env.EXPO_PUBLIC_NEXUS_API_URL;
  else process.env.EXPO_PUBLIC_NEXUS_API_URL = configured;
  const warn = console.warn;
  console.warn = (message) => { warnings.push(String(message)); };
  try {
    new Function('module', 'exports', 'require', compiled)(moduleShim, moduleShim.exports, requireShim);
  } finally {
    console.warn = warn;
    if (previous === undefined) delete process.env.EXPO_PUBLIC_NEXUS_API_URL;
    else process.env.EXPO_PUBLIC_NEXUS_API_URL = previous;
  }
  return { ...moduleShim.exports, warnings };
}

test('a configured origin wins, and a trailing slash is not part of it', () => {
  const { API_ORIGIN, warnings } = loadApiOrigin({ configured: 'http://10.0.0.9:5000/', hostUri: '192.168.1.153:8081' });
  assert.equal(API_ORIGIN, 'http://10.0.0.9:5000');
  assert.deepEqual(warnings, []);
});

test('a development build follows the PC that served the bundle', () => {
  const { API_ORIGIN } = loadApiOrigin({ hostUri: '192.168.1.153:8081' });
  assert.equal(API_ORIGIN, 'http://192.168.1.153:5000');
});

test('a packager on the loopback address falls back to the phone\'s own tunnel, not to a remote server', () => {
  // `localhost` inside the app is the phone itself, so the packager's host names nothing reachable — but
  // the answer is still this PC: `adb reverse tcp:5000` forwards the phone's loopback to it.
  const { API_ORIGIN, warnings } = loadApiOrigin({ hostUri: 'localhost:8081' });
  assert.equal(API_ORIGIN, 'http://localhost:5000');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /no configured origin and no packager host/);
  assert.match(warnings[0], /adb reverse tcp:5000/);
});

test('a build with no configuration at all uses the same local tunnel and announces it', () => {
  const { API_ORIGIN, warnings } = loadApiOrigin({});
  assert.equal(API_ORIGIN, 'http://localhost:5000');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /http:\/\/localhost:5000/);
});

test('the shell can name the origin it talks to', () => {
  const { apiOriginLabel } = loadApiOrigin({ configured: 'http://192.168.1.153:5000' });
  assert.equal(apiOriginLabel('http://192.168.1.153:5000'), 'API: local');
  assert.equal(apiOriginLabel('http://127.0.0.1:5000'), 'API: local');
  assert.equal(apiOriginLabel('http://10.1.2.3:5000'), 'API: local');
  assert.equal(apiOriginLabel('https://jungle.example.org'), 'API: jungle.example.org');
});

// Strips comments but keeps `http://` intact: `//` after a colon is part of a URL, not a comment.
const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

test('no address of another machine is written in the sources', () => {
  // Comments may name an address as an example; a *string* may not, because that is what ships.
  const files = ['src/lib/apiOrigin.ts', 'src/lib/session.ts', 'src/lib/socialTypes.ts', 'src/lib/nexusApi.ts'];
  for (const file of files) {
    assert.doesNotMatch(stripComments(read(file)), /192\.168\.\d+\.\d+/, `${file} hardcodes a LAN address`);
  }
});

test('the resolver holds exactly one URL, and it is the local backend', () => {
  const code = stripComments(read('src/lib/apiOrigin.ts'));
  const urls = [...code.matchAll(/['"`](https?:\/\/[^'"`\s]+)['"`]/g)].map((match) => match[1]);
  assert.ok(urls.includes('http://localhost:5000'), `the loopback fallback is missing: ${urls.join(', ')}`);
  for (const url of urls) {
    // Either the phone's own loopback, or the address Metro was reached on — never a fixed remote host.
    assert.match(url, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$|\$\{host\}/, `apiOrigin.ts ships ${url}`);
  }
  assert.doesNotMatch(code, /railway|herokuapp|onrender|fly\.dev/i, 'apiOrigin.ts names a hosting platform');
});

test('no mobile source names a remote backend host', () => {
  // The rule is about the data path, not about history: `HANDOFF.md` and `MIGRATION.md` keep theirs.
  const files = [
    'src/lib/apiOrigin.ts', 'src/lib/nexusApi.ts', 'src/lib/session.ts', 'src/lib/publishClient.ts',
    'src/lib/uploadClient.ts', 'src/lib/draftsClient.ts', 'src/lib/socialTypes.ts', 'src/lib/backendVersion.ts',
  ];
  for (const file of files) {
    assert.doesNotMatch(read(file), /railway\.app|\.herokuapp\.com|\.onrender\.com|\.fly\.dev/i,
      `${file} names a remote backend`);
  }
});
