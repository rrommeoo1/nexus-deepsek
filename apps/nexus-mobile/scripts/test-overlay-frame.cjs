/* global __dirname */
/**
 * Un singur dreptunghi pentru textul de peste un clip: cel din previzualizarea compozitorului și cel din
 * postarea publicată.
 *
 * Runda 41 (owner, 31 octombrie 2026): „adaug text pe un video și previzualizarea arată altfel decât
 * postarea — textul devine prea mare, stă în alt loc, iese din ecran". Cauza nu era stilul, ci geometria:
 * compozitorul măsura cuvintele într-o cutie 9:16 centrată (`contain`, 469 dp lățime), iar reader-ul le
 * măsura în dreptunghiul de conținut al unui `cover` (574 dp lățime, tăiat pe lateral), la `0.07 × lățime`.
 *
 * Testul ține aritmetica (`lib/overlayFrame.ts`) și faptul că **amândouă** suprafețele o folosesc.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8');
const compile = (relative) => ts.transpileModule(read(relative), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function loadModule(relative, overrides = {}) {
  const shim = { exports: {} };
  const requireShim = (id) => {
    if (Object.prototype.hasOwnProperty.call(overrides, id)) return overrides[id];
    throw new Error(`${relative} nu are voie să importe ${id} la rulare`);
  };
  new Function('module', 'exports', 'require', compile(relative))(shim, shim.exports, requireShim);
  return shim.exports;
}

const { creatorTokens } = loadModule('src/theme/creator.ts');
const overlay = loadModule('src/lib/overlayFrame.ts', { '../theme/creator': { creatorTokens } });

/** Telefonul de dezvoltare: 1220×2656 px la 2.6, adică ~469×1021 dp. */
const PHONE = { width: 469, height: 1021 };

test('dreptunghiul de conținut al unui `cover` e mai lat decât ecranul, iar al unui `contain` e mai scund', () => {
  const cover = overlay.mediaContentRect({ ...PHONE, ratio: 9 / 16, fit: 'cover' });
  assert.equal(Math.round(cover.height), 1021, 'un clip vertical acoperă toată înălțimea');
  assert.ok(cover.width > PHONE.width, 'și e tăiat pe lateral: dreptunghiul e mai lat decât telefonul');
  assert.equal(Math.round(cover.width), 574);
  assert.equal(Math.round(cover.left), -53, 'centrat: jumătate din tăiere în fiecare parte');
  assert.equal(Math.round(cover.top), 0);

  const contain = overlay.mediaContentRect({ ...PHONE, ratio: 9 / 16, fit: 'contain' });
  assert.equal(Math.round(contain.width), PHONE.width, 'un `contain` încape pe latime');
  assert.equal(Math.round(contain.height), 834);
  assert.equal(Math.round(contain.top), 94, 'și lasă două benzi egale sus și jos');
  assert.equal(Math.round(contain.left), 0);

  const photo = overlay.mediaContentRect({ ...PHONE, ratio: 3 / 4, fit: 'cover' });
  assert.equal(Math.round(photo.height), 1021);
  assert.equal(Math.round(photo.width), 766, 'o poză 3:4 acoperă la fel, cu alt decupaj');

  assert.deepEqual(overlay.mediaContentRect({ width: 0, height: 0, ratio: 9 / 16 }), { width: 0, height: 0, left: 0, top: 0 },
    'fără măsurătoare nu se inventează un dreptunghi');
  assert.equal(Math.round(overlay.mediaContentRect({ ...PHONE, ratio: 0, fit: 'cover' }).width), 574,
    'un raport absurd cade pe 9:16, nu pe împărțire cu zero');
});

test('textul se măsoară după dreptunghiul de conținut, nu după telefon și nu după cutia previzualizării', () => {
  const cover = overlay.mediaContentRect({ ...PHONE, ratio: 9 / 16, fit: 'cover' });
  const published = overlay.overlayFontSize('TEXT', cover.width);
  assert.ok(Math.abs(published - 40.2) < 0.2, `reader-ul tipărește ~40 pt, nu ${published}`);

  /** Ce făcea compozitorul înainte: o cutie `contain` de 469 și un 27 fix, în cod. */
  const box = overlay.overlayFontSize('TEXT', PHONE.width);
  assert.ok(Math.abs(box - 32.8) < 0.2);
  assert.notEqual(Math.round(box), 27, 'nici măcar cutia veche nu dă 27: acel număr era inventat');

  assert.equal(overlay.overlayFontSize('TEXT', 100), creatorTokens.decoration.minFontSize);
  assert.equal(overlay.overlayFontSize('TEXT', 4000), creatorTokens.decoration.maxFontSize);
  assert.equal(overlay.overlayFontSize('LOCATION', 4000), creatorTokens.decoration.locationMaxFontSize);
  assert.equal(overlay.overlayFontSize('LOCATION', 10), creatorTokens.decoration.locationMinFontSize);
  assert.ok(overlay.overlayFontSize('LOCATION', cover.width) < published, 'un loc se scrie mai mic decât un text');
});

