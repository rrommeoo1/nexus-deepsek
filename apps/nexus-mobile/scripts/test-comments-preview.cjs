/* global __dirname */
/**
 * Previzualizarea curată de deasupra comentariilor (runda 48).
 *
 * Ownerul, 31 octombrie 2026, în două propoziții care se apără împreună:
 *
 *   1. „Când se deschid comentariile, sus trebuie să rămână **numai conținutul** postării: fără avatar,
 *      nume, handle, loc, Urmărește, reacții, like/comentariu/distribuire, legendă, benzi de lizibilitate."
 *   2. „Nu vreau să se vadă părți din fotografie pe care Feed/Profil le ascund. Previzualizarea trebuie să
 *      păstreze exact aceeași decupare."
 *
 * A doua propoziție este motivul pentru care runda 47 a fost refuzată: acolo poza se potrivea `contain`, deci
 * se vedea **întreagă** într-un cadru mai scund. Testul apără amândouă: ce se desenează (stratul social
 * dispare) și **cum** se desenează (aceeași potrivire, doar o cutie mai mică, cu raportul paginii).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8');
/** Sursa fără proza ei: o propoziție dintr-un comentariu nu este un control. */
const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const shim = { exports: {} };
new Function('module', 'exports', 'require', transpile(read('src/lib/commentsPreview.ts')))(
  shim, shim.exports, (id) => { throw new Error(`commentsPreview.ts nu are voie să importe ${id} la rulare`); },
);
const { commentsPreviewAspectOf, commentsPreviewFrameOf, commentsPreviewKindOf } = shim.exports;

/** Telefonul de dezvoltare: 469 × 1021 dp (1220 × 2656 px la 2.6). */
const PHONE = { width: 469, height: 1021 };

/**
 * Ce parte din imagine se vede când o fotografie de raport `image` este așezată `cover` într-o cutie de
 * raport `box`: `cover` umple cutia, deci taie exact ce prisosește pe axa cea lungă.
 */
const coverCrop = (box, image) => ({
  widthFraction: Math.min(1, box / image),
  heightFraction: Math.min(1, image / box),
});

test('felul previzualizării: media se micșorează, cuvintele se re-pagină', () => {
  assert.equal(commentsPreviewKindOf('media'), 'media');
  assert.equal(commentsPreviewKindOf('reel'), 'media');
  assert.equal(commentsPreviewKindOf('text'), 'words');
  assert.equal(commentsPreviewKindOf('quote'), 'words', 'un citat este text, nu o imagine de acoperit');
  assert.equal(commentsPreviewKindOf('article'), 'words', 'fotografiile unui articol sunt blocuri în flux');
});


test('cutia previzualizării este pagina întreagă micșorată: același raport, altă mărime', () => {
  const frame = commentsPreviewFrameOf({ stage: 'media', pageWidth: PHONE.width, pageHeight: PHONE.height, room: 490 });
  assert.equal(frame.kind, 'media');
  assert.equal(frame.scaled, true);
  assert.equal(frame.height, 490, 'înălțimea este exact locul rămas deasupra foii');
  assert.equal(frame.width, Math.round(PHONE.width * (490 / PHONE.height)));
  const page = PHONE.width / PHONE.height;
  assert.ok(Math.abs(commentsPreviewAspectOf(frame) - page) / page < 0.001,
    'raportul cutiei este raportul paginii, în limita rotunjirii la pixel');
  assert.ok(frame.width < PHONE.width, 'compoziția este mai mică, nu alta');
});

