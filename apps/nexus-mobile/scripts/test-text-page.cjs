/* global __dirname */
// Pagina de cuvinte pe tot ecranul (owner, 27 octombrie 2026): hartia acopera suprafata disponibila,
// articolul foloseste restul, iar coltul din dreapta-jos ramane liber pentru bara de actiuni. Capul
// paginii — fata si numele autorului — este cu un pas mai mare decat acelasi cap pe un card, si numai
// acolo: o fotografie sau un clip nu primesc un chip mai mare pentru ca sunt citite pe acelasi ecran.
//
// Numerele sunt intr-un modul pur (`src/lib/textPage.ts`), deci testul le ruleaza ca pe o functie, nu le
// citeste ca pe un text; contractele de sursa spun doar cine le cheama si ce ramane neatins.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');

function load(file) {
  const out = ts.transpileModule(readFileSync(resolve(ROOT, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleShim = { exports: {} };
  new Function('module', 'exports', 'require', out)(moduleShim, moduleShim.exports, () => ({}));
  return moduleShim.exports;
}

const page = load('src/lib/textPage.ts');

const read = (file) => readFileSync(resolve(ROOT, file), 'utf8');
/** Source without comments: a sentence inside a note is not a control. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/** The canvas's own feed metrics (`METRICS.feed`), as the card is drawn today. */
const FEED = { name: 14, handle: 12, disc: 42, caption: 14, captionLine: 19, padH: 14, padB: 22, railGutter: 78 };

test('the head of a page of words is larger than the same head on a card', () => {
  const head = page.wordPageHead(FEED, true);
  assert.equal(head.disc, page.TEXT_PAGE_HEAD.disc);
  assert.ok(head.disc > FEED.disc, 'fata autorului creste');
  assert.ok(head.name > FEED.name, 'numele creste');
  assert.ok(head.handle > FEED.handle, 'si randul de sub el, ca sa nu para lipit de nume');
  // Moderately: the words are what the page is for, not the badge.
  assert.ok(head.disc <= FEED.disc * 1.35, 'fata nu devine un poster');
  assert.ok(head.name <= FEED.name * 1.3, 'numele ramane un nume');
  // Everything the page does not own is untouched: the caption sizes, the paddings, the gutter.
  assert.equal(head.caption, FEED.caption);
  assert.equal(head.padH, FEED.padH);
});

test('a picture, a clip and a cell keep the head they always had', () => {
  for (const metrics of [FEED, { name: 15, handle: 12.5, disc: 44, railGutter: 78 }, { name: 9.5, handle: 8, disc: 18, railGutter: 0 }]) {
    assert.deepEqual(page.wordPageHead(metrics, false), metrics, 'fara pagina de cuvinte, fara schimbare');
  }
});

test('the rail keeps its own footprint, and no more, on a page of words', () => {
  const gutter = page.wordPageGutter(FEED.railGutter, true);
  assert.equal(gutter, page.TEXT_PAGE_RAIL_GUTTER);
  assert.ok(gutter < FEED.railGutter, 'pagina de cuvinte nu mai pierde 78dp din latime');
  assert.ok(gutter >= page.RAIL_FOOTPRINT, 'dar bara de 56dp, la 10dp de margine, incape intreaga');
  assert.ok(gutter > page.RAIL_FOOTPRINT, 'si ii ramane aer: textul nu atinge butoanele');
  /**
   * Urma barei se masoara de la marginea *ecranului*, iar cuvintele stau in paddingul paginii: o pagina
   * care intra 14dp in ecran tine din masura ei doar 72 - 14 = 58dp. Aceeasi dreptunghi pe care il taie
   * fluxul (`wordPageRailReserve`) — vechea coloana si camera noua nu pot divergea.
   */
  const inset = page.wordPageGutter(FEED.railGutter, true, FEED.padH);
  assert.equal(inset, page.TEXT_PAGE_RAIL_GUTTER - FEED.padH,
    'paddingul paginii se scade din urma barei, nu se mai adauga peste ea');
  assert.equal(inset, page.wordPageRailReserve({ padH: FEED.padH, padB: FEED.padB, cells: 4, foot: 26 }).width,
    'coloana veche si camera fluxului taie exact acelasi dreptunghi');
  // O fotografie sau un clip nu primesc paddingul paginii peste coltura lor.
  assert.equal(page.wordPageGutter(FEED.railGutter, false, FEED.padH), FEED.railGutter);
  assert.equal(page.wordPageGutter(FEED.railGutter, true, 0), page.TEXT_PAGE_RAIL_GUTTER,
    'un apelant fara padding propriu primeste toata urma');
  // A reel keeps its own gutter; a cell of a list has no rail and keeps none.
  assert.equal(page.wordPageGutter(FEED.railGutter, false), FEED.railGutter);
  assert.equal(page.wordPageGutter(0, false), 0);
  assert.equal(page.wordPageGutter(null, true), 0);
});

test('the canvas asks the module, and only a page of words', () => {
  const canvas = code(read('src/components/PostCanvas.tsx'));
  assert.match(canvas, /const wordPage = page && !tile && \(stage === 'text' \|\| stage === 'article'\);/,
    'o pagina de cuvinte este un text sau un articol, nu o fotografie si nu o celula');
  /**
   * Runda 41: pasul de tipar se ia si pe o pagina care isi tipareste capul sus — un reel din profil, o
   * previzualizare din compozitor — ca sa fie acelasi bloc cu pagina de cuvinte de langa el.
   */
  assert.match(canvas, /const pageHead = wordPage \|\| \(page && stacked && !tile\);/,
    'capul mare este al paginii, nu al cuvintelor');
  assert.match(canvas, /const head = wordPageHead\(metrics, pageHead\);/);
  assert.match(canvas, /const railGutter = stacked && !page \? 0 : wordPageGutter\(metrics\.railGutter, wordPage, metrics\.padH\);/,
    'paddingul paginii intra in calcul: bara nu mai ia de doua ori aceeasi margine');
  // The head is what the author block reads: one face, one name, one handle.
  assert.match(canvas, /\{ width: head\.disc, height: head\.disc, borderRadius: head\.disc \/ 2 \}/);
  assert.match(canvas, /styles\.name, \{ fontSize: head\.name \}/);
  assert.match(canvas, /styles\.handle, \{ fontSize: head\.handle \}/);
  // The words keep clear of the rail: the body reserves the room the rail really stands in.
  assert.match(canvas, /styles\.readingBodyWrap, \{ paddingRight: bodyGutter \}/);
  assert.match(canvas, /const bodyGutter = !wordPage[\s\S]{0,200}: railGutter;/,
    'o pagina fara flux pastreaza coloana pe care a avut-o dintotdeauna');
  assert.match(canvas, /authoredPage \|\| statement\s*\?\s*0/,
    'un text scurt sau un articol scris nu pierde o coloana goala langa butoane');
  // What a page with a flow keeps instead: the buttons' own rectangle, handed to the flow.
  assert.match(canvas, /const railReserve = wordPage\s*\? wordPageRailReserve\(\{/);
  assert.match(canvas, /cells: isVideo \? 5 : 4, foot: RAIL_FOOT, sound: isVideo/,
    'bara unui clip are un buton mai mult: discu coloanei sonore');
  assert.match(canvas, /<EditorialArticle\s+post=\{post\}\s+style=\{pageStyle \?\? defaultTextStyle\(\)\}\s+active=\{active\}\s+railReserve=\{railReserve\}\s+folio=\{folio\}\s+mode=\{pageMode\}\s+pageRequest=\{previewPage\}\s+\/>/,
    'pagina scrisa primeste camera barei, ca fluxul sa o ocoleasca, plus modul cititorului (runda 46) si cererea de fila a foii (runda 49)');
  assert.match(code(read('src/components/EditorialArticle.tsx')), /railReserve=\{railReserve\}/);
  const editor = code(read('src/components/EditorialPage.tsx'));
  assert.match(editor, /reserve: reserveWidth > 0 && reserveHeight > 0/);
  assert.match(editor, /y: height - reserveBottom - reserveHeight,/,
    'camera sta cu piciorul unde sta bara, pe fiecare pagina');
});

test('the room of a page of words is the rail, not a column', () => {
  // Four presses on a page of words, standing 26dp above the frame's foot (PostRail's RAIL_FOOT).
  const room = page.wordPageRailReserve({ padH: FEED.padH, padB: FEED.padB, cells: 4, foot: 26 });
  assert.equal(room.width, page.TEXT_PAGE_RAIL_GUTTER - FEED.padH,
    'cat raza barei intra in masura: 66dp din margine, minus paddingul paginii');
  assert.ok(room.width < page.TEXT_PAGE_RAIL_GUTTER, 'si nu mai mult: cuvantul scrie pana la padding');
  assert.equal(room.height, 4 * page.RAIL_CELL + 3 * page.RAIL_GAP + 6, 'patru celule, trei intervale, aer');
  assert.ok(room.height > 4 * 56 && room.height < 260, 'bara de patru butoane, nu o treime de pagina');
  assert.equal(room.bottom, 26 - FEED.padB, 'piciorul barei, ridicat peste paddingul de jos al cuvintelor');
  // A page with a soundtrack shows one more press, and keeps one more cell (plus the disc's own air).
  const withDisc = page.wordPageRailReserve({ padH: FEED.padH, padB: FEED.padB, cells: 5, foot: 26, sound: true });
  assert.equal(withDisc.height - room.height, page.RAIL_CELL + page.RAIL_GAP + page.RAIL_SOUND_AIR);
  assert.equal(page.wordPageRailReserve({ padH: FEED.padH, padB: FEED.padB, cells: 4, foot: 26, sound: true }).height,
    room.height, 'o pagina de cuvinte fara disc nu plateste pentru el');
  // Nothing to keep: the composer asks for nothing and gets nothing.
  assert.deepEqual(page.wordPageRailReserve({ padH: FEED.padH, padB: FEED.padB, cells: 0, foot: 26 }),
    { width: page.TEXT_PAGE_RAIL_GUTTER - FEED.padH, height: 0, bottom: 26 - FEED.padB });
  // The reader's wider padding narrows the measure less than the feed's.
  const reader = page.wordPageRailReserve({ padH: 16, padB: 22, cells: 4, foot: 26 });
  assert.ok(reader.width < room.width, 'pe cititor textul incepe mai inauntru, deci bara ia mai putin');
});

test('the rail\'s own cell is the one the room is cut from', () => {
  const rail = code(read('src/components/PostRail.tsx'));
  assert.match(rail, /const RAIL_CELL = 56;/);
  assert.match(rail, /export const RAIL_FOOT = 26;/,
    'piciorul barei este singura masura care se schimba daca bara se ridica sau coboara');
  assert.match(rail, new RegExp(`width: RAIL_CELL, height: RAIL_CELL`));
  // The module keeps its own copy of those two numbers, and a test says they agree.
  assert.equal(page.RAIL_CELL, 56);
  assert.equal(page.RAIL_GAP, 2);
});

test('pagina citită are o margine de citit și un singur aer până la bară', () => {
  /**
   * Ownerul, 28 octombrie 2026: „textul are prea mult spațiu gol; nu se întinde până la butoane".
   * Pagina își punea aceeași margine pe ambele laturi (`max(18, 7.2%)`), deci pe un telefon de 469dp
   * rămâneau 46dp de hârtie goală în stânga și încă 46dp în dreapta, deasupra unor butoane care stau doar
   * în colțul din dreapta-jos. Fluxul are acum două margini, iar cea din dreapta este doar `RAIL_LINE_AIR`.
   */
  const editor = code(read('src/components/EditorialPage.tsx'));
  assert.match(editor, /marginLeft: margins\.left,/);
  assert.match(editor, /marginRight: margins\.right,/);
  assert.match(editor, /return \{ left: Math\.max\(12, Math\.round\(width \* 0\.032\)\), right: RAIL_LINE_AIR \}/,
    'pe o pagină cu bară, dreapta este aerul până la butoane');
  assert.match(editor, /if \(!\(reserveWidth > 0\)\) return \{ left: symmetric, right: symmetric \};/,
    'fără bară (editorul), pagina compune simetric ca înainte');
  assert.match(editor, /const symmetric = Math\.max\(18, Math\.round\(width \* 0\.072\)\);/,
    'marginea de citit rămâne cea pe care o compunea deja editorul');
  // Aerul e un singur număr, citit de flux și de rezervă: nu pot divergea.
  assert.equal(page.RAIL_LINE_AIR, 6);
  assert.equal(page.TEXT_PAGE_RAIL_GUTTER, page.RAIL_FOOTPRINT + page.RAIL_LINE_AIR);
  assert.equal(page.wordPageRailReserve({ padH: 14, padB: 22, cells: 4, foot: 26 }).height,
    4 * page.RAIL_CELL + 3 * page.RAIL_GAP + page.RAIL_LINE_AIR, 'aerul rezervei este același număr');
});

test('the paper fills the page, and the article fills what the rail leaves', () => {
  const canvas = code(read('src/components/PostCanvas.tsx'));
  // The one paper of the product is painted edge to edge, whatever theme the row was written in.
  assert.match(canvas, /<View pointerEvents="none" style=\{\[StyleSheet\.absoluteFill, \{ backgroundColor: pagePalette\.background \}\]\} \/>/);
  assert.match(canvas, /opacity=\{pagePalette \? 0 : hasMedia \? 1 : 0\.4\}/,
    'voalul dispare pe o pagina de hartie: nu mai ramane o zona intunecata peste ea');
  // The reading stage owns the whole frame, and the article is the thing that fills it.
  const styles = read('src/components/PostCanvas.tsx');
  assert.match(styles, /reading: \{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, gap: 10 \}/);
  assert.match(styles, /readingBodyWrap: \{ flex: 1, gap: 2 \}/);
  assert.match(styles, /readingCenter: \{ flex: 1, justifyContent: 'center' \}/);
  // An article with photographs is the same paper, and it grows inside the body rather than the frame.
  assert.match(code(read('src/components/EditorialArticle.tsx')), /frame: \{ flex: 1, overflow: 'hidden' \}/);
});
