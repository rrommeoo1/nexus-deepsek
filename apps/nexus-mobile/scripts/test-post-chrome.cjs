/* global __dirname */
/**
 * Locul unde nu se calcă: antetul unei postări deschise singură, capul autorului și folio-ul paginii.
 *
 * Runda 30 (owner, 30 octombrie 2026), două reclamații și o cerință:
 *   · butonul Back stătea peste numele profilului, pentru că plutea deasupra paginii;
 *   · un nume lung de locație intra sub butonul Urmărește / Editează profilul;
 *   · numerotarea `1/22` trebuia să ajungă jos, centrat, ca într-o carte.
 * Testul verifică aritmetica (`lib/postChrome.ts`, `lib/textPage.ts`) și faptul că ecranele o folosesc.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8');
const code = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const load = (relative) => {
  const shim = { exports: {} };
  new Function('module', 'exports', 'require', code(read(relative)))(
    shim, shim.exports, () => { throw new Error(`${relative} nu importă nimic la rulare`); },
  );
  return shim.exports;
};

const chrome = load('src/lib/postChrome.ts');
const page = load('src/lib/textPage.ts');

test('antetul are o înălțime rezervată, pe care pagina o respectă', () => {
  assert.equal(chrome.postHeaderHeight(0), chrome.POST_HEADER.height);
  assert.equal(chrome.postHeaderHeight(30), 30 + chrome.POST_HEADER.height, 'insetul se adaugă, nu se contopește');
  assert.equal(chrome.postHeaderHeight(-10), chrome.POST_HEADER.height, 'un inset absurd nu scurtează antetul');
  assert.equal(chrome.postHeaderHeight(NaN), chrome.POST_HEADER.height);
  assert.equal(chrome.postPageTopInset(30), chrome.postHeaderHeight(30),
    'pagina începe exact sub antet, nu peste el');
  assert.ok(chrome.POST_HEADER.button >= 44, 'Back rămâne o țintă de 44dp');
  assert.ok(chrome.POST_HEADER.height >= chrome.POST_HEADER.button, 'antetul încape butonul');
});

test('numele din antet se îngustează după uși, nu după noroc', () => {
  const wide = chrome.postHeaderNameWidth({ width: 393 });
  const narrow = chrome.postHeaderNameWidth({ width: 320 });
  assert.ok(wide > narrow, 'un ecran mai lat lasă mai mult nume');
  assert.ok(wide < 393 - chrome.POST_HEADER.button, 'butonul Back își păstrează locul');
  assert.ok(chrome.postHeaderNameWidth({ width: 393, counter: false }) > wide,
    'fără contor, numele primește locul lui');
  assert.equal(chrome.postHeaderNameWidth({ width: 0 }), 0);
});

test('ușa autorului stă lângă cuvinte doar când încap amândouă', () => {
  const phone = chrome.postHeadArrangement({ width: 393, padding: 14 });
  assert.equal(phone, 'row', 'pe un telefon obișnuit încap numele și Urmărește');
  const narrow = chrome.postHeadArrangement({ width: 250, padding: 14 });
  assert.equal(narrow, 'stack', 'pe un ecran îngust ușa coboară sub cuvinte');
  const scaled = chrome.postHeadArrangement({ width: 393, padding: 14, fontScale: 1.8 });
  assert.equal(scaled, 'stack', 'un font de sistem mare mută ușa jos, fără să atingă cuvintele');
  const wideDoor = chrome.postHeadArrangement({ width: 393, padding: 14, actionWidth: 260 });
  assert.equal(wideDoor, 'stack', 'o ușă lată (Editează profilul) nu fură din nume');
  const measured = chrome.postHeadArrangement({ width: 0, padding: 14 });
  assert.equal(measured, 'stack', 'fără măsurătoare, varianta sigură');
  assert.ok(chrome.POST_HEAD.locationLines >= 2, 'o locație are voie la două rânduri');
});


test('canvasul pune locația pe rândul ei și ține ușa într-o coloană care nu se micșorează', () => {
  const canvas = read('src/components/PostCanvas.tsx');
  assert.match(canvas, /import \{ POST_HEAD, postHeadArrangement \} from '\.\.\/lib\/postChrome';/);
  assert.match(canvas, /const headArrangement = useMemo\([\s\S]{0,240}postHeadArrangement\(\{[\s\S]{0,200}width: width \|\| viewport\.width,[\s\S]{0,200}padding: metrics\.padH,[\s\S]{0,200}fontScale: viewport\.fontScale/,
    'aranjamentul se măsoară, nu se ghicește');
  // Locația nu mai face parte din rândul @handle · dată.
  assert.match(canvas, /\{\[`@\$\{handle\}`, stamp\]\.filter\(Boolean\)\.join\(' · '\)\}/,
    'rândul de sub nume este handle + dată');
  assert.match(canvas, /numberOfLines=\{POST_HEAD\.locationLines\}/, 'locația se rupe natural pe două rânduri');
  assert.match(canvas, /const authorWithDoor = modeToggle \|\| authorAction \? \(/, 'ușa are un singur loc, într-un singur loc din cod');
  assert.match(canvas, /headArrangement === 'stack' && styles\.authorLineStack/);
  assert.match(canvas, /styles\.authorDoor, styles\.headControls, headArrangement === 'stack' && styles\.authorDoorStack/,
    'comutatorul și ușa stau în același grup, care coboară împreună pe rândul doi (runda 46)');
  // Tiparul celor două coloane: cuvintele primesc tot ce rămâne, ușa nu se strânge.
  assert.match(canvas, /authorBlock: \{ flexGrow: 1, flexShrink: 1, minWidth: 0 \}/);
  assert.match(canvas, /authorDoor: \{ flexShrink: 0, alignSelf: 'flex-start', marginTop: POST_HEAD\.actionTop \}/);
  assert.match(canvas, /location: \{ color: editorial\.inkMuted, letterSpacing: 0\.2, marginTop: POST_HEAD\.locationGap \}/);
  // Ambele capete (poza și pagina de cuvinte) desenează același bloc.
  assert.equal((canvas.match(/\{authorWithDoor\}/g) ?? []).length, 2, 'capul unei poze și capul unei pagini');
});

test('ruta unei postări are un antet adevărat, iar Back nu mai stă peste nume', () => {
  const route = read('src/app/post/[id].tsx');
  assert.match(route, /import \{ POST_HEADER, postHeaderHeight, postPageTopInset \} from '\.\.\/\.\.\/lib\/postChrome';/);
  assert.match(route, /topInset=\{topInsetFor\(entry\)\}/, 'pagina începe sub antetul care o acoperă');
  /**
   * Runda 41: un reel deschis din profil își tipărește propriul cap (`layout="post"`), deci antetul rutei
   * nu se mai desenează peste el — exact regula pe care runda 31 a dat-o paginii de cuvinte. Numerele
   * rămân aceleași: o pagină cu cap începe în banda notificărilor, una fără cap (un citat) sub antet.
   */
  assert.match(route, /const ownsHead = \(entry: SocialPost\) => readsAsPage\(entry\) \|\| \(hasVisualMedia\(entry\) && !isAuthoredArticle\(entry\)\)/,
    'o pagină care își tipărește capul nu primește un al doilea antet');
  assert.match(route, /ownsHead\(entry\) \? readerPageTopInset\(insets\.top\) : postPageTopInset\(insets\.top\)/,
    'aceleași numere pe care antetul le ocupă, alese după felul paginii');
  assert.match(route, /\{!pageOwnHead \? \(/, 'antetul rutei se desenează doar peste o pagină fără cap');
  assert.match(route, /layout="post"/, 'un reel deschis din profil se citește cu capul sus, ca o pagină de cuvinte');
  assert.match(route, /const systemNavPlate = profileOrigin;/, 'footerul gri (placa de metal) stă sub orice pagină din profil');
  assert.match(route, /height: postHeaderHeight\(insets\.top\)/, 'antetul își rezervă exact înălțimea');
  assert.match(route, /accessibilityRole="header"/, 'antetul este un antet pentru cititorul de ecran');
  assert.match(route, /styles\.headerWords\}>[\s\S]{0,300}numberOfLines=\{1\}/, 'numele se taie la un rând');
  assert.match(route, /back: \{ width: POST_HEADER\.button, height: POST_HEADER\.button/, 'Back rămâne 44×44');
  // Comportamentul de navigare: istoricul întâi, apoi profilul de origine, apoi feedul.
  assert.match(route, /if \(router\.canGoBack\(\)\) \{ router\.back\(\); return; \}/);
  assert.match(route, /if \(handle\) \{ router\.replace\(\{ pathname: '\/profile\/\[handle\]', params: \{ handle \} \}\); return; \}/,
    'fără istoric, Back duce la profilul de origine, nu la feed');
  // Contorul plimbării a intrat în antet; nu mai plutește în mijlocul paginii.
  assert.doesNotMatch(route, /top: insets\.top \+ 14/, 'nu mai există un contor plutitor peste nume');
  assert.doesNotMatch(route, /top: insets\.top \+ 8/, 'nu mai există un Back plutitor peste pagină');
  // Runda 31 (owner, 31 octombrie 2026): contorul plimbării a plecat din rută cu totul.
  assert.doesNotMatch(route, /styles\.headerCount/, 'ruta nu mai tipărește un contor de postări');
  assert.doesNotMatch(route, /\$\{at \+ 1\}\/\$\{list\.length\}/, 'nu mai există `1/22` lângă un folio de `1/3`');
});

