/* global __dirname */
/**
 * Previzualizarea postării de deasupra foii de comentarii (runda 47).
 *
 * Ownerul, 31 octombrie 2026: „foaia de comentarii se deschide pe jumătate de ecran. ÎMI PLACE
 * COMPORTAMENTUL ȘI NU VREAU SĂ SE SCHIMBE. Singura corecție necesară este ca previzualizarea postării din
 * jumătatea de sus să arate postarea ÎNTREAGĂ, nu o porțiune tăiată."
 *
 * Deci testul apără două lucruri deodată:
 *
 * 1. **socoteala** locului rămas (pură, `src/lib/sheetPreview.ts`), inclusiv cazul tastaturii;
 * 2. **foaia neatinsă** — înălțimea de deschidere, `Modal`-ul, grabber-ul, antetul, compozitorul — și
 *    faptul că singurul lucru care s-a schimbat este potrivirea postării în locul de deasupra.
 *
 * Runda 48 a revizuit punctul 2: ce se desenează deasupra foii este acum **numai conținutul** postării, iar
 * decuparea imaginii este cea din Feed/Profil (`test-comments-preview.cjs`). Foaia, înălțimile ei, `Modal`-ul
 * și compozitorul au rămas exact cum erau.
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
new Function('module', 'exports', 'require', transpile(read('src/lib/sheetPreview.ts')))(shim, shim.exports, (id) => {
  throw new Error(`sheetPreview.ts nu are voie să importe ${id} la rulare`);
});
const {
  SHEET_PREVIEW_MIN, clearSheetPreview, previewPageAfter, previewPageTurns, previewRoomOf, reportSheetPreview,
  requestSheetPreviewPage, resetSheetPreview, sheetPreviewHeight, sheetPreviewPageRequest, sheetPreviewPostId,
  subscribeSheetPreview,
} = shim.exports;

/** Telefonul de dezvoltare: 469 × 1021 dp (1220 × 2656 px la 2.6). */
const PHONE = { width: 469, height: 1021 };

test('fără foaie deschisă, pagina își păstrează înălțimea întreagă', () => {
  assert.equal(previewRoomOf({ pageHeight: PHONE.height, sheetHeight: 0 }), PHONE.height);
  assert.equal(previewRoomOf({ pageHeight: PHONE.height, sheetHeight: -40 }), PHONE.height);
  assert.equal(previewRoomOf({ pageHeight: 0, sheetHeight: 500 }), 0, 'o pagină fără înălțime nu inventează loc');
});

test('foaia ia exact partea ei: previzualizarea primește restul', () => {
  // Deschiderea de la jumătatea ecranului: 52 % din 1021 ≈ 531 dp.
  assert.equal(previewRoomOf({ pageHeight: PHONE.height, sheetHeight: 531 }), 490);
  // Lista lungă urcă foaia la 82 %: previzualizarea rămâne mică, dar nu dispare.
  assert.equal(previewRoomOf({ pageHeight: PHONE.height, sheetHeight: 837 }), 184);
  assert.equal(previewRoomOf({ pageHeight: PHONE.height, sheetHeight: 837, minimum: 200 }), 200,
    'minimul cerut de apelant este respectat');
});

test('o măsurătoare absurdă nu poate depăși pagina și nu poate coborî sub minim', () => {
  const huge = previewRoomOf({ pageHeight: 600, sheetHeight: 4000 });
  assert.equal(huge, Math.min(SHEET_PREVIEW_MIN, 600), 'foaia nu poate lua mai mult decât există');
  assert.ok(huge > 0);
  assert.equal(previewRoomOf({ pageHeight: 600, sheetHeight: 580 }), SHEET_PREVIEW_MIN);
  assert.equal(previewRoomOf({ pageHeight: Number.NaN, sheetHeight: 10 }), 0);
});

test('tastatura intră în aceeași măsurătoare, deci previzualizarea se strânge și revine', () => {
  /**
   * Foaia raportează `înălțimea ei + banda tastaturii` (`keyboard.covered`), pentru că tastatura stă sub
   * ea, în `marginBottom`, nu în `onLayout`. Deci socoteala e aceeași în amândouă cazurile — pagina nu are
   * un al doilea drum pentru tastatură.
   */
  const keyboard = 300;
  const openSheet = 531;
  assert.equal(previewRoomOf({ pageHeight: PHONE.height, sheetHeight: openSheet }), 490);
  assert.equal(previewRoomOf({ pageHeight: PHONE.height, sheetHeight: openSheet + keyboard }), 190);
  // Se închide tastatura: exact valoarea de dinainte, nu una „aproximativă".
  assert.equal(previewRoomOf({ pageHeight: PHONE.height, sheetHeight: openSheet }), 490);
});

