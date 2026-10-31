/* global __dirname */
/**
 * Un singur cap pentru o pagină, oriunde ar fi deschisă.
 *
 * Runda 43 (owner, 31 octombrie 2026): „vreau ca reel-urile din Feed să aibă același header sus ca
 * reel-urile și postările deschise din Profil". Până atunci feedul cerea `layout="reel"` — autorul
 * deasupra captionului, la piciorul cadrului — în timp ce pagina de cuvinte din același feed și același
 * reel deschis din profil își tipăreau autorul sus. Același post avea deci două capete, după locul de unde
 * era deschis.
 *
 * Testul ține exact contractul care s-a rupt: feedul cere aranjamentul paginii (`post`), îi dă aceeași
 * bandă de sus ca pagina de cuvinte (`insets.top`), cere ușa autorului (pagina de cuvinte de alături o are)
 * și nu mai lasă nimeni `reel` implicit. Aritmetica ramei e verificată în `test-profile-reel.cjs`, iar
 * ruta în `test-post-chrome.cjs`: aici e vorba doar de cine cere ce.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync, statSync } = require('node:fs');
const { resolve, join } = require('node:path');

const ROOT = resolve(__dirname, '..');
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8');

const feed = read('src/screens/FeedScreen.tsx');
const reel = read('src/components/ReelsReader.tsx');
const canvas = read('src/components/PostCanvas.tsx');
const route = read('src/app/post/[id].tsx');
const card = read('src/components/PostCard.tsx');

/** Every `.tsx` of the app, so "nimeni nu mai cere `reel`" is a fact and not a hope. */
function sources(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sources(path, found);
    else if (path.endsWith('.tsx') || path.endsWith('.ts')) found.push(path);
  }
  return found;
}

/**
 * Code without its comments: the test asks *who asks for what*, and every one of these files explains the
 * old arrangement in prose (`layout="reel"` appears in three doc blocks that describe history, not
 * behaviour). Stripping comments keeps the assertion about calls.
 */
function code(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
}

test('feedul cere capul sus, cu aceeași bandă și aceeași ușă ca pagina de cuvinte', () => {
  /** Blocul `<ReelPage` al feedului, până la închiderea lui. */
  const page = code(feed).match(/<ReelPage[\s\S]*?\/>/);
  assert.ok(page, 'feedul nu mai montează pagina de media');
  const props = page[0];
  assert.match(props, /layout="post"/, 'un reel din feed se citește cu capul sus, ca unul din profil');
  assert.match(props, /topInset=\{insets\.top\}/, 'capul începe în banda notificărilor, ca la o pagină de cuvinte');
  assert.match(props, /^\s*follow$/m, 'ușa autorului e și ea aceeași, pentru că pagina de cuvinte o are');
  assert.match(props, /overlayBottom=\{navReserve\}/, 'piciorul rămâne al feedului: bara de tab-uri e a lui');
  assert.doesNotMatch(props, /layout="reel"/, 'feedul nu mai cere aranjamentul vechi');

  /** Aceleași numere ca pagina de cuvinte din același feed și ca ruta din profil. */
  assert.match(code(feed), /<PostCard[\s\S]{0,200}topInset=\{insets\.top\}/,
    'pagina de cuvinte din feed pornește din aceeași bandă');
  assert.match(code(route), /topInset=\{topInsetFor\(entry\)\}/, 'ruta din profil își dă singură banda');
});

test('niciun ecran nu mai cere aranjamentul cu autorul la picior', () => {
  const offenders = sources(resolve(ROOT, 'src'))
    .filter((path) => /layout="reel"|layout='reel'/.test(code(readFileSync(path, 'utf8'))))
    .map((path) => path.slice(ROOT.length + 1).replace(/\\/g, '/'));
  assert.deepEqual(offenders, [], 'un reel cu autorul la picior ar fi din nou o a doua regulă');
  assert.match(reel, /layout = 'post'/, 'implicitul paginii de media e aranjamentul paginii');
});

test('canvasul are un singur cap pe pagină: sus când e rândul lui, jos doar pentru forma `reel`', () => {
  assert.match(canvas, /const stacked = layout === 'post' && !tile;/);
  /**
   * Runda 48: capul de sus se desenează pe ramura paginii **și** când compoziția nu este previzualizarea de
   * deasupra comentariilor (`commentsPreview`), unde ownerul a cerut să rămână numai conținutul postării.
   * Regula nu s-a dublat: o singură ramură, cu un singur motiv în plus.
   */
  assert.match(canvas, /\{stacked && !commentsPreview \? \(/, 'capul sus e ramura paginii');
  assert.match(canvas, /\{!stacked \? author : null\}/, 'capul de jos se desenează doar în forma veche');
  /** Pagina tipărește pasul mărit al capului, exact ca o pagină de cuvinte (54 dp față, 17 dp nume). */
  assert.match(canvas, /const pageHead = wordPage \|\| \(page && stacked && !tile\);/);
  assert.match(canvas, /const head = wordPageHead\(metrics, pageHead\);/);
});

test('cardul din căutare are deja capul sus, deci căutarea nu se atinge', () => {
  /** Un card de listă e aceeași compoziție, fără `page`: capul sus, captionul jos. */
  assert.match(card, /layout="post"/, 'cardul desenează compoziția paginii');
  assert.match(card, /page=\{Boolean\(height\)\}/, 'un card de listă nu e pagină');
  assert.match(card, /authorAction=\{authorId \?/, 'cardul își păstrează ușa autorului');
});
