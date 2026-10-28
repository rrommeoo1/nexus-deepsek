/* global __dirname */
// Lipitul în compozitorul de TEXT (owner, 29 octombrie 2026: „apăs lung pe text, dar Paste nu apare").
//
// Pagina de cuvinte este desenată de motorul de flux (`editorialFlow`) ca rânduri așezate absolut: sub deget
// nu există niciun `TextInput`. Runda trecută a ținut textul într-un câmp de 1×1px, ascuns, cu care vorbea
// doar tastatura, și deschidea o foaie doar la o ținere de 420ms pe un rând anume — deci pe telefon degetul
// lovea aproape mereu hârtie moartă, iar când foaia se deschidea, meniul Android nu avea ce selecta în câmpul
// nevăzut. Reparația nu adaugă un buton „Paste": scoate câmpul ascuns cu totul și face din hârtie ușa unui
// câmp **real, vizibil, editabil** — paragraful de sub deget —, unde selecția și clipboardul sunt ale
// sistemului, iar „Gata" scrie paragraful înapoi în pagină (`setBlockText`).
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

const doc = load('src/lib/editorialDocument.ts');
const {
  documentFromPlainText, documentPlainText, mediaBlock, pageBreakBlock, paragraphBlock, headingBlock,
  normalizeEditorialDocument, readEditorialDocument, setBlockText,
} = doc;

/** A page as the composer arranges it: a photograph between two paragraphs, and a page break. */
function article() {
  const document = documentFromPlainText('Primul paragraf.\n\nAl doilea paragraf.');
  return {
    version: 1,
    typography: 'auto',
    blocks: [
      document.blocks[0],
      mediaBlock(0, { placement: 'left', widthFraction: 0.55, wrapText: true }),
      document.blocks[1],
      pageBreakBlock(),
    ],
  };
}

test('un paragraf lipit în câmp se scrie în locul lui, iar poza rămâne unde a fost așezată', () => {
  const before = article();
  const target = before.blocks[2];
  const after = setBlockText(before, target.id, 'Un text lung, venit din clipboard.');
  assert.equal(after.blocks.length, before.blocks.length, 'numărul de blocuri rămâne același');
  assert.equal(after.blocks[0], before.blocks[0], 'primul paragraf nu este atins');
  assert.equal(after.blocks[1], before.blocks[1], 'fotografia nu se mișcă din locul ei');
  assert.equal(after.blocks[2].id, target.id, 'blocul își păstrează identitatea (care ține și poziția în pagină)');
  assert.equal(after.blocks[2].text, 'Un text lung, venit din clipboard.');
  assert.equal(after.blocks[3], before.blocks[3], 'saltul de pagină rămâne la coadă');
  // Ce iese este un document pe care serverul îl acceptă, nu doar unul care arată bine pe ecran.
  assert.doesNotThrow(() => normalizeEditorialDocument(after));
});

test('un text lipit cu rânduri goale devine atâtea paragrafe, iar titlul rămâne titlu', () => {
  const before = {
    version: 1,
    typography: 'auto',
    blocks: [headingBlock('Titlul paginii'), paragraphBlock('Textul de sub titlu.'), mediaBlock(0)],
  };
  const pasted = 'Primul paragraf al articolului.\n\nAl doilea paragraf, tot din browser.\n\nAl treilea.';
  const after = setBlockText(before, before.blocks[0].id, pasted);
  assert.equal(after.blocks.length, 3 + 2, 'titlul devine primul paragraf, restul se adaugă după el');
  assert.equal(after.blocks[0].type, 'heading', 'blocul atins era titlu și rămâne titlu');
  assert.equal(after.blocks[0].text, 'Primul paragraf al articolului.');
  assert.equal(after.blocks[1].type, 'paragraph');
  assert.equal(after.blocks[1].text, 'Al doilea paragraf, tot din browser.');
  assert.equal(after.blocks[2].text, 'Al treilea.');
  assert.equal(after.blocks[3].text, 'Textul de sub titlu.', 'paragraful următor rămâne neatins');
  assert.equal(after.blocks[4].type, 'media', 'fotografia rămâne la coada paginii, unde era');
  assert.doesNotThrow(() => normalizeEditorialDocument(after));
});

