/* global __dirname */
/**
 * Trei mărimi, un ciclu, patru atingeri — și pe pagina de text, nu doar peste poză (runda 47).
 *
 * Ownerul: „Editorialul principal încă folosește sistemul vechi `TEXT_SIZES`, cu patru mărimi. Vreau trei
 * mărimi consecvent: Mic/implicit → Mediu → Mare → iar Mic." Runda 46 făcuse ciclul pentru textul peste
 * poză, stickere și emoji (`lib/overlayPresets.ts`); aici se ține al patrulea ciclu, cel al **paginii**
 * (`lib/textStyle.ts` + `lib/editorialDocument.ts`), plus compatibilitatea cu rândurile scrise deja.
 *
 * Regulile care nu au voie să cadă:
 *   - exact trei pași, aceiași trei id-uri ca peste poză (`small`, `medium`, `large`);
 *   - a patra atingere nu este o a patra mărime, ci întoarcerea la prima;
 *   - `xlarge` rămâne citibil (rândurile vechi se deschid exact cum au fost scrise) și rămâne acceptat de
 *     server, dar nu mai este oferit;
 *   - `auto` este „Mic/implicit", nu un al patrulea pas;
 *   - serverul primește toate cele trei mărimi — nu se inventează o valoare pe care el o refuză.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8');
const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

/** `editorialDocument.ts` nu importă nimic la rulare — se încarcă singur. */
const editorial = { exports: {} };
new Function('module', 'exports', 'require', transpile(read('src/lib/editorialDocument.ts')))(editorial, editorial.exports, (id) => {
  throw new Error(`editorialDocument.ts nu are voie să importe ${id} la rulare`);
});
/** `textStyle.ts` importă doar documentul editorial: i-l dăm pe cel de sus. */
const style = { exports: {} };
new Function('module', 'exports', 'require', transpile(read('src/lib/textStyle.ts')))(style, style.exports, (id) => {
  if (id === './editorialDocument') return editorial.exports;
  throw new Error(`textStyle.ts a cerut un modul neașteptat: ${id}`);
});
const {
  TEXT_SIZE_CYCLE, TEXT_SIZES, nextTextSize, sizeOf, textSizeCycleIndex,
} = style.exports;
const {
  EDITORIAL_TYPOGRAPHY_CYCLE, nextEditorialTypography, typographyCycleIndex,
  normalizeEditorialDocument,
} = editorial.exports;

/** Aceleași trei id-uri pe care le are ciclul de peste poză (`lib/overlayPresets.ts`, runda 46). */
const presets = { exports: {} };
new Function('module', 'exports', 'require', transpile(read('src/lib/overlayPresets.ts')))(presets, presets.exports, (id) => {
  throw new Error(`overlayPresets.ts nu are voie să importe ${id} la rulare`);
});

const SERVER_STYLE = read('../../apps/nexus-web/lib/post-text-style.js');
const SERVER_DOCUMENT = read('../../apps/nexus-web/lib/post-editorial-document.js');

test('sunt exact trei mărimi, aceleași trei pe care le au textul, stickerele și emoji-urile', () => {
  assert.equal(TEXT_SIZE_CYCLE.length, 3);
  assert.deepEqual([...TEXT_SIZE_CYCLE], ['small', 'medium', 'large']);
  assert.deepEqual([...TEXT_SIZE_CYCLE], presets.exports.OVERLAY_PRESETS.map((entry) => entry.id),
    'un singur ciclu învățat: peste poză și pe pagină, aceleași trei trepte');
  assert.equal(EDITORIAL_TYPOGRAPHY_CYCLE.length, 3);
  assert.deepEqual([...EDITORIAL_TYPOGRAPHY_CYCLE], ['small', 'medium', 'large']);
});

test('ciclul paginii: Mic → Mediu → Mare → iar Mic, la nesfârșit', () => {
  let size = 'small';
  const seen = [size];
  for (let tap = 0; tap < 6; tap += 1) {
    size = nextTextSize(size);
    seen.push(size);
  }
  assert.deepEqual(seen, ['small', 'medium', 'large', 'small', 'medium', 'large', 'small'],
    'a patra atingere nu este a patra mărime, ci întoarcerea la prima');
  // Cele patru atingeri cerute, numărate: una pornește, trei o duc înapoi la început.
  assert.equal(seen.slice(0, 4).length, 4);
  assert.equal(seen[3], 'small');
});

test('ciclul mărimii paginii compuse: implicit (Mic) → Mediu → Mare → iar Mic', () => {
  let typography = 'auto';
  const seen = [typography];
  for (let tap = 0; tap < 3; tap += 1) {
    typography = nextEditorialTypography(typography);
    seen.push(typography);
  }
  assert.deepEqual(seen, ['auto', 'medium', 'large', 'small'],
    '`auto` este „Mic/implicit", deci primul pas este Medium, iar al patrulea se întoarce la Small');
  assert.equal(nextEditorialTypography('small'), 'medium');
  assert.equal(nextEditorialTypography('large'), 'small');
  // Documentul scris de compozitor rămâne valid pentru server: cele trei valori sunt acceptate.
  for (const id of ['small', 'medium', 'large']) {
    assert.equal(normalizeEditorialDocument({ version: 1, blocks: [], typography: id }).typography, id);
  }
});

