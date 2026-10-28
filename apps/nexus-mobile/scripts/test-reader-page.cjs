/* global __dirname */
/**
 * Piciorul unei pagini de cuvinte — runda 31 (owner, 31 octombrie 2026).
 *
 * Două reclamații, o singură cauză:
 *   · numele autorului apărea de două ori pe aceeași pagină — o dată în antetul rutei, o dată pe hârtia
 *     paginii, care își tipărește singură capul;
 *   · antetul purta `1/22`, adică *postările plimbării* deschise din profil, în timp ce folio-ul aceleiași
 *     pagini spunea `1/3` — numărul paginilor documentului.
 *
 * Ruta nu mai desenează nimic peste o pagină de cuvinte; ușa de întoarcere stă jos, într-o bandă pe care
 * pagina o cedează *înainte* să fie desenată (`lib/readerBar.ts`), iar singurul număr de pe ecran este
 * folio-ul paginii, tipărit de `folioLabel` (`lib/textPage.ts`) din paginile pe care cititorul le-a produs
 * efectiv. Testul verifică aritmetica modulului pur și, prin contracte de sursă, cine o folosește.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8');
const load = (relative) => {
  const code = ts.transpileModule(read(relative), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const shim = { exports: {} };
  new Function('module', 'exports', 'require', code)(shim, shim.exports, () => {
    throw new Error(`${relative} nu are voie să importe nimic la rulare`);
  });
  return shim.exports;
};

const bar = load('src/lib/readerBar.ts');
const page = load('src/lib/textPage.ts');
const presentation = load('src/lib/postPresentation.ts');

/** Sursa fără comentarii: o propoziție dintr-o notă nu este un control. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const image = (position = 0) => ({ hash: `${position}`.padStart(64, 'a'), ext: 'jpg', kind: 'image', position });

test('banda de la picior se rezervă, iar insetul telefonului se adaugă peste ea', () => {
  assert.equal(bar.readerBarHeight(0), bar.READER_BAR.height, 'fără bară de gesturi, banda întreagă');
  assert.equal(bar.readerBarHeight(24), 24 + bar.READER_BAR.height, 'insetul se adaugă, nu se contopește');
  assert.equal(bar.readerBarHeight(-8), bar.READER_BAR.height, 'un inset absurd nu scurtează banda');
  assert.equal(bar.readerBarHeight(Number.NaN), bar.READER_BAR.height);
  assert.ok(bar.READER_BAR.height >= bar.READER_BAR.button,
    'banda încape ținta de 44dp, deci ușa nu atinge nici hârtia, nici bara de gesturi');
});

test('ușa din picior este o țintă reală, desenată înăuntru', () => {
  assert.ok(bar.READER_BAR.button >= 44, '44dp de apăsare, ca orice ușă a aplicației');
  assert.ok(bar.READER_BAR.disc < bar.READER_BAR.button, 'discul stă în țintă, nu o umple');
  assert.ok(bar.READER_BAR.glyph <= bar.READER_BAR.disc + 2, 'săgeata încape în disc');
  assert.ok(bar.READER_BAR.inline > 0, 'ușa are marginea paginii, nu atinge muchia ecranului');
});

test('o pagină de cuvinte începe în banda notificărilor, nu sub un antet care nu există', () => {
  assert.equal(bar.readerPageTopInset(30), 30, 'capul paginii urcă sub ceasul telefonului');
  assert.equal(bar.readerPageTopInset(0), 0);
  assert.equal(bar.readerPageTopInset(-4), 0);
  assert.equal(bar.readerPageTopInset(Number.NaN), 0);
});

test('numai un text și un articol se citesc ca pagină', () => {
  assert.equal(presentation.readsAsPage({ id: 1, kind: 'text', caption: 'doar text' }), true);
  assert.equal(presentation.readsAsPage({
    id: 2, kind: 'image', caption: 'Un articol cu o fotografie.', text_style: { theme: 'paper' }, media: image(),
  }), true, 'un articol autorat este tot o pagină de cuvinte');
  assert.equal(presentation.readsAsPage({ id: 3, kind: 'image', media: image() }), false, 'o poză nu are cap propriu');
  assert.equal(presentation.readsAsPage({ id: 4, kind: 'video', media: { ...image(), kind: 'video', ext: 'mp4' } }), false);
  assert.equal(presentation.readsAsPage({ id: 5, kind: 'text', caption: 'comentariu', quoted_post: { id: 6 } }), false,
    'un citat este o conversație, nu o pagină');
  assert.equal(presentation.readsAsPage(null), presentation.stageFor(null) === 'text');
});

test('ruta nu desenează decât un antet, și nu peste o pagină de cuvinte', () => {
  const route = code(read('src/app/post/[id].tsx'));
  assert.match(route, /const wordPage = current \? readsAsPage\(current\) : false;/,
    'ruta întreabă exact ce întreabă și canvasul');
  assert.equal((route.match(/accessibilityRole="header"/g) ?? []).length, 1, 'un singur antet în toată ruta');
  assert.match(route, /\{!wordPage \? \([\s\S]{0,120}accessibilityRole="header"/,
    'antetul este legat de paginile care nu au cap propriu');
  assert.match(route, /\{showReaderDoor \? \([\s\S]{0,900}styles\.readerBar/,
    'pagina de cuvinte primește piciorul, nu antetul — iar din runda 32 regula ușii este a modulului');
  // Contorul plimbării a plecat din rută: singurul număr este folio-ul paginii.
  assert.doesNotMatch(route, /styles\.headerCount/);
  assert.doesNotMatch(route, /\$\{at \+ 1\}/, 'ruta nu mai numără postările plimbării');
  assert.doesNotMatch(route, /counterSize/, 'nici stilul contorului nu mai există');
});

test('pagina este măsurată cu banda piciorului înainte de a fi desenată', () => {
  const route = code(read('src/app/post/[id].tsx'));
  assert.match(route,
    /readsAsPage\(entry\) \? readerPageTopInset\(insets\.top\) : postPageTopInset\(insets\.top\)/,
    'pagina de cuvinte pornește de sub ceas; o poză, de sub antet');
  assert.match(route, /if \(!readsAsPage\(entry\)\) return insets\.bottom;/,
    'o poză cedează doar bara de gesturi');
  assert.match(route, /profileOrigin \? profileReaderBottomInset\(insets\.bottom\) : readerBarHeight\(insets\.bottom\);/,
    'pagina de cuvinte din profil cedează hârtia ușii; cea deschisă altundeva păstrează banda ușii');
  assert.match(route, /topInset=\{topInsetFor\(entry\)\}[\s\S]{0,80}bottomInset=\{bottomInsetFor\(entry\)\}/,
    'aceleași numere ajung la compoziție');
  assert.match(route, /height: readerBarHeight\(insets\.bottom\)[\s\S]{0,120}paddingLeft: READER_BAR\.inline/,
    'banda desenată este exact banda rezervată');
  const canvas = code(read('src/components/PostCanvas.tsx'));
  assert.match(canvas, /paddingBottom: metrics\.padB \+ bottomInset/, 'cuvintele se opresc deasupra benzii');
  const card = code(read('src/components/PostCard.tsx'));
  assert.match(card, /bottom=\{RAIL_FOOT \+ bottomInset\}/, 'bara de acțiuni urcă peste bandă, nu în ea');
});

test('ușa din picior este aceeași ieșire pe care o apăsa antetul', () => {
  const route = code(read('src/app/post/[id].tsx'));
  assert.equal((route.match(/onPress=\{close\}/g) ?? []).length, 2, 'antetul și piciorul apasă aceeași funcție');
  assert.match(route, /if \(router\.canGoBack\(\)\) \{ router\.back\(\); return; \}/);
  assert.match(route, /if \(handle\) \{ router\.replace\(\{ pathname: '\/profile\/\[handle\]', params: \{ handle \} \}\); return; \}/);
  assert.match(route, /readerDoor: \{ width: READER_BAR\.button, height: READER_BAR\.button/,
    'ușa din picior păstrează ținta de 44dp');
});

test('pagerul paginii urmează numărul, iar numărul este o singură funcție', () => {
  const reading = code(read('src/components/PostReading.tsx'));
  assert.match(reading, /\{folioLabel\(current, total\)\}/, 'folio-ul paginii citite');
  assert.doesNotMatch(reading, /`\$\{current \+ 1\}\/\$\{total\}`/, 'nu se compune al doilea număr în altă parte');
  assert.match(reading, /const pagerRef = useRef<ScrollView>\(null\);/);
  assert.match(reading, /ref=\{pagerRef\}/);
  assert.match(reading, /if \(page <= total - 1\) return;\s*setPage\(Math\.max\(0, total - 1\)\);/,
    'un articol re-liniat nu lasă cititorul pe o pagină care nu mai există');
  assert.match(reading, /pagerRef\.current\?\.scrollTo\(\{ x: index \* box\.width, animated: false \}\);/);
  assert.match(reading, /\}, \[total, box\.width\]\);/,
    'offsetul se re-issuează numai când se schimbă numărul de pagini, nu la fiecare deget');

  const editorial = code(read('src/components/EditorialPage.tsx'));
  assert.match(editorial, /\{folioLabel\(current, total\)\}/, 'compozitorul tipărește același folio');
  assert.doesNotMatch(editorial, /`\$\{current \+ 1\}\/\$\{total\}`/);
  assert.match(editorial, /if \(page <= total - 1\) return;/);
  assert.match(editorial, /scrollToOffset\(\{ offset: \(total - 1\) \* width, animated: false \}\)/);

  assert.equal(page.folioLabel(0, 3), '1/3');
  assert.equal(page.folioLabel(1, 3), '2/3');
  assert.equal(page.folioLabel(2, 3), '3/3');
  assert.equal(page.folioLabel(3, 3), '3/3', 'un index rămas în urmă tipărește ultima pagină reală');
  assert.equal(page.folioLabel(0, 1), '', 'o carte nu își numerotează singura pagină');
  assert.equal(page.folioLabel(0, 0), '');
});


/**
 * Runda 32 (owner, 31 octombrie 2026): pagina de cuvinte deschisă **din profil**.
 *
 * Aceeași pagină, alt drum până la ea — și de aceea toate cele trei schimbări atârnă de un singur număr, cel
 * pe care ruta îl știa deja (`profileOrigin`, adică parametrul `profile` trimis de perete):
 *
 *   · ușa din picior pleacă: Back-ul telefonului duce în același profil, cu scroll-ul lui;
 *   · banda ușii se întoarce la hârtie, iar folio-ul coboară în ea (`PROFILE_FOLIO` → `PROFILE_READER_FOOT`);
 *   · butoanele sistemului primesc o placă de argint, fiindcă pe cremă glifele albe nu se văd.
 *
 * Feed-ul, recepția compozitorului, pozele și clipurile rămân exact cum erau: testul verifică și *absența*
 * schimbării, nu doar prezența ei.
 */
