/* global __dirname */
/**
 * Mercury: un singur metal neutru pentru lucrurile care citeau ca „negru dur".
 *
 * Runda 30 (owner, 30 octombrie 2026) cere trei schimbări și o singură condiție: iconițele implicite ale
 * reacțiilor de pe pagina albă, avatarul implicit și butonul `+` din subsol să treacă pe un argintiu
 * discret. Testul ține tokenul, contrastul măsurat al fiecărei perechi, faptul că Reels rămâne neatins și
 * că pozele reale de profil nu sunt atinse.
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

/** Load a theme module with the tiny `require` graph the modules really use. */
const loaded = new Map();
const loadTheme = (name) => {
  if (loaded.has(name)) return loaded.get(name);
  const shim = { exports: {} };
  new Function('module', 'exports', 'require', code(read(`src/theme/${name}.ts`)))(shim, shim.exports, (request) => {
    const match = request.match(/^\.\/([\w-]+)$/);
    if (!match) throw new Error(`mercury.ts does not import ${request}`);
    return loadTheme(match[1]);
  });
  loaded.set(name, shim.exports);
  return shim.exports;
};
const { mercury, mercuryAvatar, mercuryMarkOn } = loadTheme('mercury');
const { blackSilver } = loadTheme('blackSilver');

/** WCAG 2.1 relative luminance and contrast, the same arithmetic `test-theme-contrast.cjs` uses. */
function luminance(hex) {
  const value = hex.replace('#', '');
  const channel = (index) => {
    const part = parseInt(value.slice(index, index + 2), 16) / 255;
    return part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}
const contrast = (one, other) => {
  const [light, dark] = [luminance(one), luminance(other)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
};

test('există un singur token Mercury, iar baza este argintiul cerut', () => {
  assert.equal(mercury.base, '#A5A5A5', 'valoarea numită de owner');
  for (const key of ['light', 'deep', 'shadow', 'graphite', 'paper']) {
    assert.match(mercury[key], /^#[0-9a-f]{6}$/i, `${key} is a colour`);
  }
  assert.equal(mercury.paper, '#f4efe2', 'hârtia paginilor de cuvinte');
  // Runda 31: două dintre cele cinci valori sunt chiar membre ale paletei, nu o a doua scară de gri.
  assert.equal(mercury.base, blackSilver.muted, 'baza este argintiul discret al paletei');
  assert.equal(mercury.deep, blackSilver.deepMercury, 'umbră metalului este membrul deepMercury');
  assert.equal(mercuryMarkOn('paper'), mercury.deep);
  assert.equal(mercuryMarkOn('night'), mercury.base);
  // Un singur modul: nicio a doua nuanță inventată într-un ecran.
  for (const file of ['src/theme/social.ts', 'src/components/PostRail.tsx', 'src/components/ProfileHeader.tsx', 'src/components/AppNav.tsx']) {
    const source = read(file);
    if (source.includes('A5A5A5')) assert.ok(source.includes('mercury') || source.includes('blackSilver'), `${file} ia argintiul din token`);
  }
});

test('fiecare pereche Mercury trece contrastul pe terenul pe care este desenată', () => {
  const pairs = [
    ['grafit pe metal', mercury.graphite, mercury.base, 4.5],
    ['metalul în umbră pe hârtie', mercury.deep, mercury.paper, 3],
    ['metalul pe câmpul junglei', mercury.base, '#101311', 4.5],
    ['metalul în umbră pe câmp', mercury.deep, '#101311', 4.5],
  ];
  for (const [name, ink, surface, minimum] of pairs) {
    const ratio = contrast(ink, surface);
    assert.ok(ratio >= minimum, `${name}: ${ratio.toFixed(2)}:1 (minim ${minimum}:1)`);
  }
  // Argintiul de bază NU are voie pe glifele desenate pe crem: ar fi o decorație, nu un control.
  assert.ok(contrast(mercury.base, mercury.paper) < 3, 'baza nu se folosește ca glifă pe hârtie');
});

test('avatarul implicit este logo-ul JB cu fructe, iar poza reală rămâne', () => {
  // Runda 31: discul este grafit, ca desenul colorat al logo-ului să se vadă; cerneala rămasă este metalul.
  assert.equal(mercuryAvatar.plate, blackSilver.graphite, 'discul unui profil fără poză este grafit');
  assert.equal(mercuryAvatar.ink, blackSilver.bright, 'cerneala de rezervă rămâne metalul luminat');
  const avatar = read('src/components/BrandAvatar.tsx');
  assert.match(avatar, /<BrandLogo variant="fruit"/, 'fața implicită este chiar logo-ul, nu un desen nou');
  assert.match(avatar, /BRAND_AVATAR_FILL = 0\.82/, 'logo-ul umple 82 % din disc, cu marginea lui cu tot');
  assert.ok(read('src/components/BrandLogo.tsx').includes("require('../../assets/brand/jb-mark-512.png')"),
    'același fișier al mărcii, refolosit');
  const header = read('src/components/ProfileHeader.tsx');
  assert.match(header, /backgroundColor: mercuryAvatar\.plate/, 'discul implicit este al paletei');
  assert.match(header, /: \([\s\S]{0,120}<BrandAvatar size=\{socialTokens\.identity\.avatarSize - 2\}/,
    'capul profilului fără poză poartă logo-ul');
  assert.doesNotMatch(header, /initialsFor\(profile/, 'nu mai există iniţiale pe fața implicită');
  assert.doesNotMatch(header, /backgroundColor: '#090a0c'/, 'nu mai există negru dur sub avatar');
  const editor = read('src/components/ProfileEditSheet.tsx');
  assert.match(editor, /backgroundColor: mercuryAvatar\.plate/, 'și discul din editorul de profil este al paletei');
  assert.match(header, /\{avatar \? \([\s\S]{0,220}<RemoteImageSource source=\{avatar\}/, 'poza încărcată este desenată neschimbată');
  const canvas = read('src/components/PostCanvas.tsx');
  assert.match(canvas, /disc: \{[\s\S]{0,160}backgroundColor: mercuryAvatar\.plate/);
  assert.match(canvas, /<BrandAvatar size=\{head\.disc - 2\}/, 'și cardul din feed poartă logo-ul');
});


test('reacțiile de pe pagina albă trec pe Mercury, iar Reels rămâne neatins', () => {
  const social = read('src/theme/social.ts');
  const material = social.slice(social.indexOf('controls: {'));
  const paper = material.slice(material.indexOf('paper: {'), material.indexOf('night: {'));
  const night = material.slice(material.indexOf('night: {'));

  assert.match(paper, /mark: mercury\.deep/, 'glifele de pe crem poartă metalul în umbră');
  assert.match(night, /mark: blackSilver\.bright/, 'noaptea — și deci un clip, o poză și Reels — poartă metalul luminat');
  // Ușile (Urmărește, Editează profilul) și cifrele își păstrează cerneala: runda atinge doar glifele.
  assert.match(paper, /ink: '#2B3134'/, 'cerneala ușilor rămâne grafit');
  assert.match(paper, /count: '#3B4245'/, 'cifra de sub glifă rămâne lizibilă');

  const rail = read('src/components/PostRail.tsx');
  assert.match(rail, /const markInk = controls\.mark;/, 'coloana ia cerneala de glifă din teren');
  assert.equal((rail.match(/<SolidViewerIcon[^>]*color=\{markInk\}/g) ?? []).length, 4, 'comentariu, salvare, distribuire și discul sonor');
  assert.match(rail, /<ActivityIndicator color=\{markInk\}/, 'un scris în curs folosește aceeași cerneală');

  // Reels: pagina unui clip nu spune niciun teren, deci ia `night` — neatins.
  const reels = read('src/components/ReelsReader.tsx');
  assert.doesNotMatch(reels, /mercury/, 'Reels nu cunoaște Mercury');
  const card = read('src/components/PostCard.tsx');
  assert.match(card, /stage === 'text' \|\| stage === 'article' \? 'paper' : 'night'/,
    'doar pagina de cuvinte este hârtie; restul este noapte');
});

test('butonul + din subsol este argintiu puternic, cu un plus negru mat', () => {
  const social = read('src/theme/social.ts');
  assert.match(social, /createInk: blackSilver\.bright/, 'discul de sub metal este argintiul luminat');
  assert.match(social, /createGlyph: blackSilver\.onBright/, 'plusul este negru mat pe metal');
  assert.match(social, /polish: blackSilverPolish/, 'cele patru opriri vin din paletă');
  const nav = read('src/components/AppNav.tsx');
  assert.match(nav, /color=\{colors\.createGlyph\}/, 'plusul este desenat cu cerneala paletei');
  assert.match(nav, /onPress=\{create \? onOpenCreate : \(\) => onSelect\(slot\)\}/,
    'comportamentul butonului nu s-a schimbat');
  assert.match(nav, /accessibilityLabel=\{counting \?/, 'eticheta de accesibilitate rămâne');
  const stops = read('src/theme/blackSilver.ts').slice(
    read('src/theme/blackSilver.ts').indexOf('blackSilverPolish'),
    read('src/theme/blackSilver.ts').indexOf('BLACK_SILVER_PAIRS'),
  );
  assert.doesNotMatch(stops, /#050608|#000000|#343941/, 'nici o oprire neagră în disc');
  assert.ok(stops.includes('blackSilver.bright') && stops.includes('blackSilver.deepMercury'),
    'discul urcă de la metalul luminat la umbra lui');
});

test('emoji rămân exact aceleași: runda nu atinge nici emoji-urile, nici paleta', () => {
  const types = read('src/lib/socialTypes.ts');
  assert.ok(types.includes("export const REACTION_EMPTY_HEART = '\\u{1F90D}';"), 'inima goală de noapte');
  assert.ok(types.includes("export const REACTION_EMPTY_HEART_ON_PAPER = '\\u{1F5A4}';"), 'inima goală de hârtie');
  const picker = types.slice(types.indexOf('REACTION_PICKER_GLYPHS'), types.indexOf('REACTION_EMPTY_HEART'));
  for (const glyph of ['\\u{1F44D}', '\\u2764\\uFE0F', '\\u{1F602}', '\\u{1F62E}', '\\u{1F622}', '\\u{1F621}', '\\u25C6', '\\u25BC']) {
    assert.ok(picker.includes(glyph), `${glyph} rămâne în paletă`);
  }
  // Paleta și controlul reacției nu cunosc Mercury: un emoji nu se recolorează.
  assert.doesNotMatch(read('src/components/ReactionControl.tsx'), /mercury/);
  assert.doesNotMatch(read('src/components/ReactionPalette.tsx'), /mercury/);
});