test('decuparea este identică cu a paginii: `cover` taie aceleași părți, numai mai mici', () => {
  const frame = commentsPreviewFrameOf({ stage: 'media', pageWidth: PHONE.width, pageHeight: PHONE.height, room: 490 });
  const pageBox = PHONE.width / PHONE.height;
  const frameBox = commentsPreviewAspectOf(frame);
  /**
   * Fiecare fotografie, oricare i-ar fi raportul, trebuie să arate în previzualizare exact partea pe care o
   * arată în Feed/Profil. O schimbare de `fit` (runda 47, `contain`) ar face fracțiile 1 — adică fotografia
   * întreagă, cu părțile pe care pagina le ascunde.
   */
  for (const image of [9 / 16, 1, 4 / 5, 16 / 9, 3 / 4, 2 / 3, 1220 / 2656]) {
    const feed = coverCrop(pageBox, image);
    const preview = coverCrop(frameBox, image);
    assert.ok(Math.abs(feed.widthFraction - preview.widthFraction) < 0.002,
      `lățimea vizibilă a unei imagini ${image.toFixed(3)} rămâne a paginii`);
    assert.ok(Math.abs(feed.heightFraction - preview.heightFraction) < 0.002,
      `înălțimea vizibilă a unei imagini ${image.toFixed(3)} rămâne a paginii`);
  }
  // Nemijlocit: nicio dimensiune a cutiei nu egalează pagina întreagă când foaia este ridicată.
  assert.ok(frame.width < PHONE.width && frame.height < PHONE.height,
    'compoziția este micșorată, nu întinsă pe pagina întreagă');
});

test('fără foaie deschisă, compoziția nu se atinge', () => {
  const page = commentsPreviewFrameOf({ stage: 'media', pageWidth: PHONE.width, pageHeight: PHONE.height, room: PHONE.height });
  assert.deepEqual(page, {
    width: PHONE.width, height: PHONE.height, scaled: false, scale: 1, kind: 'media',
  });
  const roomy = commentsPreviewFrameOf({ stage: 'reel', pageWidth: PHONE.width, pageHeight: PHONE.height, room: 2000 });
  assert.equal(roomy.height, PHONE.height, 'un loc mai mare decât pagina nu mărește compoziția');
  assert.equal(roomy.scaled, false);
});

test('o pagină de cuvinte nu se micșorează: se re-pagina pe locul rămas', () => {
  for (const stage of ['text', 'quote', 'article']) {
    const frame = commentsPreviewFrameOf({ stage, pageWidth: PHONE.width, pageHeight: PHONE.height, room: 490 });
    assert.equal(frame.kind, 'words');
    assert.equal(frame.width, PHONE.width, `${stage}: pagina păstrează lățimea de citit`);
    assert.equal(frame.height, 490, `${stage}: și primește locul rămas, ca să se re-pagineze`);
    assert.equal(frame.scaled, false, `${stage}: nimic nu se micșorează — un articol la 48 % este ilizibil`);
    assert.equal(frame.scale, 1);
  }
  // O pagină de cuvinte nu crește niciodată peste înălțimea ei.
  const tall = commentsPreviewFrameOf({ stage: 'text', pageWidth: PHONE.width, pageHeight: 400, room: 900 });
  assert.equal(tall.height, 400);
});

test('măsurători stricate nu inventează o previzualizare', () => {
  for (const input of [
    { stage: 'media', pageWidth: 0, pageHeight: PHONE.height, room: 490 },
    { stage: 'media', pageWidth: PHONE.width, pageHeight: 0, room: 490 },
    { stage: 'media', pageWidth: PHONE.width, pageHeight: PHONE.height, room: 0 },
    { stage: 'media', pageWidth: Number.NaN, pageHeight: PHONE.height, room: 490 },
    { stage: 'text', pageWidth: PHONE.width, pageHeight: PHONE.height, room: -40 },
  ]) {
    const frame = commentsPreviewFrameOf(input);
    assert.equal(frame.height, 0, `fără măsurătoare nu există cutie (${JSON.stringify(input)})`);
    assert.equal(frame.scaled, false);
  }
});