const theme = load('src/theme/blackSilver.ts');

test('un text deschis din profil nu mai rezervă banda ușii', () => {
  assert.equal(bar.profileReaderBottomInset(0), bar.PROFILE_READER_FOOT.air, 'rămâne doar aerul hârtiei');
  assert.equal(bar.profileReaderBottomInset(48), 48 + bar.PROFILE_READER_FOOT.air,
    'insetul telefonului este al telefonului și se adaugă, ca peste tot');
  assert.equal(bar.profileReaderBottomInset(-8), bar.PROFILE_READER_FOOT.air, 'un inset absurd nu scurtează piciorul');
  assert.equal(bar.profileReaderBottomInset(Number.NaN), bar.PROFILE_READER_FOOT.air);
  assert.ok(bar.profileReaderBottomInset(48) < bar.readerBarHeight(48), 'piciorul din profil e mai scurt decât cel cu ușă');
  assert.equal(bar.readerBarHeight(48) - bar.profileReaderBottomInset(48), bar.READER_BAR.height - bar.PROFILE_READER_FOOT.air,
    'diferența este banda ușii minus aerul păstrat, nu o cifră inventată');
  assert.ok(bar.PROFILE_READER_FOOT.air > 0 && bar.PROFILE_READER_FOOT.air < bar.READER_BAR.height,
    'aerul rămas e o margine de hârtie, nu o bandă de control');
});