test('un rând nou în interiorul paragrafului rămâne rând nou, iar rândul gol desparte paragrafe', () => {
  /**
   * Until the text-integrity round a `\n` inside a paragraph became a space, so a poem, a list or an address
   * pasted from a browser reached the page as prose the author had not written. A blank line still separates
   * two paragraphs; a single line break inside one is kept verbatim, and the flow starts a new line on it.
   */
  const before = article();
  const after = setBlockText(before, before.blocks[0].id, 'primul rând\ncontinuă pe al doilea');
  assert.equal(after.blocks[0].text, 'primul rând\ncontinuă pe al doilea', 'rândul nou nu devine spațiu');
  assert.equal(after.blocks.length, before.blocks.length, 'și nu rupe paragraful în două');

  const two = setBlockText(before, before.blocks[0].id, 'primul rând\n\ncontinuă pe al doilea');
  assert.equal(two.blocks.length, before.blocks.length + 1, 'un rând gol desparte două paragrafe');
  assert.equal(two.blocks[1].text, 'continuă pe al doilea');
  // Și drumul de întoarcere dă exact ce a lipit autorul.
  assert.equal(documentPlainText(after).split('\n\n')[0], 'primul rând\ncontinuă pe al doilea');
});

test('un paragraf golit dispare, pentru că un document cu paragraf gol este refuzat', () => {
  const before = article();
  const after = setBlockText(before, before.blocks[0].id, '   \n\n  ');
  assert.equal(after.blocks.length, before.blocks.length - 1, 'blocul golit a fost scos');
  assert.equal(after.blocks[0].type, 'media', 'iar fotografia urcă pe primul loc, neatinsă');
  assert.doesNotThrow(() => normalizeEditorialDocument(after), 'documentul rămas este valid');
});

test('câmpul deschis pe o pagină goală scrie primele paragrafe ale articolului', () => {
  const empty = documentFromPlainText('');
  assert.equal(empty.blocks.length, 0);
  const after = setBlockText(empty, null, 'Un fragment copiat din browser.\n\nȘi încă unul.');
  assert.equal(after.blocks.length, 2, 'textul lipit devine primele două paragrafe');
  assert.equal(after.blocks[0].type, 'paragraph');
  assert.equal(documentPlainText(after), 'Un fragment copiat din browser.\n\nȘi încă unul.');
  assert.doesNotThrow(() => normalizeEditorialDocument(after));
  // Fără text, pagina goală rămâne goală: nu se inventează un paragraf pe care serverul l-ar refuza.
  assert.equal(setBlockText(empty, null, '   '), empty);
});

test('un bloc care nu există sau nu ține cuvinte nu este atins', () => {
  const before = article();
  assert.equal(setBlockText(before, 'inexistent', 'altceva').blocks.length, before.blocks.length);
  const media = before.blocks[1];
  assert.equal(setBlockText(before, media.id, 'altceva').blocks[1].type, 'media',
    'o fotografie nu devine paragraf pentru că a fost ținută apăsată');
  // Idempotent: același text scris de două ori nu produce un document nou (nici un re-flux degeaba).
  const once = setBlockText(before, before.blocks[0].id, 'același text');
  assert.equal(setBlockText(once, before.blocks[0].id, 'același text'), once);
});

test('documentul scris în câmp se citește înapoi, cu tot cu paragrafele lipite', () => {
  const before = article();
  const pasted = 'Primul paragraf al unui articol.\n\nAl doilea, mai lung, cu diacritice: șțăâî și „ghilimele”.';
  const after = setBlockText(before, before.blocks[2].id, pasted);
  const readBack = readEditorialDocument(JSON.parse(JSON.stringify(normalizeEditorialDocument(after))));
  assert.ok(readBack);
  assert.equal(documentPlainText(readBack), documentPlainText(after));
});

