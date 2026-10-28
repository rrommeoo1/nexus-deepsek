/* global __dirname */
// Emoji-ul apăsat în compozitor ajungea la sfârșitul paragrafului, nu la cursor (owner, 28 octombrie 2026).
//
// Panoul de emoji este o tastatură, iar o tastatură scrie *la cursor*. Câmpul raporta însă selecția degeaba:
// `onSelectionChange` o consuma ca să elibereze pinul atingerii și nu păstra nimic, așa că singura poziție
// cunoscută era sfârșitul șirului, iar un emoji apăsat la mijlocul frazei apărea după ultimul cuvânt. Runda
// 33 mută socoteala într-un modul pur (`src/lib/textInsert.ts`) și o ține aici: început, mijloc, sfârșit,
// înlocuirea unui interval, rândurile noi păstrate, emoji consecutive, emoji compuse din mai multe code
// points, și un cursor care ar cădea în mijlocul unei perechi surrogate (unde un `slice` ar rupe caracterul).
//
// A doua parte a fișierului leagă modulul de compozitor: efectul de inserare folosește `insertAtSelection`,
// iar textul editabil este exact cel care ajunge în pagină la „Gata" (`setBlockText` → `documentPlainText`),
// deci ce se vede în câmp este ce se publică.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(ROOT, file), 'utf8');
/** Sursa fără proza ei: o propoziție dintr-un comentariu nu este un control. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

function load(file) {
  const out = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleShim = { exports: {} };
  new Function('module', 'exports', 'require', out)(moduleShim, moduleShim.exports, () => {
    throw new Error(`${file} nu are voie să importe nimic la rulare`);
  });
  return moduleShim.exports;
}

const { insertAtSelection, snapSelection } = load('src/lib/textInsert.ts');
const { documentFromPlainText, documentPlainText, setBlockText } = load('src/lib/editorialDocument.ts');

const WORD = 'Mâine plec la munte.';

test('un emoji scris la început, la mijloc sau la sfârșit rămâne acolo unde e cursorul', () => {
  assert.deepEqual(insertAtSelection(WORD, '🌿', { start: 0, end: 0 }), { text: '🌿Mâine plec la munte.', caret: 2 });
  const middle = insertAtSelection(WORD, '🌿', { start: 6, end: 6 });
  assert.equal(middle.text, 'Mâine 🌿plec la munte.');
  assert.equal(middle.caret, 8);
  const end = insertAtSelection(WORD, '🌿', { start: WORD.length, end: WORD.length });
  assert.equal(end.text, `${WORD}🌿`);
  assert.equal(end.caret, WORD.length + 2);
  // Un cursor fără interval selectat este tot un interval: `start === end` este cursorul, nu o selecție.
  assert.equal(
    insertAtSelection(WORD, '🌿', { start: 6, end: 6 }).text,
    insertAtSelection(WORD, '🌿', snapSelection(WORD, { start: 6, end: 6 })).text,
  );
});

test('un cuvânt selectat este înlocuit de emoji, nu dublat', () => {
  // „plec" stă la 6..10 în `Mâine plec la munte.`; emoji intră exact pe locul lui.
  const replaced = insertAtSelection(WORD, '🌿', { start: 6, end: 10 });
  assert.equal(replaced.text, 'Mâine 🌿 la munte.');
  assert.equal(replaced.caret, 8);
  // „Selectează tot" + emoji = pagina aceea, fără restul.
  assert.deepEqual(insertAtSelection(WORD, '🌿', { start: 0, end: WORD.length }), { text: '🌿', caret: 2 });
});

test('fără interval raportat, emoji-ul se scrie la sfârșitul paragrafului', () => {
  // Singurul caz în care vechea comportare rămâne: câmpul nu a spus niciodată unde e cursorul.
  assert.equal(insertAtSelection(WORD, '🌿', null).text, `${WORD}🌿`);
  assert.equal(insertAtSelection(WORD, '🌿', undefined).text, `${WORD}🌿`);
  assert.equal(insertAtSelection('', '🌿', null).text, '🌿');
  assert.equal(insertAtSelection('', '🌿', null).caret, 2);
});

test('un interval imposibil este tăiat la pagină, nu aruncat, și se citește în ordinea dată', () => {
  // Un interval care vine înainte de un lipit poate depăși textul; unul luat invers are altă ordine.
  assert.deepEqual(snapSelection(WORD, { start: 999, end: 1200 }), { start: WORD.length, end: WORD.length });
  assert.deepEqual(snapSelection(WORD, { start: -40, end: -1 }), { start: 0, end: 0 });
  assert.deepEqual(snapSelection(WORD, { start: 9, end: 5 }), { start: 5, end: 9 });
  assert.deepEqual(snapSelection(WORD, { start: 3.7, end: 5.2 }), { start: 3, end: 5 });
  // Un interval pe care nu-l putem citi deloc nu devine „tot textul selectat": rămâne cursorul de la sfârșit.
  assert.deepEqual(snapSelection(WORD, { start: NaN, end: Infinity }), { start: WORD.length, end: WORD.length });
  assert.deepEqual(snapSelection(WORD, {}), { start: WORD.length, end: WORD.length });
});



test('un cursor din mijlocul unui emoji este scos din pereche, ca să nu rupă caracterul', () => {
  // „🌿" ocupă două unități UTF-16 (0..2). Un cursor la 1 este în interiorul perechii.
  const text = '🌿a';
  assert.deepEqual(snapSelection(text, { start: 1, end: 1 }), { start: 0, end: 0 });
  const typed = insertAtSelection(text, '🔥', { start: 1, end: 1 });
  assert.equal(typed.text, '🔥🌿a');
  // Capătul din dreapta al unei perechi este împins înainte, ca selecția să acopere emoji-ul întreg.
  const pair = 'a🌿b';
  assert.deepEqual(snapSelection(pair, { start: 2, end: 2 }), { start: 1, end: 1 });
  assert.deepEqual(snapSelection(pair, { start: 1, end: 2 }), { start: 1, end: 3 });
  assert.equal(insertAtSelection(pair, '🔥', { start: 1, end: 2 }).text, 'a🔥b');
});

test('rândurile noi rămân rânduri noi, iar emoji-ul nu lipește paragrafele', () => {
  const text = 'primul rând\nal doilea rând';
  // `\n` este la 11: chiar după el (12) emoji-ul intră începutul rândului al doilea…
  assert.equal(insertAtSelection(text, '🌿', { start: 12, end: 12 }).text, 'primul rând\n🌿al doilea rând');
  // …după prima literă (13) intră după ea, iar rândul nou rămâne neatins.
  assert.equal(insertAtSelection(text, '🌿', { start: 13, end: 13 }).text, 'primul rând\na🌿l doilea rând');
  // La sfârșitul rândului, înaintea rândului nou: emoji-ul rămâne pe rândul lui.
  assert.equal(insertAtSelection(text, '🌿', { start: 11, end: 11 }).text, 'primul rând🌿\nal doilea rând');
  // Două rânduri noi dintr-un lipit nu sunt atinse de o inserare la mijloc.
  assert.equal(insertAtSelection('a\n\nb', '🌿', { start: 3, end: 3 }).text, 'a\n\n🌿b');
});

test('două emoji apăsate una după alta stau unul lângă altul, în ordinea apăsării', () => {
  // Cursorul întors de o inserare este cel pe care se sprijină următoarea — de aceea `caret` face parte din răspuns.
  let state = { text: 'Mâine plec la munte.', caret: 6 };
  for (const emoji of ['🌿', '🔥', '🧭']) {
    const typed = insertAtSelection(state.text, emoji, { start: state.caret, end: state.caret });
    state = { text: typed.text, caret: typed.caret };
  }
  assert.equal(state.text, 'Mâine 🌿🔥🧭plec la munte.');
  assert.equal(state.caret, 12);
});

test('un emoji compus din mai multe code points se scrie întreg, iar cursorul rămâne pe graniță', () => {
  // Familia ZWJ ocupă 8 unități UTF-16: nici o bucată din ea nu are voie să rămână în urmă.
  const family = '👨‍👩‍👧';
  assert.equal(family.length, 8);
  const typed = insertAtSelection('mama și ', family, { start: 8, end: 8 });
  assert.equal(typed.text, `mama și ${family}`);
  assert.equal(typed.caret, 16);
  assert.deepEqual(snapSelection(typed.text, { start: typed.caret, end: typed.caret }), { start: 16, end: 16 });
  // Steagul (doi indicatori regionali), un emoji cu modificator de ton și o inimă cu selector: tot întregi.
  for (const composed of ['🇷🇴', '👋🏽', '❤️']) {
    const out = insertAtSelection('a', composed, { start: 1, end: 1 }).text;
    assert.equal(out, `a${composed}`);
    assert.deepEqual(snapSelection(out, { start: 1, end: 1 }), { start: 1, end: 1 });
  }
});

test('compozitorul scrie emoji-ul cu regula din `textInsert`, nu cu un append la sfârșit', () => {
  const page = code(read('src/components/EditorialPage.tsx'));
  assert.match(page, /import \{ insertAtSelection, snapSelection, type TextSelection \} from '\.\.\/lib\/textInsert';/,
    'pagina folosește regula pusă sub test, nu una scrisă în loc');
  /**
   * Intervalul raportat de telefon are întâietate; locul atingerii rămâne pentru prima clipă, iar
   * sfârșitul paragrafului doar când nu s-a spus niciodată nimic.
   */
  assert.match(page, /const range = current\.selection \?\? current\.caret \?\? current\.text\.length;/,
    'ordinea surselor de cursor este explicită');
  assert.match(page, /insertAtSelection\(current\.text, addition, typeof range === 'number' \? \{ start: range, end: range \} : range\)/,
    'emoji-ul este scris la intervalul găsit');
  // Cursorul rămâne după emoji, altfel al doilea emoji ar sări iar la sfârșitul paragrafului.
  assert.match(page, /caret: typed\.caret, selection: \{ start: typed\.caret, end: typed\.caret \}/,
    'cursorul rămâne după emoji-ul scris');
  // Lipirea la coadă, vechea comportare, nu mai are voie să existe în calea de inserare.
  assert.doesNotMatch(page, /text: `\$\{current\.text\}\$\{addition\}`/,
    'emoji-ul nu se mai adaugă orbește la sfârșitul paragrafului');
});