test('umplutura și lățimea maximă vin din foaia creatorului, nu din alt loc', () => {
  assert.deepEqual(overlay.overlayPadding('TEXT'), {
    horizontal: creatorTokens.decoration.horizontalPadding,
    vertical: creatorTokens.decoration.verticalPadding,
  });
  assert.deepEqual(overlay.overlayPadding('TIME'), {
    horizontal: creatorTokens.decoration.timeHorizontalPadding,
    vertical: creatorTokens.decoration.timeVerticalPadding,
  });
  assert.equal(overlay.overlayMaxWidth('TEXT'), 0.78);
  assert.equal(overlay.overlayMaxWidth('LOCATION'), 0.86);
  assert.equal(overlay.overlayPadding('LOCATION').horizontal, creatorTokens.decoration.horizontalPadding);
});

test('procentul din manifest și fracțiunea din previzualizare sunt aceeași poziție', () => {
  assert.equal(overlay.overlayPercent(0.4), 40);
  assert.equal(overlay.overlayPercent(0.5), 50);
  assert.equal(overlay.overlayPercent(0.999), 92, 'un text nu poate ieși din cadru');
  assert.equal(overlay.overlayPercent(-3), 8);
  assert.equal(overlay.overlayPercent(NaN), 50);
  assert.equal(overlay.overlayFraction(40), 0.4);
  assert.equal(overlay.overlayFraction(0), 0);
  assert.equal(overlay.overlayFraction(NaN), 0.5);
  assert.equal(overlay.clampOverlayPosition(0.08), overlay.OVERLAY_LIMITS.min);
  assert.equal(overlay.clampOverlayPosition(0.92), overlay.OVERLAY_LIMITS.max);
});

test('fereastra vizibilă a unui `cover` taie doar coloanele din afara ecranului', () => {
  const cover = overlay.mediaContentRect({ ...PHONE, ratio: 9 / 16, fit: 'cover' });
  const window = overlay.overlayWindow({ ...PHONE, rect: cover });
  assert.equal(Math.round(window.left), 53, 'prima coloană ascunsă e tăierea din stânga');
  assert.equal(Math.round(window.right), 522, 'și ultima e cea din dreapta');
  assert.equal(window.top, 0, 'pe verticală nu se taie nimic');
  assert.equal(window.bottom, Math.round(cover.height));

  const contain = overlay.mediaContentRect({ ...PHONE, ratio: 9 / 16, fit: 'contain' });
  const inside = overlay.overlayWindow({ ...PHONE, rect: contain });
  assert.deepEqual(inside, { left: 0, top: 0, right: contain.width, bottom: contain.height },
    'un `contain` încape în întregime: fereastra e dreptunghiul');
});

test('amândouă suprafețele desenează cu același modul, nu cu două socoteli', () => {
  const published = read('src/components/PostDecorations.tsx');
  const layer = read('src/components/PostOverlay.tsx');
  const composer = read('src/components/CaptureEditor.tsx');
  const manifest = read('src/lib/studioManifest.ts');

  assert.match(published, /import \{ mediaContentRect, type OverlayFit \} from '\.\.\/lib\/overlayFrame'/);
  assert.match(published, /<PostOverlay decorations=\{decorations\} bounds=\{bounds\} ratio=\{ratio\} fit=\{fit\} now=\{now\} \/>/,
    'o postare publicată desenează cu stratul comun');
  assert.doesNotMatch(published, /creatorTokens/, 'postarea nu-și mai socotește singură tipul');

  assert.match(layer, /overlayFontSize\(kind, rect\.width\)/, 'tipul se măsoară după dreptunghiul de conținut');
  assert.match(layer, /overlayPadding\(kind\)/);
  assert.match(layer, /overlayMaxWidth\(kind\) \* 100/);
  assert.match(layer, /mediaContentRect\(\{ width: bounds\.width, height: bounds\.height, ratio, fit \}\)/);

  assert.match(composer, /<PostOverlay[\s\S]{0,400}decorations=\{previewDecorations\}/, 'compozitorul desenează cu același strat');
  assert.match(composer, /studioDecorations\(capture, draft\)/, 'și cu exact decorările pe care le va publica');
  assert.match(composer, /mediaContentRect\(\{/);
  assert.match(composer, /onMove=\{moveDecoration\}/, 'o etichetă trasă rămâne aceeași etichetă, doar mutabilă');
  assert.doesNotMatch(composer, /fontSize: 27/, 'cele 27 de puncte inventate au plecat');
  assert.doesNotMatch(composer, /contentFit="contain"/, 'clipul se desenează cu regula reader-ului, nu cu o cutie');

  assert.match(manifest, /export function studioDecorations\(capture: LocalCapture, draft: LocalDraft\): StudioDecoration\[\]/,
    'lista de decorări e o funcție proprie, pe care previzualizarea o poate citi');
  assert.match(manifest, /const decorations = studioDecorations\(capture, draft\);[\s\S]{0,120}if \(!decorations\.length\) return null;/,
    'manifestul publicării folosește exact aceeași listă');
});
