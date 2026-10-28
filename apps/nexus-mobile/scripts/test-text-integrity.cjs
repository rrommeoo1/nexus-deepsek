/* global __dirname */
/**
 * Integritatea textului: ce scrie autorul în câmp este exact ce se publică.
 *
 * Runda din 30 octombrie 2026 a plecat de la o postare reală în care cuvintele lipite în câmpul de text
 * nu ajungeau pe pagină, iar un clip scos din pagină se urca totuși la publicare. Cele două simptome
 * aveau aceeași cauză: compozitorul ținea **două** adevăruri — `draft.document` (pagina desenată) și
 * `body` (textul din câmp) — și fiecare buton citea altul. Testele de aici apără un singur adevăr:
 * `page = setBlockText(draft.document, flight)`, din care se citesc și rândurile, și `body`, și ce se
 * trimite la server.
 *
 * Ce se verifică, în ordinea în care se întâmplă în mână:
 *  A. lipești un text, apeși `Gata`, apeși `Publică` — se publică exact textul lipit;
 *  B. lipești și apeși `Publică` fără `Gata` — la fel, fiindcă `Publică` citește `page`, nu `draft`;
 *  C. deschizi câmpul și îl închizi fără nicio tastă — pagina rămâne neatinsă;
 *  D. o ciornă veche nu poate readuce în postare un fișier care nu mai e pe pagină;
 *  E. emojiul este o tastă în câmp, nu o rescriere a paginii;
 *  F. rândurile autorului ajung rânduri pe pagină;
 *  G. literele și mărimile noi se desenează și se măsoară fără să taie ultimul cuvânt;
 *  H. ce oferă telefonul este exact ce primește serverul (o față refuzată = o postare pierdută);
 *  I. mânerul de selecție este albastru de cerneală, nu accentul temei.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(ROOT, file), 'utf8');
/** Sursa fără comentarii: un nume de funcție nu poate fi „dovedit" de textul care îl povestește. */
const bare = (file) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

function load(file, requireShim = (id) => {
  throw new Error(`${file} nu are voie să ceară „${id}" la rulare`);
}) {
  const output = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const shim = { exports: {} };
  new Function('module', 'exports', 'require', output)(shim, shim.exports, requireShim);
  return shim.exports;
}

const documentModule = load('src/lib/editorialDocument.ts');
const metricsModule = load('src/lib/fontMetrics.ts');
const flowModule = load('src/lib/editorialFlow.ts', (id) => {
  if (id === './editorialDocument') return documentModule;
  if (id === './fontMetrics') return metricsModule;
  throw new Error(`editorialFlow.ts a cerut un modul neașteptat: ${id}`);
});
const styleModule = load('src/lib/textStyle.ts', (id) => {
  if (id === './editorialDocument') return documentModule;
  throw new Error(`textStyle.ts a cerut un modul neașteptat: ${id}`);
});

const {
  applyPlainText, documentFromPlainText, documentPlainText, mediaBlock, reconcileMedia, removeEditorialBlock,
  setBlockText,
} = documentModule;
const { TEXT_SIZES, TEXT_FONT_IDS, fontFamilyFor, metricFaceFor, pagePaletteOf, sizeOf, TEXT_SELECTION_COLOR } = styleModule;

/**
 * O pagină ca a autorului: două paragrafe și un clip între ele, adică exact forma care a produs bug-ul
 * (cuvinte deasupra și dedesubtul unui fișier).
 */
function composed() {
  const base = documentFromPlainText('Primul paragraf scris de autor.\n\nAl doilea paragraf scris de autor.');
  return {
    version: 1,
    typography: 'auto',
    blocks: [
      base.blocks[0],
      mediaBlock(0, { mediaType: 'video', placement: 'full', widthFraction: 1, wrapText: false }),
      base.blocks[1],
    ],
  };
}

