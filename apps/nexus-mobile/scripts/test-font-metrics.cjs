/* global __dirname */
// Măsura paginii de cuvinte (owner, 29 octombrie 2026): „rândurile se termină prea devreme, deși mai aveau
// loc". Motorul de flux (`lib/editorialFlow.ts`) hotărăște unde se rupe un rând înainte ca React Native să
// deseneze ceva, deci are nevoie de lățimea cuvintelor în puncte. Până acum o lua dintr-un tabel scris de
// mână („o literă mică înseamnă 0,54 din corp"), iar tabelul acela era cu 2–9 % mai lat decât fontul real:
// fiecare rând se rupea cu un cuvânt mai devreme, iar hârtia rămasă la capătul rândului era exact „spațiul
// gol" pe care ownerul îl vedea.
//
// Numerele din `src/lib/fontMetrics.ts` au fost citite din fișierele de font ale telefonului (`/system/fonts`
// de pe Xiaomi MIX Flip, 25098PN5AC): cmap → glifă, hmtx → avans, împărțit la unitsPerEm. Testul de față le
// compară cu o măsurătoare **independentă**, făcută pe același telefon de către alt motor de text: o pagină
// deschisă în Chrome pe device, cu `canvas.measureText` la aceleași corpuri (`_measure.html`), citită înapoi
// prin `uiautomator`. Modelul trebuie să fie cuprins între măsura reală și ea plus 6 % — niciodată mai
// îngust (un cuvânt tăiat), niciodată cu mult mai lat (hârtie pierdută).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');

