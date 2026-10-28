/* global __dirname */
// Al patrulea val (20 octombrie 2026), pe cuvantul ownerului: „vreau sa faci footer ul sa nu mia dispara
// la scroll..va ramane permananet". Bara de jos nu mai fuge, deci nici pagina nu mai are ce urmari.
//
// Trei reguli se verifica aici, pe sursa, fiindca toate trei sunt reguli de compozitie:
//
//   permanenta  bara sta in shell o data, nemiscata: fara `transform`, fara stare ascunsa, fara ceas;
//   banda       fiecare pagina care deruleaza rezerva inaltimea barei la picior (`useNavReserve`), iar
//               feedul, care este paginat, o masoara cu aceeasi functie (`appNavHeight`);
//   golul       mecanicile vechiului gol (coborarea piciorului, banda eliberata) nu mai exista nici in
//               cod, nici in fisiere: `lib/feedFoot.ts` a fost sters, iar niciun nume din el nu a ramas.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync, readdirSync, statSync } = require('node:fs');
const { resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8');
/** Sursa fara proza ei: un comentariu care numeste ce s-a scos nu este un control. */
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const shell = code(read('src/app/index.tsx'));
const feed = code(read('src/screens/FeedScreen.tsx'));
const canvas = code(read('src/components/PostCanvas.tsx'));
const nav = code(read('src/components/AppNav.tsx'));

function sources(dir = 'src') {
  const out = [];
  for (const entry of readdirSync(resolve(ROOT, dir))) {
    const relative = `${dir}/${entry}`;
    const stat = statSync(resolve(ROOT, relative));
    if (stat.isDirectory()) out.push(...sources(relative));
    else if (/\.tsx?$/.test(entry)) out.push(relative);
  }
  return out;
}

test('bara sta in shell o singura data si nu se mai misca', () => {
  assert.match(shell, /<View style=\{styles\.navOverlay\}>\s*<AppNav/, 'bara este montata o data, in shell');
  assert.match(shell, /navOverlay: \{ position: 'absolute', left: 0, right: 0, bottom: 0 \}/, 'bara este lipita de piciorul ecranului');
  assert.doesNotMatch(shell, /navHidden|chromeHidden|Animated|translateY|CHROME_SLIDE_MS/, 'nimic nu mai ascunde sau misca bara');
  assert.doesNotMatch(nav, /Animated/, 'bara insasi nu are animatie');
});

test('feedul nu mai primeste starea barei: nu are ce urmari', () => {
  assert.match(shell, /<FeedScreen \/>/, 'shell-ul cheama feedul fara props');
  assert.match(feed, /export function FeedScreen\(\) \{/, 'feedul nu are props');
  assert.doesNotMatch(feed, /onBrowse|chromeHidden|footShift|bottomShift/, 'feedul nu mai raspunde la bara');
});

test('fiecare pagina care deruleaza rezerva banda barei', () => {
  const pages = [
    ['src/screens/SearchScreen.tsx', 24],
    ['src/app/tag/[tag].tsx', 28],
    ['src/screens/FriendsScreen.tsx', 10],
    ['src/screens/LiveScreen.tsx', 14],
    ['src/screens/ProfileScreen.tsx', 18],
    ['src/screens/MessagesScreen.tsx', 16],
  ];
  for (const [file, room] of pages) {
    const source = code(read(file));
    assert.match(source, /const navReserve = useNavReserve\(\);/, `${file}: pagina isi masoara banda`);
    assert.match(
      source,
      new RegExp(`paddingBottom: navReserve \\+ ${room}`),
      `${file}: ultimul rand se opreste deasupra barei, cu respiratia lui`,
    );
  }
  assert.match(nav, /export function useNavReserve\(\): number \{/, 'banda are un singur punct de masura, in bara');
  assert.match(nav, /return appNavHeight\(insets\.bottom\);/, 'hook-ul citeste aceeasi functie ca bara');
});

test('inboxul isi ridica si composerul deasupra barei', () => {
  const messages = code(read('src/screens/MessagesScreen.tsx'));
  assert.match(messages, /<View style=\{\[styles\.composer, \{ paddingBottom: 10 \+ navReserve \}\]\}>/, 'composerul nu sta sub sticla');
  assert.match(messages, /composer: \{[^}]*paddingTop: 10, paddingHorizontal: 10/, 'padding-ul composerului este sus si lateral');
});

test('feedul paginat masoara aceeasi banda, nu o copiaza', () => {
  assert.match(feed, /const navReserve = appNavHeight\(insets\.bottom\);/, 'feedul citeste functia barei');
  assert.match(feed, /<ReelPage[\s\S]{0,400}?overlayBottom=\{navReserve\}/, 'poza si clipul isi tin rail-ul deasupra barei');
  assert.match(feed, /<PostCard[\s\S]{0,400}?bottomInset=\{navReserve\}/, 'pagina de cuvinte isi opreste textul deasupra barei');
  assert.match(feed, /height: pageHeight/, 'pagina ramane inaltimea viewportului: nimic nu se redimensioneaza');
});

test('golul vechiului footer nu mai exista nicaieri', () => {
  assert.equal(existsSync(resolve(ROOT, 'src/lib/feedFoot.ts')), false, 'lib/feedFoot.ts a fost sters');
  for (const file of sources()) {
    const source = code(read(file));
    assert.doesNotMatch(source, /feedFoot|footTravel|footShift|bottomShift|FOOT_CLEARANCE/, `${file}: nicio urma a coborarii`);
  }
});

test('cuvintele unui post de text cresc intr-o padure, nu pe un perete negru', () => {
  const grove = read('src/components/JungleGrove.tsx');
  assert.match(grove, /export const JungleGrove = memo\(/, 'o singura pictura pe pagina, memoizata');
  assert.match(grove, /pointerEvents="none"/, 'padurea nu opreste niciun gest');
  assert.match(grove, /accessible=\{false\}/, 'padurea nu este citita de un cititor de ecran');
  assert.doesNotMatch(grove, /useState|useEffect|setInterval|Animated|Easing/, 'fara stare, fara efect, fara animatie');
  assert.match(grove, /preserveAspectRatio="xMidYMid slice"/, 'desenul umple cadrul oricare ar fi raportul');
  /** Imaginea ceruta pe 20 octombrie seara: bolovan sub muschi, orhidee in colturile de jos, soare prin coronament. */
  assert.match(grove, /id=\{`\$\{id\}-rock`\}/, 'bolovanul are stratul lui');
  assert.match(grove, /id=\{`\$\{id\}-carpet`\}/, 'muschiul de pe bolovan are stratul lui');
  assert.match(grove, /id=\{`\$\{id\}-shaft`\}/, 'lumina se strecoara prin coronament');
  const bloomTable = /const BLOOMS = \[([\s\S]*?)\n\];/.exec(grove);
  assert.ok(bloomTable, 'orhideele sunt o tabela, nu forme imprastiate prin desen');
  const bloomX = [...bloomTable[1].matchAll(/x: (\d+)/g)].map((match) => Number(match[1]));
  assert.ok(bloomX.some((x) => x < 90) && bloomX.some((x) => x > 200), 'orhidee pe ambele laturi');
  /** Coloana 230..300 e a barei laterale: o violeta sub un semn de carte ar fi o greseala, nu un cadru. */
  assert.ok(bloomX.every((x) => x < 230 || x > 300), 'nicio orhidee in coloana barei laterale');
  assert.ok(grove.indexOf('`url(#${id}-well)`') > grove.indexOf('BLOOMS.map'), 'voalul se asaza peste orhidee');
  /** Verdetul ramane stins: nicio opacitate peste jumatate intr-un strat al padurii. */
  const stops = [...grove.matchAll(/stopOpacity=\{([\d.]+)\}/g)].map((match) => Number(match[1]));
  assert.ok(stops.length >= 6, 'gradientele isi declara opacitatile');
  for (const opacity of stops) assert.ok(opacity <= 0.5, `${opacity} ramane sub jumatate`);
});

test('padurea sta sub cuvinte si numai pe o pagina fara fotografie de fundal', () => {
  /** Un singur desen pe pagina, si acela in ramura fara media de fundal, inaintea voalului. */
  const open = canvas.indexOf("{!hasMedia || stage === 'article' ? (");
  const grove = canvas.indexOf('<JungleGrove');
  assert.ok(open > -1, 'postul de text are ramura lui de compozitie');
  assert.equal(canvas.indexOf('<JungleGrove', grove + 1), -1, 'desenul apare o singura data');
  assert.ok(grove > open, 'desenul este in ramura de text');
  assert.ok(canvas.indexOf('nxCanvasVeil', open) > grove, 'voalul se aseaza peste padure, nu sub ea');
  assert.match(canvas, /<JungleGrove seed=\{String\(post\.id\)\} dim=\{statement \? 0\.28 : 0\.36\}/, 'estomparea este o decizie de compozitie');
  assert.match(canvas, /opacity=\{pagePalette \? 0 : hasMedia \? 1 : 0\.4\}/, 'voalul nu se aseaza peste hartie');
  /**
   * O pagina de cuvinte este *intotdeauna* o pagina (regula ownerului, 27 octombrie 2026): stilul
   * autorului cand randul are unul citibil, hartia implicita cand nu are niciunul. Asa celula peretelui si
   * pagina pe care o deschide nu mai pot fi doua hartii diferite. Un cadru care nu este pagina (un citat, o
   * postare fara text) ramane compozitia cititorului, cu padurea ei.
   *
   * Culorile nu mai vin din tema randului: `pagePaletteOf` da hartia si cerneala produsului pentru orice
   * tema, iar tema ramane doar accentul (un fir, un cadru de chip). Articolul cu fotografie pastreaza
   * aceeasi ramura: pagina este hartie, fotografia este un bloc in lectura.
   */
  assert.match(canvas, /const authored = stage === 'text' \|\| stage === 'article' \? textStyleForPost\(post\.text_style\) : null/, 'stilul se citeste tolerant pe pagina de text si pe articolul cu poze');
  assert.match(canvas, /const pageStyle = stage === 'text' \|\| stage === 'article' \? pageStyleForPost\(post\.text_style\) : null/, 'o pagina de cuvinte este intotdeauna o pagina');
  assert.match(canvas, /const pagePalette = pageStyle \? pagePaletteOf\(pageStyle\) : null/, 'hartia paginii vine din paleta paginii, nu din tema randului');
  assert.match(canvas, /backgroundColor: pagePalette\.background/, 'hartia paginii picteaza tot cadrul');
  assert.match(canvas, /const pageInk = pagePalette \? \{ color: pagePalette\.text \} : null/, 'numele autorului se scrie cu cerneala paginii, nu cu alb');
  assert.ok(canvas.indexOf('pagePalette ? (') > open, 'pagina are ramura ei, in interiorul ramurii de text');
  for (const file of ['src/components/PostMedia.tsx', 'src/components/ReelsReader.tsx', 'src/components/StoryViewer.tsx']) {
    assert.doesNotMatch(code(read(file)), /JungleGrove/, `${file} deseneaza media si ramane negru`);
  }
});

test('discul de creare este platină, nu cerneală', () => {
  const tokens = read('src/theme/social.ts');
  /**
   * Runda 31 (owner, 31 octombrie 2026): discul este acum argintul *luminat* al paletei — patru opriri
   * care urcă de la `bright` la umbra metalului, fără nici un negru. Semnul `+` este negru mat.
   */
  assert.match(tokens, /polish: blackSilverPolish/, 'gradientul discului vine din paletă');
  const palette = read('src/theme/blackSilver.ts');
  const stops = palette.slice(palette.indexOf('blackSilverPolish'), palette.indexOf('BLACK_SILVER_PAIRS'));
  for (const member of ['bright', 'silver', 'muted', 'deepMercury']) {
    assert.ok(stops.includes(`blackSilver.${member}`), `discul are oprirea ${member}`);
  }
  const discBlock = tokens.slice(tokens.indexOf('create: {'), tokens.indexOf('/** Where the light strikes'));
  assert.doesNotMatch(discBlock, /#050608|#343941|#d8dce1/, 'discul nu mai are nicio oprire neagră');
  assert.match(tokens, /polishCenter: \{ x: '35%', y: '28%' \}/, 'lumina cade din stanga sus');
  assert.match(nav, /const disc = socialTokens\.nav\.create;/, 'bara isi ia platina din token');
  assert.match(nav, /\{disc\.polish\.map\(\(stop\) => \(/, 'fiecare oprire a gradientului este desenata');
  assert.match(nav, /id="nxCreatePolish"/, 'discul are un strat propriu, sub glif');
  assert.match(nav, /styles\.createDisc/, 'discul are un stil al lui, nu un fundal de pin');
});