test('A. lipit, Gata, Publică: se publică exact textul lipit, iar clipul rămâne pe pagină', () => {
  /**
   * Drumul întreg, fără interfață: câmpul primește textul lipit (`setBlockText`), `Gata` scrie rezultatul
   * în `draft.document`, `Publică` ia pagina de acolo. Textul are și un rând nou în interior, fiindcă
   * exact rândurile lipite din browser se pierdeau înainte.
   */
  const pasted = 'Textul lipit din browser.\nAl doilea rând al lui.\n\nUn paragraf nou, lipit.';
  const page = composed();
  const committed = setBlockText(page, page.blocks[0].id, pasted);
  const { document: published } = reconcileMedia(committed, 1);

  assert.equal(documentPlainText(published), `${pasted}\n\nAl doilea paragraf scris de autor.`,
    'fiecare rând publicat este un rând lipit, în ordine, iar restul paginii rămâne neatins');
  assert.equal(published.blocks.filter((block) => block.type === 'media').length, 1, 'clipul nu se pierde la Gata');
  assert.equal(published.blocks.find((block) => block.type === 'media').mediaIndex, 0,
    'și își păstrează fișierul');
});

test('B. Publică fără Gata: compozitorul trimite pagina câmpului, nu documentul dinainte de lipire', () => {
  /**
   * Butonul `Publică` nu are voie să citească `draft.document`: între ultima tastă și apăsare nu s-a
   * întâmplat nimic care să scrie pagina, deci `draft.document` este textul *dinainte* de lipire. Ce se
   * trimite se compune din `page` (câmpul aplicat prin `setBlockText`) și trece prin `reconcileMedia`,
   * ca fișierul unei fotografii scoase din pagină să nu urce.
   */
  const source = bare('src/app/text.tsx');
  assert.match(source, /const page = useMemo\(\s*\(\) => \(flight \? setBlockText\(draft\.document, flight\.blockId, flight\.text\) : draft\.document\)/,
    'page este câmpul aplicat pe pagină, nu pagina singură');
  assert.match(source, /const reconciled = reconcileMedia\(page, draft\.attachments\.length\);/,
    'publicarea reconciliază pagina, nu documentul');
  assert.match(source, /const caption = documentPlainText\(reconciled\.document\);/,
    'legenda este textul paginii publicate');
  assert.match(source, /textStyle: \{ \.\.\.draft\.style, document: reconciled\.document \}/,
    'și pagina publicată este exact documentul din care s-a citit legenda');
  assert.doesNotMatch(source, /reconcileMedia\(draft\.document/,
    'nimic nu mai reconciliază documentul nepublicat');
  assert.doesNotMatch(source, /documentPlainText\(draft\.document\)/,
    'și nimic nu mai citește cuvintele din documentul nepublicat');
  assert.match(source, /const body = documentPlainText\(page\);/, 'textul paginii se citește din `page`');
});

test('B2. fiecare tastă este o intenție nouă, deci o reîncercare nu repetă textul dinainte', () => {
  /**
   * `Idempotency-Key` este schimbat la fiecare modificare — și la fiecare caracter din câmp, nu doar la
   * fiecare gest de pagină. Altfel, o publicare picată pe rețea ar fi reluată cu legenda veche, iar serverul
   * (corect) ar răspunde cu postarea de dinainte.
   */
  const source = bare('src/app/text.tsx');
  const keys = source.match(/publishKey\.current = publishIntentKey\(\);/g) ?? [];
  assert.ok(keys.length >= 3, `cheia se reînnoiește în editare, în câmp și în pagină (găsite: ${keys.length})`);
  const onFieldChange = source.slice(source.indexOf('const onFieldChange'), source.indexOf('const page = useMemo'));
  assert.match(onFieldChange, /publishKey\.current = publishIntentKey\(\);/, 'câmpul reînnoiește cheia');
});

test('C. câmpul deschis și închis fără nicio tastă nu schimbă pagina', () => {
  /**
   * `Gata` scrie prin `setBlockText`, care întoarce *același* obiect când textul nu s-a schimbat; iar
   * compozitorul sare peste `onChangeDocument` când obiectul este identic (`next !== document`). Un câmp
   * deschis doar ca să te uiți nu are cum să re-formeze pagina, să golească Undo sau să schimbe cheia.
   */
  const page = composed();
  assert.equal(setBlockText(page, page.blocks[0].id, page.blocks[0].text), page, 'același obiect, nu o copie');

  const composer = bare('src/app/text.tsx');
  assert.match(composer, /: draft\.document\),\s*\n\s*\[draft\.document, flight\],/,
    'fără câmp deschis, `page` *este* documentul ciornei, nu o copie a lui');

  const sheet = bare('src/components/EditorialPage.tsx');
  assert.match(sheet, /const next = setBlockText\(document, open\.blockId, open\.text\);\s*\n\s*if \(next !== document\) onChangeDocument\(next, false\);/,
    '`Gata` nu anunță o schimbare pe care nu a făcut-o');
  assert.equal(page.typography, 'auto', 'și nici măsura nu se atinge');
});

test('D. o ciornă veche nu poate readuce în postare un fișier care nu mai e pe pagină', () => {
  /**
   * `reconcileMedia` este garda dintre pagină și server: păstrează doar fișierele pe care pagina le arată,
   * în ordinea paginii, și renumerotează blocurile ca să corespundă ordinii de încărcare. Ciorna veche
   * (scrisă de o versiune care ștergea blocul dar lăsa fișierul) este exact cazul pe care îl apără.
   */
  const page = composed();
  // Un al doilea bloc de media care arată fișierul 7 dintr-o ciornă veche, dar nu mai există niciun fișier.
  const stale = { ...page, blocks: [...page.blocks, mediaBlock(7, { placement: 'right' })] };
  const none = reconcileMedia(stale, 0);
  assert.equal(none.document.blocks.filter((block) => block.type === 'media').length, 0,
    'fără fișiere pe telefon nu pleacă niciun bloc de media');
  assert.deepEqual(none.kept, [], 'și niciun fișier la încărcare');

  const orphan = reconcileMedia(stale, 1);
  assert.deepEqual(orphan.kept, [0], 'doar fișierul arătat de pagină');
  assert.equal(orphan.document.blocks.filter((block) => block.type === 'media').length, 1,
    'blocul orfan (index 7) dispare din document');
  assert.equal(orphan.document.blocks.filter((block) => block.type === 'media')[0].mediaIndex, 0,
    'iar blocul rămas este renumerotat 0');

  // Pagina deja aliniată nu se atinge: aceeași referință, deci niciun re-flow degeaba.
  assert.equal(reconcileMedia(page, 1).document, page, 'o pagină curată rămâne aceeași referință');
  assert.deepEqual(reconcileMedia(page, 1).kept, [0]);
});

test('E. un emoji este o tastă în câmp, nu o rescriere a paginii', () => {
  /**
   * Până în această rundă emojiul intra direct în document (`applyPlainText`), ceea ce însemna că un emoji
   * apăsat cât timp câmpul era deschis rescria pagina fără textul din câmp. Acum cere o inserare:
   * compozitorul trimite un `insertRequest` cu nonce, iar pagina îl adaugă la cuvintele din câmp.
   */
  const composer = bare('src/app/text.tsx');
  assert.doesNotMatch(composer, /applyPlainText\(/, 'compozitorul nu mai rescrie pagina cu emojiul');
  assert.match(composer, /insertRequest=/, 'emojiul cere o inserare în câmp');

  const sheet = bare('src/components/EditorialPage.tsx');
  const insert = sheet.slice(sheet.indexOf('const insertNonce'), sheet.indexOf('const focusRequest'));
  assert.match(insert, /setField\(\(current\) => \(/, 'inserarea scrie în câmp');
  /**
   * Runda 33: nu la coada paragrafului, ci la cursor. `onSelectionChange` păstra până atunci doar pinul
   * atingerii, deci un emoji apăsat la mijlocul frazei apărea după ultimul cuvânt. Acum intervalul raportat
   * de telefon are întâietate, iar regula de scriere este `insertAtSelection` (`lib/textInsert.ts`).
   */
  assert.doesNotMatch(insert, /text: `\$\{current\.text\}\$\{addition\}`/, 'nu se mai lipește orbește la coadă');
  assert.match(insert, /const range = current\.selection \?\? current\.caret \?\? current\.text\.length;/,
    'cursorul raportat de telefon este folosit');
  assert.match(insert, /insertAtSelection\(current\.text, addition,/, 'emoji-ul se scrie la cursor');

  // Lista oferită de tastatură nu are dubluri: un emoji nu se poate afla în două grupuri deodată.
  assert.equal(new Set(styleModule.TEXT_EMOJI).size, styleModule.TEXT_EMOJI.length, 'fiecare emoji o singură dată');
  assert.ok(styleModule.TEXT_EMOJI.includes('🦗'), 'greierul de junglă există');
  assert.ok(styleModule.TEXT_EMOJI_GROUPS.length >= 6, 'și tastatura are grupuri destule pentru un jurnal');
});

test('F. rândurile autorului ajung rânduri pe pagină', () => {
  /**
   * Fluxul rupe rândurile după măsură, dar un `\n` scris de autor rupe *înaintea* cuvântului următor, fără
   * să adauge un rând gol: două jumătăți de vers rămân două rânduri, iar un rând gol desparte paragrafe
   * (`paragraphsOf`). Fără asta, un poem lipit ajungea o proză.
   */
  const page = documentFromPlainText('primul rând\ncontinuă aici\n\nun paragraf nou');
  const result = flowModule.flowEditorialDocument(page, {
    pageWidth: 360, pageHeight: 640, fontSize: 20, lineHeight: 29, headingSize: 28, headingLine: 38,
    marginX: 26, marginTop: 30, marginBottom: 30, align: 'left', font: 'serif',
  });
  const lines = result.pages[0].lines.map((line) => line.text);
  assert.deepEqual(lines, ['primul rând', 'continuă aici', 'un paragraf nou'], 'trei rânduri, în ordinea scrisă');
  assert.equal(result.pages.length, 1, 'și încape pe o pagină');
});

test('G. literele și mărimile noi se desenează și se măsoară fără să taie ultimul cuvânt', () => {
  /**
   * Fluxul măsoară cu tabelele a trei fețe (`lib/fontMetrics.ts`), dar autorul poate alege șase. `metricFaceFor`
   * asociază fiecare față desenată cu tabla care o *supraestimează* — o linie care încape în model încape și
   * pe ecran, cel mult se rupe puțin mai devreme. Desenul rămâne `fontFamilyFor`.
   */
  const mapping = { serif: 'serif', sans: 'sans', mono: 'mono', slab: 'mono', casual: 'serif', condensed: 'serif' };
  assert.deepEqual([...TEXT_FONT_IDS].sort(), Object.keys(mapping).sort(), 'șase fețe, toate cu tabelă de măsură');
  for (const [font, face] of Object.entries(mapping)) {
    assert.equal(metricFaceFor(font), face, `${font} se măsoară cu ${face}`);
    assert.ok(['serif', 'sans', 'mono'].includes(metricFaceFor(font)), `${font} are o tabelă reală`);
  }

  const families = new Set();
  for (const font of TEXT_FONT_IDS) {
    for (const platform of ['ios', 'android']) {
      const family = fontFamilyFor(font, platform);
      assert.equal(typeof family, 'string', `${font} are o familie pe ${platform}`);
      assert.ok(family.trim().length > 0, `${font}/${platform} nu e gol`);
    }
    /** Pe web o față fără nume propriu (`sans`) lasă sistemul să aleagă: asta e o alegere, nu o lipsă. */
    const web = fontFamilyFor(font, 'web');
    assert.ok(web === undefined || web.trim().length > 0, `${font}/web este o familie sau „lasă sistemul"`);
    families.add(fontFamilyFor(font, 'android'));
  }
  assert.equal(families.size, TEXT_FONT_IDS.length,
    'fiecare față desenează altceva pe Android, altfel cele șase butoane ar fi unul');

  // Mărimile: fiecare treaptă are numere proprii, iar `xlarge` este cu adevărat mai mare decât `large`.
  const ids = TEXT_SIZES.map((entry) => entry.id);
  assert.deepEqual(ids, ['small', 'medium', 'large', 'xlarge'], 'patru trepte, în ordine');
  for (let index = 1; index < TEXT_SIZES.length; index += 1) {
    assert.ok(TEXT_SIZES[index].fontSize > TEXT_SIZES[index - 1].fontSize, `${ids[index]} este mai mare`);
    assert.ok(TEXT_SIZES[index].lineHeight > TEXT_SIZES[index - 1].lineHeight, `${ids[index]} are rând mai înalt`);
  }
  assert.equal(sizeOf('xlarge').fontSize, 34, 'ultima treaptă este 34/47');
  assert.equal(sizeOf('xlarge').lineHeight, 47);

  // Pagina măsoară cu fața de măsură și desenează cu a autorului.
  const sheet = bare('src/components/EditorialPage.tsx');
  assert.match(sheet, /const metricFont = metricFaceFor\(style\.font\);/, 'pagina calculează fața de măsură');
  assert.match(sheet, /const bodyFont = fontFamilyFor\(style\.font, Platform\.OS\) \?\? 'serif';/,
    'și desenează cu familia autorului');
  assert.doesNotMatch(sheet, /font: style\.font/, 'măsurarea nu mai primește fața desenată');
  assert.doesNotMatch(sheet, /measureTextWidth\([^)]*bodyFont/, 'nici măsurătorile nu mai folosesc fața desenată');
});

test('H. ce desenează telefonul este exact ce primește serverul', async () => {
  /**
   * Pagina se compune pe telefon după listele ei (`textStyle.ts`) și se validează pe server după ale lui
   * (`apps/nexus-web/lib/post-text-style.js`). O față sau o mărime pe care telefonul o oferă dar serverul o
   * refuză nu se vede până la `Publică`, când textul e deja scris — deci cele două liste trebuie citite
   * împreună. Serverul păstrează și el doar ce știe: `TEXT_STYLE_INVALID` înseamnă o postare pierdută.
   */
  const web = resolve(ROOT, '..', 'nexus-web', 'lib');
  const serverStyle = await import(pathToFileURL(resolve(web, 'post-text-style.js')).href);
  const serverDocument = await import(pathToFileURL(resolve(web, 'post-editorial-document.js')).href);

  assert.deepEqual([...serverStyle.TEXT_FONTS], [...TEXT_FONT_IDS], 'aceleași șase fețe, în aceeași ordine');
  assert.deepEqual([...serverStyle.TEXT_SIZES], TEXT_SIZES.map((entry) => entry.id), 'aceleași patru mărimi');
  assert.deepEqual([...serverDocument.EDITORIAL_TYPOGRAPHIES], [...documentModule.EDITORIAL_TYPOGRAPHIES],
    'aceleași mărimi de pagină, cu tot cu `auto`');

  /** Și chiar trec de validare: o postare nu se pierde fiindcă autorul a ales ultima treaptă. */
  const style = {
    ...styleModule.defaultTextStyle(), font: 'condensed', size: 'xlarge',
    document: documentFromPlainText('Un paragraf scris în cea mai mare mărime.'),
  };
  style.document.typography = 'xlarge';
  const accepted = serverStyle.normalizeTextStyle(style);
  assert.equal(accepted.font, 'condensed', 'serverul păstrează fața condensată');
  assert.equal(accepted.size, 'xlarge', 'și mărimea cea mare');
  assert.equal(accepted.document.typography, 'xlarge', 'și măsura paginii');
});

test('I. selecția este albastru de cerneală, nu accentul temei', () => {
  /**
   * `TEXT_SELECTION_COLOR` este culoarea mânerului de selecție: un albastru care se citește pe hârtia caldă și
   * sub cerneala paginii. Înainte de rundă mânerul lua accentul temei (verdele de junglă), care pe o pagină
   * tipărită arăta ca un marcaj greșit.
   */
  const palette = pagePaletteOf();
  assert.notEqual(TEXT_SELECTION_COLOR, palette.mark, 'selecția nu este accentul textului');
  assert.notEqual(TEXT_SELECTION_COLOR, palette.accent, 'și nici accentul temei');
  for (const other of [palette.text, palette.background]) {
    assert.ok(styleModule.contrastRatio(TEXT_SELECTION_COLOR, other) >= 1.4,
      `selecția se vede lângă ${other}`);
  }

  // Și este pusă pe câmp, nu lăsată la alegerea sistemului.
  const sheet = bare('src/components/EditorialPage.tsx');
  assert.match(sheet, /selectionColor=\{TEXT_SELECTION_COLOR\}/, 'câmpul își alege singur culoarea selecției');
  assert.doesNotMatch(sheet, /selectionColor=\{palette\./, 'nu o ia din paleta temei');
});
