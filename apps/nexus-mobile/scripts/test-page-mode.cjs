/* global __dirname */
/**
 * Hârtie / Noapte (runda 46): cum se citește o pagină de cuvinte și cine hotărăște.
 *
 * Ownerul a cerut două fețe pentru aceeași pagină — hârtia caldă de până acum și un **negru mat** pentru
 * cititul de noapte — plus un comutator în capul paginii, imediat înaintea porții autorului. Aici se ține
 * partea care se poate dovedi fără telefon:
 *
 *   · preferința este a **cititorului**, ținută într-un singur loc și anunțată abonaților (`lib/pageMode.ts`);
 *   · cele două palete au contrast măsurat, iar accentul autorului nu se desenează dacă nu se vede;
 *   · comutatorul stă în capul unei pagini de cuvinte, înaintea porții, iar lățimea lui intră în socoteala
 *     care hotărăște dacă poarta coboară pe rândul doi (`lib/postChrome.ts`).
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

function loadPure(relative) {
  const shim = { exports: {} };
  new Function('module', 'exports', 'require', compile(relative))(shim, shim.exports, (id) => {
    throw new Error(`${relative} nu are voie să importe ${id} la rulare`);
  });
  return shim.exports;
}

/** `textStyle.ts` are un singur import real (`editorialDocument`), ca în `test-text-style.cjs`. */
function loadTextStyle() {
  const editorial = loadPure('src/lib/editorialDocument.ts');
  const shim = { exports: {} };
  new Function('module', 'exports', 'require', compile('src/lib/textStyle.ts'))(shim, shim.exports, (id) => {
    if (id === './editorialDocument') return editorial;
    throw new Error(`textStyle.ts a cerut un modul neașteptat: ${id}`);
  });
  return shim.exports;
}

const mode = loadPure('src/lib/pageMode.ts');
const style = loadTextStyle();

test('modul este al cititorului: o singură valoare, anunțată abonaților', () => {
  mode.resetReaderPageMode();
  assert.equal(mode.activePageMode(), 'paper', 'o sesiune nouă începe pe hârtie');
  let told = 0;
  const off = mode.subscribePageMode(() => { told += 1; });
  mode.setReaderPageMode('night');
  assert.equal(mode.activePageMode(), 'night');
  assert.equal(told, 1, 'abonatul este anunțat o dată');
  mode.setReaderPageMode('night');
  assert.equal(told, 1, 'aceeași valoare nu anunță nimic: niciun control nu poate intra în buclă');
  assert.equal(mode.togglePageMode(), 'paper', 'a doua atingere întoarce hârtia');
  assert.equal(told, 2);
  off();
  mode.setReaderPageMode('night');
  assert.equal(told, 2, 'după dezabonare nu mai vine nimic');
  mode.resetReaderPageMode();
});

test('cele două fețe au nume, semn și o explicație pentru cititorul de ecran', () => {
  assert.deepEqual(mode.PAGE_MODES.map((entry) => entry.id), ['paper', 'night']);
  for (const entry of mode.PAGE_MODES) {
    assert.ok(entry.label.length > 2, `eticheta modului ${entry.id}`);
    assert.ok(entry.glyph.length > 0);
    assert.ok(entry.hint.length > 10);
  }
  assert.equal(mode.pageModeLabel('night'), 'Noapte');
  assert.equal(mode.pageModeLabel('ceva'), 'Hârtie', 'o valoare necunoscută se citește ca hârtie');
  assert.equal(mode.isNightMode('night'), true);
  assert.equal(mode.isNightMode('paper'), false);
  assert.equal(mode.nextPageMode('night'), 'paper');
  assert.equal(mode.nextPageMode('paper'), 'night');
});

test('paleta de noapte este negru mat cu cerneală deschisă, nu un gri luminat', () => {
  const night = style.pagePaletteOf(null, 'night');
  assert.equal(night.background, style.PAGE_NIGHT.background);
  assert.equal(night.text, style.PAGE_NIGHT.text);
  assert.equal(night.mark, style.PAGE_NIGHT.mark);
  /** Negru mat: fiecare canal sub 20/255 și fără nuanță vizibilă (maxim 4 diferență între canale). */
  const channels = [1, 3, 5].map((index) => parseInt(night.background.slice(index, index + 2), 16));
  assert.ok(channels.every((channel) => channel < 20), 'fundalul este negru, nu gri');
  assert.ok(Math.max(...channels) - Math.min(...channels) <= 4, 'și este neutru, nu colorat');
  assert.ok(style.contrastRatio(night.background, night.text) >= 7, 'textul trece AAA pe negru');
  assert.ok(style.contrastRatio(night.background, night.mark) >= 4.5, 'tag-urile și linkurile se pot citi');
  /** Hârtia rămâne hârtie: modul implicit nu schimbă nimic din ce era. */
  const paper = style.pagePaletteOf(null, 'paper');
  assert.equal(paper.background, '#f4efe2');
  assert.equal(paper.text, '#1a221b');
  assert.deepEqual(style.pagePaletteOf(), paper, 'fără mod, rezultatul este cel de până acum');
});

