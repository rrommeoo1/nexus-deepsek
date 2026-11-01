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
  assert.match(published, /<PostOverlay decorations=\{decorations\} bounds=\{bounds\} ratio=\{ratio\} fit=\{fit\} now=\{now\} scale=\{scale\} \/>/,
    'o postare publicată desenează cu stratul comun, la micșorarea compoziției');
  assert.doesNotMatch(published, /creatorTokens/, 'postarea nu-și mai socotește singură tipul');

  assert.match(layer, /overlayFontSize\(kind, rect\.width, scale\)/, 'tipul se măsoară după dreptunghiul de conținut, micșorat cu compoziția');
  assert.match(layer, /overlayPadding\(kind, scale\)/);
  assert.match(layer, /overlayMaxWidth\(kind, item\.scale\) \* 100/);
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

/**
 * Runda 49: stickerul se micșorează **cu** cutia, nu rămâne la minimul paginii.
 *
 * Runda 48 a măsurat pe telefon exact defectul: în pagină stickerul „Așa este😍" avea 981×217 px, iar în
 * previzualizare 547×123 px — raport 0,56 în loc de 0,48, adică mai mare decât compoziția din jur, lipit de
 * muchia cutiei. Cauza nu era poziția (`left: x%` este o fracțiune din dreptunghi, deci se micșorează
 * singură), ci **plafonul de tipografie**: `minFontSize` este o măsură a paginii, iar într-o cutie la
 * jumătate rămânea neschimbat.
 */
test('micșorarea compoziției micșorează și tipografia stickerului, cu același factor', () => {
  const page = overlay.mediaContentRect({ ...PHONE, ratio: 9 / 16, fit: 'cover' });
  const pageText = overlay.overlayFontSize('TEXT', page.width);
  /** Cutia previzualizării din runda 48: pagina micșorată la raportul ei (225×490 din 469×1021). */
  const scale = 490 / PHONE.height;
  const box = { width: Math.round(PHONE.width * scale), height: 490 };
  const rect = overlay.mediaContentRect({ ...box, ratio: 9 / 16, fit: 'cover' });

  const reduced = overlay.overlayFontSize('TEXT', rect.width, scale);
  assert.ok(Math.abs(reduced / pageText - scale) < 0.01,
    `tipografia scade cu cutia: ${reduced.toFixed(2)} / ${pageText.toFixed(2)} = ${(reduced / pageText).toFixed(3)} față de ${scale.toFixed(3)}`);

  /** Fără factorul de micșorare, socoteala veche dă exact ce s-a măsurat: minimul paginii. */
  const withoutScale = overlay.overlayFontSize('TEXT', rect.width);
  assert.equal(withoutScale, creatorTokens.decoration.minFontSize, 'runda 48 cădea pe minimul paginii');
  assert.ok(withoutScale / pageText > 0.55, 'și ieșea cu peste 15 % mai mare decât compoziția');

  /** Aceeași regulă pentru tot ce este măsură a paginii: aer, colț, umbră, spațiere. */
  const padding = overlay.overlayPadding('TEXT', scale);
  assert.equal(padding.horizontal, creatorTokens.decoration.horizontalPadding * scale);
  assert.equal(padding.vertical, creatorTokens.decoration.verticalPadding * scale);
  const clock = overlay.overlayPadding('TIME', scale);
  assert.equal(clock.horizontal, creatorTokens.decoration.timeHorizontalPadding * scale);
  assert.equal(overlay.overlayRadius('LOCATION', scale), 22 * scale);
  assert.equal(overlay.overlayRadius('TEXT', scale), 0, 'un text nu are pastilă, la nicio mărime');
  assert.equal(overlay.overlayShadowRadius(scale), 7 * scale);
  assert.equal(overlay.overlayLetterSpacing('TIME', scale), scale);
  assert.equal(overlay.overlayLetterSpacing('TEXT', scale), 0);

  /** Pagina întreagă rămâne exact ce era: factorul 1 nu schimbă nimic. */
  assert.deepEqual(overlay.overlayPadding('TEXT'), overlay.overlayPadding('TEXT', 1));
  assert.equal(overlay.overlayFontSize('TEXT', page.width, 1), pageText);
  assert.equal(overlay.overlayShadowRadius(), 7);

  /** O măsură stricată nu inversează socoteala: sub zero sau `NaN` înseamnă „pagina întreagă", nu „uriaș". */
  assert.equal(overlay.overlayFontSize('TEXT', PHONE.width, NaN), overlay.overlayFontSize('TEXT', PHONE.width));
  assert.equal(overlay.overlayFontSize('TEXT', PHONE.width, 0), overlay.overlayFontSize('TEXT', PHONE.width));
  assert.equal(overlay.overlayFontSize('TEXT', 4000, 4), creatorTokens.decoration.maxFontSize,
    'un factor peste 1 nu mărește nimic: pagina este plafonul');
});