test('stratul social nu se desenează în previzualizare: rămâne numai conținutul', () => {
  const canvas = strip(read('src/components/PostCanvas.tsx'));
  assert.match(canvas, /presentation = 'page'/, 'felul de prezentare este un prop, nu o grămadă de condiții');
  assert.match(canvas, /const commentsPreview = presentation === 'commentsPreview';/,
    'un singur nume, citit o dată, pentru tot stratul social');
  // Capul autorului (avatar, nume, handle, loc, Urmărește) — pe ambele ramuri.
  assert.match(canvas, /\{stacked && !commentsPreview \? \(/, 'capul paginii de media nu se desenează');
  assert.match(canvas, /\{commentsPreview \? null : \(\s*<View style=\{styles\.readingHead\}/,
    'nici capul paginii de cuvinte');
  // Descrierea, traducerea, rândul de acțiuni și ceasul clipului, toate într-un singur bloc.
  assert.match(canvas, /\{commentsPreview \? null : \(\s*<View\s+style=\{\[styles\.bottom/,
    'blocul descrierii și al acțiunilor este oprit întreg');
  assert.match(canvas, /\{bottomActions && !commentsPreview \?/,
    'nici rândul de acțiuni al unei celule');
  // Benzile de lizibilitate și semnul de redare.
  assert.match(canvas, /\{commentsPreview \? null : \(\s*<PostScrim id=\{`nxCanvasHead/, 'fără banda capului');
  assert.match(canvas, /\{commentsPreview \? null : \(\s*<PostScrim id=\{`nxCanvasFoot/, 'fără banda descrierii');
  assert.match(canvas, /\{playBadge && isVideo && !active && !commentsPreview \? \(/, 'fără discul de redare');
});

test('potrivirea imaginii rămâne a paginii: previzualizarea nu atinge `fit`', () => {
  const canvas = strip(read('src/components/PostCanvas.tsx'));
  /**
   * Exact ce a refuzat ownerul în runda 47: un `contain` strecurat în previzualizare. Fotografia trebuie să
   * se deseneze cu potrivirea paginii, oricare ar fi cadrul din jur.
   */
  assert.doesNotMatch(canvas, /'contain'/, 'niciun `contain` în compoziție, în nicio ramură');
  assert.match(canvas, /<RemoteImage item=\{cover\} fit="cover" style=\{styles\.media\} onError=\{onError\} \/>/,
    'fotografia se desenează `cover`, ca în Feed/Profil');
  assert.match(canvas, /fit="portrait-cover"\s+style=\{styles\.media\}/, 'clipul se desenează `portrait-cover`');
  // Un clip dintr-o galerie își păstrează potrivirea cititorului (PostCanvas nu-i mai impune una).
  assert.doesNotMatch(canvas, /videoFit=/, 'galeria nu mai primește o potrivire de împrumut');
  assert.match(strip(read('src/components/ReelsReader.tsx')), /mediaOverlay=\{<PostDecorations post=\{post\} fit="cover" \/>\}/,
    'decorațiunile stau pe poza de sub ele, cu aceeași potrivire');
});

test('suprafețele micșorează compoziția în locul rămas, fără să redeseneze nimic', () => {
  for (const file of ['src/components/PostCard.tsx', 'src/components/ReelsReader.tsx']) {
    const surface = strip(read(file));
    assert.match(surface, /commentsPreviewFrameOf\(\{/, `${file} folosește socoteala comună a cutiei`);
    assert.match(surface, /styles\.previewMatter/, `${file} așază compoziția în terenul paginii`);
    assert.match(surface, /presentation=\{previewing \? 'commentsPreview' : 'page'\}/, `${file} trimite felul de prezentare`);
    // Comenzile sociale se opresc pe aceeași condiție.
    assert.match(surface, /\{previewing \? null : \(\s*<PostRail/, `${file}: coloana de presări se oprește`);
    assert.match(surface, /\{previewing \? null : \(\s*<PostDistributePanel/, `${file}: panoul de distribuire se oprește`);
  }
});

test('foaia de comentarii și interacțiunile ei rămân exact cum erau', () => {
  const sheet = strip(read('src/components/CommentsSheet.tsx'));
  assert.match(sheet, /maxHeight: '82%', minHeight: '52%/, 'aceeași deschidere și același plafon');
  assert.match(sheet, /animationType="slide"/, 'aceeași alunecare');
  assert.match(sheet, /styles\.grabber/, 'același mâner');
  assert.match(sheet, /composerInput/, 'același compozitor');
  assert.doesNotMatch(sheet, /splitPanel|SplitView|fullScreenComments/, 'fără o a doua interfață de comentarii');
  // Foaia este montată de fiecare suprafață care deschide comentariile.
  for (const file of ['src/components/PostCard.tsx', 'src/components/ReelsReader.tsx']) {
    assert.match(strip(read(file)), /<PostSheets post=\{post\} engagement=\{engagement\} \/>/, `${file}: aceeași foaie`);
  }
});