test('depozitul spune o singură dată ce s-a schimbat și se curăță numai pentru foaia lui', () => {
  resetSheetPreview();
  let notifications = 0;
  const stop = subscribeSheetPreview(() => { notifications += 1; });
  reportSheetPreview(7, 531);
  assert.equal(notifications, 1);
  reportSheetPreview(7, 531);
  assert.equal(notifications, 1, 'aceeași măsurătoare nu mai anunță nimic: altfel randarea intră în buclă');
  reportSheetPreview(7, 610);
  assert.equal(notifications, 2);
  assert.equal(sheetPreviewPostId(), 7);
  assert.equal(sheetPreviewHeight(), 610);
  clearSheetPreview(9);
  assert.equal(sheetPreviewPostId(), 7, 'o altă postare nu are voie să șteargă măsurătoarea foii deschise');
  clearSheetPreview(7);
  assert.equal(sheetPreviewPostId(), 0);
  assert.equal(sheetPreviewHeight(), 0);
  assert.equal(notifications, 3);
  clearSheetPreview();
  assert.equal(notifications, 3, 'o închidere repetată nu mai anunță nimic');
  reportSheetPreview(0, 500);
  assert.equal(sheetPreviewPostId(), 0, 'fără postare nu există foaie');
  // `NaN` dintr-o măsurătoare stricată nu otrăvește starea.
  reportSheetPreview(4, Number.NaN);
  assert.equal(sheetPreviewHeight(), 0);
  stop();
  resetSheetPreview();
});

test('foaia de comentarii NU a fost redesenată: aceeași deschidere, același Modal, același cap', () => {
  const sheet = strip(read('src/components/CommentsSheet.tsx'));
  // Înălțimea de deschidere și plafonul ei sunt exact cele de dinainte de rundă.
  assert.match(sheet, /maxHeight: '82%', minHeight: '52%', backgroundColor: C\.surface/,
    'foaia pornește tot de la jumătatea ecranului și urcă tot la 82 %');
  assert.match(sheet, /<Modal visible animationType="slide" transparent onRequestClose=\{onClose\} statusBarTranslucent>/,
    'tot un Modal transparent care alunecă de jos, nu un panou împărțit');
  /**
   * Runda 49: mânerul primește o zonă proprie de tragere (28 dp, cu aceeași linie de 4 dp în ea) — foaia se
   * închide trăgând-o în jos —, dar sunt **aceleași** două bucăți, cu același stil, nu un mâner nou.
   */
  assert.match(sheet, /<View \{\.\.\.sheetGesture\.panHandlers\} style=\{styles\.grabberZone\}[\s\S]{0,200}<View style=\{styles\.grabber\} \/>/,
    'același mâner, acum cu zonă de tragere');
  assert.match(sheet, /styles\.head/, 'același antet cu titlul și ✕');
  assert.match(sheet, /composerInput/, 'același compozitor de comentariu');
  // Nu s-a strecurat o a doua arhitectură.
  assert.doesNotMatch(sheet, /splitPanel|split-panel|SplitView|splitView/, 'fără panouri împărțite');
  // Și totuși își raportează măsurătoarea, ca postarea să se poată potrivi deasupra.
  assert.match(sheet, /onLayout=\{\(event\) => setSheetHeight\(Math\.round\(event\.nativeEvent\.layout\.height\)\)\}/,
    'foaia se măsoară pe ea însăși');
  assert.match(sheet, /reportSheetPreview\(post\.id, sheetHeight \+ keyboard\.covered\)/,
    'măsurătoarea include banda tastaturii, când este deschisă');
  assert.match(sheet, /clearSheetPreview\(post\.id\)/, 'închiderea dă pagina înapoi');
});