test('ușa din picior rămâne numai acolo unde Back-ul telefonului nu poate duce în profil', () => {
  assert.equal(bar.readerDoorShown({ wordPage: true, profileOrigin: true, canGoBack: true }), false,
    'profil → text: fără disc, Back-ul telefonului face exact același drum');
  assert.equal(bar.readerDoorShown({ wordPage: true, profileOrigin: true, canGoBack: false }), true,
    'link fără istorie: ușa este singura cale spre profil');
  assert.equal(bar.readerDoorShown({ wordPage: true, profileOrigin: false, canGoBack: true }), true,
    'compozitor → text: ușa rămâne, ca în runda 31');
  assert.equal(bar.readerDoorShown({ wordPage: true, profileOrigin: false, canGoBack: false }), true);
  assert.equal(bar.readerDoorShown({ wordPage: false, profileOrigin: true, canGoBack: true }), false,
    'o poză sau un clip nu a avut niciodată ușa din picior');
  assert.equal(bar.readerDoorShown({ wordPage: false, profileOrigin: false, canGoBack: true }), false);
});

test('folio-ul din profil coboară, iar vorbele coboară cu el, fără să-l atingă', () => {
  const own = page.folioRow(false);
  const profile = page.folioRow(true);
  assert.deepEqual(own, { band: page.PAGE_FOLIO.band, inset: page.PAGE_FOLIO.inset },
    'feed-ul și compozitorul își păstrează rândul din runda 31');
  assert.deepEqual(profile, { band: page.PROFILE_FOLIO.band, inset: page.PROFILE_FOLIO.inset });
  assert.ok(profile.inset < own.inset, 'cifrele coboară spre picior');
  assert.ok(own.inset - profile.inset >= 6, 'mutarea se vede: cel puțin 6dp mai jos');
  assert.ok(profile.band < own.band, 'și marginea de sub cuvinte coboară cu ele');
  assert.ok(profile.band >= profile.inset + page.PAGE_FOLIO.size,
    'rândul din profil încape numărul: nicio cifră peste un cuvânt');
  assert.ok(profile.inset > 0, 'și tot nu stă pe muchia hârtiei');
  assert.equal(page.PROFILE_FOLIO.size, undefined, 'tipul folio-ului nu se rescrie: doar rândul se mută');
});

