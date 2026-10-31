/* global __dirname */
/**
 * Căutarea/explorarea rundei 45: ce s-a putut dovedi fără telefon.
 *
 * Ownerul a cerut șapte lucruri (fără antet, grilă de trei coloane 9:16, numai cifra reală de
 * vizualizări, căutare automată la tastare cu oameni/postări/subiecte, aranjament de cont, citire prin
 * readerul existent, poziția păstrată la întoarcere) plus o singură cerință tehnică (miniaturi
 * virtualizate, nu playere). Aici se ține partea de sursă a fiecăruia — legătura dintre ecran, celulă și
 * ruta de citire — fiindcă pe telefon se dovedește numai ce desenează.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8');
/** Comentariile se taie înainte de potrivire, ca un docblock să nu poată ține un test în viață. */
const code = (relative) => read(relative).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*/gm, '');

test('search nu mai are antet de shell: câmpul este primul rând al ecranului', () => {
  const shell = code('src/app/index.tsx');
  assert.match(shell, /slot === 'account' \|\| slot === 'inbox' \|\| slot === 'search' \|\| onFeed \? null/,
    'slotul de căutare nu primește AppHeader');
  const search = read('src/screens/SearchScreen.tsx');
  const field = search.indexOf('<TextInput');
  const list = search.indexOf('<FlatList');
  assert.ok(field > 0 && list > 0 && field < list, 'câmpul stă înaintea listei, deci primul rând');
  assert.ok(!/AppHeader/.test(search), 'ecranul nu-și desenează propriul antet');
  assert.ok(!/Caută<\/Text>/.test(code('src/screens/SearchScreen.tsx')), 'butonul „Caută" a plecat: căutarea e automată');
});

test('grila are trei coloane de 9:16, din aceleași numere ca peretele profilului', () => {
  const search = code('src/screens/SearchScreen.tsx');
  assert.match(search, /import \{ GRID_COLUMNS, GRID_GAP, tileSize \} from '\.\.\/lib\/profileGrid';/);
  assert.match(search, /numColumns=\{GRID_COLUMNS\}/);
  assert.match(search, /columnWrapperStyle=\{styles\.row\}/);
  const grid = read('src/lib/profileGrid.ts');
  assert.match(grid, /export const GRID_COLUMNS = 3;/);
  assert.match(grid, /export const TILE_ASPECT = 9 \/ 16;/);
  const tile = code('src/components/ProfileTile.tsx');
  assert.match(tile, /aspectRatio: socialTokens\.archive\.tileAspect/, 'celula își ia forma din temă (9:16)');
});

test('miniaturile arată numai cifra reală de vizualizări, iar ea vine din payload', () => {
  const search = code('src/screens/SearchScreen.tsx');
  assert.match(search, /<ProfileTile post=\{item\} mode="explore" \/>/);
  assert.match(search, /const cell = tileSize\(listWidth - 2 \* GRID_GAP, GRID_COLUMNS, GRID_GAP\);/,
    'celula are lățimea unei treimi, nu toată lățimea rândului');
  assert.match(search, /<View style=\{\{ width: cell\.width \}\}>/);
  assert.ok(!/PostCard/.test(search), 'rezultatele nu mai sunt carduri întregi de postare');
  const tile = code('src/components/ProfileTile.tsx');
  assert.match(tile, /const viewers = profileCompactCount\(post\.view_stats\?\.viewers\);/,
    'cifra este cea numărată de server, nu una socotită pe telefon');
  assert.match(tile, /mode === 'explore' && viewers && !cover/, 'o pagină de cuvinte primește și ea cifra');
  assert.match(tile, /mode !== 'explore' && attribution && !words/,
    'pe peretele de explorare nu se tipărește nici măcar a cui este redistribuirea');
  assert.ok(!/caption/.test(tile), 'nicio descriere pe celulă');
});

