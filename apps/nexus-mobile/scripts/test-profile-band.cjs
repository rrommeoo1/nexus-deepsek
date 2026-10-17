/* global __dirname */
// The profile band's contract, native-first (`MIGRATION.md` §20.1). No web module is the oracle here:
// the band was designed on the phone, and what these tests pin is the behaviour the owner asked for.
//
//   * the age is derived from the date of birth at the moment it is read: birthday today, tomorrow,
//     yesterday, 29 February in a common year, the reader's own time zone around midnight, a date the
//     calendar does not have, and a date in the future;
//   * the five readings appear in the owner's order, each one only when the payload carries it, with no
//     empty reading and no doubled separator;
//   * the loop: the 48 seconds on a nominal column, a floor and a ceiling, and enough copies of the run
//     to close the seam.
//
// The component itself is held to the three things a reader can check by hand: the transform is native,
// reduced motion stops it, and a touch opens the sheet.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const source = readFileSync(resolve(ROOT, 'src/lib/profileBand.ts'), 'utf8');
const code = ts.transpileModule(source, {
  fileName: 'profileBand.ts',
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleShim = { exports: {} };
new Function('module', 'exports', 'require', code)(moduleShim, moduleShim.exports, require);
const {
  normaliseBirthDate, bandAge, displayAge, memberSince, bandRows, bandItems, bandLabel,
  bandCycleMs, bandCopies, BAND_SECONDS,
} = moduleShim.exports;

/** A moment in a fixed zone-independent form: the tests never depend on the machine's own zone. */
const at = (iso) => new Date(iso).getTime();
const profile = (patch = {}) => ({
  user_id: 1, handle: 'ana', name: 'Ana', bio: '', location: '', age: null, visibility: 'public', ...patch,
});

test('data de nastere este o zi pe care calendarul o are', () => {
  assert.equal(normaliseBirthDate('1990-10-17'), '1990-10-17');
  assert.equal(normaliseBirthDate(' 1990-10-17 '), '1990-10-17');
  assert.equal(normaliseBirthDate('2025-02-29'), null, '29 februarie nu exista in 2025');
  assert.equal(normaliseBirthDate('2024-02-29'), '2024-02-29', 'dar exista in 2024');
  assert.equal(normaliseBirthDate('2001-02-30'), null);
  assert.equal(normaliseBirthDate('2001-13-01'), null);
  assert.equal(normaliseBirthDate('1899-12-31'), null);
  assert.equal(normaliseBirthDate(''), null);
  assert.equal(normaliseBirthDate(null), null);
  assert.equal(normaliseBirthDate(undefined), null);
  assert.equal(normaliseBirthDate('17.10.1990'), null);
});

test('varsta se schimba in ziua de nastere, nu inainte si nu dupa', () => {
  const born = '1990-10-17';
  assert.equal(bandAge(born, at('2026-10-17T12:00:00Z'), 'UTC'), 36, 'chiar in ziua de nastere');
  assert.equal(bandAge(born, at('2026-10-16T23:59:00Z'), 'UTC'), 35, 'cu o zi inainte');
  assert.equal(bandAge(born, at('2026-10-18T00:01:00Z'), 'UTC'), 36, 'dupa');
  assert.equal(bandAge(born, at('2026-10-01T00:00:00Z'), 'UTC'), 35, 'in aceeasi luna, dar inainte de zi');
});

test('29 februarie: un an mai mult abia de la 1 martie in anii nebisecti', () => {
  const born = '2000-02-29';
  assert.equal(bandAge(born, at('2026-02-28T12:00:00Z'), 'UTC'), 25);
  assert.equal(bandAge(born, at('2026-03-01T12:00:00Z'), 'UTC'), 26);
  assert.equal(bandAge(born, at('2024-02-29T12:00:00Z'), 'UTC'), 24, 'bisect: chiar in zi');
  assert.equal(bandAge(born, at('2024-02-28T12:00:00Z'), 'UTC'), 23);
});

test('fusul orar al cititorului decide ziua, nu cel al serverului', () => {
  const born = '1990-10-18';
  const moment = at('2026-10-17T23:30:00Z');
  assert.equal(bandAge(born, moment, 'UTC'), 35, 'inca 17 octombrie la UTC');
  assert.equal(bandAge(born, moment, 'Europe/Bucharest'), 36, 'deja 18 octombrie la Bucuresti');
  assert.equal(bandAge(born, moment, 'America/New_York'), 35, 'inca 17 octombrie la New York');
  assert.equal(bandAge(born, moment, 'Not/AZone'), bandAge(born, moment), 'un fus necunoscut cade pe calendarul dispozitivului');
});

test('o data invalida sau viitoare nu produce o varsta', () => {
  assert.equal(bandAge('2001-02-30', at('2026-10-17T12:00:00Z'), 'UTC'), null);
  assert.equal(bandAge('2030-01-01', at('2026-10-17T12:00:00Z'), 'UTC'), null);
  assert.equal(bandAge('', at('2026-10-17T12:00:00Z'), 'UTC'), null);
});

test('varsta afisata: data de nastere cand o avem, numarul serverului cand nu', () => {
  const now = at('2026-10-17T12:00:00Z');
  assert.equal(displayAge(profile({ birth_date: '1990-10-17', age: 30 }), now, 'UTC'), 36, 'data de nastere castiga');
  assert.equal(displayAge(profile({ birth_date: null, age: 30 }), now, 'UTC'), 30, 'varsta primita, nerecalculata');
  assert.equal(displayAge(profile({ birth_date: '2001-02-30', age: 30 }), now, 'UTC'), null, 'nu inventam un fallback');
  assert.equal(displayAge(profile({ age: null }), now, 'UTC'), null);
  assert.equal(displayAge(profile({ age: 7 }), now, 'UTC'), null);
  assert.equal(displayAge(null, now, 'UTC'), null);
});


test('membru din: luna crearii, citita in fusul cititorului', () => {
  const september = at('2025-09-30T22:30:00Z');
  assert.equal(memberSince(september / 1000, 'UTC', at('2026-10-17T12:00:00Z')), 'septembrie 2025');
  assert.equal(memberSince(september / 1000, 'Europe/Bucharest', at('2026-10-17T12:00:00Z')), 'octombrie 2025');
  assert.equal(memberSince(0), '');
  assert.equal(memberSince(null), '');
  assert.equal(memberSince(Number.NaN), '');
  assert.equal(memberSince(at('2027-01-01T00:00:00Z') / 1000, 'UTC', at('2026-10-17T12:00:00Z')), '', 'o data viitoare nu e un membru din');
});

test('cele cinci citiri, in ordinea proprietarului, fara goluri', () => {
  const now = at('2026-10-17T12:00:00Z');
  const all = bandRows(profile({
    bio: 'Scriu despre\nlucruri mici.', location: 'Cluj', joined_at: at('2025-03-04T10:00:00Z') / 1000,
    birth_date: '1990-10-17', visibility: 'public',
  }), now, { timeZone: 'UTC' });
  assert.deepEqual(all.map((row) => row.kind), ['bio', 'location', 'member', 'age', 'account']);
  assert.deepEqual(all.map((row) => row.label), ['Descriere', 'Locație', 'Membru din', 'Vârstă', 'Tipul contului']);
  assert.deepEqual(all.map((row) => row.text), [
    'Scriu despre lucruri mici.', 'Cluj', 'Membru din martie 2025', '36 ani', 'Cont public',
  ]);
  assert.equal(all[4].icon, '🔓');
  // Fiecare citire lipsa isi scoate doar randul ei, iar ordinea celorlalte ramane.
  const base = { bio: 'b', location: 'l', joined_at: at('2025-03-04T10:00:00Z') / 1000, birth_date: '1990-10-17', visibility: 'public' };
  const cases = [
    [{ bio: '' }, ['location', 'member', 'age', 'account']],
    [{ location: '  ' }, ['bio', 'member', 'age', 'account']],
    [{ joined_at: null }, ['bio', 'location', 'age', 'account']],
    [{ birth_date: null, age: null }, ['bio', 'location', 'member', 'account']],
    [{ visibility: '' }, ['bio', 'location', 'member', 'age']],
  ];
  for (const [patch, expected] of cases) {
    assert.deepEqual(bandRows(profile({ ...base, ...patch }), now, { timeZone: 'UTC' }).map((row) => row.kind), expected);
  }
  assert.deepEqual(bandRows(profile(), now, { timeZone: 'UTC' }).map((row) => row.kind), ['account']);
  assert.deepEqual(bandRows(null, now), []);
  // Nicio citire goala si niciun separator dublu: linia se citeste dintr-o bucata.
  const line = bandLabel(bandItems(all));
  assert.equal(line, all.map((row) => row.text).join(' · '));
  assert.ok(!line.includes('·  ·'), 'fara separatoare duble');
  assert.ok(!line.startsWith('·') && !line.endsWith('·'), 'fara separator la capete');
});

test('contul privat poarta lacatul, cel public lacatul deschis', () => {
  const now = at('2026-10-17T12:00:00Z');
  const open = bandRows(profile({ visibility: 'public' }), now)[0];
  const friends = bandRows(profile({ visibility: 'friends' }), now)[0];
  const priv = bandRows(profile({ visibility: 'private' }), now)[0];
  assert.equal(open.text, 'Cont public');
  assert.equal(open.icon, '🔓');
  assert.equal(friends.text, 'Cont privat');
  assert.equal(friends.icon, '🔒');
  assert.equal(priv.text, 'Cont privat');
});

test('bucla: 48 de secunde pe coloana nominala, cu un minim si un maxim', () => {
  assert.equal(BAND_SECONDS, 48);
  assert.equal(bandCycleMs(0), 0, 'o banda nemasurata nu se anima');
  assert.equal(bandCycleMs(-10), 0);
  assert.equal(bandCycleMs(360), 48000);
  assert.equal(bandCycleMs(180), 48000, 'un rand scurt nu alearga');
  assert.equal(bandCycleMs(720), 96000, 'un rand lung merge cu aceeasi viteza');
  assert.equal(bandCycleMs(2000), 120000, 'dar nu mai lent de atat');
  assert.ok(bandCycleMs(400) > bandCycleMs(390));
});

test('destule copii ca cusatura buclei sa nu lase un gol', () => {
  assert.equal(bandCopies(0, 360), 2, 'inainte de masurare, doua copii');
  assert.equal(bandCopies(500, 360), 2, 'un rand mai lat decat ecranul');
  assert.equal(bandCopies(100, 360), 5, '360 + 100, in pasi de 100');
  assert.equal(bandCopies(360, 360), 2);
  assert.equal(bandCopies(40, 400), 11);
  assert.equal(bandCopies(10, 4000), 12, 'plafonat');
});

test('componenta: driver nativ, reduce motion si foaia la atingere', () => {
  const component = readFileSync(resolve(ROOT, 'src/components/ProfileBand.tsx'), 'utf8');
  assert.match(component, /useNativeDriver: true/, 'translateX merge pe driverul nativ');
  assert.match(component, /translateX: shift/, 'benzile calatoresc pe orizontala');
  assert.match(component, /AccessibilityInfo\.isReduceMotionEnabled/, 'reduce motion este citit');
  assert.match(component, /reduceMotionChanged/, 'si urmarit cand se schimba');
  assert.match(component, /AppState\.addEventListener/, 'ceasul este citit din nou la revenirea in aplicatie');
  assert.match(component, /getDate\(\) \+ 1/, 'si la miezul noptii locale');
  assert.match(component, /<Modal/, 'foaia este un modal');
  assert.match(component, /PanResponder\.create/, 'foaia se inchide prin tragere');
  assert.match(component, /accessibilityRole="button"/, 'banda este un singur buton pentru cititorul de ecran');
  assert.match(component, /bandLabel\(items\)/, 'si isi citeste toate cele cinci fapte o data');
  // Antetul nu mai tipareste ce duce banda.
  const header = readFileSync(resolve(ROOT, 'src/components/ProfileHeader.tsx'), 'utf8');
  assert.ok(!header.includes('styles.about'), 'descrierea a plecat din antet');
  assert.ok(!header.includes('bioOpen'), 'nici controlul ei de extindere');
  assert.ok(!header.includes('styles.meta'), 'nici locul si varsta de sub butoane');
  // Ecranul aseaza banda imediat sub antet.
  const screen = readFileSync(resolve(ROOT, 'src/screens/ProfileScreen.tsx'), 'utf8');
  assert.match(screen, /<ProfileHeader[\s\S]*?<ProfileBand profile=\{profile\} \/>/, 'banda sta sub antet');
});