test('atingerea pe pagină este și primul interval, deci un emoji apăsat imediat nu fuge la coadă', () => {
  const page = code(read('src/components/EditorialPage.tsx'));
  assert.match(page, /selection: at === null \? null : \{ start: at, end: at \},/,
    'locul atingerii se ține minte ca interval');
  // Câmpul deschis fără atingere (butonul „Tastatură") începe fără interval: emoji-ul merge la sfârșit.
  assert.match(page, /text: words \? words\.text : '', caret: null, selection: null \}/,
    'câmpul deschis din buton nu pretinde un cursor pe care nu-l are');
});

test('textul scris în câmp — cu emoji cu tot — este textul care ajunge în pagină', () => {
  // Același drum ca în compozitor: paragraful intră în câmp, emoji-ul se scrie la cursor, „Gata" scrie
  // paragraful înapoi (`setBlockText`), iar pagina arată exact ce s-a văzut în câmp.
  const document = documentFromPlainText('Mâine plec la munte.');
  const paragraph = document.blocks.find((block) => block.type === 'paragraph');
  assert.ok(paragraph, 'paragraful există în pagină');
  const field = { text: paragraph.text, caret: null, selection: { start: 6, end: 6 } };
  const typed = insertAtSelection(field.text, '🌿', field.selection);
  const next = setBlockText(document, paragraph.id, typed.text);
  assert.equal(documentPlainText(next), 'Mâine 🌿plec la munte.');
  // Și un emoji scris după „Gata", când câmpul nu mai are interval, se lipește la sfârșitul rândului deja scris.
  const reopened = { text: documentPlainText(next), caret: null, selection: null };
  const range = reopened.selection ?? reopened.caret ?? reopened.text.length;
  assert.equal(insertAtSelection(reopened.text, '🔥', { start: range, end: range }).text, 'Mâine 🌿plec la munte.🔥');
});

