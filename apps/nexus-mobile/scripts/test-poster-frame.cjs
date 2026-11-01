/* global __dirname */
/**
 * Miniaturile clipurilor din Profil și din Căutare (runda 49).
 *
 * Ownerul a refuzat placa neagră cu un disc de redare: o grilă de clipuri arăta doisprezece dreptunghiuri
 * goale. Telefonul poate cere un cadru din chiar fișierul pe care `expo-video` îl redă, iar `expo-image`
 * știe să deseneze referința nativă întoarsă. Testul ține **socoteala** (`lib/posterFrame.ts`, pură) și
 * faptul că lanțul chiar este legat: celula desenează cadrul, cadrul se ia o singură dată per fișier, iar
 * playerul se eliberează imediat.
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

const poster = loadModule('src/lib/posterFrame.ts');

test('cheia unui cadru este fișierul plus lățimea: două celule cu același clip cer un singur cadru', () => {
  const uri = 'https://nexus.local/media/9f2c.webm';
  assert.equal(poster.posterKeyOf(uri), `${uri}#w${poster.POSTER_MAX_WIDTH}`);
  assert.equal(poster.posterKeyOf(uri, 240), `${uri}#w240`);
  assert.equal(poster.posterKeyOf(uri, 240), poster.posterKeyOf(uri, 240.4), 'lățimea se rotunjește');
  assert.equal(poster.posterKeyOf(''), '', 'fără fișier nu există cheie');
  assert.notEqual(poster.posterKeyOf(uri, 240), poster.posterKeyOf(uri, 360), 'altă lățime, alt cadru');
});

test('lățimea cerută umple celula fără să țină degeaba o poză de 1080 px', () => {
  /** Celula din profil are ~150 dp; telefonul de dezvoltare are densitatea 2,6. */
  assert.equal(poster.posterWidthFor(150, 2.6), 360, 'se plafonează la lățimea de miniatură');
  assert.equal(poster.posterWidthFor(150, 1), 150, 'pe un ecran cu densitate 1 cadrul nu se inventează mai mare');
  assert.equal(poster.posterWidthFor(40, 2.6), 120, 'o celulă minusculă cere totuși un cadru vizibil');
  assert.equal(poster.posterWidthFor(0, 2.6), poster.POSTER_MAX_WIDTH, 'o măsurătoare lipsă nu cere 0 px');
  assert.equal(poster.posterWidthFor(150, 0), 150, 'o densitate absurdă nu împarte la zero');
});

test('cadrul se ia puțin după început, iar dintr-un clip scurt se ia mijlocul', () => {
  assert.equal(poster.posterTimeFor(), poster.POSTER_AT_SECONDS, 'o durată necunoscută nu schimbă regula');
  assert.equal(poster.posterTimeFor(0), poster.POSTER_AT_SECONDS);
  assert.equal(poster.posterTimeFor(NaN), poster.POSTER_AT_SECONDS);
  assert.equal(poster.posterTimeFor(12), poster.POSTER_AT_SECONDS);
  assert.equal(poster.posterTimeFor(0.6), 0.3, 'jumătatea unui clip de 0,6 s');
});

test('cache-ul are un plafon și scoate ce este mai vechi', () => {
  assert.deepEqual(poster.posterEvictions(['a'], 3), [], 'sub plafon nu scoate nimic');
  assert.deepEqual(poster.posterEvictions(['a', 'b', 'c'], 3), ['a'], 'intrarea nouă scoate cea mai veche');
  assert.deepEqual(poster.posterEvictions(['a', 'b', 'c', 'd'], 3), ['a', 'b'], 'cât timp intră atâtea');
  assert.deepEqual(poster.posterEvictions([], 3), []);
  assert.deepEqual(poster.posterEvictions(['a', 'b'], 0), [], 'un plafon absurd cade pe cel implicit, nu pe zero');
});

test('un eșec nu lasă celula neagră: se reîncearcă, din ce în ce mai rar, apoi se oprește', () => {
  assert.deepEqual([...poster.POSTER_RETRY_DELAYS], [1500, 4000, 9000], 'pauzele cresc, ca o grilă să nu repornească decodoare');
  assert.equal(poster.posterRetryDelay(1), 1500, 'prima reîncercare vine repede — fișierul poate fi doar încă descărcat');
  assert.equal(poster.posterRetryDelay(2), 4000);
  assert.equal(poster.posterRetryDelay(3), 9000);
  assert.equal(poster.posterRetryDelay(4), null, 'a patra încercare este ultima');
  assert.equal(poster.posterRetryDelay(99), null, 'un fișier care nu vine nu este cerut la nesfârșit');
  assert.equal(poster.posterRetryDelay(0), 1500, 'o socoteală stricată nu sare peste reîncercare');
  assert.equal(poster.posterRetryDelay(NaN), 1500);
  assert.equal(poster.posterRetryDelay(-3), 1500);

  const store = strip(read('src/lib/videoPoster.ts'));
  assert.match(store, /else failures\.set\(key, \(failures\.get\(key\) \?\? 0\) \+ 1\);/, 'eșecul se numără');
  assert.match(store, /const wait = posterRetryDelay\(failures\.get\(key\) \?\? 1\);/, 'hook-ul așteaptă pauza potrivită');
  assert.match(store, /if \(wait != null\) timer = setTimeout\(ask, wait\);/, 'și reia cererea singur');
  assert.match(store, /if \(timer\) clearTimeout\(timer\);/, 'un timer rămas în urmă se oprește la demontare');
  assert.match(store, /failures\.delete\(key\);/, 'un cadru sosit șterge socoteala eșecurilor');
});