test('postarea se potrivește în locul rămas pe toate suprafețele care deschid foaia', () => {
  for (const file of ['src/components/PostCard.tsx', 'src/components/ReelsReader.tsx']) {
    const surface = strip(read(file));
    assert.match(surface, /useSheetPreview\(post\.id\)/, `${file} citește măsurătoarea foii`);
    assert.match(surface, /previewRoomOf\(\{ pageHeight: height, sheetHeight \}\)/, `${file} folosește socoteala comună`);
    /**
     * Runda 48: compoziția primește un **fel de prezentare**, nu o potrivire de imagine. `contain` a fost
     * refuzat de owner (arăta părți din fotografie pe care Feed/Profil le ascund); ce se verifică acum e
     * felul de prezentare, iar decuparea este apărată de `test-comments-preview.cjs`.
     */
    assert.match(surface, /presentation=\{previewing \? 'commentsPreview' : 'page'\}/,
      `${file} spune compoziției că este previzualizare`);
    assert.doesNotMatch(surface, /sheetPreview=/, `${file} nu mai trimite vechea promisiune de potrivire`);
  }
});

/**
 * Runda 50 — un deget care frunzărește repede.
 *
 * Runda 49 știa să întoarcă fila articolului din previzualizare, dar socoteala se făcea în randare: `seq`-ul
 * cel mai nou înlocuia orice cerere căzută între două randări, deci două gesturi într-un singur commit React
 * = o singură filă. Aici se apără socoteala nouă, pe numere, fără telefon.
 */
test('două gesturi într-un commit întorc două file, nu una', () => {
  assert.equal(previewPageTurns(0, null), 0, 'nicio cerere nu întoarce nimic');
  assert.equal(previewPageTurns(0, { seq: 0, postId: 7, offset: 1 }), 0, 'secvența zero este „încă nimic"');
  assert.equal(previewPageTurns(3, { seq: 3, postId: 7, offset: 1 }), 0, 'o cerere deja consumată nu se mai plătește');
  assert.equal(previewPageTurns(3, { seq: 4, postId: 7, offset: 1 }), 1, 'un singur gest, o filă înainte');
  assert.equal(previewPageTurns(3, { seq: 5, postId: 7, offset: 1 }), 2, 'două gesturi pierdute între randări = două file');
  assert.equal(previewPageTurns(3, { seq: 6, postId: 7, offset: -1 }), -3, 'direcția este a cererii celei mai noi');
  assert.equal(previewPageTurns(5, { seq: 4, postId: 7, offset: 1 }), 0, 'o secvență veche nu întoarce nimic');
});

test('fila nu iese din articol: prima și ultima pagină sunt capete', () => {
  assert.equal(previewPageAfter(0, 1, 9), 1);
  assert.equal(previewPageAfter(0, -1, 9), 0, 'înainte de prima filă nu există pagină');
  assert.equal(previewPageAfter(8, 1, 9), 8, 'după ultima filă nu există pagină');
  assert.equal(previewPageAfter(0, 12, 9), 8, 'un salt mare se oprește la ultima filă');
  assert.equal(previewPageAfter(4, 2, 9), 6);
  assert.equal(previewPageAfter(4, -2, 9), 2);
  assert.equal(previewPageAfter(0, 1, 1), 0, 'un articol de o filă nu se frunzărește');
  assert.equal(previewPageAfter(0, 1, 0), 0);
});

test('cererea chiar ajunge la pagină, iar pagina o consumă fără să o piardă pe drum', () => {
  resetSheetPreview();
  reportSheetPreview(11, 540);
  requestSheetPreviewPage(11, 1);
  requestSheetPreviewPage(11, 1);
  const request = sheetPreviewPageRequest();
  assert.equal(request.seq, 2, 'două gesturi, două secvențe');
  assert.equal(request.postId, 11);
  assert.equal(previewPageTurns(0, request), 2, 'pagina care nu a consumat nimic întoarce două file');
  assert.equal(previewPageTurns(request.seq, request), 0, 'și nu o mai întoarce a doua oară');
  /** O foaie închisă nu mai are voie să întoarcă fila unei postări care nu mai este deschisă. */
  clearSheetPreview();
  requestSheetPreviewPage(11, 1);
  assert.equal(sheetPreviewPageRequest().seq, 2, 'fără foaie deschisă, cererea nu se înregistrează');

  /**
   * Și mecanismul este cel din pagină: cererea se citește într-un efect, cu numărul de file din `seq`.
   * Un `setSpentSeq` în randare (runda 49) este exact ce pierdea un gest.
   */
  const page = strip(read('src/components/EditorialPage.tsx'));
  assert.match(page, /const turns = previewPageTurns\(spentSeqRef\.current, pageRequest\);/, 'pagina numără filele cererii');
  assert.match(page, /const next = previewPageAfter\(page, turns, total\);/, 'și aterizează în intervalul articolului');
  assert.doesNotMatch(page, /setSpentSeq/, 'cererea nu se mai consumă în timpul randării');
});
