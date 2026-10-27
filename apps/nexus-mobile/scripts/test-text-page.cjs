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
  // A reel keeps its own gutter; a cell of a list has no rail and keeps none.
  assert.equal(page.wordPageGutter(FEED.railGutter, false), FEED.railGutter);
  assert.equal(page.wordPageGutter(0, false), 0);
  assert.equal(page.wordPageGutter(null, true), 0);
});

test('the canvas asks the module, and only a page of words', () => {
  const canvas = code(read('src/components/PostCanvas.tsx'));
  assert.match(canvas, /const wordPage = page && !tile && \(stage === 'text' \|\| stage === 'article'\);/,
    'o pagina de cuvinte este un text sau un articol, nu o fotografie si nu o celula');
  assert.match(canvas, /const head = wordPageHead\(metrics, wordPage\);/);
  assert.match(canvas, /const railGutter = stacked && !page \? 0 : wordPageGutter\(metrics\.railGutter, wordPage\);/);
  // The head is what the author block reads: one face, one name, one handle.
  assert.match(canvas, /\{ width: head\.disc, height: head\.disc, borderRadius: head\.disc \/ 2 \}/);
  assert.match(canvas, /styles\.name, \{ fontSize: head\.name \}/);
  assert.match(canvas, /styles\.handle, \{ fontSize: head\.handle \}/);
  // The words keep clear of the rail: the body reserves the gutter on the right.
  assert.match(canvas, /styles\.readingBodyWrap, \{ paddingRight: railGutter \}/);
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
