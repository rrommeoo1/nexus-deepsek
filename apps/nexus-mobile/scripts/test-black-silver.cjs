#!/usr/bin/env node
/* global __dirname */
/**
 * Round 31 — Matte Black + Silver, and nothing else.
 *
 * The owner, 31 October 2026: „identitatea vizuală este încă inconsistentă… vreau MATTE BLACK + SILVER
 * peste tot". This suite is the contract of that round, and it holds four things at once:
 *
 *   1. the palette — the eight values, the inks that sit on the metal, and every contrast pair;
 *   2. the modules that must read it — `jungle`, `editorial`, `social` — so no screen can keep a private
 *      green, teal or yellow, and the cream reading page stays exactly as it was;
 *   3. a **static audit of the whole source tree**: every green/teal/yellow literal that is still painted
 *      has to be on the documented exception list (semantics, the fruit artwork, the writer's page
 *      themes, the legacy web transcription), and every exception is justified in this file;
 *   4. the visible defects the owner named — the black heart, the green relationship buttons, the
 *      initials instead of the fruit logo, the yellow profile tab, the dull `+`, the green footer.
 *
 * Usage: node scripts/test-black-silver.cjs
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync, statSync } = require('node:fs');
const { resolve, join, relative } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const read = (relativePath) => readFileSync(resolve(ROOT, relativePath), 'utf8');
const code = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

/** Load a theme module with the tiny `require` graph the modules really use. */
const loaded = new Map();
const load = (name) => {
  if (loaded.has(name)) return loaded.get(name);
  const shim = { exports: {} };
  new Function('module', 'exports', 'require', code(read(`src/theme/${name}.ts`)))(shim, shim.exports, (request) => {
    /** `editorial.ts` asks React Native for a font stack; that is the only bare import in the theme. */
    if (request === 'react-native') {
      return { Platform: { select: (options) => options.android ?? options.default } };
    }
    const match = request.match(/^\.\/([\w-]+)$/);
    if (!match) throw new Error(`${name}.ts does not import ${request}`);
    return load(match[1]);
  });
  loaded.set(name, shim.exports);
  return shim.exports;
};

const { blackSilver, blackSilverPolish, BLACK_SILVER_PAIRS, contrast } = load('blackSilver');
const { jungle } = load('jungle');

