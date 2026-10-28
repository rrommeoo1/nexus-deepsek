/* global __dirname */
/**
 * `Vezi traducerea` apare doar când limba postării diferă de limba în care citește telefonul.
 *
 * Runda 30 (owner, 30 octombrie 2026): butonul apărea pe aproape fiecare postare pentru că nimeni nu
 * publica o limbă, iar regula veche citea „nicio limbă" ca „nimic nu dovedește că e limba ta". Acest
 * test ține tabelul cerut, detectorul local (fără rețea), normalizarea codurilor și cache-ul.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const source = readFileSync(resolve(__dirname, '../src/lib/language.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleShim = { exports: {} };
new Function('module', 'exports', 'require', code)(moduleShim, moduleShim.exports, () => {
  throw new Error('language.ts nu are voie să importe nimic la rulare');
});
const {
  languageCodeOf, needsTranslation, postLanguageOf, translationForPost,
  detectLanguage, readLanguage, detectCached, clearLanguageCache, languageCacheSize,
  activeLanguage, setReaderLanguage, subscribeReaderLanguage, deviceLanguage,
} = moduleShim.exports;

test('un cod de limbă se compară pe subtagul principal', () => {
  assert.equal(languageCodeOf('ro-RO'), 'ro');
  assert.equal(languageCodeOf('ro_RO'), 'ro');
  assert.equal(languageCodeOf(' RO '), 'ro');
  assert.equal(languageCodeOf('pl-PL'), 'pl');
  assert.equal(languageCodeOf('en-US'), 'en');
  assert.equal(languageCodeOf('română'), '');
  assert.equal(languageCodeOf(''), '');
  assert.equal(languageCodeOf(null), '');
  assert.equal(languageCodeOf(42), '');
});

test('tabelul cerut de owner: poarta apare doar pentru o limbă străină', () => {
  assert.equal(needsTranslation('ro', 'ro'), false);
  assert.equal(needsTranslation('ro-RO', 'ro'), false);
  assert.equal(needsTranslation('ro', 'ro-RO'), false);
  assert.equal(needsTranslation('en', 'ro'), true, 'română + engleză = da');
  assert.equal(needsTranslation('pl', 'pl'), false);
  assert.equal(needsTranslation('ro', 'pl'), true, 'poloneză + română = da');
  assert.equal(needsTranslation('en', 'en'), false);
  assert.equal(needsTranslation('pl', 'en'), true, 'engleză + poloneză = da');
  // Nicio limbă pe postare: nimic de tradus, deci nicio poartă.
  assert.equal(needsTranslation('', 'ro'), false);
  assert.equal(needsTranslation(null, 'ro'), false);
  assert.equal(needsTranslation('und', 'ro'), false);
  // Un runtime care nu-și cunoaște limba nu poate afirma că pagina e străină.
  assert.equal(needsTranslation('ro', ''), false);
  assert.equal(needsTranslation('en', ''), false);
});

test('limba activă a aplicației se poate schimba, iar cititorii sunt anunțați', () => {
  const seen = [];
  const stop = subscribeReaderLanguage(() => seen.push(activeLanguage()));
  const boot = activeLanguage();
  assert.equal(boot, deviceLanguage(), 'fără o alegere, limba este a telefonului');
  setReaderLanguage('pl-PL');
  assert.equal(activeLanguage(), 'pl');
  assert.deepEqual(seen, ['pl'], 'abonatul este anunțat o dată');
  setReaderLanguage('pl');
  assert.equal(seen.length, 1, 'aceeași limbă nu anunță din nou');
  assert.equal(needsTranslation('ro', activeLanguage()), true);
  assert.equal(needsTranslation('pl', activeLanguage()), false);
  setReaderLanguage(null);
  assert.equal(activeLanguage(), boot);
  assert.equal(seen.length, 2);
  stop();
  setReaderLanguage('en');
  assert.equal(seen.length, 2, 'după dezabonare nu mai vine nimic');
  setReaderLanguage(null);
});


test('detectorul local recunoaște româna, poloneza și engleza', () => {
  assert.equal(detectLanguage('Astăzi mergem la munte cu prietenii și vom sta acolo până mâine.'), 'ro');
  assert.equal(detectLanguage('Dzisiaj idziemy w góry z przyjaciółmi i będziemy tam do jutra.'), 'pl');
  assert.equal(detectLanguage('Today we are going to the mountains with our friends and we will stay there.'), 'en');
  // Diacriticele sunt dovada cea mai tare, chiar într-un text scurt.
  assert.equal(detectLanguage('Mâine nu este școală, dar vom citi.'), 'ro');
});

test('un text scurt, un nume, un link sau doar emoji nu are limbă', () => {
  for (const text of [
    '', '   ', '😀😀😀', '🖤🌿🔥✨',
    'Gata',
    'ano nou',
    'Ana Pop',
    '#munte #iarna #zăpadă',
    'https://example.com/articol/despre-munte',
    '@ana și @ion',
    '1234 5678 90',
    'OK',
  ]) {
    assert.equal(detectLanguage(text), '', `„${text}" nu are destulă dovadă`);
  }
});

test('o pagină amestecată nu primește o poartă pe ghicite', () => {
  const mixed = 'Astăzi mergem la munte cu prietenii and today we go to the mountains with our friends.';
  const reading = readLanguage(mixed);
  assert.ok(reading.tokens >= 3);
  assert.ok(reading.runnerUp > 0, 'ambele limbi au punctat');
  assert.equal(detectLanguage(mixed), '', 'dominanta nu este destul de clară');
});

test('limba declarată de rând are întâietate, iar detecția este memorată', () => {
  clearLanguageCache();
  const ro = { language: 'ro-RO', caption: 'Today we are going to the mountains with our friends.' };
  assert.equal(postLanguageOf(ro), 'ro', 'metadatele bat detectorul');
  const undeclared = { language: 'und', caption: 'Astăzi mergem la munte cu prietenii și vom sta acolo.' };
  assert.equal(postLanguageOf(undeclared), 'ro', '`und` nu este o declarație');
  assert.equal(postLanguageOf({ caption: '😀😀' }), '');
  assert.equal(postLanguageOf(null), '');
  assert.equal(postLanguageOf({}), '');
  assert.ok(languageCacheSize() >= 1);
  const before = languageCacheSize();
  postLanguageOf(undeclared);
  postLanguageOf(undeclared);
  assert.equal(languageCacheSize(), before, 'aceleași cuvinte nu se mai măsoară o dată');
  clearLanguageCache();
  assert.equal(languageCacheSize(), 0);
  assert.equal(detectCached('Astăzi mergem la munte cu prietenii și vom sta acolo.'), 'ro');
});

test('decizia completă a unei postări, pentru fiecare rând din tabel', () => {
  const romanian = { caption: 'Astăzi mergem la munte cu prietenii și vom sta acolo până mâine.' };
  const polish = { caption: 'Dzisiaj idziemy w góry z przyjaciółmi i będziemy tam do jutra.' };
  const english = { caption: 'Today we are going to the mountains with our friends and we will stay there.' };
  const emoji = { caption: '🖤🌿🔥' };
  assert.equal(translationForPost(romanian, 'ro'), false);
  assert.equal(translationForPost(english, 'ro'), true);
  assert.equal(translationForPost(polish, 'pl'), false);
  assert.equal(translationForPost(romanian, 'pl'), true);
  assert.equal(translationForPost(english, 'en'), false);
  assert.equal(translationForPost(polish, 'en'), true);
  assert.equal(translationForPost(emoji, 'ro'), false);
  assert.equal(translationForPost(emoji, 'pl'), false);
  assert.equal(translationForPost({ caption: 'Salut' }, 'ro'), false);
});