function load(file, requireShim) {
  const out = ts.transpileModule(readFileSync(resolve(ROOT, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleShim = { exports: {} };
  new Function('module', 'exports', 'require', out)(moduleShim, moduleShim.exports, requireShim);
  return moduleShim.exports;
}

const metrics = load('src/lib/fontMetrics.ts', () => {
  throw new Error('fontMetrics.ts nu are voie să importe nimic la rulare');
});
const documentModule = load('src/lib/editorialDocument.ts', () => {
  throw new Error('editorialDocument.ts nu are voie să importe nimic la rulare');
});
const flowModule = load('src/lib/editorialFlow.ts', (id) => {
  if (id === './editorialDocument') return documentModule;
  if (id === './fontMetrics') return metrics;
  throw new Error(`editorialFlow.ts a cerut un modul neașteptat: ${id}`);
});

const { advanceOf, measureRun, LINE_SAFETY, METRIC_CHARS } = metrics;
const { measureTextWidth } = flowModule;

/**
 * Ce a măsurat Chrome-ul telefonului, în puncte CSS (= dp la 416 dpi), pe 29 octombrie 2026.
 * Rândurile sunt chiar primele rânduri ale articolului publicat (postarea 46 din baza vie) plus câteva
 * sonde alese pentru litere late, cifre și diacritice românești.
 */
const MEASURED_ON_DEVICE = [
  { family: 'serif', size: 22, real: 324.68, text: '**Nu, carnea crudă nu se spală' },
  { family: 'serif', size: 22, real: 353.35, text: 'înainte de preparare**, indiferent' },
  { family: 'serif', size: 22, real: 340.41, text: 'de tip (vită, pui, porc, miel, pește' },
  { family: 'serif', size: 22, real: 256.49, text: 'Autoritățile de siguranță' },
  { family: 'serif', size: 22, real: 325.02, text: 'aaaa iiii mmmm WWWW 0000' },
  { family: 'serif', size: 22, real: 315.46, text: 'Iluzie minimală, imensă iarnă' },
  { family: 'serif', size: 22, real: 396.52, text: 'The quick brown fox jumps over 1234' },
  { family: 'serif', size: 22, real: 112.27, text: 'șțăâîȘȚĂÂÎ' },
  { family: 'sans', size: 22, real: 312.27, text: '**Nu, carnea crudă nu se spală' },
  { family: 'sans', size: 22, real: 331.72, text: 'înainte de preparare**, indiferent' },
  { family: 'sans', size: 22, real: 330.6, text: 'de tip (vită, pui, porc, miel, pește' },
  { family: 'sans', size: 22, real: 242.68, text: 'Autoritățile de siguranță' },
  { family: 'sans', size: 22, real: 312.93, text: 'aaaa iiii mmmm WWWW 0000' },
  { family: 'sans', size: 22, real: 290.16, text: 'Iluzie minimală, imensă iarnă' },
  { family: 'sans', size: 22, real: 373.89, text: 'The quick brown fox jumps over 1234' },
  { family: 'sans', size: 22, real: 106.55, text: 'șțăâîȘȚĂÂÎ' },
  { family: 'mono', size: 22, real: 396.06, text: '**Nu, carnea crudă nu se spală' },
  { family: 'mono', size: 22, real: 448.87, text: 'înainte de preparare**, indiferent' },
  { family: 'mono', size: 22, real: 475.28, text: 'de tip (vită, pui, porc, miel, pește' },
  { family: 'mono', size: 22, real: 330.05, text: 'Autoritățile de siguranță' },
  { family: 'mono', size: 22, real: 316.87, text: 'aaaa iiii mmmm WWWW 0000' },
  { family: 'mono', size: 22, real: 382.91, text: 'Iluzie minimală, imensă iarnă' },
  { family: 'mono', size: 22, real: 462.09, text: 'The quick brown fox jumps over 1234' },
  { family: 'mono', size: 22, real: 132.03, text: 'șțăâîȘȚĂÂÎ' },
];

test('măsura modelului stă între fontul real și el plus șase la sută', () => {
  for (const row of MEASURED_ON_DEVICE) {
    const model = measureTextWidth(row.text, row.size, row.family);
    const ratio = model / row.real;
    assert.ok(ratio >= 1, `„${row.text}” (${row.family}) este măsurat mai îngust decât fontul real: ${ratio.toFixed(3)}`);
    assert.ok(ratio <= 1.06, `„${row.text}” (${row.family}) este măsurat prea lat: ${ratio.toFixed(3)}`);
  }
});

test('tabelul vechi era mai lat decât fontul; al nostru nu mai este', () => {
  /**
   * Tabelul scris de mână (0,54 pentru o literă mică, 0,28 pentru spațiu, ×1,035 la final) dădea 362,2dp
   * pentru primul rând al articolului la 24dp — iar telefonul îl desena în 354,2dp. Diferența de 2,3 % nu
   * pare multă, dar pe un rând de 422dp însemna zece puncte de hârtie goală la fiecare rând, iar cuvintele
   * care ar fi încăput în ele coborau pe rândul următor: exact „spațiul gol" reclamat de owner.
   */
  const line = '**Nu, carnea crudă nu se spală';
  const now = measureTextWidth(line, 22, 'serif');
  const old = (() => {
    const NARROW = new Set('ijl.,:;\'!|`'.split(''));
    const WIDE = new Set('mwMW@%'.split(''));
    let total = 0;
    for (const char of Array.from(line)) {
      let factor;
      if (char === ' ') factor = 0.28;
      else if (NARROW.has(char)) factor = 0.31;
      else if (WIDE.has(char)) factor = 0.86;
      else if (char >= 'A' && char <= 'Z') factor = 0.68;
      else if (char >= '0' && char <= '9') factor = 0.56;
      else factor = 0.54;
      total += factor * 22;
    }
    return total * 1.035;
  })();
  const device = 324.68;
  assert.ok(now < old, 'modelul nou este mai îngust decât cel vechi');
  assert.ok(Math.abs(now / device - 1) < 0.03, `modelul nou este la ${((now / device - 1) * 100).toFixed(1)}% de telefon`);
  assert.ok(old / device > 1.02, 'modelul vechi se abătea cu peste 2 % — de aici rândurile rupte prea devreme');
});

test('literele înguste rămân înguste, iar cele late rămân late', () => {
  const width = (char) => advanceOf(char, 'serif');
  assert.ok(width('i') < width('n'), 'i este mai îngust decât n');
  assert.ok(width('n') < width('m'), 'n este mai îngust decât m');
  assert.ok(width('m') < width('W'), 'm este mai îngust decât W');
  assert.ok(width(' ') < width('i'), 'spațiul este cel mai îngust dintre toate');
  assert.ok(width('m') > width('a') * 1.5, 'm este aproape dublu față de a, nu „un pic mai lat”');
});

test('mono are un singur pas, oricare ar fi litera', () => {
  const sample = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ăâîșț.,!?-';
  for (const char of Array.from(sample)) {
    assert.equal(advanceOf(char, 'mono'), advanceOf('n', 'mono'), `„${char}” nu are pasul mono`);
  }
  assert.equal(measureTextWidth('abcd', 20, 'mono'), measureTextWidth('wxyz', 20, 'mono'));
});

test('boldul serif are propriul tabel, iar sansul crește cu 4,5 %', () => {
  const bold = advanceOf('a', 'serif', true);
  const regular = advanceOf('a', 'serif');
  assert.ok(bold > regular, 'un titlu este mai lat decât rândul de sub el');
  assert.equal(advanceOf('a', 'sans', true), advanceOf('a', 'sans') * 1.045, 'fără tabel bold, sansul crește egal');
  assert.equal(advanceOf('a', 'mono', true), advanceOf('a', 'mono'), 'un mono bold nu își schimbă pasul');
});

test('un caracter necunoscut este socotit lat, nu îngust', () => {
  // Un emoji este desenat de Noto Color Emoji, al cărui avans este ~1,28 din corp.
  assert.ok(advanceOf('\u{1F5A4}', 'serif') >= 1.2, 'inima neagră ocupă locul unui emoji');
  // O literă chirilică sau un titlu CJK nu are tabel: modelul preferă să greșească în lat.
  assert.ok(advanceOf('\u4e2d', 'serif') >= 1, 'un caracter CJK are corpul întreg');
  assert.ok(advanceOf('\u0416', 'serif') >= 0.7, 'o literă necunoscută nu este tratată ca un spațiu');
});

test('marja de siguranță este mică și se aplică o singură dată', () => {
  assert.ok(LINE_SAFETY >= 1 && LINE_SAFETY <= 1.02, 'marja rămâne sub 2 %');
  assert.equal(measureRun('', 22, 'serif'), 0, 'un rând gol nu are lățime');
  const one = advanceOf('a', 'serif') * 22;
  assert.ok(Math.abs(measureRun('a', 22, 'serif') - one * LINE_SAFETY) < 1e-9, 'o literă = avansul ei × corp × marjă');
  // Dublul corpului înseamnă dublul lățimii: măsura este liniară în corpul literei.
  assert.ok(Math.abs(measureRun('un text oarecare', 44, 'serif') - 2 * measureRun('un text oarecare', 22, 'serif')) < 1e-9);
});

test('tabelele acoperă toată pagina: ASCII, latină extinsă și literele românești', () => {
  assert.ok(METRIC_CHARS >= 200, 'peste două sute de caractere măsurate, nu doar alfabetul');
  for (const char of Array.from('Aa Zz 09 .,;:!?-–—…„”‘’«»')) {
    /** Un caracter din tabel nu cade pe clasa de siguranță a necunoscutelor (0,8). */
    assert.notEqual(advanceOf(char, 'serif'), 0.8, `„${char}” lipsește din tabel`);
  }
  for (const char of Array.from('ăâîșțĂÂÎȘȚ')) {
    assert.notEqual(advanceOf(char, 'serif'), 0.8, `„${char}” lipsește din tabel`);
  }
});

test('rândul publicat este desenat în punctele în care a fost măsurat', () => {
  /**
   * Măsura din `editorialFlow` este în puncte fixe. Dacă pagina ar lăsa sistemul să mărească litera
   * (`allowFontScaling`, care e implicit), un cititor cu textul mărit ar vedea rândurile curgând peste
   * marginea dreaptă și peste bară — pentru că fluxul ar crede în continuare că încap. De aceea rândul
   * publicat își oprește scalarea, iar `RichText` o poartă mai departe la fiecare segment.
   */
  const page = readFileSync(resolve(ROOT, 'src/components/EditorialPage.tsx'), 'utf8');
  assert.match(page, /<RichText[\s\S]{0,200}?allowFontScaling=\{false\}/, 'rândul paginii nu se scalează');
  const rich = readFileSync(resolve(ROOT, 'src/components/RichText.tsx'), 'utf8');
  assert.match(rich, /allowFontScaling=\{allowFontScaling\}/, 'segmentul moștenește hotărârea rândului');
  assert.match(page, /<Text allowFontScaling=\{false\} numberOfLines=\{1\} ellipsizeMode="clip" style=\{type\}>/,
    'rândul scris în compozitor se desenează la fel');
});