test('accentul autorului se desenează noaptea numai dacă se vede', () => {
  /** Tema `paper` are accentul verde închis al hârtiei: pe negru ar fi un fir invizibil. */
  const paperTheme = style.pagePaletteOf({ theme: 'paper' }, 'night');
  assert.equal(paperTheme.accent, style.PAGE_NIGHT.mark, 'accentul care nu se vede este înlocuit');
  /** Tema `jungle` are auriu: acela se vede pe negru și rămâne al autorului. */
  const jungle = style.pagePaletteOf({ theme: 'jungle' }, 'night');
  assert.equal(jungle.accent, '#c9a227', 'un accent care se vede rămâne al autorului');
  assert.ok(style.contrastRatio(jungle.background, jungle.accent) >= 3);
  /** Pe hârtie, accentul autorului nu se atinge. */
  assert.equal(style.pagePaletteOf({ theme: 'paper' }, 'paper').accent, '#2f5d45');
});



test('comutatorul stă în capul paginii, imediat înaintea porții autorului', () => {
  const canvas = read('src/components/PostCanvas.tsx');
  const toggle = read('src/components/PageModeToggle.tsx');
  assert.match(toggle, /export function PageModeToggle/, 'comutatorul este o componentă');
  assert.match(toggle, /accessibilityRole="tab"/, 'este un segmentat, nu două butoane fără stare');
  assert.match(toggle, /accessibilityState=\{\{ selected: on \}\}/, 'starea aleasă este spusă, nu doar colorată');
  assert.match(toggle, /setReaderPageMode\(option\.id\)/, 'atingerea scrie preferința cititorului');
  assert.match(toggle, /export const PAGE_MODE_TOGGLE_WIDTH = 60/, 'lățimea este o constantă, nu o ghicire');
  assert.match(canvas, /const pageMode = usePageMode\(\)/, 'pagina citește modul cititorului');
  assert.match(canvas, /const modeToggle = wordPage && pagePalette \? \(/, 'numai o pagină de cuvinte îl primește');
  assert.ok(canvas.indexOf('const authorWithDoor = modeToggle || authorAction ?') > 0,
    'comutatorul poate sta și singur, fără o poartă inventată');
  assert.ok(canvas.indexOf('{modeToggle}') < canvas.indexOf('{authorAction}'),
    'comutatorul este desenat imediat înaintea porții');
  assert.match(canvas, /extra: wordPage \? PAGE_MODE_TOGGLE_WIDTH : 0/,
    'lățimea lui intră în socoteala care hotărăște dacă poarta coboară pe rândul doi');
});

test('pe pagina de noapte banda capului nu se desenează: negrul delimitează singur', () => {
  const canvas = read('src/components/PostCanvas.tsx');
  assert.match(canvas, /const nightPage = Boolean\(pagePalette\) && pageMode === 'night';/);
  assert.match(canvas, /const headGeometry = nightPage \? null : headerScrim\(\{/);
  /** Hârtia își păstrează banda: pe teren luminos, cerneala închisă chiar delmitează. */
  assert.match(read('src/lib/readability.ts'), /paper: \{\s*\/\*\* Capul paginii/, 'greutatea de hârtie rămâne în sistem');
});

test('modul ajunge în toate suprafețele de citire, nu într-una singură', () => {
  const canvas = read('src/components/PostCanvas.tsx');
  assert.match(canvas, /mode=\{pageMode\}/, 'articolul publicat primește modul');
  const reading = read('src/components/PostReading.tsx');
  assert.match(reading, /pagePaletteOf\(textStyle, mode\)/, 'o pagină moștenită îl primește la fel');
  const article = read('src/components/EditorialArticle.tsx');
  assert.match(article, /mode=\{mode\}/);
  const page = read('src/components/EditorialPage.tsx');
  assert.match(page, /pagePaletteOf\(style, mode\)/, 'pagina își ia hârtia din mod');
  assert.match(page, /mode\?: PageMode/);
});

test('preferința nu este scrisă în postare și nu cere un strat de stocare care nu există', () => {
  /** Comentariile se taie înainte de potrivire: un docblock are voie să spună ce depozit *nu* folosește. */
  const bare = (relative) => read(relative).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*/gm, '');
  const store = bare('src/lib/pageMode.ts');
  assert.doesNotMatch(store, /AsyncStorage|SecureStore|fetch\(/, 'modul nu depinde de rețea sau de un depozit local');
  const canvas = bare('src/components/PostCanvas.tsx');
  assert.doesNotMatch(canvas, /pageMode[^\n]*text_style/, 'modul nu este scris în stilul postării');
});
