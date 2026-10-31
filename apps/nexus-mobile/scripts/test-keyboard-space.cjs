/* global __dirname */
/**
 * Tastatura (runda 46): cât loc trebuie să cedeze o suprafață când se deschide tastatura.
 *
 * Ownerul a cerut ca postarea să se rearanjeze în spațiul rămas, nu să fie acoperită: zona media să încapă
 * întreagă (proporție păstrată), textul să se re-pagineze, iar câmpul și butonul de trimitere să rămână
 * vizibile. Toate suprafețele împart aceeași socoteală (`lib/keyboardSpace.ts`), fiindcă pe telefonul de
 * dezvoltare fereastra **nu** se micșorează pentru tastatură, iar pe alt telefon se micșorează — o singură
 * formulă trebuie să fie corectă în amândouă cazurile.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8');
const code = ts.transpileModule(read('src/lib/keyboardSpace.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const shim = { exports: {} };
new Function('module', 'exports', 'require', code)(shim, shim.exports, (id) => {
  throw new Error(`keyboardSpace.ts nu are voie să importe ${id} la rulare`);
});
const { KEYBOARD_MIN_CONTENT, bottomInsetWithKeyboard, contentBudget, keyboardSpaceOf } = shim.exports;

/** Telefonul de dezvoltare: 1220×2656 px la 2.6, adică ~469×1021 dp; tastatura ~320 dp. */
const PHONE = { height: 1021, keyboard: 320 };

test('tastatura închisă nu schimbă nimic din ecran', () => {
  const closed = keyboardSpaceOf({ baseHeight: PHONE.height, windowHeight: PHONE.height, keyboardHeight: 0 });
  assert.deepEqual(closed, { covered: 0, available: PHONE.height });
});

test('pe un telefon care NU micșorează fereastra (Android 15 edge-to-edge) se cedează tastatura', () => {
  const open = keyboardSpaceOf({ baseHeight: PHONE.height, windowHeight: PHONE.height, keyboardHeight: PHONE.keyboard });
  assert.equal(open.covered, PHONE.keyboard, 'toată tastatura este acoperire, fiindcă fereastra nu a cedat nimic');
  assert.equal(open.available, PHONE.height - PHONE.keyboard);
});

test('pe un telefon care ÎȘI micșorează fereastra nu se numără de două ori', () => {
  const resized = keyboardSpaceOf({
    baseHeight: PHONE.height,
    windowHeight: PHONE.height - PHONE.keyboard,
    keyboardHeight: PHONE.keyboard,
  });
  assert.equal(resized.covered, 0, 'platforma a luat deja locul: încă o scădere ar goli ecranul');
  assert.equal(resized.available, PHONE.height - PHONE.keyboard, 'același spațiu real, aceeași socoteală');
});

test('o valoare absurdă nu poate produce o zonă negativă sau sub minim', () => {
  const huge = keyboardSpaceOf({ baseHeight: PHONE.height, windowHeight: PHONE.height, keyboardHeight: 4000 });
  assert.ok(huge.covered >= 0);
  assert.equal(huge.available, KEYBOARD_MIN_CONTENT, 'rămâne cel puțin un rând de conținut');
  assert.equal(keyboardSpaceOf({ baseHeight: 0, windowHeight: 0, keyboardHeight: 0 }).available, KEYBOARD_MIN_CONTENT);
  assert.equal(keyboardSpaceOf({ baseHeight: -10, windowHeight: -10, keyboardHeight: -10 }).covered, 0);
});

test('insetul de jos se plătește o singură dată', () => {
  assert.equal(bottomInsetWithKeyboard(34, 0), 34, 'fără tastatură, bara de gesturi are locul ei');
  assert.equal(bottomInsetWithKeyboard(34, 320), 0, 'cu tastatura, bara stă sub ea, nu lângă ea');
  assert.equal(bottomInsetWithKeyboard(-5, 0), 0);
});

test('un cadru cu antet și cu unelte scade exact ce s-a măsurat', () => {
  assert.equal(contentBudget({ available: 700, chromeAbove: 96, chromeBelow: 140 }), 464);
  assert.equal(contentBudget({ available: 300, chromeAbove: 200, chromeBelow: 140 }), KEYBOARD_MIN_CONTENT,
    'sub minim rămâne minimul: conținutul se derulează, nu dispare');
});

test('suprafețele folosesc aceeași socoteală, nu una proprie', () => {
  for (const file of ['src/components/CommentsSheet.tsx', 'src/app/text.tsx', 'src/components/CaptureEditor.tsx']) {
    assert.match(read(file), /useKeyboardSpace\(\)/, `${file} își ia tastatura din câștigul comun`);
  }
  const sheet = read('src/components/CommentsSheet.tsx');
  assert.doesNotMatch(sheet, /Keyboard\.addListener/, 'comentariile nu mai au un al doilea ascultător');
  assert.match(sheet, /marginBottom: keyboard\.covered/);
  assert.match(sheet, /bottomInsetWithKeyboard\(insets\.bottom, keyboard\.covered\)/,
    'insetul de jos nu se adaugă peste tastatură');
  /** Compozitorul paginii: pagina se compune pe locul măsurat, nu pe fereastra întreagă. */
  const composer = read('src/app/text.tsx');
  assert.match(composer, /const pageHeight = viewport > 0/);
  assert.match(composer, /paddingBottom: keyboard\.covered/);
  /** Editorul: previzualizarea are un cadru de `stageHeight`, iar panourile stau lipite de tastatură. */
  const editor = read('src/components/CaptureEditor.tsx');
  assert.match(editor, /const stageHeight = keyboard\.covered > 0/);
  assert.match(editor, /bottom: panelBottom/);
});