/**
 * Runda 50 — eticheta mărită nu are voie să iasă din fereastră.
 *
 * `item.scale` (runda 46) crește eticheta în jurul centrului **după** ce a fost măsurată, iar locul în
 * care este ținută se socotea din cutia nemărită. Pe telefon, broasca de la 22 % și „Runda 50" de la 78 %
 * erau amândouă tăiate de marginea ecranului (`r50-s2`, `r50-t`).
 */
test('o etichetă mărită este ținută în fereastră cu cutia ei mărită', () => {
  const rect = { width: 574, height: 1021 };
  /** Fereastra unui `cover` pe acest telefon: dreptunghiul e mai lat, deci coloanele laterale sunt tăiate. */
  const window = { left: 52, top: 0, right: 522, bottom: 1021 };
  const size = { width: 120, height: 40 };

  const small = overlay.overlayHeldSpot({ point: { x: 0.22, y: 0.26 }, size, window, rect, scale: 1 });
  assert.equal(Math.round(small.x), 126, 'nemicșorată, eticheta stă chiar la 22 % din conținut');
  assert.equal(Math.round(small.y), 265);

  /** La 1.8 aceeași etichetă e mai lată, deci centrul ei nu mai poate sta tot la 22 %. */
  const large = overlay.overlayHeldSpot({ point: { x: 0.22, y: 0.26 }, size, window, rect, scale: 1.8 });
  assert.ok(large.x > small.x, 'un text mare la stânga este împins spre interior');
  assert.ok(large.x - (size.width * 1.8) / 2 >= window.left - 0.001,
    'și rămâne în fereastră: marginea lui stângă nu iese din ce se vede');

  /** Aceeași socoteală în oglindă, pentru o etichetă din dreapta („Runda 50" stă la 78 %). */
  const right = overlay.overlayHeldSpot({ point: { x: 0.78, y: 0.44 }, size, window, rect, scale: 1.8 });
  assert.ok(right.x + (size.width * 1.8) / 2 <= window.right + 0.001, 'nici în dreapta nu iese');
  assert.ok(right.x < 0.78 * rect.width, 'este trasă spre interior, nu lăsată peste margine');

  /** O etichetă mai lată decât fereastra întreagă se așază în mijlocul ei, nu lipită de o margine. */
  const wide = overlay.overlayHeldSpot({ point: { x: 0.1, y: 0.5 }, size: { width: 900, height: 40 }, window, rect, scale: 1 });
  assert.equal(Math.round(wide.x), Math.round((window.left + window.right) / 2));

  /** Factorul lipsă sau absurd nu schimbă nimic: se citește ca 1. */
  assert.deepEqual(
    overlay.overlayHeldSpot({ point: { x: 0.5, y: 0.5 }, size, window, rect }),
    overlay.overlayHeldSpot({ point: { x: 0.5, y: 0.5 }, size, window, rect, scale: 1 }),
  );
  assert.deepEqual(
    overlay.overlayHeldSpot({ point: { x: 0.5, y: 0.5 }, size, window, rect, scale: Number.NaN }),
    overlay.overlayHeldSpot({ point: { x: 0.5, y: 0.5 }, size, window, rect, scale: 1 }),
  );

  /** Și randatorul chiar o folosește, în amândouă suprafețele (compozitor și postare). */
  const layer = read('src/components/PostOverlay.tsx');
  assert.match(layer, /overlayHeldSpot\(\{/, 'stratul citește socoteala comună');
  assert.match(layer, /scale: item\.scale/, 'și îi dă mărimea decorării');
  assert.doesNotMatch(layer, /window\.left \+ size\.width \/ 2/, 'nu mai ține eticheta după cutia nemărită');
});

/**
 * Runda 50 — cutia unui text mărit.
 *
 * Un text avea voie la 78 % din conținut și apoi era desenat la 1,8: ieșea din cutia lui, rămânea pe un
 * singur rând și era tăiat de marginea ecranului („Clip cu sticker", `r50-u`). Cutia cere acum `78 % ÷ 1,8`,
 * deci ce se vede după mărire este exact 78 %.
 */
test('cutia unui text se împarte la mărimea lui, ca să încapă după mărire', () => {
  assert.equal(overlay.overlayMaxWidth('TEXT'), 0.78, 'neschimbat la mărimea normală');
  assert.equal(overlay.overlayMaxWidth('LOCATION'), 0.86);
  assert.equal(overlay.overlayMaxWidth('TEXT', 1.8), 0.78 / 1.8, 'cutia se strânge cu factorul');
  assert.ok(overlay.overlayMaxWidth('TEXT', 1.8) * 1.8 <= 0.78 + 1e-9, 'iar după mărire acoperă exact 78 %');
  assert.equal(overlay.overlayMaxWidth('TEXT', 0), 0.78, 'un factor absurd nu lărgește nimic');
  assert.equal(overlay.overlayMaxWidth('TEXT', Number.NaN), 0.78);

  const layer = read('src/components/PostOverlay.tsx');
  assert.match(layer, /maxWidth: `\$\{overlayMaxWidth\(kind, item\.scale\) \* 100\}%`/,
    'stratul cere cutia potrivită mărimii');
});