test('runda 32: ruta leagă toate cele trei schimbări de parametrul `profile`', () => {
  const route = code(read('src/app/post/[id].tsx'));
  assert.match(route, /const profileOrigin = handle\.length > 0;\s*const walkMode = profileOrigin;/,
    'profilul este parametrul pe care îl trimite peretele, nu o deducție din stivă');
  assert.match(route, /const folioFor = \(entry: SocialPost\) => folioRow\(readsAsPage\(entry\) && profileOrigin\);/,
    'rândul folio-ului se hotărăște o singură dată, din origine');
  assert.match(route, /folio=\{folioFor\(entry\)\}/, 'și ajunge la pagina desenată');
  assert.match(route, /const showReaderDoor = readerDoorShown\(\{[\s\S]{0,140}canGoBack: router\.canGoBack\(\),/,
    'regula ușii stă în modul, cu istoricul citit de la router');
  assert.match(route, /const systemNavPlate = profileOrigin && wordPage;/, 'placa de argint e a paginii din profil');
  assert.match(route, /\{systemNavPlate \? <SystemNavBand height=\{insets\.bottom\} \/> : null\}/,
    'și se montează cu insetul telefonului, nu cu o cifră a ei');
  assert.equal((route.match(/onPress=\{close\}/g) ?? []).length, 2, 'antetul și ușa apasă aceeași ieșire');
});

test('rândul folio-ului trece prin compoziție până la ambele cititoare', () => {
  const card = code(read('src/components/PostCard.tsx'));
  const canvas = code(read('src/components/PostCanvas.tsx'));
  const article = code(read('src/components/EditorialArticle.tsx'));
  const reading = code(read('src/components/PostReading.tsx'));
  const editorial = code(read('src/components/EditorialPage.tsx'));
  assert.match(card, /folio=\{folio\}/, 'cartea dă compoziției rândul primit');
  assert.equal((canvas.match(/folio=\{folio\}/g) ?? []).length, 2, 'ambele cititoare primesc același rând');
  assert.match(article, /folio=\{folio\}/, 'articolul autorat îl trece mai departe');
  assert.match(reading, /folio \? \{ paddingBottom: folio\.band \} : null/,
    'vorbele se opresc deasupra cifrelor, la rândul primit');
  assert.match(reading, /styles\.folio, folio \? \{ bottom: folio\.inset \} : null/,
    'folio-ul stă la insetul rândului primit');
  assert.match(editorial, /styles\.folio, folio \? \{ bottom: folio\.inset \} : null/,
    'aceeași poziție în pagina autorată');
  assert.match(editorial, /marginBottom: Math\.max\(pageFolioBand\(\), Math\.round\(height \* 0\.064\)\)/,
    'fluxul păstrează marginea din runda 31: numărul se mută, rândurile nu');
});

test('feed-ul și recepția compozitorului nu trimit niciun rând nou', () => {
  const feed = code(read('src/screens/FeedScreen.tsx'));
  assert.match(feed, /<PostCard/);
  assert.doesNotMatch(feed, /folio/, 'feed-ul nu citește rândul: pagina lui rămâne cea din runda 31');
  const composer = code(read('src/app/text.tsx'));
  assert.match(composer, /params: \{ id: String\(result\.id\) \}/,
    'recepția compozitorului nu se declară drept profil');
});


test('bara telefonului primește o placă de argint, și o dă înapoi la plecare', () => {
  const band = code(read('src/components/SystemNavBand.tsx'));
  assert.match(band, /<NavigationBar style="dark" \/>/, 'glifele sistemului în cerneala lui închisă');
  assert.match(band, /backgroundColor: blackSilver\.silver/, 'argintul Mercury, nu o culoare inventată');
  assert.match(band, /height: inset/, 'placa este exact insetul telefonului');
  assert.match(band, /position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 21/,
    'la piciorul ecranului, peste hârtie');
  assert.match(band, /pointerEvents="none"/, 'butoanele sistemului rămân ale sistemului');
  assert.match(band, /Platform\.OS === 'android'/, 'iOS și web nu au ce căuta aici');
  assert.doesNotMatch(band, /useEffect|setBackgroundColor/,
    'starea se dă înapoi prin stack-ul expo la demontare, nu printr-un efect al nostru');
  assert.equal(theme.blackSilver.silver, '#C4C7CB', 'metalul din care e făcută placa');
  assert.ok(theme.contrast(theme.blackSilver.onSilver, theme.blackSilver.silver) >= 4.5,
    'cerneala închisă pe placa de argint, peste minimul unui control');
});

