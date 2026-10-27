/* global __dirname */
/**
 * The authored look of a text post, on the phone.
 *
 * Two modules must agree: `src/lib/textStyle.ts` (what the composer previews and sends) and
 * `apps/nexus-web/lib/post-text-style.js` (what `/api/posts` accepts and stores). A theme id or a
 * colour pair that drifts between them would make a publish fail on the one rule the phone had
 * already shown as valid, so the parity test reads both and compares them field by field.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const ts = require('typescript');

const source = readFileSync(resolve(__dirname, '../src/lib/textStyle.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const editorialSource = readFileSync(resolve(__dirname, '../src/lib/editorialDocument.ts'), 'utf8');
const editorialCode = ts.transpileModule(editorialSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const editorialShim = { exports: {} };
new Function('module', 'exports', 'require', editorialCode)(editorialShim, editorialShim.exports, () => {
  throw new Error('editorialDocument.ts nu are voie să importe nimic la rulare');
});
const moduleShim = { exports: {} };
new Function('module', 'exports', 'require', code)(moduleShim, moduleShim.exports, (id) => {
  if (id === './editorialDocument') return editorialShim.exports;
  throw new Error(`textStyle.ts a cerut un modul neașteptat: ${id}`);
});
const {
  TEXT_ALIGNS, TEXT_ALIGN_IDS, TEXT_EMOJI, TEXT_FONTS, TEXT_FONT_IDS, TEXT_MAX_CHARS,
  TEXT_MEDIA_SCALE_MAX, TEXT_MEDIA_SCALE_MIN, TEXT_MEDIA_X_LIMIT, TEXT_MEDIA_Y_MAX, TEXT_MEDIA_Y_MIN,
  TEXT_SIZES, TEXT_SIZE_IDS, TEXT_THEMES, TEXT_THEME_IDS, TEXT_DEFAULT_THEME,
  clampMediaFrame, contrastRatio, defaultTextStyle, fontFamilyFor, isFormerDefaultPage, mediaFrameOf, normalizeTextStyle,
  pagePaletteOf, pageStyleForPost, readTextStyle, sizeOf, textStyleForPost, themeOf, TEXT_PAGE_THEME,
} = moduleShim.exports;

const SERVER = resolve(__dirname, '../../nexus-web/lib/post-text-style.js');

test('compozitorul și serverul oferă aceleași teme, litere, mărimi și alinieri', async () => {
  const server = await import(pathToFileURL(SERVER).href);
  assert.deepEqual([...TEXT_THEME_IDS], [...server.TEXT_THEMES]);
  assert.deepEqual([...TEXT_FONT_IDS], [...server.TEXT_FONTS]);
  assert.deepEqual([...TEXT_SIZE_IDS], [...server.TEXT_SIZES]);
  assert.deepEqual([...TEXT_ALIGN_IDS], [...server.TEXT_ALIGNS]);
  assert.equal(TEXT_THEMES.length, 6);
  for (const item of TEXT_THEMES) {
    const palette = server.TEXT_THEME_PALETTE[item.id];
    assert.equal(item.background, palette.background, `fundalul temei ${item.id}`);
    assert.equal(item.text, palette.text, `textul temei ${item.id}`);
    assert.match(item.background, /^#[0-9a-f]{6}$/);
    assert.match(item.text, /^#[0-9a-f]{6}$/);
    // Every offered pair clears WCAG AA for body text: a theme is a look, not an unreadable page.
    assert.ok(contrastRatio(item.background, item.text) >= 4.5, `contrastul temei ${item.id}`);
  }
  assert.deepEqual(defaultTextStyle(), server.TEXT_STYLE_DEFAULTS);
  /**
   * The default page is e-paper: warm paper with dark ink, the same page the profile cell paints. A
   * default that drifted back to a coloured card would put a green/black rectangle back in the composer,
   * so the pair is asserted by name and not only by parity with the server.
   */
  assert.equal(TEXT_DEFAULT_THEME, 'paper');
  assert.deepEqual(defaultTextStyle(), {
    theme: 'paper', font: 'serif', size: 'medium', align: 'left',
    background: '#f4efe2', text: '#1a221b', media: { scale: 1, x: 0, y: 0 },
  });
  assert.equal(server.TEXT_STYLE_DEFAULTS.theme, 'paper');
  assert.equal(server.TEXT_STYLE_DEFAULTS.background, '#f4efe2');
  assert.equal(server.TEXT_STYLE_DEFAULTS.text, '#1a221b');
});