test('cadrele de pe ecran nu ies din cache, iar ce nu a fost atins iese primul', () => {
  assert.deepEqual(poster.posterTouch(['a', 'b', 'c'], 'a'), ['b', 'c', 'a'], 'cheia atinsă trece la capătul cel mai nou');
  assert.deepEqual(poster.posterTouch(['a', 'b'], 'z'), ['a', 'b', 'z'], 'o cheie nouă intră la capăt');
  assert.deepEqual(poster.posterTouch(['a', 'b'], ''), ['a', 'b'], 'fără cheie, ordinea nu se schimbă');

  const store = strip(read('src/lib/videoPoster.ts'));
  assert.match(store, /const held = new Map<string, number>\(\);/, 'celulele montate țin minte ce desenează');
  assert.match(store, /hold\(key\);/, 'o celulă își ține cheia cât timp este montată');
  assert.match(store, /release\(key\);/, 'și o dă drumul când pleacă');
  assert.match(store, /!held\.has\(entry\)/, 'un cadru ținut de o celulă nu este scos din cache');
  assert.match(store, /function touch\(key: string\): void \{/, 'o citire atinge cheia');
});

test('celula are trei stări, iar cea de „se lucrează" nu este placa neagră', () => {
  const tile = strip(read('src/components/ProfileTile.tsx'));
  assert.match(tile, /const video = useVideoPoster\(isVideo \? cover : null\);/, 'celula cere cadrul clipului');
  assert.match(tile, /<Image source=\{video\.frame\} contentFit="cover" style=\{styles\.fill\}/, 'și îl desenează pe toată celula');
  assert.match(tile, /video\.status === 'failed' \? styles\.videoPlate : styles\.videoPlateLoading/,
    'eșecul are placa de rezervă, lucrul în curs are suprafața neutră');
  assert.match(tile, /\{video\.status === 'failed' \? null : <View style=\{styles\.posterPending\} \/>\}/,
    'inelul apare numai cât timp cadrul este pe drum');
  assert.match(tile, /videoPlateLoading: \{ alignItems: 'center', justifyContent: 'center', backgroundColor: '#16212a' \}/,
    'suprafața de lucru este mai deschisă decât negrul plăcii');
  assert.match(tile, /posterPending: \{/, 'inelul este desenat, nu animat');
  assert.doesNotMatch(tile, /ActivityIndicator|Animated\./, 'fără animație continuă: ecranul trebuie să aibă stare de repaus');
  const store = strip(read('src/lib/videoPoster.ts'));
  assert.match(store, /export type VideoPosterStatus = 'ready' \| 'loading' \| 'failed';/, 'trei stări, numite');
  assert.match(store, /return \{ frame, status \};/, 'hook-ul întoarce cadrul și starea lui');
});

test('cadrul se ia o singură dată per fișier, iar o grilă nu montează playere', () => {
  const tile = strip(read('src/components/ProfileTile.tsx'));
  assert.match(tile, /import \{ Image \} from 'expo-image';/, 'cadrul se desenează cu `expo-image`');
  assert.match(tile, /styles\.playDisc/, 'discul de redare rămâne peste cadru');
  assert.doesNotMatch(tile, /VideoView|useVideoPlayer/, 'o grilă nu montează playere');

  const store = strip(read('src/lib/videoPoster.ts'));
  assert.match(store, /createVideoPlayer\(local \?\? source\)/, 'cadrul se ia din playerul care există');
  assert.match(store, /generateThumbnailsAsync\(\[posterTimeFor\(player\.duration\)\], \{ maxWidth: width \}\)/,
    'o singură cerere, la lățimea stabilită');
  assert.match(store, /finally \{\s*player\.release\(\);\s*\}/, 'playerul se eliberează imediat după cadru');
  assert.match(store, /if \(running < POSTER_CONCURRENCY\) run\(\);/, 'cel mult două generări deodată');
  assert.match(store, /const inFlight = pending\.get\(key\);/, 'aceeași cerere nu pornește două decodoare');
  assert.match(store, /catch\(\(\) => undefined\)/, 'un eșec nu aruncă nimic în sus: celula își vede de treaba ei');
});
