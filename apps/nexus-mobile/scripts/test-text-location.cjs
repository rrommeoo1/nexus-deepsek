/* global __dirname */
// Locația paginii: citită din telefon, numită de geocoderul serverului, scrisă ca nume — și scoasă cu un X.
//
// Trei lucruri se apără aici, în ordinea importanței:
// 1. un telefon fără modulul nativ (sau fără GPS, sau cu permisiunea refuzată) nu blochează publicarea;
// 2. în ciornă și în corpul publicării ajunge un *nume de loc*, niciodată o coordonată;
// 3. X-ul golește câmpul care pleacă la server, iar locația nu se întoarce singură după aceea.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(ROOT, file), 'utf8');
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/**
 * `location.ts` importă API-ul produsului, care la rândul lui atinge Expo; testul îi dă un `require` propriu,
 * ca regula geocoderului să poată fi citită fără un telefon atașat.
 */
function loadLocation(stubs) {
  const out = ts.transpileModule(read('src/lib/location.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleShim = { exports: {} };
  const requireShim = (id) => {
    if (Object.prototype.hasOwnProperty.call(stubs, id)) return stubs[id];
    throw new Error(`location.ts nu are voie să importe ${id}`);
  };
  new Function('module', 'exports', 'require', out)(moduleShim, moduleShim.exports, requireShim);
  return moduleShim.exports;
}

/** Fără `expo-location` în build: exact telefonul de dinaintea acestei runde. */
const withoutModule = () => loadLocation({
  './publishing': { PUBLISHING_LIMITS: { location: 120 }, emptyPublishing: () => ({}), normalizePublishing: () => ({}) },
  './nexusApi': { nexusApi: async () => ({ suggestions: [] }) },
  './apiOrigin': { API_ORIGIN: 'http://127.0.0.1:5000' },
  './idempotency': { newMutationKey: () => 'k' },
  './session': { authHeaders: () => ({}) },
});

test('fără modulul nativ, locația este „indisponibilă" — nu o excepție și nu o publicare blocată', async () => {
  const location = withoutModule();
  assert.equal(await location.readLocationPermission(), 'unavailable');
  const answer = await location.detectPlace();
  assert.equal(answer.status, 'unavailable');
  assert.match(answer.reason, /loca/i, 'spune omului ce s-a întâmplat, într-o propoziție');
});

test('coordonata care pleacă spre geocoder are patru zecimale, nu precizia telefonului', () => {
  const location = withoutModule();
  assert.equal(location.roundCoordinate(44.4267654321), '44.4268');
  assert.equal(location.roundCoordinate(26.1025123456), '26.1025');
  assert.equal(location.roundCoordinate(-0.000049), '0.0000');
  assert.equal(location.roundCoordinate(0), '0.0000');
});

test('numele locului este cel de zonă, cu orașul ca rezervă, niciodată strada', () => {
  const location = withoutModule();
  const suggestions = [
    { label: 'Strada Franceză 12, Sectorul 3, București', type: 'exact' },
    { label: 'Sectorul 3, București', type: 'area' },
    { label: 'București', type: 'city' },
  ];
  assert.deepEqual(location.readablePlace(suggestions), { label: 'Sectorul 3, București', type: 'area' });
  // Fără zonă, orașul e răspunsul; fără oraș, rămâne ce există.
  assert.deepEqual(location.readablePlace([suggestions[0], suggestions[2]]), { label: 'București', type: 'city' });
  assert.deepEqual(location.readablePlace([suggestions[0]]), { label: 'Strada Franceză 12, Sectorul 3, București', type: 'exact' });
  // Precizia cerută schimbă ordinea, nu valorile.
  assert.equal(location.readablePlace(suggestions, 'city').label, 'București');
  assert.equal(location.readablePlace(suggestions, 'exact').type, 'exact');
  assert.equal(location.readablePlace([]), null);
  assert.equal(location.readablePlace(null), null);
  assert.equal(location.readablePlace([{ label: '   ', type: 'area' }]), null, 'un nume gol nu este un loc');
  // Numele păstrează limita serverului (`PUBLISHING_LIMITS.location`), nu o inventează.
  const long = location.readablePlace([{ label: 'x'.repeat(400), type: 'area' }]);
  assert.equal(long.label.length, 120);
});

test('compozitorul scrie locația ca nume, o golește la X și nu o mai readuce singur', () => {
  const composer = code(read('src/app/text.tsx'));
  // Numele venit de la server este scris în câmpul care pleacă la publicare.
  assert.match(composer, /edit\(\{ publishing: \{ \.\.\.draft\.publishing, location: result\.label \}/,
    'numele locului se scrie în detaliile de publicare');
  // X-ul golește același câmp: nu ascunde o etichetă lăsând coordonatele să călătorească dedesubt.
  assert.match(composer, /function removePlace\(\) \{[\s\S]{0,220}publishing: \{ \.\.\.draft\.publishing, location: '' \}/,
    'X-ul golește locația din ce se trimite');
  assert.match(composer, /placeRemoved\.current = true;/, 'compozitorul ține minte că omul a spus nu');
  assert.match(composer, /if \(placeRemoved\.current\) return;/, 'citirea automată nu se mai întoarce peste decizia lui');
  // Decizia nu trăiește doar cât e ecranul deschis: se scrie în ciornă, ca o repornire să nu readucă locul.
  assert.match(composer, /edit\(\{ publishing: \{ \.\.\.draft\.publishing, location: '' \}, locationDismissed: true \}\)/,
    'X-ul scrie în ciornă că locul a fost scos');
  assert.match(composer, /if \(placeRemoved\.current \|\| draft\.locationDismissed\) return;/,
    'o ciornă din care locul a fost scos nu se mai detectează singură');
  const draft = code(read('src/lib/textDraft.ts'));
  assert.match(draft, /locationDismissed: boolean;/, 'decizia are un loc în ciornă');
  assert.match(draft, /locationDismissed: source\.locationDismissed === true,/, 'o ciornă veche nu are decizia');
  // Nicio coordonată în compozitor: ele trăiesc doar în `lib/location.ts`, și doar până la geocoder.
  assert.doesNotMatch(composer, /latitude|longitude/, 'compozitorul nu vede coordonate');
  assert.match(composer, /publishing: draft\.publishing,/, 'publicarea trimite detaliile, cu locația goală dacă a fost scoasă');
  // Locația nu blochează butonul Publică.
  assert.doesNotMatch(composer, /disabled=\{[^}]*place/, 'locația nu oprește publicarea');
});

test('permisiunea este cerută de un deget, după ce i s-a spus de ce', () => {
  const composer = code(read('src/app/text.tsx'));
  const location = code(read('src/lib/location.ts'));
  // Deschiderea compozitorului citește permisiunea fără dialog; dialogul sistemului aparține unei apăsări.
  assert.match(composer, /void askPlace\(false\)/, 'compozitorul citește permisiunea fără să întrebe');
  assert.match(composer, /void askPlace\(true\)/, 'o apăsare cere permisiunea');
  assert.match(composer, /Jungle Book cere locația telefonului doar pentru asta/, 'spune de ce, înainte de dialog');
  assert.match(location, /requestForegroundPermissionsAsync/, 'permisiunea este cea de prim-plan');
  assert.match(location, /if \(!permission\.granted\) return \{ status: 'denied' \}/, 'refuzul este un răspuns, nu o excepție');
  assert.match(location, /PUBLISHING_LIMITS\.location/, 'numele păstrează limita serverului');
  // Geocoderul produsului, nu unul inventat: aceeași rută pe care o folosește și webul.
  assert.match(location, /\/api\/location\/suggestions\?kind=reverse&lat=/, 'ruta de reverse-geocoding a serverului');
  assert.match(location, /headers: \{ 'Accept-Language': 'ro,en' \}/,
    'numele locului vine în limba cititorului, nu în limba străzii');
  assert.match(location, /if \(!core\.requireOptionalNativeModule\('ExpoLocation'\)\) return null;/,
    'modulul nativ este întrebat înainte de a fi încărcat, nu presupus');
  assert.match(composer, /permission === 'unavailable'[\s\S]{0,240}status: 'unavailable'/,
    'un build fără modul spune altceva decât un refuz: două defecte diferite, două propoziții diferite');
  // Niciun IP: locația vine din receptorul telefonului, nu din adresa de rețea.
  assert.doesNotMatch(location, /ipapi|ip-api|ipinfo|geoip/i, 'adresa de rețea nu este o locație');
});