test('o temă necunoscută se deschide pe pagina implicită, nu pe prima din listă', () => {
  // A row written by a build with a theme this one has never heard of reads as the default page.
  assert.equal(themeOf('unknown').id, TEXT_DEFAULT_THEME);
  assert.equal(themeOf('unknown').background, '#f4efe2');
  assert.equal(themeOf('unknown').text, '#1a221b');
  assert.equal(readTextStyle({ theme: 'neon' }).theme, 'paper');
});


test('fiecare temă, literă și mărime se poate citi înapoi', () => {
  assert.equal(TEXT_MAX_CHARS, 20000);
  assert.ok(TEXT_EMOJI.length >= 24);
  assert.equal(new Set(TEXT_EMOJI).size, TEXT_EMOJI.length);
  for (const id of TEXT_THEME_IDS) {
    assert.equal(themeOf(id).id, id);
    const style = normalizeTextStyle({ theme: id });
    assert.equal(style.theme, id);
    assert.equal(style.background, themeOf(id).background);
    assert.equal(style.text, themeOf(id).text);
  }
  for (const id of TEXT_FONT_IDS) assert.equal(normalizeTextStyle({ font: id }).font, id);
  for (const id of TEXT_SIZE_IDS) assert.equal(normalizeTextStyle({ size: id }).size, id);
  for (const id of TEXT_ALIGN_IDS) assert.equal(normalizeTextStyle({ align: id }).align, id);
  // An unknown id never reaches a page; `themeOf` falls back to the default page (see the test above).
  assert.equal(sizeOf('unknown').id, 'medium');
  assert.equal(sizeOf('large').fontSize, 30);
  assert.equal(sizeOf('large').lineHeight, 42);
});

test('normalizarea strictă refuză ce ar refuza și serverul', async () => {
  const invalid = (error) => error?.code === 'TEXT_STYLE_INVALID';
  // Absent means "no authored style", not "the defaults": that is what keeps old posts unchanged.
  assert.equal(normalizeTextStyle(null), null);
  assert.equal(normalizeTextStyle(undefined), null);
  for (const value of ['jungle', 7, [], true]) {
    assert.throws(() => normalizeTextStyle(value), invalid);
  }
  assert.throws(() => normalizeTextStyle({ theme: 'jungle', extra: 1 }), invalid);
  assert.throws(() => normalizeTextStyle({ theme: 'neon' }), invalid);
  assert.throws(() => normalizeTextStyle({ font: 'comic' }), invalid);
  assert.throws(() => normalizeTextStyle({ size: 'huge' }), invalid);
  assert.throws(() => normalizeTextStyle({ align: 'right' }), invalid);
  // A request may choose a theme, never repaint it: the pair must be the theme's own.
  assert.throws(() => normalizeTextStyle({ theme: 'jungle', background: '#000000' }), invalid);
  assert.throws(() => normalizeTextStyle({ theme: 'jungle', text: '#ffffff' }), invalid);
  assert.throws(() => normalizeTextStyle({ theme: 'jungle', background: 'red' }), invalid);
  // Missing members take their theme's defaults; the palette pair is always the one that is stored.
  assert.deepEqual(normalizeTextStyle({ theme: 'paper' }), {
    theme: 'paper', font: 'serif', size: 'medium', align: 'left',
    background: '#f4efe2', text: '#1a221b', media: { scale: 1, x: 0, y: 0 },
  });
  // Uppercase hex is accepted and lowercased, exactly like the server — and a chosen theme keeps *its*
  // pair, so the reference themes above it are unchanged by the e-paper default.
  assert.deepEqual(normalizeTextStyle({ theme: 'jungle', background: '#0B1F16', text: '#F2EFE4' }), {
    theme: 'jungle', font: 'serif', size: 'medium', align: 'left',
    background: '#0b1f16', text: '#f2efe4', media: { scale: 1, x: 0, y: 0 },
  });

  const server = await import(pathToFileURL(SERVER).href);
  assert.equal(server.normalizeTextStyle({ theme: 'paper' }).background, '#f4efe2');
  assert.throws(() => server.normalizeTextStyle({ theme: 'neon' }), /TEXT_STYLE_INVALID/);
  assert.throws(() => server.normalizeTextStyle({ theme: 'jungle', extra: 1 }), /TEXT_STYLE_INVALID/);
});