test('compozitorul are un câmp nativ, editabil, deschis de o atingere pe pagina de cuvinte', () => {
  const page = code(read('src/components/EditorialPage.tsx'));
  /**
   * Câmpul este un `TextInput` adevărat, multiline, focalizat când se deschide, cu meniul de context al
   * sistemului lăsat deschis (nimeni nu-l ascunde cu `contextMenuHidden`), așezat peste hârtia paginii.
   */
  assert.match(page, /\{editable && field \? \(/, 'câmpul există doar în compozitor');
  assert.match(page, /value=\{field\.text\}/, 'ce scrie autorul este în câmp');
  assert.match(page, /onChangeText=\{\(text\) => setField\(/, 'câmpul este controlat de editare');
  assert.match(page, /multiline\s+autoFocus/, 'câmpul se deschide cu tastatura, pe mai multe rânduri');
  assert.doesNotMatch(page, /contextMenuHidden/, 'meniul Android (Paste, Copiază) rămâne al sistemului');
  assert.match(page, /accessibilityLabel="Paragraful paginii"/, 'câmpul se anunță ca o pagină de scris');
  assert.match(page, /selectionColor=\{TEXT_SELECTION_COLOR\}/,
    'selecția se vede pe hârtie, în albastrul cititorului');
  /**
   * Not the theme's accent. The selection used to be painted `palette.mark` — the jungle green — and the
   * handles of a selection on a green mark were invisible on half the themes, which is what made „nu pot
   * selecta" true for the owner even after the field became visible.
   */
  assert.doesNotMatch(page, /selectionColor=\{palette\./, 'selecția nu mai ia culoarea temei');
  assert.match(page, /fieldInput: \{ flex: 1, padding: 0, margin: 0 \}/, 'câmpul umple foaia, ca pagina');
  /**
   * Cursorul cerut de deget este pus o singură dată: `selection` este legat de `field.caret`, iar primul
   * `onSelectionChange` îl eliberează. Un `selection` controlat permanent ar trage cursorul înapoi la fiecare
   * re-randare, adică exact opusul a ce vrea un om care selectează un cuvânt.
   */
  assert.match(page, /selection=\{field\.caret === null \? undefined : \{ start: field\.caret, end: field\.caret \}\}/,
    'atingerea așază cursorul unde a fost degetul');
  /**
   * …dar evenimentul nu mai este aruncat: intervalul raportat de telefon este păstrat în `field.selection`
   * (`lib/textInsert.ts`), pentru că panoul de emoji scrie *la cursor*. Până în runda 33 el se consuma doar
   * ca să elibereze pinul, deci un emoji apăsat la mijlocul frazei ajungea la sfârșitul paragrafului.
   * Pinul se eliberează în continuare, în aceeași actualizare.
   */
  assert.match(page, /onSelectionChange=\{\(event\) => \{/,
    'mișcarea cursorului este citită, nu doar consumată');
  assert.match(page, /const reported = snapSelection\(field\.text, event\.nativeEvent\.selection\);/,
    'intervalul raportat este trecut prin `snapSelection` înainte să fie folosit');
  assert.match(page, /setField\(\(current\) => \(current \? \{ \.\.\.current, caret: null, selection: reported \} : current\)\)/,
    'prima mișcare a cursorului eliberează pinul și ține minte intervalul');
  // Un buton care ar lipi singur ar fi o minciună: câmpul nu citește clipboardul în locul sistemului.
  assert.doesNotMatch(page, /Clipboard/, 'nimeni nu citește clipboardul în locul sistemului');

  /**
   * Câmpul ascuns de 1×1px a fost scos cu totul. El era singurul drum de scriere al paginii, deci un telefon
   * nu putea selecta nimic: nu avea ce. Un test care ar accepta un `TextInput` invizibil ar accepta din nou
   * defectul pe care ownerul l-a raportat de două ori.
   */
  assert.doesNotMatch(page, /hiddenInput/, 'nu mai există câmpul de 1×1px');
  assert.doesNotMatch(page, /caretHidden/, 'nu mai există un cursor ascuns într-un câmp nevăzut');
  assert.doesNotMatch(page, /accessibilityLabel="Textul postării"/, 'textul întregii pagini nu mai stă într-un câmp invizibil');

  /**
   * Drumul spre câmp este hârtia însăși: un `Pressable` acoperă pagina sub rânduri și sub fotografii, deci
   * o atingere în margine, între paragrafe sau pe o pagină goală deschide câmpul. Înainte, doar un rând atins
   * exact răspundea, iar restul paginii părea moartă.
   */
  assert.match(page, /accessibilityLabel=\{hasText \? 'Scrie în pagină' : 'Începe textul paginii'\}/,
    'toată hârtia este ușa spre câmp');
  assert.match(page, /onPress=\{\(event\) => \{\s*const point = paragraphAt\(event\.nativeEvent\.locationX, event\.nativeEvent\.locationY\);/,
    'atingerea alege paragraful de sub deget');
  assert.match(page, /const paragraphAt = useCallback\(\(pointX: number, pointY: number\) => \{/,
    'alegerea paragrafului este o singură regulă, în pagină');

  /** Un rând știe din ce paragraf vine și unde anume în el: atingerea și ținerea deschid același câmp. */
  assert.match(page, /const FIELD_HOLD_MS = 420;/, 'pragul de ținere este un număr, nu o coincidență');
  assert.match(page, /onPress=\{\(event\) => openField\(line\.blockId, caretAt\(event\.nativeEvent\.locationX\)\)\}/,
    'atingerea pe un cuvânt deschide paragraful lui, cu cursorul acolo');
  assert.match(page, /onLongPress=\{\(event\) => openField\(line\.blockId, caretAt\(event\.nativeEvent\.locationX\)\)\}/,
    'ținerea pe un cuvânt deschide același câmp');
  assert.equal((page.match(/delayLongPress=\{FIELD_HOLD_MS\}/g) ?? []).length, 2, 'amândouă suprafețele au același prag');

  /** Tastatura are un singur stăpân: câmpul. Nu există al doilea `TextInput` care să-l contrazică. */
  assert.equal((page.match(/<TextInput\s/g) ?? []).length, 1, 'pagina are exact un câmp nativ');
  assert.match(page, /hardwareBackPress', \(\) => \{ closeField\(\); return true; \}/,
    'butonul Înapoi închide câmpul, nu compozitorul');
});

test('câmpul scrie textul în document printr-o singură regulă, la închidere', () => {
  const page = code(read('src/components/EditorialPage.tsx'));
  assert.match(page, /const next = setBlockText\(document, open\.blockId, open\.text\);/, 'un singur drum spre document');
  assert.match(page, /if \(next !== document\) onChangeDocument\(next, false\);/, 'doar dacă s-a schimbat ceva');
  // Și regula aceea este cea testată mai sus: paragrafele se taie după rândul gol.
  const document = code(read('src/lib/editorialDocument.ts'));
  assert.match(document, /function paragraphsOf\(value: string\): string\[\]/, 'regula paragrafelor este una singură');
  assert.match(document, /const paragraphs = paragraphsOf\(value\);[\s\S]{0,1200}export function setBlockText/,
    'aceeași regulă taie textul paginii întregi și textul lipit în câmp');
});

test('cursorul supraviețuiește închiderii câmpului, ca emoji-ul să ajungă unde a fost degetul', () => {
  /**
   * Raportul de pe telefon (runda 34): scrie „Ana are mere.”, așază cursorul înainte de „mere”, apasă
   * „Gata”, apasă „Emoji” — și emoji-ul apare la sfârșitul frazei. Cauza nu era aritmetica inserării
   * (`lib/textInsert.ts`, testată separat), ci faptul că `Gata` arunca foaia *și* intervalul: ramura din
   * efectul de inserare care rulează fără foaie deschisă nu avea ce cursor să folosească, deci cădea pe
   * `text.length`. Iar foaia trebuie închisă, fiindcă bara cu „Emoji” stă sub tastatură cât timp e
   * deschisă, iar butonul Înapoi al telefonului închide foaia (`hardwareBackPress` → `closeField`).
   */
  const page = code(read('src/components/EditorialPage.tsx'));
  assert.match(page, /const lastCaretRef = useRef<\{ blockId: string \| null; offset: number \} \| null>\(null\);/,
    'ultimul cursor este ținut într-un ref (fără re-randare)');
  assert.match(page, /if \(open\) \{[\s\S]{0,420}?lastCaretRef\.current = \{ blockId: open\.blockId, offset:/,
    '„Gata” scrie cursorul înainte să arunce foaia');
  assert.match(page, /lastCaretRef\.current = \{ blockId: field\.blockId, offset: reported\.end \};/,
    'fiecare mișcare raportată de telefon îl actualizează');
  assert.match(page, /lastCaretRef\.current = \{ blockId: words \? words\.id : null, offset: at \?\?/,
    'atingerea pe hârtie îl așază unde a fost degetul');
  // Efectul de inserare, fără foaie deschisă: cursorul ținut minte, apoi abia apoi coada paragrafului.
  assert.match(page, /const retained = lastCaretRef\.current;/, 'inserarea citește cursorul ținut minte');
  assert.match(page, /if \(target\) \{[\s\S]{0,420}?insertAtSelection\(target\.text, addition, \{ start: offset, end: offset \}\)/,
    'emoji-ul se așază la acel cursor, nu la sfârșit');
  assert.match(page, /Math\.min\(target\.text\.length, retained!\.offset\)/,
    'un cursor mai mare decât paragraful este tăiat, nu aruncat');
  // Fără niciun cursor (pagină goală, prima atingere) comportamentul rămas este cel documentat: coada.
  assert.match(page, /const last = \[\.\.\.document\.blocks\]\.reverse\(\)\.find\(/, 'coada rămâne plasa de siguranță');
});

