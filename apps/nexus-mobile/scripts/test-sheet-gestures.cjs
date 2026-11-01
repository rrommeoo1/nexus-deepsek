/* global __dirname */
/**
 * Gesturile foii de comentarii (runda 49): tragerea în jos și fila articolului din previzualizare.
 *
 * Ownerul a cerut două lucruri care se țin de aceeași piedică: foaia se închide trăgând-o în jos, iar
 * articolul din previzualizare se frunzărește cu degetul. Piedica este arhitectura: foaia stă într-un
 * `Modal` al cărui strat acoperă exact locul unde se desenează postarea, deci un gest pe previzualizare nu
 * ajunge niciodată la pagerul ei. De aceea foaia ia gestul și îl raportează (`lib/sheetPreview.ts`), iar
 * pagina îl citește în `PostCanvas` și îl dă paginii autorului (`EditorialPage`).
 *
 * Testul ține socoteala (`lib/sheetDismiss.ts`, pură), depozitul de cereri și faptul că lanțul chiar este
 * legat în cod.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8');
const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const loadModule = (relative) => {
  const shim = { exports: {} };
  const compiled = ts.transpileModule(read(relative), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('module', 'exports', 'require', compiled)(shim, shim.exports, (id) => {
    throw new Error(`${relative} nu are voie să importe ${id} la rulare`);
  });
  return shim.exports;
};

const gesture = loadModule('src/lib/sheetDismiss.ts');
const store = loadModule('src/lib/sheetPreview.ts');

test('o tragere în jos a mânerului: foaia urmează degetul și se închide la prag', () => {
  assert.deepEqual(gesture.sheetDragDecision({ dy: 0, vy: 0 }), { offset: 0, dismiss: false });
  assert.deepEqual(gesture.sheetDragDecision({ dy: 40, vy: 0 }), { offset: 40, dismiss: false });
  assert.deepEqual(gesture.sheetDragDecision({ dy: gesture.SHEET_DISMISS_TRAVEL, vy: 0 }),
    { offset: gesture.SHEET_DISMISS_TRAVEL, dismiss: true }, 'pragul închide');
  assert.equal(gesture.sheetDragDecision({ dy: 20, vy: 1.6 }).dismiss, true, 'o aruncare scurtă închide și ea');
  assert.equal(gesture.sheetDragDecision({ dy: 20, vy: -1.6 }).dismiss, false, 'o aruncare în sus nu închide');
  assert.equal(gesture.sheetDragDecision({ dy: -50, vy: 0 }).offset, 0, 'foaia nu urcă peste locul ei');
  assert.deepEqual(gesture.sheetDragDecision({ dy: NaN, vy: 0 }), { offset: 0, dismiss: false },
    'o măsurătoare stricată nu ia decizia degetului');
  assert.equal(gesture.sheetDragDecision({ dy: 120, vy: NaN }).dismiss, true, 'fără viteză rămâne pragul de drum');
});

test('gestul de tragere pornește numai în jos și numai clar vertical', () => {
  assert.equal(gesture.sheetDragShouldStart({ dx: 0, dy: 2 }), false, 'o atingere nu este o tragere');
  assert.equal(gesture.sheetDragShouldStart({ dx: 0, dy: 30 }), true);
  assert.equal(gesture.sheetDragShouldStart({ dx: -30, dy: 10 }), false, 'o filă orizontală rămâne a listei');
  assert.equal(gesture.sheetDragShouldStart({ dx: 10, dy: -40 }), false, 'o derulare în sus rămâne a listei');
  assert.equal(gesture.sheetDragShouldStart({ dx: NaN, dy: NaN }), false);
});

test('stratul de deasupra: filă orizontală întoarce fila, tragere în jos închide, restul nu face nimic', () => {
  assert.deepEqual(gesture.previewBackdropDecision({ dx: -90, dy: 8 }),
    { action: 'page', offset: 1 }, 'stânga cere fila următoare');
  assert.deepEqual(gesture.previewBackdropDecision({ dx: 90, dy: -8 }),
    { action: 'page', offset: -1 }, 'dreapta cere fila dinainte');
  assert.deepEqual(gesture.previewBackdropDecision({ dx: 30, dy: 20 }), { action: 'none' },
    'sub prag nu se întoarce nicio filă');
  assert.deepEqual(gesture.previewBackdropDecision({ dx: 40, dy: 140 }), { action: 'dismiss' },
    'o tragere în jos închide foaia');
  assert.deepEqual(gesture.previewBackdropDecision({ dx: 4, dy: 4 }), { action: 'dismiss' },
    'o atingere închide foaia, ca până acum');
  assert.deepEqual(gesture.previewBackdropDecision({ dx: NaN, dy: 0 }), { action: 'none' });
  assert.deepEqual(gesture.previewBackdropDecision(), { action: 'none' });
});

test('cererea de filă ajunge numai la postarea a cărei foaie este deschisă', () => {
  store.resetSheetPreview();
  assert.equal(store.sheetPreviewPageRequest().seq, 0, 'nimic cerut la început');

  store.requestSheetPreviewPage(7, 1);
  assert.equal(store.sheetPreviewPageRequest().seq, 0, 'fără foaie deschisă nu se cere nimic');

  store.reportSheetPreview(7, 900);
  let notified = 0;
  const off = store.subscribeSheetPreviewPage(() => { notified += 1; });
  store.requestSheetPreviewPage(7, 1);
  const first = store.sheetPreviewPageRequest();
  assert.equal(first.seq, 1);
  assert.equal(first.postId, 7);
  assert.equal(first.offset, 1);
  assert.equal(notified, 1, 'pagina este anunțată o dată');

  store.requestSheetPreviewPage(7, 1);
  assert.equal(store.sheetPreviewPageRequest().seq, 2, 'două cereri la rând sunt două file, nu una');
  store.requestSheetPreviewPage(7, -1);
  assert.equal(store.sheetPreviewPageRequest().offset, -1);
  assert.equal(store.sheetPreviewPageRequest().seq, 3);

  store.requestSheetPreviewPage(9, 1);
  assert.equal(store.sheetPreviewPageRequest().postId, 7, 'foaia altei postări nu întoarce fila acesteia');

  off();
  store.requestSheetPreviewPage(7, 1);
  assert.equal(notified, 3, 'dezabonarea oprește anunțurile');
  store.clearSheetPreview(7);
  store.resetSheetPreview();
  assert.equal(store.sheetPreviewPageRequest().seq, 0);
});

test('lanțul este legat: foaia cere, pagina citește, fila se întoarce', () => {
  const sheet = strip(read('src/components/CommentsSheet.tsx'));
  assert.match(sheet, /requestSheetPreviewPage\(post\.id, decision\.offset\)/, 'foaia raportează fila cerută');
  assert.match(sheet, /onStartShouldSetPanResponder: \(\) => true/, 'ambele gesturi cer degetul de la început');
  assert.match(sheet, /<View\s+\{\.\.\.backdropGesture\.panHandlers\}/, 'stratul de deasupra ia gestul, nu un `Pressable`');
  assert.match(sheet, /accessibilityActions=\{\[\{ name: 'activate' \}\]\}/, 'TalkBack are acțiunea de închidere');
  assert.match(sheet, /<View \{\.\.\.sheetGesture\.panHandlers\} style=\{styles\.grabberZone\}/, 'mânerul se trage');
  assert.match(sheet, /dragY > 0 \? \{ transform: \[\{ translateY: dragY \}\] \} : null/, 'foaia urmează degetul');
  assert.match(sheet, /maxHeight: '82%', minHeight: '52%/, 'înălțimile foii nu s-au schimbat');

  const canvas = strip(read('src/components/PostCanvas.tsx'));
  assert.match(canvas, /useCommentsPreviewPage\(post\.id, commentsPreview\)/,
    'compoziția citește cererea numai în previzualizare');
  assert.match(canvas, /pageRequest=\{previewPage\}/, 'și o dă paginii autorului');

  const article = strip(read('src/components/EditorialArticle.tsx'));
  assert.match(article, /pageRequest\?: SheetPreviewPageRequest \| null;/, 'articolul o primește');
  assert.match(article, /pageRequest=\{pageRequest\}/, 'și o trece paginii');

  const page = strip(read('src/components/EditorialPage.tsx'));
  assert.match(page, /pageRequest\?: SheetPreviewPageRequest \| null;/, 'pagina o primește');
  assert.match(page, /const requestedSeq = pageRequest\?\.seq \?\? 0;/, 'cererea se citește o dată per `seq`');
  assert.match(page, /if \(requestedSeq > spentSeq && requestedSeq > 0\)/, 'și se consumă în randarea care o vede');
  assert.match(page, /scrollToIndex\(\{ index: page, animated: true \}\)/, 'pagerul se mută pe fila cerută');
  assert.match(page, /horizontal\s+pagingEnabled/, 'pagerul paginii rămâne cel al autorului');
});


