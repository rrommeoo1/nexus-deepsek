/* global __dirname */
// Where the phone's requests go.
//
// The app used to fall back to the hosted Railway deployment whenever `EXPO_PUBLIC_NEXUS_API_URL`
// was missing, so a development build whose shell had forgotten the variable quietly read
// production while the PC sat idle. `lib/apiOrigin.ts` now decides in one place: the variable, then
// the host Metro served the bundle from (the PC that also runs the backend), and only then the
// hosted deployment — announced, never silent. No PC address is written in any source file.
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

test('a development build follows the PC that served the bundle, not Railway', () => {
  const { API_ORIGIN } = loadApiOrigin({ hostUri: '192.168.1.153:8081' });
  assert.equal(API_ORIGIN, 'http://192.168.1.153:5000');
});

test('a packager on the loopback address is not a phone address', () => {
  // `localhost` inside the app is the phone itself: guessing it would be worse than the hosted
  // default, so this case is treated as "no packager host" and says so.
  const { API_ORIGIN, warnings } = loadApiOrigin({ hostUri: 'localhost:8081' });
  assert.equal(API_ORIGIN, 'https://nexus-deepsek-production.up.railway.app');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /no configured origin and no packager host/);
});

test('a release build without any configuration announces what it uses', () => {
  const { API_ORIGIN, warnings } = loadApiOrigin({});
  assert.equal(API_ORIGIN, 'https://nexus-deepsek-production.up.railway.app');
  assert.match(warnings[0], /nexus-deepsek-production\.up\.railway\.app/);
});

test('the shell can name the origin it talks to', () => {
  const { apiOriginLabel } = loadApiOrigin({ configured: 'http://192.168.1.153:5000' });
  assert.equal(apiOriginLabel('http://192.168.1.153:5000'), 'API: local');
  assert.equal(apiOriginLabel('http://127.0.0.1:5000'), 'API: local');
  assert.equal(apiOriginLabel('https://nexus-deepsek-production.up.railway.app'), 'API: Railway');
  assert.equal(apiOriginLabel('https://jungle.example.org'), 'API: jungle.example.org');
});

test('no address of the owner\'s PC is written in the sources', () => {
  // Comments may name an address as an example; a *string* may not, because that is what ships.
  const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const files = ['src/lib/apiOrigin.ts', 'src/lib/session.ts', 'src/lib/socialTypes.ts', 'src/lib/nexusApi.ts'];
  for (const file of files) {
    assert.doesNotMatch(code(read(file)), /192\.168\.\d+\.\d+/, `${file} hardcodes a LAN address`);
  }
});