test('căutarea pornește singură la tastare, cu un singur răspuns pentru ultima întrebare', () => {
  const search = code('src/screens/SearchScreen.tsx');
  assert.match(search, /const DEBOUNCE_MS = 320;/);
  assert.match(search, /const MIN_QUERY = 2;/);
  assert.match(search, /setTimeout\(\(\) => \{/);
  assert.match(search, /if \(mine !== ticket\.current\) return;/, 'un răspuns vechi nu scrie peste unul nou');
  assert.match(search, /\/api\/social\/search\?q=\$\{encodeURIComponent\(asked\)\}/);

test('oamenii se citesc ca într-o căutare de cont: poză, nume, @handle', () => {
  const search = code('src/screens/SearchScreen.tsx');
  assert.match(search, /function AccountRow\(\{ person \}: \{ person: SearchProfile \}\)/);
  assert.match(search, /style=\{styles\.avatar\}/);
  assert.match(search, /style=\{styles\.personName\}/);
  assert.match(search, /`@\$\{person\.handle\}`/);
  assert.match(search, /openSocialProfile\(person\.handle\)/);
});

test('o celulă deschide readerul existent, iar lista nu ține niciun player', () => {
  const tile = code('src/components/ProfileTile.tsx');
  assert.match(tile, /pathname: '\/post\/\[id\]'/, 'citirea este ruta comună, cu reacții și comentarii');
  const search = code('src/screens/SearchScreen.tsx');
  assert.ok(!/RemoteVideo/.test(search), 'peretele nu are voie să țină decodoare');
  assert.ok(!/LinearGradient|stopOpacity/.test(search), 'niciun gradient propriu: citirea are un singur sistem');
  assert.match(search, /removeClippedSubviews/);
  assert.match(search, /windowSize=\{5\}/);
  assert.match(search, /maxToRenderPerBatch=\{GRID_COLUMNS \* 3\}/);
});

test('întoarcerea dintr-o postare păstrează locul din listă', () => {
  const search = code('src/screens/SearchScreen.tsx');
  assert.ok(!/useFocusEffect|useIsFocused/.test(search),
    'ecranul nu se reîncarcă la focus: lista rămâne montată sub ruta postului, cu poziția ei');
  const shell = code('src/app/index.tsx');
  assert.match(shell, /<SearchScreen key=\{`search-\$\{searchQuery\}`\} initialQuery=\{searchQuery\} \/>/,
    'cheia se schimbă numai când o ușă a bandei aduce o întrebare nouă');
});

  assert.match(search, /\/api\/social\/feed\?lens=for-you&format=all&limit=/, 'peretele este feed-ul recomandat');
  assert.match(search, /'\/api\/social\/tags\?kind=hashtag&limit=30'/);
  assert.match(search, /openTagPage\(entry\.tag\)/, 'un subiect deschide pagina lui, nu o căutare nouă');
});

test('rezultatele continuă pe cursorul serverului, fără dubluri și fără bucle (runda 46)', () => {
  const search = code('src/screens/SearchScreen.tsx');
  assert.match(search, /nextCursor: page\.next_cursor \?\? null/, 'prima pagină reține cursorul serverului');
  assert.match(search, /cursor=\$\{encodeURIComponent\(cursor\)\}/, 'pagina următoare cere cursorul, nu reface prima cerere');
  assert.match(search, /if \(!fresh \|\| !fresh\.nextCursor \|\| moreBusy\) return;/,
    'fără cursor sau cu o pagină în zbor, nimic nu pornește: fără bucle');
  assert.match(search, /if \(mine !== ticket\.current\) return;[\s\S]*?rememberPayload\(page\);/,
    'un răspuns vechi este aruncat și pe pagina a doua');
  assert.match(search, /const knownPosts = new Set\(previous\.posts\.map\(\(post\) => post\.id\)\);/);
  assert.match(search, /\(page\.posts \?\? \[\]\)\.filter\(\(post\) => !knownPosts\.has\(post\.id\)\)/, 'fără dubluri');
  assert.match(search, /const knownProfiles = new Set\(previous\.profiles\.map\(\(profile\) => profile\.id\)\);/);
  assert.match(search, /onEndReached=\{\(\) => \{ if \(term\) loadMore\(\); \}\}/, 'pagina următoare se cere doar în rezultate');
  assert.match(search, /const DEBOUNCE_MS = 320;/, 'debounce-ul rămâne cel cerut');
  assert.match(search, /setMoreBusy\(false\);\s*setMoreError\(''\);/, 'o întrebare nouă curăță starea paginii vechi');
});

test('subiectele goale se spun în cuvinte, nu se inventează (runda 46)', () => {
  const search = code('src/screens/SearchScreen.tsx');
  assert.match(search, /term && !tagMatches\.length && !trending\.length/,
    'rândul de subiecte are un răspuns pentru lista goală');
  assert.match(search, /ultimele 3 zile/);
  const api = readFileSync(resolve(__dirname, '../../nexus-web/lib/api.js'), 'utf8');
  assert.match(api, /const windowSeconds = 3 \* 24 \* 3600;/, 'fereastra de trei zile este a serverului, nu a ecranului');
  assert.match(api, /minAuthors: 2/, 'și pragul de doi autori este tot al serverului');
  assert.ok(!/insert into|INSERT INTO|seed/i.test(search), 'ecranul nu creează date ca să aibă ce arăta');
});