test('paleta este exact cea cerută, iar fiecare pereche își ține contrastul', () => {
  const wanted = {
    matteBlack: '#101113', deepBlack: '#090A0B', graphite: '#1C1E20', elevated: '#242629',
    silver: '#C4C7CB', bright: '#E1E3E5', deepMercury: '#7C8083', muted: '#A5A5A5',
  };
  for (const [key, value] of Object.entries(wanted)) {
    assert.equal(blackSilver[key].toUpperCase(), value, `${key} este valoarea ownerului`);
  }
  for (const [key, value] of Object.entries(blackSilver)) {
    if (typeof value !== 'string') continue;
    assert.match(value, /^(#[0-9a-f]{6}|rgba\(\d+,\d+,\d+,[\d.]+\))$/i, `${key} este o culoare`);
  }
  assert.equal(blackSilver.onSilver, blackSilver.matteBlack, 'textul de pe metal este negru mat');
  assert.equal(blackSilver.onBright, blackSilver.deepBlack, 'textul de pe metalul luminat este negrul de jos');
  assert.equal(blackSilverPolish.length, 4, 'discul are patru opriri');
  assert.equal(blackSilverPolish[0].color, blackSilver.bright, 'lumina cade pe metalul luminat');
  assert.equal(blackSilverPolish[3].color, blackSilver.deepMercury, 'iar piciorul rămâne metal, nu negru');

  for (const pair of BLACK_SILVER_PAIRS) {
    const ratio = contrast(pair.ink, pair.surface);
    assert.ok(ratio >= pair.minimum, `${pair.name}: ${ratio.toFixed(2)}:1 (minim ${pair.minimum}:1)`);
  }
});

test('modulele vechi citesc din paletă: nici un ecran nu mai are verdele lui', () => {
  assert.equal(jungle.canvas, blackSilver.matteBlack, 'câmpul este negru mat');
  assert.equal(jungle.surface, blackSilver.graphite);
  assert.equal(jungle.surfaceRaised, blackSilver.elevated);
  assert.equal(jungle.primary, blackSilver.silver, 'acțiunea principală este argintul');
  assert.equal(jungle.navActive, blackSilver.bright, 'tab-ul deschis este argintul luminat (nu banana)');
  assert.equal(jungle.navIdle, blackSilver.muted, 'tab-ul închis este argintul discret');
  assert.equal(editorial.field, blackSilver.matteBlack);
  assert.equal(editorial.ink, blackSilver.text);
  assert.equal(editorial.leaf, blackSilver.silver, 'accentul editorial este metalul');

  const social = read('src/theme/social.ts');
  assert.match(social, /import \{ blackSilver, blackSilverPolish \} from '\.\/blackSilver';/,
    'shell-ul Social ia paleta dintr-un singur loc');
  assert.equal(socialTokens.colors.screen, blackSilver.matteBlack);
  assert.equal(socialTokens.colors.createInk, blackSilver.bright, 'plusul stă pe argint luminat');
  assert.equal(socialTokens.colors.createGlyph, blackSilver.onBright, 'iar semnul lui este negru mat');
  assert.equal(socialTokens.post.controls.night.mark, blackSilver.bright, 'cele patru semne de noapte sunt argintii');
  assert.equal(socialTokens.relations.accent, blackSilver.silver, 'butoanele de relație sunt metalul');
  assert.equal(socialTokens.relations.accentInk, blackSilver.onSilver, 'cu text negru mat');
  assert.equal(socialTokens.identity.storyRingUnseen, blackSilver.bright, 'inelul de story necitit este metalul');
  for (const stop of socialTokens.nav.fill) {
    assert.match(stop.color, /^#[0-9a-f]{6}$/i, `oprirea ${stop.offset} este opacă`);
  }
  assert.equal(socialTokens.nav.fill[0].color, blackSilver.matteBlack);
  assert.equal(socialTokens.nav.fill[2].color, blackSilver.deepBlack);
});

test('hârtia de citit rămâne hârtie: crem, cerneală caldă, teme de pagină neatinse', () => {
  assert.equal(socialTokens.reading.page, '#f4efe2', 'pagina de cuvinte este tot crem');
  assert.equal(socialTokens.reading.ink, '#1a221b', 'cu cerneala ei caldă');
  const style = read('src/lib/textStyle.ts');
  assert.ok(style.includes("id: 'paper', label: 'Hârtie', background: '#f4efe2', text: '#1a221b'"),
    'tema Hârtie a scriitorului este neatinsă');
  assert.ok(style.includes('export const TEXT_THEMES'), 'temele de pagină există în continuare');
});

const { editorial } = load('editorial');

test('audit static: nici un verde, teal sau galben nedocumentat în cod', () => {
  /**
   * The documented exceptions. Every entry names *why* that literal is allowed to stay, and the test
   * fails if a file that is not listed here paints one:
   *
   *   textStyle.ts      the six page themes a *writer* chooses (`Jungle`, `Moss`, `Hârtie`, …). They are
   *                     content, not chrome: a published post stores its theme, and repainting it would
   *                     change posts that already exist.
   *   jungle.ts         `FRUIT` — the measured pigments of the JB artwork the owner asked to preserve.
   *   blackSilver.ts    `success` / `warning`: a presence dot and a warning are meaning, not branding.
   *   social.ts         the same two semantic values, under the names the profile header reads.
   *   webTokens.ts      a historical transcription of the web CSS variables; nothing imports it.
   */
  const exceptions = {
    'src/lib/textStyle.ts': '#0b1f16 #c9a227 #2f5d45 #16301f #9ccb6e',
    'src/theme/jungle.ts': '#f5d33c #f59b2e #f57a4a #8bd04a #2f9e5a #d63357 #5a50b4 #9a42b0',
    'src/theme/blackSilver.ts': '#39e58e #ffd166',
    'src/theme/social.ts': '#39e58e #ffd166',
    'src/theme/webTokens.ts': '*',
  };

  const walk = (dir, out = []) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
    }
    return out;
  };
  const stripComments = (source) => source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (match) => match.replace(/[^\n]/g, ' '));
  const rgbOf = (literal) => {
    if (literal.startsWith('#')) {
      let hex = literal.slice(1);
      if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
      if (hex.length !== 6) return null;
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    }
    const match = literal.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (!match) return null;
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  };
  const isBranded = (rgb) => {
    const max = Math.max(...rgb);
    const min = Math.min(...rgb);
    const saturation = max === 0 ? 0 : (max - min) / max;
    if (saturation <= 0.25) return false;
    let hue = 0;
    if (max !== min) {
      const [r, g, b] = rgb;
      if (max === r) hue = ((g - b) / (max - min)) % 6;
      else if (max === g) hue = (b - r) / (max - min) + 2;
      else hue = (r - g) / (max - min) + 4;
      hue *= 60;
      if (hue < 0) hue += 360;
    }
    if (hue >= 70 && hue <= 190) return true;
    return hue >= 35 && hue < 70 && saturation > 0.4;
  };

  const offenders = [];
  for (const file of walk(resolve(ROOT, 'src'))) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    const allowed = exceptions[rel];
    if (allowed === '*') continue;
    const allowedList = (allowed ?? '').split(' ').filter(Boolean);
    const lines = stripComments(readFileSync(file, 'utf8')).split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const literal of line.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) ?? []) {
        const rgb = rgbOf(literal);
        if (!rgb || !isBranded(rgb)) continue;
        if (allowedList.includes(literal.toLowerCase())) continue;
        offenders.push(`${rel}:${index + 1}: ${literal}`);
      }
    });
  }
  assert.deepEqual(offenders, [], `branding verzui rămase:\n${offenders.join('\n')}`);

  // The legacy transcription exists, and no screen may read it.
  const importers = [];
  for (const file of walk(resolve(ROOT, 'src'))) {
    if (file.endsWith('webTokens.ts')) continue;
    if (readFileSync(file, 'utf8').includes('webTokens')) importers.push(relative(ROOT, file));
  }
  assert.deepEqual(importers, [], 'webTokens.ts nu este pictat de nici un ecran');
});