test('cadrul fotografiei se păstrează în pagină și se citește la fel pe server', async () => {
  // A frame is geometry, not a look: the phone may move and zoom the lead, never outside the page.
  assert.deepEqual(clampMediaFrame(null), { scale: 1, x: 0, y: 0 });
  assert.deepEqual(clampMediaFrame({ scale: 9, x: -9, y: 9 }), {
    scale: TEXT_MEDIA_SCALE_MAX, x: -TEXT_MEDIA_X_LIMIT, y: TEXT_MEDIA_Y_MAX,
  });
  assert.deepEqual(clampMediaFrame({ scale: 0, x: 9, y: -9 }), {
    scale: TEXT_MEDIA_SCALE_MIN, x: TEXT_MEDIA_X_LIMIT, y: TEXT_MEDIA_Y_MIN,
  });
  assert.deepEqual(clampMediaFrame({ scale: 0.8125, x: -0.2345, y: 0.1265 }), {
    scale: 0.813, x: -0.234, y: 0.127,
  });
  // A number that is not finite is not a position: the clamp never stores NaN.
  assert.deepEqual(clampMediaFrame({ scale: Number.NaN, x: 'left', y: Infinity }), { scale: 1, x: 0, y: 0 });

  const framed = { scale: 0.8, x: -0.2, y: 0.1 };
  assert.deepEqual(normalizeTextStyle({ theme: 'paper', media: framed }).media, framed);
  assert.equal(mediaFrameOf(null).scale, 1);
  assert.deepEqual(mediaFrameOf({ media: framed }).x, -0.2);
  // A half-written draft is read, not rejected: the frame is clamped like the colours are repaired.
  assert.deepEqual(readTextStyle({ theme: 'paper', media: { scale: 7, x: 7, y: -7 } }).media, {
    scale: TEXT_MEDIA_SCALE_MAX, x: TEXT_MEDIA_X_LIMIT, y: TEXT_MEDIA_Y_MIN,
  });
  assert.deepEqual(readTextStyle({ theme: 'paper', media: { scale: 'mare' } }).media, { scale: 1, x: 0, y: 0 });

  const invalid = (error) => error?.code === 'TEXT_STYLE_INVALID';
  assert.throws(() => normalizeTextStyle({ media: { scale: 1, x: 0, y: 0, z: 1 } }), invalid);
  // A string is not a number, even when it looks like one: the clamp would have to guess.
  assert.throws(() => normalizeTextStyle({ media: { scale: '1', x: 0, y: 0 } }), invalid);
  assert.throws(() => normalizeTextStyle({ media: { scale: 2, x: 0, y: 0 } }), invalid);
  assert.throws(() => normalizeTextStyle({ media: { scale: 1, x: 0.5, y: 0 } }), invalid);
  assert.throws(() => normalizeTextStyle({ media: { scale: 1, x: 0, y: -0.5 } }), invalid);

  // The server stores exactly the frame the composer showed, or refuses it for the same reason.
  const server = await import(pathToFileURL(SERVER).href);
  assert.deepEqual(server.normalizeTextStyle({ theme: 'paper', media: framed }).media, framed);
  assert.throws(() => server.normalizeTextStyle({ media: { scale: 2, x: 0, y: 0 } }), /TEXT_STYLE_INVALID/);
  assert.throws(() => server.normalizeTextStyle({ media: { scale: 1, x: 0, y: 0, z: 1 } }), /TEXT_STYLE_INVALID/);
});

test('cititorul tolerant deschide o ciornă sau o postare scrisă de alt build', () => {
  const fallback = defaultTextStyle();
  assert.deepEqual(readTextStyle(null), fallback);
  assert.deepEqual(readTextStyle('jungle'), fallback);
  assert.deepEqual(readTextStyle([1, 2]), fallback);
  assert.deepEqual(readTextStyle({ theme: 'neon', font: 'comic', size: 'huge', align: 'right' }), fallback);
  assert.deepEqual(readTextStyle({ theme: 'ember', font: 'mono', size: 'large', align: 'center' }), {
    theme: 'ember', font: 'mono', size: 'large', align: 'center',
    background: '#2a120b', text: '#fbeadf', media: { scale: 1, x: 0, y: 0 },
  });
  // A stored pair that is not the theme's own is replaced, never printed.
  assert.deepEqual(readTextStyle({ theme: 'paper', background: '#000000', text: '#ffffff' }), {
    theme: 'paper', font: 'serif', size: 'medium', align: 'left',
    background: '#f4efe2', text: '#1a221b', media: { scale: 1, x: 0, y: 0 },
  });
});