test('mărimile vechi se citesc exact cum au fost scrise, deși nu mai sunt oferite', () => {
  /**
   * `xlarge` este treapta de poster a rundelor anterioare. Rândurile care o au trebuie să se deschidă la
   * aceeași măsură (34/47), nu migrată și nu micșorată: pagina unui om nu se rescrie pentru o preferință
   * de meniu.
   */
  assert.deepEqual(sizeOf('xlarge'), { id: 'xlarge', label: 'Foarte mare', fontSize: 34, lineHeight: 47 });
  assert.equal(textSizeCycleIndex('xlarge'), 2, 'treapta veche stă pe locul celei mari');
  assert.equal(nextTextSize('xlarge'), 'small', 'de acolo, prima atingere se întoarce la Mic');
  assert.deepEqual(typographyCycleIndex('xlarge'), 2);
  assert.equal(nextEditorialTypography('xlarge'), 'small');
  assert.equal(normalizeEditorialDocument({ version: 1, blocks: [], typography: 'xlarge' }).typography, 'xlarge',
    'documentul vechi se deschide neschimbat');
  // Valorile necunoscute nu aruncă și nu mută pagina: se citesc ca primul pas.
  assert.equal(textSizeCycleIndex('enormous'), 0);
  assert.equal(typographyCycleIndex('enormous'), 0);
});

test('serverul primește toate cele trei mărimi, iar cele vechi rămân valide', () => {
  assert.match(SERVER_STYLE, /export const TEXT_SIZES = Object\.freeze\(\['small', 'medium', 'large', 'xlarge'\]\);/,
    'lista serverului acoperă cele trei trepte și o păstrează pe cea veche');
  assert.match(SERVER_DOCUMENT, /export const EDITORIAL_TYPOGRAPHIES = Object\.freeze\(\['auto', 'small', 'medium', 'large', 'xlarge'\]\);/,
    'documentul editorial este validat pe aceeași listă');
  for (const id of TEXT_SIZE_CYCLE) {
    assert.match(SERVER_STYLE, new RegExp(`'${id}'`), `serverul acceptă mărimea ${id}`);
    assert.match(SERVER_DOCUMENT, new RegExp(`'${id}'`), `documentul acceptă mărimea ${id}`);
  }
  // Tabelul de desenare păstrează toate cele patru trepte, deci nimic nu se pierde la citire.
  assert.deepEqual(TEXT_SIZES.map((entry) => entry.id), ['small', 'medium', 'large', 'xlarge']);
  for (const entry of TEXT_SIZES) {
    assert.ok(entry.fontSize > 0 && entry.lineHeight > entry.fontSize, `rândul ${entry.id} are interliniu`);
  }
});

test('compozitorul scrie ciclul în document, iar previzualizarea și pagina publicată citesc aceeași măsură', () => {
  const toolbar = strip(read('src/components/TextToolbar.tsx'));
  assert.match(toolbar,
    /door\('measure', 'Mărime', MEASURE_LABELS\[measure\], \(\) => onMeasure\(nextEditorialTypography\(measure\)\)\)/,
    'ușa de mărime este ciclul însuși, nu un panou');
  assert.doesNotMatch(toolbar, /panel === 'measure'/,
    'panoul cu `auto`, `small`, `medium`, `large`, `xlarge` a plecat: oferea patru mărimi');
  assert.doesNotMatch(toolbar, /TEXT_SIZES/, 'bara nu mai are nevoie de tabelul de desenare ca să numere treptele');

  const composer = strip(read('src/app/text.tsx'));
  assert.match(composer, /onMeasure=\{\(next\) => applyDocument\(setDocumentTypography\(draft\.document, next\), true\)\}/,
    'atingerea scrie măsura în document, cu instantaneu de undo');
  assert.match(composer, /<EditorialPage/, 'compozitorul desenează pagina cu motorul de pagină');

  /** O singură socoteală a măsurii: `editorialSizeFor` + `sizeOf`, chemate de pagina compusă. */
  const post = strip(read('src/lib/editorialPost.ts'));
  assert.match(post, /const chosen: EditorialTypography = document\.typography \?\? 'auto';/);
  const page = strip(read('src/components/EditorialPage.tsx'));
  assert.match(page, /const measure = sizeOf\(editorialSizeFor\(document, style\)\);/,
    'previzualizarea și pagina publicată își iau mărimea din aceeași funcție');
  assert.match(strip(read('src/components/EditorialArticle.tsx')), /<EditorialPage/,
    'postarea publicată desenează aceeași pagină, deci aceeași mărime');
});