test('toate cele patru apăsări ale unui post sunt argintii, inima inclusiv', () => {
  const rail = read('src/components/PostRail.tsx');
  const reaction = read('src/components/ReactionControl.tsx');
  // Un singur izvor de cerneală pentru cele patru semne.
  assert.match(rail, /const markInk = controls\.mark;/, 'coloana își ia cerneala dintr-un singur loc');
  const marks = rail.match(/<SolidViewerIcon[^>]*color=\{markInk\}/g) ?? [];
  assert.equal(marks.length, 4, 'comentariu, salvare, distribuire și discul sonor poartă aceeași cerneală');
  // Inima: desenată, nu emoji — emoji-ul de hârtie era negru.
  assert.match(reaction, /export type ReactionHeart = 'mark' \| 'emoji';/);
  assert.match(reaction, /\{!mine && heart === 'mark'[\s\S]{0,200}kind="heartLine"[\s\S]{0,80}color=\{markInk\}/,
    'Like-ul neatins este un semn desenat în aceeași cerneală');
  assert.match(read('src/components/SolidViewerIcon.tsx'), /heartLine/, 'inima are un traseu desenat');
  // Stările rămân distincte: emoji-ul ales, plus punctul de salvare/redistribuire.
  assert.match(reaction, /REACTION_PICKER_GLYPHS\[mine\]/, 'reacția aleasă rămâne emoji-ul ei');
  assert.match(rail, /styles\.stateDot/, 'o salvare luată își păstrează punctul');
  // Reels nu se atinge: își cere explicit emoji-ul pe care l-a avut dintotdeauna.
  assert.match(read('src/components/ReelsReader.tsx'), /heart="emoji"/, 'Reels rămâne cu inima lui albă');
});

test('butoanele de relație sunt argintii, cu text negru mat, și rămân distincte', () => {
  const button = read('src/components/RelationButton.tsx');
  assert.match(button, /accentPaper: \{ backgroundColor: socialTokens\.post\.controls\.paper\.plateSolid/,
    'Urmărește pe o pagină de cuvinte este un cip de argint plin');
  assert.match(button, /labelPaperAccent: \{ color: socialTokens\.post\.controls\.paper\.inkOnPlate \}/,
    'cu text negru mat');
  assert.match(button, /accentNight: \{ backgroundColor: socialTokens\.post\.controls\.night\.plateOn/,
    'noaptea, aceeași ușă este tot cipul luminat');
  assert.match(button, /\? \(accent \? styles\.labelPaperAccent : styles\.labelPaper\)/,
    'ușa secundară (Urmărit) rămâne în cerneala ei, deci cele două stări se disting');
  assert.doesNotMatch(button, /#2fbdb3|#67f5ed|#04120f/, 'nici un teal în buton');

  const header = read('src/components/ProfileHeader.tsx');
  assert.match(header, /backgroundColor: blackSilver\.silver,[\s\S]{0,200}ownerPressed/,
    'Editează profilul este tot un cip de argint');
  assert.match(header, /ownerNeutralLabel: \{\s*color: blackSilver\.onSilver,/, 'cu text negru mat');
});

test('avatarul implicit este logo-ul JB cu fructe pe toate suprafețele', () => {
  /** The surfaces the owner listed: feed, profile, comments, messages, friends, search, lists, stories. */
  const surfaces = [
    'src/components/PostCanvas.tsx',
    'src/components/PostReading.tsx',
    'src/components/ProfileHeader.tsx',
    'src/components/CommentsSheet.tsx',
    'src/components/ContactCard.tsx',
    'src/components/ProfileWhisperCard.tsx',
    'src/components/StoryRail.tsx',
    'src/components/StoryViewer.tsx',
    'src/components/AppNav.tsx',
    'src/screens/FriendsScreen.tsx',
    'src/screens/MessagesScreen.tsx',
    'src/screens/SearchScreen.tsx',
    'src/screens/LiveScreen.tsx',
  ];
  for (const file of surfaces) {
    const source = read(file);
    assert.ok(source.includes('<BrandAvatar'), `${file} poartă logo-ul implicit`);
    assert.doesNotMatch(source, /initialsFor\((name|title|author|profile|item|session)/,
      `${file} nu mai tipărește iniţiale acolo unde desena o față`);
  }
  // Poza reală rămâne poza reală pe fiecare dintre ele.
  for (const file of surfaces) {
    if (!read(file).includes('RemoteImageSource')) continue;
    assert.match(read(file), /RemoteImageSource[\s\S]{0,120}BrandAvatar|BrandAvatar[\s\S]{0,120}RemoteImageSource/,
      `${file} păstrează poza și adaugă logo-ul doar ca rezervă`);
  }
  const avatar = read('src/components/BrandAvatar.tsx');
  assert.match(avatar, /BRAND_AVATAR_FILL = 0\.82/, 'logo-ul are marginea și cercul lui, nu e întins');
  assert.match(avatar, /Math\.max\(BRAND_AVATAR_MIN/, 'și nu scade sub o dimensiune lizibilă');
});

test('subsolul: negru mat, tab-ul de profil argintiu, plusul proeminent', () => {
  const nav = read('src/components/AppNav.tsx');
  assert.match(nav, /color=\{selected \? jungle\.navActive : jungle\.navIdle\}/,
    'cele șapte semne iau cerneala din temă');
  assert.doesNotMatch(nav, /F5D33C|f5d33c|139,208,74/, 'nici banana, nici kiwiul nu mai pictează bara');
  assert.equal(jungle.navActive, blackSilver.bright, 'tab-ul deschis este argintul luminat');
  assert.equal(jungle.navIdle, blackSilver.muted, 'tab-ul închis rămâne argintiu, doar mai discret');
  assert.equal(socialTokens.colors.glassBorder, blackSilver.hairline, 'sticla are o hairline de argint');
  assert.match(nav, /backgroundColor: socialTokens\.colors\.createInk/, 'discul plusului este paleta');
  assert.match(nav, /borderColor: socialTokens\.colors\.createBorder/, 'cu un inel propriu');
  assert.match(nav, /<BrandAvatar size=\{socialTokens\.nav\.disc\.size - 4\}/, 'contul fără poză poartă logo-ul');

  const app = JSON.parse(read('app.json')).expo;
  assert.equal(app.android.adaptiveIcon.backgroundColor, '#101113', 'iconița stă pe negru mat');
  for (const plugin of app.plugins) {
    if (Array.isArray(plugin) && plugin[0] === 'expo-splash-screen') {
      assert.equal(plugin[1].backgroundColor, '#101113', 'splash-ul stă pe negru mat');
      assert.equal(plugin[1].dark.backgroundColor, '#101113', 'și noaptea la fel');
    }
  }
  assert.doesNotMatch(read('app.json'), /#02150D/i, 'nici un verde în configurația de sistem');
});

const { socialTokens } = load('social');