test('o postare fără stil rămâne compoziția cititorului', () => {
  assert.equal(textStyleForPost(null), null);
  assert.equal(textStyleForPost(undefined), null);
  assert.equal(textStyleForPost('jungle'), null);
  assert.equal(textStyleForPost({ theme: 'neon' }), null);
  assert.equal(textStyleForPost({ theme: 'jungle', hacked: true }), null);
  assert.deepEqual(textStyleForPost({ theme: 'moss', size: 'large' }), {
    theme: 'moss', font: 'serif', size: 'large', align: 'left',
    background: '#16301f', text: '#eaf3e6', media: { scale: 1, x: 0, y: 0 },
  });
  /**
   * A member this build *does* know but that was written by another one is read, not dropped: the page
   * keeps the face, the measure and the frame its author set even though the colour pair is regenerated.
   */
  assert.deepEqual(textStyleForPost({
    theme: 'paper', font: 'mono', size: 'small', align: 'center', background: '#000000', text: '#ffffff',
    media: { scale: 1.2, x: 0.1, y: 0.2 },
  }), {
    theme: 'paper', font: 'mono', size: 'small', align: 'center',
    background: '#f4efe2', text: '#1a221b', media: { scale: 1.2, x: 0.1, y: 0.2 },
  });
});

test('pagina care a fost defaultul de ieri se deschide pe hârtie, iar o alegere rămâne a autorului', () => {
  /**
   * Until 26 October 2026 the composer opened on `jungle`, so every row published before that day and
   * left untouched carries exactly this shape. The owner's rule is that the untouched former default is a
   * default, not a choice: it opens on the paper page, like a row that carries no style at all.
   */
  const legacy = textStyleForPost({ theme: 'jungle' });
  assert.deepEqual(legacy, defaultTextStyle());
  assert.equal(legacy.theme, 'paper');
  assert.equal(isFormerDefaultPage(readTextStyle({ theme: 'jungle' })), true);
  /**
   * The moment the author changed *anything*, the page is theirs and is read exactly as it was written:
   * another theme, another face, another measure, another alignment, a framed picture, a document.
   */
  for (const chosen of [
    { theme: 'moss' },
    { theme: 'jungle', font: 'mono' },
    { theme: 'jungle', size: 'large' },
    { theme: 'jungle', align: 'center' },
    { theme: 'jungle', media: { scale: 1.4, x: 0, y: 0 } },
    { theme: 'jungle', document: { version: 1, typography: 'auto', blocks: [{ id: 'p-1', type: 'paragraph', text: 'Un paragraf.' }] } },
  ]) {
    const style = readTextStyle(chosen);
    assert.equal(isFormerDefaultPage(style), false, JSON.stringify(chosen));
    assert.deepEqual(textStyleForPost(chosen), style, JSON.stringify(chosen));
  }
  // And the untouched default is still *published* as it was stored: only the reading is paper.
  assert.equal(normalizeTextStyle({ theme: 'jungle' }).theme, 'jungle');
});

test('fiecare platformă primește o literă care există pe ea', () => {
  assert.equal(fontFamilyFor('serif', 'android'), 'serif');
  assert.equal(fontFamilyFor('serif', 'ios'), 'Georgia');
  assert.equal(fontFamilyFor('mono', 'android'), 'monospace');
  assert.equal(fontFamilyFor('mono', 'ios'), 'Menlo');
  assert.equal(fontFamilyFor('sans', 'android'), 'sans-serif');
  assert.equal(fontFamilyFor('sans', 'ios'), 'System');
  // A runtime whose platform is neither iOS nor Android falls back to the system reading face.
  assert.equal(fontFamilyFor('serif', 'web'), 'Georgia, serif');
  assert.equal(fontFamilyFor('serif', 'macos'), undefined);
  assert.equal(fontFamilyFor('sans', 'windows'), undefined);
});

