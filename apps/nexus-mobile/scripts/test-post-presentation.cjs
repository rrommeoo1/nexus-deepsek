/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const source = readFileSync(resolve(__dirname, '../src/lib/postPresentation.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleShim = { exports: {} };
new Function('module', 'exports', 'require', code)(moduleShim, moduleShim.exports, () => {
  throw new Error('postPresentation.ts nu are voie să importe nimic la rulare');
});
const {
  MAX_MEDIA, MAX_TEXT_PAGES, mediaLeadHeight, quoteChain,
  textPages, textPagesWithLead, textPageCapacity, textPreview, stageFor, mediaLayoutFor,
  galleryOf, videoOf, mediaOf, tagsOf, locationOf, contentTypeOf, isAuthoredArticle,
} = moduleShim.exports;

const image = (position = 0) => ({ hash: `${position}`.padStart(64, 'a'), ext: 'jpg', kind: 'image', position });
const clip = (position = 0) => ({ hash: `${position}`.padStart(64, 'b'), ext: 'mp4', kind: 'video', position });

test('galeria se citește în ordinea autorului, cu limita de cinci', () => {
  assert.equal(MAX_MEDIA, 5);
  assert.deepEqual(galleryOf({ id: 1, media_list: [image(1), image(0)] }).map((item) => item.position), [1, 0]);
  assert.equal(galleryOf({ id: 1, media_list: Array.from({ length: 8 }, (_, index) => image(index)) }).length, 5);
  assert.equal(galleryOf({ id: 1, media: image() }).length, 1);
  assert.equal(galleryOf({ id: 1, media: { ext: 'jpg' } }).length, 0);
  assert.equal(mediaOf({ id: 1, media_list: [image(0)], media: image(1) }).length, 1);
  assert.equal(videoOf({ id: 1, media_list: [image(0), clip(1)] }).kind, 'video');
});

test('aranjarea media urmează numărul de fișiere', () => {
  assert.equal(mediaLayoutFor(0), 'none');
  assert.equal(mediaLayoutFor(1), 'single');
  assert.equal(mediaLayoutFor(2), 'pair');
  assert.equal(mediaLayoutFor(3), 'grid');
  assert.equal(mediaLayoutFor(5), 'grid');
  assert.equal(mediaLayoutFor(6), 'carousel');
  assert.equal(mediaLayoutFor(Number.NaN), 'none');
});

test('fiecare tip de postare ajunge la randatorul potrivit', () => {
  // Payload-ul real: `posts.kind` e coloana serverului (`text` | `image` | `video`).
  assert.equal(stageFor({ id: 1, kind: 'text', caption: 'doar text' }), 'text');
  assert.equal(stageFor({ id: 1, kind: 'image', caption: '', media: image() }), 'media');
  assert.equal(stageFor({ id: 1, kind: 'image', caption: 'o poză', media: image() }), 'media');
  assert.equal(stageFor({ id: 1, kind: 'video', media: clip() }), 'reel');
  // Un clip cu descriere rămâne Reel: descrierea e metadată, nu un alt tip de conținut.
  assert.equal(stageFor({ id: 1, kind: 'video', caption: 'un clip cu descriere', media: clip() }), 'reel');
  assert.equal(stageFor({ id: 1, kind: 'text', caption: 'comentariu', quoted_post: { id: 2, caption: 'originalul' } }), 'quote');
  assert.equal(stageFor(null), 'text');
});

test('o pagina autorata cu fotografii ramane articol, nu pagina imersiva', () => {
  const authoredPhoto = {
    id: 1, kind: 'image', caption: 'Un articol cu o fotografie.', text_style: { theme: 'paper' }, media: image(),
  };
  assert.equal(isAuthoredArticle(authoredPhoto), true);
  assert.equal(stageFor(authoredPhoto), 'article');

  // O poza fara pagina autorata pastreaza compozitia foto, exact ca inainte.
  assert.equal(isAuthoredArticle({ id: 2, kind: 'image', caption: 'doar o poza', media: image() }), false);
  assert.equal(stageFor({ id: 2, kind: 'image', caption: 'doar o poza', media: image() }), 'media');

  // Stilul fara media este pagina de cuvinte; un clip ramane Reel; un quote isi pastreaza conversatia.
  assert.equal(isAuthoredArticle({ id: 3, kind: 'text', caption: 'doar cuvinte', text_style: { theme: 'paper' } }), false);
  assert.equal(isAuthoredArticle({ id: 4, kind: 'video', caption: 'un clip', text_style: { theme: 'paper' }, media: clip() }), false);
  assert.equal(isAuthoredArticle({
    id: 5, kind: 'image', caption: 'raspuns', text_style: { theme: 'paper' }, media: image(),
    quoted_post: { id: 6, caption: 'originalul' },
  }), false);
  // Un soundtrack nu este o fotografie si nu transforma pagina intr-un articol cu poza.
  assert.equal(isAuthoredArticle({
    id: 7, kind: 'text', caption: 'cu sunet', text_style: { theme: 'paper' },
    media_list: [{ hash: 'c'.repeat(64), ext: 'mp3', kind: 'audio', position: 0 }],
  }), false);
});

test('clasificarea conținutului: Reel vs Post, după tipul stocat', () => {
  const reelWithCaption = { id: 1, kind: 'video', caption: 'Vântul în trestie, Delta Dunării.', media: clip() };
  const reelWithoutCaption = { id: 2, kind: 'video', media: clip() };
  const textPost = { id: 3, kind: 'text', caption: 'Trotuarul de lângă Cișmigiu.' };
  const photoPost = { id: 4, kind: 'image', media: image() };
  const textAndPhoto = { id: 5, kind: 'image', caption: 'Cafeaua de după alergare.', media: image() };
  const quotePost = { id: 6, kind: 'text', caption: 'Asta.', quoted_post: { id: 7, kind: 'video', media: clip() } };
  const repost = { id: 8, kind: 'text', repost: { reposter: { handle: 'ana' } }, caption: '' };

  // REEL: clipul e compoziția, cu sau fără descriere.
  assert.equal(contentTypeOf(reelWithCaption), 'reel');
  assert.equal(contentTypeOf(reelWithoutCaption), 'reel');
  assert.equal(stageFor(reelWithCaption), 'reel');
  assert.equal(stageFor(reelWithoutCaption), 'reel');

  // POST: orice altceva - text, poză, text + poză, quote, repost.
  for (const post of [textPost, photoPost, textAndPhoto, quotePost, repost]) {
    assert.equal(contentTypeOf(post), 'post', `postarea ${post.id} nu e Reel`);
    assert.notEqual(stageFor(post), 'reel', `postarea ${post.id} nu are voie la randatorul de Reel`);
  }

  // Un video *înglobat* într-o postare nu face postarea Reel: tipul explicit decide.
  const textAndVideo = { id: 9, kind: 'video', post_type: 'post', caption: 'Text lung, cu un clip dedesubt.', media_list: [clip()] };
  assert.equal(contentTypeOf(textAndVideo), 'post');
  assert.equal(stageFor(textAndVideo), 'media');

  // Un Reel declarat explicit rămâne Reel chiar dacă serverul ar trimite alt `kind`.
  assert.equal(contentTypeOf({ id: 10, kind: 'image', post_type: 'reel', media: clip() }), 'reel');

  // Fără `kind` (date vechi, scrise de mână): doar clipul fără cuvinte e Reel.
  assert.equal(contentTypeOf({ id: 11, media: clip() }), 'reel');
  assert.equal(contentTypeOf({ id: 12, media: clip(), caption: 'cu text' }), 'post');
  assert.equal(contentTypeOf(null), 'post');
});


test('un quote arată originalul, iar lanțul se oprește la trei panouri', () => {
  const original = { id: 10, caption: 'originalul' };
  const first = { id: 11, caption: 'primul quote', quoted_post: original };
  const second = { id: 12, caption: 'al doilea quote', quoted_post: first };
  const third = { id: 13, caption: 'al treilea quote', quoted_post: second };

  const one = quoteChain(first);
  assert.deepEqual(one.layers.map((layer) => layer.post.id), [11, 10]);
  assert.deepEqual(one.layers.map((layer) => layer.role), ['latest', 'original']);
  assert.equal(one.omitted, 0);

  const two = quoteChain(second);
  assert.deepEqual(two.layers.map((layer) => layer.post.id), [12, 11, 10]);
  assert.deepEqual(two.layers.map((layer) => layer.role), ['latest', 'previous', 'original']);

  const three = quoteChain(third);
  assert.deepEqual(three.layers.map((layer) => layer.post.id), [13, 12, 10]);
  assert.equal(three.omitted, 1);
  assert.equal(three.total, 4);
});

test('un lanț ciclic nu blochează randarea', () => {
  const a = { id: 1, caption: 'a' };
  const b = { id: 2, caption: 'b', quoted_post: a };
  a.quoted_post = b;
  const chain = quoteChain(a);
  assert.deepEqual(chain.layers.map((layer) => layer.post.id), [1, 2]);
  assert.equal(quoteChain(null).layers.length, 0);
});

test('paginarea textului nu rupe cuvinte si nu pierde continut', () => {
  assert.equal(MAX_TEXT_PAGES, 120);
  assert.deepEqual(textPages(''), { pages: [], overflow: false });
  assert.deepEqual(textPages('   ').pages, []);

  const words = Array.from({ length: 180 }, (_, index) => `cuvant${index}`);
  const long = textPages(words.join(' '));
  assert.equal(long.overflow, false);
  assert.ok(long.pages.length > 1 && long.pages.length <= MAX_TEXT_PAGES);
  for (const page of long.pages) {
    for (const word of page.split(/\s+/)) assert.ok(words.includes(word), `cuvant rupt: ${word}`);
    assert.ok(page.length <= 420, `pagina depaseste limita: ${page.length}`);
  }
  assert.deepEqual(textPages(words.join(' ')), long, 'acelasi text = aceleasi pagini');

  const paragraphs = textPages('Primul paragraf.\n\nAl doilea paragraf.');
  assert.equal(paragraphs.pages.length, 1);
  assert.equal(paragraphs.pages[0], 'Primul paragraf.\n\nAl doilea paragraf.');

  const capped = textPages(words.join(' '), 120, 2);
  assert.equal(capped.pages.length, 2);
  assert.equal(capped.overflow, true);
  assert.ok(capped.pages[1].length > 120);
});

test('prima pagina a unui articol cu fotografie are capacitatea ei, restul paginilor pe cea normala', () => {
  const words = Array.from({ length: 220 }, (_, index) => `cuvant${index}`);
  const article = words.join(' ');
  const split = textPagesWithLead(article, 160, 420);
  assert.equal(split.overflow, false);
  assert.ok(split.pages.length > 2);
  assert.ok(split.pages[0].length <= 160, `prima pagina: ${split.pages[0].length}`);
  for (const page of split.pages.slice(1)) {
    assert.ok(page.length <= 420, `pagina urmatoare: ${page.length}`);
  }
  // Niciun cuvant nu se pierde si ordinea ramane a autorului.
  assert.deepEqual(split.pages.join('\n\n').split(/\s+/).filter(Boolean), words);
  assert.deepEqual(textPagesWithLead(article, 160, 420), split, 'acelasi text = aceleasi pagini');
  assert.deepEqual(textPagesWithLead('', 160, 420), { pages: [], overflow: false });
  const tiny = textPagesWithLead(article, 20, 420);
  assert.ok(tiny.pages[0].length > 0 && tiny.pages[0].length <= 80, 'capacitatea mica este plafonata, nu zero');
});

test('o pagina masurata primeste cate caractere incap pe ecran, nu 420', () => {
  // A phone page: 393 dp wide, ~600 dp of reading room, 24/34 type.
  const phone = textPageCapacity({ width: 393, height: 600, fontSize: 24, lineHeight: 34 });
  assert.ok(phone > 300 && phone < 700, `capacitatea unui telefon: ${phone}`);
  // A small face fits more; a poster face fits less.
  const small = textPageCapacity({ width: 393, height: 600, fontSize: 20, lineHeight: 30 });
  const large = textPageCapacity({ width: 393, height: 600, fontSize: 30, lineHeight: 42 });
  assert.ok(small > phone && phone > large, `${small} > ${phone} > ${large}`);
  // An unmeasured box falls back to the old page size instead of producing an empty page.
  assert.equal(textPageCapacity({ width: 0, height: 0, fontSize: 24, lineHeight: 34 }), 420);
});

test('un articol de 10 000 de caractere se imparte fara sa piarda nimic', () => {
  const paragraph = 'Padurea isi tine pagina. '.repeat(19).trim();
  const article = Array.from({ length: 26 }, (_, index) => `${paragraph} #${index}`).join('\n\n');
  assert.ok(article.length >= 10000, `articolul are ${article.length} caractere`);
  const capacity = textPageCapacity({ width: 393, height: 600, fontSize: 24, lineHeight: 34 });
  const split = textPages(article, capacity);
  assert.equal(split.overflow, false);
  assert.ok(split.pages.length > 5, `paginile unui articol lung: ${split.pages.length}`);
  assert.ok(split.pages.length <= MAX_TEXT_PAGES);
  for (const page of split.pages) {
    assert.ok(page.trim().length > 0, 'nicio pagina goala');
    assert.ok(page.length <= capacity, `pagina depaseste capacitatea: ${page.length} > ${capacity}`);
  }
  // Every word of the article survives, in order.
  const original = article.split(/\s+/).filter(Boolean);
  const kept = split.pages.join('\n\n').split(/\s+/).filter(Boolean);
  assert.deepEqual(kept, original);

  // The same article with a picture on its first page still keeps every word.
  const firstWithPhoto = Math.floor(capacity * 0.6);
  const withPhoto = textPagesWithLead(article, firstWithPhoto, capacity);
  assert.equal(withPhoto.overflow, false);
  assert.ok(withPhoto.pages.length >= split.pages.length, 'fotografia nu poate micsora numarul de pagini');
  assert.ok(withPhoto.pages[0].length <= firstWithPhoto);
  for (const page of withPhoto.pages.slice(1)) assert.ok(page.length <= capacity);
  assert.deepEqual(
    withPhoto.pages.join('\n\n').split(/\s+/).filter(Boolean),
    original,
    'fotografia nu are voie sa piarda un cuvant',
  );
});

test('fotografia mărită împinge textul, iar pagina nu este înghițită de ea', () => {
  // A 393×699 page: the measured media cap is 34 % of the page, at most 92 % of its width.
  const pageWidth = 393;
  const pageHeight = pageWidth * (16 / 9);
  const base = Math.min(pageHeight * 0.34, pageWidth * 0.92, 420);
  const plain = mediaLeadHeight(base, pageWidth, pageHeight, { scale: 1, y: 0 });
  const zoomed = mediaLeadHeight(base, pageWidth, pageHeight, { scale: 1.2, y: 0 });
  const lowered = mediaLeadHeight(base, pageWidth, pageHeight, { scale: 1, y: 0.2 });
  assert.equal(plain, base + 12);
  assert.ok(zoomed > plain, 'apropierea mărește blocul');
  assert.ok(lowered > plain, 'mutarea în jos rezervă mai mult spațiu');
  assert.equal(mediaLeadHeight(base, pageWidth, pageHeight, { scale: 1, y: -0.2 }), plain);
  // The cap keeps the words alive: a huge frame never takes more than 46 % of the page.
  assert.equal(mediaLeadHeight(base, pageWidth, pageHeight, { scale: 1.2, y: 0.45 }), Math.min(pageHeight * 0.46, pageWidth * 1.02, 480));
  // No lead, no room reserved.
  assert.equal(mediaLeadHeight(0, pageWidth, pageHeight, { scale: 1 }), 0);

  // The first page's capacity follows that height: a larger picture means fewer characters on page one,
  // and the rest of the article continues on the following pages without losing a word.
  const article = Array.from({ length: 300 }, (_, index) => `cuvant${index}`).join(' ');
  const capacity = textPageCapacity({ width: pageWidth, height: pageHeight, fontSize: 20, lineHeight: 29 });
  const firstFor = (lead) => textPageCapacity({
    width: pageWidth, height: Math.max(80, pageHeight - lead - 12), fontSize: 20, lineHeight: 29,
  });
  const flat = textPagesWithLead(article, firstFor(plain), capacity);
  const tall = textPagesWithLead(article, firstFor(zoomed), capacity);
  assert.ok(tall.pages[0].length < flat.pages[0].length, 'prima pagină se micșorează când poza crește');
  assert.ok(tall.pages.length >= flat.pages.length);
  assert.deepEqual(tall.pages.join('\n\n').split(/\s+/).filter(Boolean), article.split(/\s+/).filter(Boolean));
});

test('butonul de traducere nu mai este o decizie a prezentării', () => {
  /**
   * Runda 30: regula a plecat în `lib/language.ts` (`scripts/test-language.cjs`), pentru că are nevoie
   * de detectorul local și de limba activă a aplicației — două lucruri care nu au ce căuta într-un modul
   * de prezentare pur. Aici rămâne doar promisiunea că prezentarea nu mai decide singură.
   */
  assert.equal(moduleShim.exports.needsTranslation, undefined);
  assert.equal(moduleShim.exports.languageCodeOf, undefined);
});

test('previzualizarea taie pe cuvânt și spune când mai e text', () => {
  assert.deepEqual(textPreview('scurt'), { text: 'scurt', hasMore: false });
  const preview = textPreview('un text lung '.repeat(40), 60);
  assert.equal(preview.hasMore, true);
  assert.ok(preview.text.endsWith('\u2026'));
  assert.ok(preview.text.length <= 61);
  assert.equal(preview.text.includes('  '), false);
  assert.deepEqual(textPreview(null), { text: '', hasMore: false });
});

test('etichetele și locația vin din postarea însăși', () => {
  assert.deepEqual(tagsOf({ id: 1, tags: ['#jungle', 'noapte'], caption: 'text cu #noapte și #cod' }), ['#jungle', 'noapte', 'cod']);
  assert.deepEqual(tagsOf({ id: 1, caption: 'fără etichete' }), []);
  assert.equal(locationOf({ id: 1, publishing: { location: '  Brașov ' } }), 'Brașov');
  assert.equal(locationOf({ id: 1 }), '');
});