test('folio-ul stă jos, centrat, și are un rând al lui în pagină', () => {
  assert.ok(page.PAGE_FOLIO.band >= page.PAGE_FOLIO.inset + page.PAGE_FOLIO.size,
    'banda folio-ului încape numărul');
  assert.equal(page.pageFolioBand(), page.PAGE_FOLIO.band);
  assert.equal(page.pageFolioBand(false), 0);
  assert.equal(page.pageFolioPadding, undefined, 'o singură sursă pentru bandă, nu două');

  /** Cerneala folio-ului, compusă peste hârtie, trebuie să rămână lizibilă (4,5:1 pentru text mic). */
  const ink = [0x1a, 0x22, 0x1b];
  const paper = [0xf4, 0xef, 0xe2];
  const blended = ink.map((value, index) => Math.round(value * page.PAGE_FOLIO.ink + paper[index] * (1 - page.PAGE_FOLIO.ink)));
  const luminance = (rgb) => {
    const channel = (value) => {
      const part = value / 255;
      return part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
  };
  const ratio = (luminance(paper) + 0.05) / (luminance(blended) + 0.05);
  assert.ok(ratio >= 4.5, `folio lizibil pe hârtie: ${ratio.toFixed(2)}:1`);
  assert.ok(page.PAGE_FOLIO.ink < 1, 'și totuși secundar: nu tipărește la fel de tare ca vorbele');

  const editorial = read('src/components/EditorialPage.tsx');
  assert.match(editorial, /marginBottom: Math\.max\(pageFolioBand\(\), Math\.round\(height \* 0\.064\)\)/,
    'fluxul primește banda folio-ului ca margine de jos');
  assert.match(editorial, /folio: \{ position: 'absolute', left: 0, right: 0, bottom: PAGE_FOLIO\.inset, alignItems: 'center' \}/,
    'numerotarea este centrată pe lățimea paginii');
  assert.match(editorial, /fontFamily: editorialType\.serif/);
  assert.doesNotMatch(editorial, /backgroundColor: 'rgba\(8,10,13,0\.72\)'/, 'nu mai există chip negru în colț');
  assert.doesNotMatch(editorial, /style=\{styles\.badge\}/, 'vechiul badge din colț a plecat');

  const reading = read('src/components/PostReading.tsx');
  assert.match(reading, /paddingBottom: PAGE_FOLIO\.band/, 'cuvintele se opresc deasupra numărului');
  assert.match(reading, /folio: \{ position: 'absolute', left: 0, right: 0, bottom: PAGE_FOLIO\.inset, alignItems: 'center' \}/);
  assert.match(reading, /folioText: \{\s*fontFamily: editorialType\.serif/);
  assert.match(reading, /fontVariant: \['tabular-nums'\]/, 'cifrele nu sar când se schimbă pagina');
  assert.match(reading, /\{folioLabel\(current, total\)\}/, 'numărul este al paginii, dintr-o singură funcție');
  assert.match(read('src/components/EditorialPage.tsx'), /\{folioLabel\(current, total\)\}/,
    'compozitorul tipărește același folio, din aceeași funcție');
  assert.equal(page.folioLabel(0, 3), '1/3');
  assert.equal(page.folioLabel(2, 3), '3/3');
  assert.equal(page.folioLabel(9, 3), '3/3', 'un index rămas în urmă tipărește ultima pagină reală');
  assert.equal(page.folioLabel(0, 1), '', 'o singură pagină nu se numerotează');

  /** Același folio, în feed și în postarea deschisă din profil: o singură compoziție le desenează. */
  for (const source of [read('src/screens/FeedScreen.tsx'), read('src/app/post/[id].tsx')]) {
    assert.match(source, /<PostCard/, 'ambele contexte montează aceeași pagină');
  }
  assert.match(read('src/components/PostCard.tsx'), /<PostCanvas/, 'iar pagina este compoziția universală');
});

test('traducerea cerută rămâne o acțiune reală a paginii', () => {
  const canvas = read('src/components/PostCanvas.tsx');
  assert.match(canvas, /const readerLanguage = useActiveLanguage\(\);/);
  assert.match(canvas, /const translation = onTranslate && translationForPost\(post, readerLanguage\) \? onTranslate : undefined;/);
  assert.match(canvas, /function useActiveLanguage\(\): string \{\s*return useSyncExternalStore\(subscribeReaderLanguage, activeLanguage, activeLanguage\);/,
    'limba activă este abonată, deci decizia se recalculează când se schimbă limba');
  assert.equal((canvas.match(/onPress=\{translation\}/g) ?? []).length, 3,
    'toate cele trei locuri în care poarta apare rămân apăsări reale');
  const card = read('src/components/PostCard.tsx');
  /**
   * Runda 42: propozitia care spune ca traducerea lipseste din acest build a plecat din `useState`-ul
   * paginii in registrul comun. Ce apara testul ramane acelasi lucru: poarta este legata, iar lipsa unei
   * traduceri este o *informare*, nu o eroare (`engagement.inform`, nu `fail`).
   */
  assert.match(card, /onTranslate=\{\(\) => engagement\.inform\('Traducerea/,
    'traducerea existenta este inca legata, ca informare');
  assert.match(card, /noticeTone=\{notice\?\.tone\}/, 'propozitia isi pastreaza tonul');

});