test('compozitorul are o singură pagină, iar fotografia ei se aranjează în ea', () => {
  const composer = readFileSync(resolve(__dirname, '../src/app/text.tsx'), 'utf8');
  // The duplicate drawings are gone: no separate decorative page, no separate text card, no modal.
  assert.doesNotMatch(composer, /from '\.\.\/components\/TextPage'|<TextPage/);
  assert.doesNotMatch(composer, /previewOpen|composerCard|PREVIZUALIZARE/);
  assert.doesNotMatch(composer, /<Modal/);
  // The one page is the editorial flow, and it is editable in place.
  assert.match(composer, /<EditorialPage/);
  assert.match(composer, /document=\{draft\.document\}/);
  assert.match(composer, /editable/);
  assert.match(composer, /onChangeDocument=\{applyDocument\}/);
  assert.match(composer, /editorialMediaForAttachments\(draft\.attachments\)/);
  // The document travels with the style, so a published page reopens with the same arrangement.
  assert.match(composer, /textStyle: \{ \.\.\.draft\.style, document: draft\.document \}/);
  // The words are typed into the page itself: exactly one hidden editor, inside the page component.
  const page = readFileSync(resolve(__dirname, '../src/components/EditorialPage.tsx'), 'utf8');
  const pageInputs = page.match(/accessibilityLabel="Textul postării"/g) ?? [];
  assert.equal(pageInputs.length, 1);
});

test('cititorul deschide fotografia paginii în vizualizatorul articolului', () => {
  const page = readFileSync(resolve(__dirname, '../src/components/EditorialPage.tsx'), 'utf8');
  const articleMedia = readFileSync(resolve(__dirname, '../src/components/ArticleMedia.tsx'), 'utf8');
  // The viewer is the one the legacy lead block uses, not a second full-screen rendering.
  assert.match(articleMedia, /export function PhotoViewer/);
  assert.match(page, /import \{ PhotoViewer \} from '\.\/ArticleMedia'/);
  assert.match(page, /<PhotoViewer/);
  // Only a published page opens the viewer; the composer keeps its gestures.
  assert.match(page, /!editable && onOpenPhoto && box\.mediaType === 'image'/);
  assert.match(page, /onPress=\{\(\) => onOpenPhoto\?\.\(box\.mediaIndex\)\}/);
  assert.match(page, /onOpenPhoto=\{photoItems\.length \? openPhoto : undefined\}/);
});

test('documentul editorial trece prin ambele validatoare, iar unul rupt este refuzat', async () => {
  const document = {
    version: 1,
    typography: 'auto',
    blocks: [
      { id: 'p-1', type: 'paragraph', text: 'Un paragraf.' },
      { id: 'm-1', type: 'media', mediaIndex: 0, mediaType: 'image', placement: 'left', widthFraction: 0.55, wrapText: true },
      { id: 'h-1', type: 'heading', text: 'Un titlu' },
      { id: 'br-1', type: 'pagebreak' },
    ],
  };
  const phone = normalizeTextStyle({ theme: 'paper', document });
  assert.deepEqual(phone.document, document);
  const server = await import(pathToFileURL(SERVER).href);
  assert.deepEqual(server.normalizeTextStyle({ theme: 'paper', document }).document, document);
  for (const broken of [
    { version: 1, blocks: [{ id: 'p-1', type: 'paragraph', text: '' }] },
    { version: 1, blocks: [{ id: 'p-1', type: 'pictogramă', text: 'x' }] },
    { version: 1, blocks: [{ id: 'm-1', type: 'media', mediaIndex: 0, mediaType: 'image', placement: 'left', widthFraction: 2, wrapText: true }] },
  ]) {
    assert.throws(() => normalizeTextStyle({ theme: 'paper', document: broken }), (error) => error.code === 'TEXT_STYLE_INVALID');
    assert.throws(() => server.normalizeTextStyle({ theme: 'paper', document: broken }), /TEXT_STYLE_INVALID/);
  }
  // A page written before documents existed carries no `document` key at all.
  assert.equal(Object.hasOwn(normalizeTextStyle({ theme: 'paper' }), 'document'), false);
  assert.equal(Object.hasOwn(server.normalizeTextStyle({ theme: 'paper' }), 'document'), false);
});

