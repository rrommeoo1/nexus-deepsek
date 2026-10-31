/* global __dirname */
/**
 * Câți redări ține telefonul deodată (runda 43).
 *
 * Ownerul a raportat trei omoruri `OutOfMemoryError` în `MediaCodecRenderer`. Un decodor Android nu cere
 * memorie JavaScript: cere un buffer de la sistem, iar sistemul îl refuză când prea multe redări sunt vii
 * (sau când una nu e niciodată eliberată). Numărul acela nu se vede nici într-o captură, nici într-un
 * `uiautomator dump` — de aceea fiecare redare se anunță când se deschide și când se închide
 * (`lib/playerTrace.ts`), iar telefonul poate fi întrebat cât ține.
 *
 * Testul rulează contorul însuși (nu doar textul lui): o redare deschisă crește numărul, una închisă îl
 * scade, un bilet închis de două ori nu poate face numărul negativ, iar vârful ține minte momentul cel
 * mai încărcat. A doua parte ține legătura cu codul: `RemoteVideo` și `RemoteImageSound` sunt singurele
 * două locuri care deschid o redare, și amândouă o închid la demontare.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8');

function load(relative) {
  const compiled = ts.transpileModule(read(relative), {
    fileName: relative,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const shim = { exports: {} };
  new Function('module', 'exports', 'require', compiled)(shim, shim.exports, (id) => {
    throw new Error(`${relative} cere ${id} la rulare`);
  });
  return shim.exports;
}

const trace = load('src/lib/playerTrace.ts');
const media = read('src/components/PostMedia.tsx');

test('o redare deschisă crește numărul, una închisă îl scade', () => {
  trace.clearPlayerTrace();
  assert.deepEqual(trace.livePlayers(), { total: 0, video: 0, audio: 0 });

  const clip = trace.playerOpened('video', 'abc123');
  const sound = trace.playerOpened('audio', 'still-sound');
  assert.deepEqual(trace.livePlayers(), { total: 2, video: 1, audio: 1 });
  assert.equal(trace.peakPlayers(), 2);

  trace.playerClosed(clip);
  assert.deepEqual(trace.livePlayers(), { total: 1, video: 0, audio: 1 });
  trace.playerClosed(sound);
  assert.deepEqual(trace.livePlayers(), { total: 0, video: 0, audio: 0 });

  /** Vârful rămâne cel atins: o pagină liniștită nu șterge dovada unei swiperi încărcate. */
  assert.equal(trace.peakPlayers(), 2);
});

test('un bilet închis de două ori nu poate face numărul negativ', () => {
  trace.clearPlayerTrace();
  const id = trace.playerOpened('video', 'abc123');
  trace.playerClosed(id);
  trace.playerClosed(id);
  trace.playerClosed(9999);
  assert.equal(trace.livePlayers().total, 0);
  assert.equal(trace.peakPlayers(), 1);
});

test('fiecare redare a aplicației se anunță și se eliberează la demontare', () => {
  /** Un clip: `useVideoPlayer` ține decodorul cât trăiește componenta. */
  assert.match(media, /import \{ playerClosed, playerOpened \} from '\.\.\/lib\/playerTrace';/);
  assert.match(media, /ticket\.current = playerOpened\('video', item\?\.hash \?\? 'clip'\);/);
  assert.match(media, /return \(\) => \{ playerClosed\(ticket\.current\); ticket\.current = 0; \};/,
    'demontarea închide biletul, adică eliberează redarea');
  /** O coloană sonoră: al doilea redător, numărat separat. */
  assert.match(media, /ticket\.current = playerOpened\('audio', 'still-sound'\);/);
});

test('o galerie redă doar pagina din față', () => {
  /**
   * Regula care ține playback-ul la un clip pe card: pagina de galerie pornește doar clipul din față
   * (`played`). Ce face *montarea* (câte decodoare stau pregătite, nu pornite) se măsoară pe telefon cu
   * contorul de mai sus — `HANDOFF.md` §0.43 ține numărul citit din `adb logcat`.
   */
  assert.match(read('src/components/PostReading.tsx'), /const played = active && index === page;/);
});
