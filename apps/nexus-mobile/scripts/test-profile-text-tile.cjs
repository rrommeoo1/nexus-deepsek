/* global __dirname */
// A text post's cell is a miniature reading page.
//
// The owner's brief (26 October 2026) has four cases — a titled article, a short untitled note, a long
// untitled article, and an editorial article that carries photographs — and each of them is a question
// with an answer: which words, how large, how many lines, and does the page say it continues. This suite
// holds those answers to numbers, and the component to painting them and nothing else.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const page = (() => {
  const code = ts.transpileModule(readFileSync(resolve(ROOT, 'src/lib/profileTextTile.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleShim = { exports: {} };
  new Function('module', 'exports', 'require', code)(moduleShim, moduleShim.exports, () => ({}));
  return moduleShim.exports;
})();

const read = (file) => readFileSync(resolve(ROOT, file), 'utf8');
const component = read('src/components/ProfileTextTile.tsx');
const tile = read('src/components/ProfileTile.tsx');
const tokens = read('src/theme/social.ts');
/** The page's own definition: the cell's paper must be `TEXT_THEMES.paper`, not a second palette. */
const pageStyle = read('src/lib/textStyle.ts');
/** Source without comments: a phrase inside a note is not a control, and not a colour either. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
/** The two halves of the promise a cell makes: the frame it is drawn in, and the reader it opens. */
const canvas = code(read('src/components/PostCanvas.tsx'));
const readingSource = read('src/components/PostReading.tsx');

/**
 * The reference phone's cell in points: the Xiaomi is 469 points wide at 416 dpi, three columns and a
 * 2-point gap, so a thumbnail is ~155 x 275 points and its measure (155 - 2 x 9) is 137.
 */
const BOX = { width: 155, height: 275 };

const LONG = `PRIMUL PARAGRAF. Acesta este inceputul articolului de test lung.\n\n${('PARAGRAFUL 1. Padurea are legi pe care nimeni nu le-a scris, iar cine le citeste cu rabdare ajunge sa le recunoasca. ').repeat(8)}`;

test('cuvintele vin din postarea reală: titlul din publishing, textul din caption', () => {
  // The stored title is the only title: `publishing.title` is what the composer writes.
  assert.deepEqual(
    page.textTileCopy({ publishing: { title: '  Test jungle cu fotografie ' }, caption: 'PAGINA JUNGLE. Primul paragraf.' }),
    { title: 'Test jungle cu fotografie', body: 'PAGINA JUNGLE. Primul paragraf.', cut: false },
  );
  // An authored page's first heading is a title too, and its paragraphs are the text.
  const authored = page.textTileCopy({
    caption: 'un text mai vechi',
    text_style: { document: { blocks: [
      { id: 'h1', type: 'heading', text: 'Titlul paginii' },
      { id: 'p1', type: 'paragraph', text: 'Primul paragraf.' },
      { id: 'p2', type: 'paragraph', text: 'Al doilea paragraf.' },
    ] } },
  });
  assert.equal(authored.title, 'Titlul paginii');
  assert.equal(authored.body, 'Primul paragraf.\n\nAl doilea paragraf.');
  // A post with no title has no title. The opening sentence is not promoted into one.
  const untitled = page.textTileCopy({ caption: 'Testez Nexus pe telefon: feed, gesturi și profil.' });
  assert.equal(untitled.title, '');
  assert.equal(untitled.body, 'Testez Nexus pe telefon: feed, gesturi și profil.');
  // A legacy page that repeats its title as its first line is not printed twice.
  const repeated = page.textTileCopy({ publishing: { title: 'Articol lung de test' }, caption: 'Articol lung de test\n\nPRIMUL PARAGRAF.' });
  assert.equal(repeated.body, 'PRIMUL PARAGRAF.');
  // Nothing at all is not an error: it is a blank page.
  assert.deepEqual(page.textTileCopy(null), { title: '', body: '', cut: false });
  assert.deepEqual(page.textTileCopy({ caption: '   \n\n  ' }), { title: '', body: '', cut: false });
  // Malformed stored JSON (a document that is not a document) never throws and falls back to the caption.
  assert.equal(page.textTileCopy({ caption: 'doar text', text_style: { document: 'nope' } }).body, 'doar text');
});

test('diacriticele, hashtagurile și cuvintele lungi trec neatinse', () => {
  const copy = page.textTileCopy({ caption: `În țară, la șosea: „ăâîșț” — @nexus #pădure #2026 și un cuvânt foarte lung: ${'x'.repeat(80)}` });
  assert.match(copy.body, /În țară, la șosea/);
  assert.match(copy.body, /@nexus #pădure #2026/);
  assert.ok(copy.body.endsWith('x'.repeat(80)), 'a long word is kept whole: the page wraps it, it is not cut');
  const plan = page.planTextTile(copy, BOX);
  assert.ok(plan.bodyLines >= 1);
  assert.ok(plan.shape === 'short' || plan.shape === 'medium', 'a note, not an article');
});

test('o postare scurtă fără titlu e scrisă mare, în mijlocul paginii', () => {
  const copy = page.textTileCopy({ caption: 'Testez Nexus pe telefon: feed, gesturi și profil.' });
  const plan = page.planTextTile(copy, BOX);
  assert.equal(plan.shape, 'short');
  assert.ok(plan.bodySize >= 15, `a 49-character note is set at ${plan.bodySize} points, not at a caption size`);
  assert.equal(plan.fade, false);
  assert.equal(plan.cut, false);
  assert.equal(plan.centred, true, 'a short note sits in the optical middle, like a title page');
  assert.ok(plan.bodyLines >= 3, 'and it has room for every line it needs');
});

test('un articol lung fără titlu arată începutul lui și spune că pagina continuă', () => {
  const copy = page.textTileCopy({ caption: LONG });
  assert.ok(LONG.length > page.TEXT_TILE_MAX_CHARS, 'the stored article is longer than a cell');
  assert.ok(copy.body.length <= page.TEXT_TILE_MAX_CHARS, 'the page carries the opening, not the article');
  assert.equal(copy.cut, true);
  const plan = page.planTextTile(copy, BOX);
  assert.equal(plan.shape, 'long');
  assert.ok(plan.bodySize >= page.TEXT_TILE_MIN_SIZE, 'never below the legibility floor');
  assert.ok(plan.bodySize <= 11, 'a long article sets small, so that a page of it fits');
  assert.equal(plan.fade, true, 'the page fades out instead of ending mid-sentence');
  assert.equal(plan.cut, true);
  assert.ok(plan.bodyLines >= 8, `a long page is dense: ${plan.bodyLines} lines`);
  assert.match(plan.body, /^PRIMUL PARAGRAF\./, 'its first paragraph really is on the page');
});

test('titlul e cel mai tare lucru de pe pagină, iar extrasul îi urmează', () => {
  const copy = page.textTileCopy({
    publishing: { title: 'Test jungle cu fotografie' },
    caption: 'PAGINA JUNGLE. Primul paragraf al unui text scurt, asezat pe fundalul padurii.\n\nAl doilea paragraf al paginii.',
  });
  const plan = page.planTextTile(copy, BOX);
  assert.equal(plan.shape, 'titled');
  assert.ok(plan.titleSize > plan.bodySize, `the title is ${plan.titleSize} points, the body ${plan.bodySize}`);
  assert.ok(plan.titleSize >= 14, 'the title is readable at arm\u2019s length');
  assert.equal(plan.titleLines, 3, 'a long title wraps and is clamped, never dropped');
  assert.ok(plan.bodyLines >= 2, 'and there is room for the excerpt under it');
  // A very long stored title is set smaller instead of running off the page.
  const longTitle = page.planTextTile(page.textTileCopy({ publishing: { title: 'T'.repeat(118) }, caption: 'un text' }), BOX);
  assert.ok(longTitle.titleSize < plan.titleSize);
  // A title with no body still fills its page: it is the whole post.
  const bare = page.planTextTile(page.textTileCopy({ publishing: { title: 'Doar titlul' } }), BOX);
  assert.equal(bare.shape, 'title');
  assert.equal(bare.body, '');
  assert.ok(bare.titleLines >= 3);
});

test('un articol cu fotografii rămâne o pagină, cu o singură imagine mică în ea', () => {
  const copy = page.textTileCopy({
    publishing: { title: 'Test jungle cu fotografie' },
    caption: 'PAGINA JUNGLE. Primul paragraf.',
  });
  const plan = page.planTextTile(copy, BOX, { hasMedia: true });
  assert.equal(plan.shape, 'article');
  assert.ok(plan.plate > 0, 'the article keeps one picture');
  assert.ok(plan.plate < BOX.width * 0.5, 'but the picture is a band, not the page');
  assert.ok(plan.titleSize > 0 && plan.bodyLines >= 1, 'the words are still the page');
  // Words without a picture ask for no plate at all.
  const plain = page.planTextTile(page.textTileCopy({ caption: 'doar cuvinte' }), BOX);
  assert.equal(plain.plate, 0);
});

test('măsura paginii decide mărimea literei, nu un număr fix', () => {
  const copy = page.textTileCopy({ caption: LONG });
  const big = page.planTextTile(copy, { width: 300, height: 520 });
  const small = page.planTextTile(copy, { width: 96, height: 170 });
  assert.ok(big.bodyLines > small.bodyLines, 'a bigger page holds more lines');
  // A page too small to hold even one line still answers with a plan instead of throwing.
  const tiny = page.planTextTile(copy, { width: 20, height: 20 });
  assert.ok(tiny.bodyLines >= 1 && tiny.bodySize >= page.TEXT_TILE_MIN_SIZE);
  // No measurements at all is the same as a small page, not a crash.
  assert.ok(page.planTextTile(copy, {}).bodyLines >= 1);
  // A note at 300 points of measure is set no larger than a note at 137, and never smaller than legibility.
  const wideNote = page.planTextTile(page.textTileCopy({ caption: 'Scurt.' }), { width: 300, height: 520 });
  assert.ok(wideNote.bodySize <= 17);
  assert.ok(wideNote.bodySize >= page.TEXT_TILE_MIN_SIZE);
});

test('pagina e hârtie caldă cu cerneală închisă, nu capacul verde de mușchi', () => {
  /** The e-paper surface is one token set, so the page cannot drift into a theme colour by accident. */
  assert.match(tokens, /reading: \{/);
  assert.match(tokens, /page: '#f4efe2'/);
  assert.match(tokens, /ink: '#1a221b'/);
  /**
   * ...and it is *the* page, not a cell-shaped near-miss: the pair is `TEXT_THEMES.paper`'s, which is what
   * the composer, the feed and the full reader paint and what the server stores. Two papers a hair apart
   * was the drift this assertion now catches.
   */
  assert.match(pageStyle, /id: 'paper'[^}]*background: '#f4efe2'[^}]*text: '#1a221b'/);
  assert.match(tokens, /face: 'serif'/);
  assert.match(code(component), /backgroundColor: reading\.page/);
  assert.match(code(component), /color: reading\.ink/);
  assert.match(code(component), /fontFamily: reading\.face/);
  // No moss green anywhere on the page, and no leaf motif: the owner's complaint was exactly that tile.
  assert.doesNotMatch(component, /#16301f|LeafMotif|palette\.background|themeOf\([^)]*\)\.background/);
  /**
   * The author's own theme survives as one hairline, not as the paper — and it is read through the same
   * resolver the page behind the cell paints with (`pagePaletteOf` over `pageStyleForPost`), so a post
   * with no authored look takes the paper's accent and a `jungle` row shows its gold over the very paper
   * it will open on. A cell that painted one accent while the page it opens painted another was the
   * drift this guard exists for.
   */
  assert.match(component, /const accent = pagePaletteOf\(pageStyleForPost\(post\.text_style\)\)\.accent/);
  assert.doesNotMatch(code(component), /themeOf\(|TEXT_DEFAULT_THEME/);
  assert.doesNotMatch(component, /'jungle'|"jungle"/);
});

test('pagina se desenează din plan: titlu, imagine opțională, text, fade, nimic altceva', () => {
  const source = code(component);
  // The plan is what is painted: every size comes from it.
  assert.match(source, /planTextTile\(copy, \{ width, height \}/);
  assert.match(source, /fontSize: plan\.titleSize, lineHeight: plan\.titleLine/);
  assert.match(source, /fontSize: plan\.bodySize, lineHeight: plan\.bodyLine/);
  // The title is its own element and can wrap to the lines the plan allowed.
  assert.match(source, /numberOfLines=\{plan\.titleLines\}/);
  assert.match(source, /numberOfLines=\{plan\.bodyLines\}/);
  // The single picture of an article is drawn only when the plan asks for one.
  assert.match(source, /plate && plan\.plate \? \(/);
  assert.match(source, /<RemoteImage item=\{plate\} fit="cover"/);
  // Content longer than the page fades into the paper instead of ending mid-glyph.
  assert.match(source, /plan\.fade \? \(/);
  assert.match(source, /reading\.fadeSteps\.map/);
  // The cell is measured once; the measured box is what the plan is computed from.
  assert.match(source, /onLayout=\{onLayout\}/);
  assert.match(source, /planTextTile\(copy, \{ width, height \}/);
  assert.match(source, /const \[box, setBox\] = useState\(\{ width: 0, height: 0 \}\)/);
  // It draws no controls of its own: the tap belongs to the tile around it.
  assert.doesNotMatch(source, /Pressable|onPress|accessibilityRole="button"/);
  // And it is invisible to a screen reader, because the tile around it is the one control with a name.
  assert.match(source, /importantForAccessibility="no-hide-descendants"/);
});

test('atingerea celulei deschide postarea întreagă, nu o previzualizare', () => {
  // The page is inside the same Pressable the tile always was, so the door is unchanged.
  assert.match(tile, /<Pressable[\s\S]*onPress=\{open\}/);
  assert.match(tile, /router\.push\(\{/);
  assert.match(tile, /pathname: '\/post\/\[id\]'/);
  assert.match(tile, /accessibilityLabel=\{`Deschide postarea \$\{post\.id\}`\}/);
});

/**
 * Prioritatea A a rundei (27 octombrie 2026): o singură hârtie, pe ambele laturi ale atingerii.
 *
 * Celula era `#f5f0e4` în timp ce pagina era `#f4efe2` și — mai rău — o postare de cuvinte *fără*
 * `text_style` desena o celulă de hârtie, iar la atingere se deschidea compoziția de mangal a cititorului,
 * fiindcă pagina exista doar pentru un rând care căra un stil. O miniatură este o promisiune despre pagina
 * din spatele ei; aserțiunile de mai jos sunt acea promisiune, în ordinea în care o parcurge degetul.
 */
test('celula și pagina pe care o deschide sunt aceeași hârtie', () => {
  // 1. Hârtia celulei este hârtia paginii: un singur set de tokeni, nu două palete aproape egale.
  assert.match(code(tokens), /page: '#f4efe2'/);
  assert.match(code(tokens), /ink: '#1a221b'/);
  assert.match(pageStyle, /id: 'paper'[^}]*background: '#f4efe2'[^}]*text: '#1a221b'/);
  // 2. Cadrul unei postări de cuvinte este *întotdeauna* o pagină: stilul autorului, sau hârtia implicită.
  assert.match(canvas, /const pageStyle = stage === 'text' \|\| stage === 'article' \? pageStyleForPost\(post\.text_style\) : null/);
  assert.match(canvas, /const pagePalette = pageStyle \? pagePaletteOf\(pageStyle, pageMode\) : null/);
  assert.match(canvas, /backgroundColor: pagePalette\.background/);
  // Firul celulei este accentul paginii pe care o deschide, citit prin același resolver (nu din coloana brută).
  assert.match(component, /const accent = pagePaletteOf\(pageStyleForPost\(post\.text_style\)\)\.accent/);
  assert.doesNotMatch(code(component), /themeOf|TEXT_DEFAULT_THEME/, 'celula nu-și mai compune singură tema');
  // 3. Cuvintele unui text lung sunt desenate de cititor *cu același stil*, deci paginile lui nu pot cădea
  //    înapoi pe mangalul cititorului doar fiindcă rândul nu are stil stocat.
  assert.match(canvas, /textStyle=\{pageStyle\}/);
  assert.match(canvas, /style=\{pageStyle \?\? defaultTextStyle\(\)\}/);
  assert.match(readingSource, /palette \? \{ backgroundColor: palette\.background \} : null/);
  // 4. Hârtia nu este pictată de două ori: o pagină nu primește nici pădure, nici voal peste culoarea ei.
  assert.match(canvas, /opacity=\{pagePalette \? 0 : hasMedia \? 1 : 0\.4\}/);
  assert.ok(canvas.indexOf('pagePalette ? (') < canvas.indexOf('<JungleGrove'), 'pădurea nu mai stă sub o pagină de hârtie');
});