test('contrastul este calculat pe luminanța WCAG', () => {
  assert.equal(contrastRatio('#000000', '#ffffff').toFixed(2), '21.00');
  assert.equal(contrastRatio('#ffffff', '#ffffff').toFixed(2), '1.00');
  assert.ok(contrastRatio('#0b1f16', '#f2efe4') > contrastRatio('#0b1f16', '#777777'));
});


/**
 * Hârtia universală (decizia ownerului, 27 octombrie 2026: *paper everywhere*).
 *
 * `pagePaletteOf` este singurul loc în care se hotărăsc culorile unei pagini de cuvinte. Tema aleasă nu
 * mai este pagina: fundalul și cerneala sunt mereu ale hârtiei, iar din temă rămâne doar accentul, adică
 * un fir și un cadru — niciodată un cuvânt de citit.
 */
test('fiecare temă se citește pe aceeași hârtie, iar tema rămâne doar accentul', () => {
  const paper = TEXT_THEMES.find((item) => item.id === TEXT_PAGE_THEME);
  assert.equal(TEXT_PAGE_THEME, 'paper');
  assert.deepEqual(pagePaletteOf(null), {
    background: paper.background, text: paper.text, mark: paper.accent, accent: paper.accent,
  });
  for (const item of TEXT_THEMES) {
    const palette = pagePaletteOf({ theme: item.id });
    assert.equal(palette.background, '#f4efe2', `hârtia temei ${item.id}`);
    assert.equal(palette.text, '#1a221b', `cerneala temei ${item.id}`);
    // Cuvintele de citit iau accentul hârtiei, nu al temei: aurul pe crem este o pată, nu un link.
    assert.equal(palette.mark, paper.accent, `semnul temei ${item.id}`);
    assert.equal(palette.accent, item.accent, `accentul temei ${item.id} rămâne al autorului`);
  }
  // Pagina se citește lejer: mult peste AA, și peste AAA, în orice temă.
  assert.ok(contrastRatio('#f4efe2', '#1a221b') >= 7, 'hârtia și cerneala trec AAA');
});

/**
 * Rândurile 39/40/41 din `C:\Nexus\data\nexus.sqlite` sunt exact acest caz: `{"theme":"jungle",…,
 * "background":"#0b1f16","text":"#f2efe4","document":{…}}`. `isFormerDefaultPage` nu le poate atinge
 * (cere `document == null`), deci nimic nu le rescrie și nimic nu le mută într-o migrare: normalizarea se
 * face la pictare.
 */
test('un rând jungle cu document se citește pe hârtie, fără să fie rescris', () => {
  const document = {
    version: 1,
    typography: 'auto',
    blocks: [{ id: 'p-1', type: 'paragraph', text: 'PAGINA JUNGLE. Primul paragraf.' }],
  };
  const stored = {
    theme: 'jungle', font: 'serif', size: 'medium', align: 'left',
    background: '#0b1f16', text: '#f2efe4', media: { scale: 1, x: 0, y: 0 }, document,
  };
  const style = pageStyleForPost(stored);
  // Aspectul autorului este păstrat întreg: tema, fața, măsura, alinierea și documentul.
  assert.equal(style.theme, 'jungle');
  assert.equal(style.font, 'serif');
  assert.equal(style.size, 'medium');
  assert.equal(style.align, 'left');
  assert.deepEqual(style.document, document);
  // Dar pagina pe care se citește este hârtia, cu cerneala hârtiei și accentul autorului ca fir.
  const palette = pagePaletteOf(style);
  assert.equal(palette.background, '#f4efe2');
  assert.equal(palette.text, '#1a221b');
  assert.equal(palette.mark, '#2f5d45');
  assert.equal(palette.accent, '#c9a227');
  // Rândul stocat nu a fost atins: nimic nu s-a migrat și nimic nu s-a rescris.
  assert.equal(stored.background, '#0b1f16');
  assert.equal(stored.text, '#f2efe4');
  // Un rând fără stil este tot o pagină, și anume aceeași hârtie.
  assert.deepEqual(pageStyleForPost(null), defaultTextStyle());
  assert.equal(pagePaletteOf(pageStyleForPost(null)).background, '#f4efe2');
});

