/* global __dirname, process */
// The band's contract, phone against web. `src/components/ProfileTicker.tsx` is a transcription of the
// web's `apps/nexus-web/public/profile-ticker.js` (wave 14i), so this script asks both of them the same
// questions and insists on the same answers: the fragments of a description, the readings and the two
// rows they are dealt into, how wide a run has to be and how long it takes to travel, the four doors and
// what each one hands over, and every value the stylesheet owns. The module's own markup is the oracle -
// built here without a browser and read back as the structure the phone draws.
//
// On top of that it pins the band's measured place in the column: the own-profile capture says the
// identity, the band's row and the tabs follow each other with no gap at all, and the stylesheet's own
// arithmetic says the band is 395 of the capture's 469 pixels wide.
//
// Usage: node scripts/test-ticker-parity.cjs [path/to/the/wave-directory]
//   The default wave is the live web app (../../nexus-web/public). Pass the sandbox copy of it while the
//   web still serves the old band: the module there is the reference, and the wave's own stylesheet and
//   locale are what the phone is held against. A reference that is not wave 14i is refused outright, and
//   when the wave is not the live app the run also reports the replay still owed - the stylesheet's rules
//   and the band's words that the live copy is still missing.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');
const react = require('react');

const ROOT = resolve(__dirname, '..');
const REPO = resolve(ROOT, '..', '..');
const WEB = resolve(REPO, 'apps/nexus-web/public');
// The wave is a directory: the module and the stylesheet that belongs to it. The live web app is the
// default; the sandbox copy of it is what to pass until the replay has landed in the app itself.
const WAVE = resolve(process.argv[2] || WEB);
const REFERENCE = resolve(WAVE, 'profile-ticker.js');
const CSS = resolve(WAVE, 'profile-experience.css');
const LIVE_CSS = resolve(WEB, 'profile-experience.css');
// The words a reading prints come from the app's locale file: the wave's own copy of it, so the sandbox
// speaks for itself, and the live one once the wave is the live app already.
const LOCALE = require('node:fs').existsSync(resolve(WAVE, 'interface-locale.js'))
  ? resolve(WAVE, 'interface-locale.js')
  : resolve(WEB, 'interface-locale.js');
const CAPTURE = resolve(REPO, 'docs/web-ref/profile/own-0.dom.json');

/** Compiled the way the app's other scripts compile TS: transpile, then run against a shimmed require. */
function compile(file) {
  return ts.transpileModule(readFileSync(file, 'utf8'), {
    fileName: file,
    compilerOptions: {
      allowJs: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React, esModuleInterop: true,
    },
  }).outputText;
}

/** `StyleSheet.create` records every sheet it is handed, so a style block is read without a renderer. */
const sheets = [];
const noop = () => null;
const STUBS = {
  react,
  'react-native': {
    __esModule: true,
    Animated: { View: noop },
    Easing: { linear: (value) => value },
    Pressable: noop,
    Text: noop,
    View: noop,
    StyleSheet: { create: (sheet) => { sheets.push(sheet); return sheet; } },
  },
  'react-native-svg': { __esModule: true, default: noop, Defs: noop, LinearGradient: noop, Rect: noop, Stop: noop },
};
/** Anything a screen imports that this contract does not read: usable, never called. */
const loose = new Proxy(function loose() {}, {
  get: (target, key) => (key === '__esModule' ? true : loose), apply: () => loose, construct: () => loose,
});

function loadModule(file, overrides = {}, strict = false) {
  const moduleShim = { exports: {} };
  const requireShim = (id) => {
    if (Object.prototype.hasOwnProperty.call(overrides, id)) return overrides[id];
    if (strict) throw new Error(`${file} imports ${id}, which this contract does not stand in for`);
    return loose;
  };
  new Function('exports', 'require', 'module', compile(file))(moduleShim.exports, requireShim, moduleShim);
  return moduleShim.exports;
}

/** The wave-14i module itself: it imports nothing, and it does not need a document to build markup. */
const web = loadModule(REFERENCE, {}, true);
if (!web.PROFILE_TICKER_ROWS || !web.PROFILE_TICKER_ACTIONS || !web.PROFILE_TICKER_RUN_MIN) {
  throw new Error(`${REFERENCE} is not the wave-14i band (no two rows, no PROFILE_TICKER_ACTIONS, no run minimum)`);
}

const tokens = loadModule(resolve(ROOT, 'src/theme/social.ts'), {}, true).socialTokens;
/** The description's own cut: which piece of it is text and which one leads somewhere. */
const bioText = loadModule(resolve(ROOT, 'src/lib/profileBioText.ts'), {}, true);
const ticker = loadModule(resolve(ROOT, 'src/components/ProfileTicker.tsx'), {
  ...STUBS, '../theme/social': { socialTokens: tokens }, '../lib/profileBioText': bioText,
}, true);
loadModule(resolve(ROOT, 'src/screens/ProfileScreen.tsx'), {
  ...STUBS, '../theme/social': { socialTokens: tokens }, '../components/ProfileTicker': ticker,
});

const stylesWith = (key) => {
  const sheet = sheets.find((entry) => entry && Object.prototype.hasOwnProperty.call(entry, key));
  assert.ok(sheet, `no StyleSheet.create block carries a \`${key}\` style`);
  return sheet;
};
const band = stylesWith('band');
const screen = stylesWith('tabsBlock');

/** The first bundle in `interface-locale.js` is ro-RO, the language this app's interface is written in. */
const localeSource = readFileSync(LOCALE, 'utf8');
function romanian(key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`"${escaped}":\\s*"([^"]*)"`).exec(localeSource);
  assert.ok(match, `interface-locale.js has no ${key}`);
  return match[1];
}
const t = (key) => romanian(key);

/** `profile-experience.css` flattened into rules, media queries included, so a declaration can be read. */
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, ' ');
const cssRules = [...stripComments(readFileSync(CSS, 'utf8')).matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selectors, body]) => ({ selectors: selectors.split(',').map((entry) => entry.trim()), body }));
function declarations(selector, property) {
  const escaped = property.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  const pattern = new RegExp(`(?:^|;)\\s*${escaped}\\s*:\\s*([^;}]+)`, 'gi');
  return cssRules
    .filter((rule) => rule.selectors.includes(selector))
    .flatMap((rule) => [...rule.body.matchAll(pattern)].map((match) => match[1].trim()));
}
function declaration(selector, property) {
  const found = declarations(selector, property);
  assert.ok(found.length, `profile-experience.css never sets ${property} on ${selector}`);
  return found[found.length - 1]; // a later rule wins, the way the cascade would have it
}
const pixels = (value) => Number(/^(-?\d+(?:\.\d+)?)px$/.exec(value)?.[1]);
/** A `padding` shorthand may write a bare zero; every other length in this stylesheet carries its unit. */
const lengthOf = (value) => (value === '0' ? 0 : pixels(value));
/** `.85` and `0.85` are the same colour; the stylesheet writes the first and the tokens the second. */
const colourOf = (value) => {
  const colour = /rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}/.exec(value)[0];
  return colour.replace(/(^|[^0-9])\.(\d)/g, '$10.$2');
};

/** The own-profile capture: 469 x 1021 at device pixel ratio 2.6, the geometry this band was measured on. */
const capture = JSON.parse(readFileSync(CAPTURE, 'utf8'));
const captured = (cls) => {
  const node = capture.nodes.find((entry) => String(entry.cls || '').split(/\s+/).includes(cls));
  assert.ok(node, `the capture has no .${cls}`);
  return node;
};
const bottomOf = (node) => node.r[1] + node.r[3];

// The readings are a sentence split by the locale's own rules; the fixtures lean on what a description
// can hold without turning one into an essay: nothing, one line, many lines, several sentences, a short
// one that never ends with a full stop, punctuation that is not one, an emoji, and a very long line.
const BIOS = [
  null,
  '',
  'its me:) Picasso\nLala blanco. Oh',
  'First sentence. Second one! Third? Fourth… Fifth.',
  'un | doi · trei\npatru',
  'x'.repeat(120),
  'a. b. c. d. e. f. g. h. i. j. k.',
  '  spații  în  jur  ',
  'emoji 🎂 și punct. Altă propoziție.',
  'fără punct final',
  'Multi\nline\nbio\ncu\ncinci\nlinii',
];

const PROFILES = [
  // A profile the screen never draws without is not a fixture: `null` is asserted on its own below.
  {},
  { handle: '@romeodeepsek' },
  {
    handle: 'romeodeepsek',
    location: 'Kraków, Polonia',
    age: 34,
    bio: 'its me:) Picasso\nLala blanco. Oh',
    counts: { posts: 32, followers: 1, following: 1 },
  },
  { location: '', age: 12, counts: {} },
  { age: 13, counts: { posts: 0 } },
  { age: 25.5, handle: ' @x ' },
  { counts: { posts: '12', followers: -4, following: 1234567 } },
  { location: 'Chișinău', counts: { followers: 1000000 } },
  { handle: '@a', location: 'New York, SUA', age: 41 },
  { bio: 'un | doi · trei\npatru', counts: { posts: 3, followers: 2, following: 2 } },
];

test('etichetele și ușile vin din pachetul românesc, nu din minte', () => {
  // Every string read out of the locale file below is the first bundle's, so the first bundle has to be
  // ro-RO: these two are the words the production markup printed, and they are not the English ones.
  assert.equal(romanian('profile.posts'), 'postări');
  assert.equal(romanian('profile.years'), 'ani');
  assert.deepEqual([...ticker.TICKER_DOORS].sort(), Object.keys(web.PROFILE_TICKER_ACTIONS).sort());
  const labelKey = (kind) => `profile.tickerOpen${kind[0].toUpperCase()}${kind.slice(1)}`;
  for (const kind of ticker.TICKER_DOORS) {
    assert.equal(ticker.DOOR_HINTS[kind], romanian(labelKey(kind)), `hint for ${kind}`);
  }
});

test('descrierea se rupe în aceleași fragmente ca pe web', () => {
  for (const bio of BIOS) {
    assert.deepEqual(ticker.tickerFragments(bio), web.profileTickerFragments(bio), `bio: ${JSON.stringify(bio)}`);
  }
  assert.deepEqual(ticker.tickerFragments('un | doi. trei', 0), web.profileTickerFragments('un | doi. trei', 0));
  assert.equal(ticker.tickerFragments('x'.repeat(120))[0].length, web.profileTickerFragments('x'.repeat(120))[0].length);
});

test('citirile sunt aceleași ca pe web, cu descrierea în frunte', () => {
  // The screen never draws the band without a profile in hand, so a missing profile is nothing to draw,
  // while the module - which renders into a page that was fetched - spells out three zeroed counters.
  assert.deepEqual(ticker.tickerItems(null), []);
  /** The phone's own field on a reading: the pieces a description was cut into (`bioTokens`). */
  const plain = (item) => Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'tokens'));
  for (const [index, profile] of PROFILES.entries()) {
    const theirs = web.profileTickerItems(profile, { t, locale: 'ro-RO' });
    // `PROFILE_TICKER_ROWS` of the module ends its first row with the description; this band opens with it,
    // and every other reading keeps the module's own order and values exactly.
    const expected = [
      ...theirs.filter((item) => item.kind === 'bio'),
      ...theirs.filter((item) => item.kind !== 'bio'),
    ];
    assert.deepEqual(
      ticker.tickerItems(profile).map(plain),
      expected,
      `profile ${index}: ${JSON.stringify(profile)}`,
    );
  }
});

test('citirile se împart în aceleași două rânduri, cu descrierea prima', () => {
  for (const [index, profile] of PROFILES.entries()) {
    const mine = ticker.tickerItems(profile);
    const theirs = web.profileTickerItems(profile, { t, locale: 'ro-RO' });
    const where = `profile ${index}`;
    const kindsOf = (rows) => rows.map((row) => row.map((item) => item.kind));
    const mineKinds = kindsOf(ticker.tickerRows(mine));
    const theirKinds = kindsOf(web.profileTickerRows(theirs));
    assert.equal(mineKinds.length, theirKinds.length, `${where}: the same number of rows`);
    mineKinds.forEach((row, at) => {
      assert.deepEqual([...row].sort(), [...theirKinds[at]].sort(), `${where} row ${at}: the same readings`);
    });
    // The phone's own order, spelled out: the owner's words open the row, then the place, the year and the
    // handle, and the three counters are the second row. A row with nothing in it is not drawn.
    const expected = [
      ['bio', 'location', 'age', 'handle'],
      ['posts', 'followers', 'following'],
    ].map((kinds) => mine.filter((item) => kinds.includes(item.kind)).map((item) => item.kind))
      .filter((row) => row.length);
    assert.deepEqual(mineKinds, expected, `${where}: the phone's own order`);
  }
});

test('o cursă e la fel de lată și durează la fel ca pe web', () => {
  for (let slots = 0; slots <= 64; slots += 1) {
    assert.equal(ticker.tickerSpan(slots), web.profileTickerSpan(slots), `span for ${slots} slots`);
  }
  for (const slots of [120, 245, 512, 1000]) {
    assert.equal(ticker.tickerSpan(slots), web.profileTickerSpan(slots), `span for ${slots} slots`);
  }
  // A row with nothing in it is never drawn (see `PROFILE_TICKER_ROWS`), and the module cannot size one -
  // the phone's guard is the run minimum itself.
  assert.equal(ticker.tickerRunSlots([]), web.PROFILE_TICKER_RUN_MIN);
  for (let length = 1; length <= 12; length += 1) {
    const row = Array.from({ length }, (_, index) => ({ kind: 'bio', value: `f${index}` }));
    const slots = ticker.tickerRunSlots(row);
    // `PROFILE_TICKER_RUN_MIN`: a row repeats until its run is eight readings wide, never narrower.
    assert.equal(slots, length * Math.max(1, Math.ceil(web.PROFILE_TICKER_RUN_MIN / length)), `slots for ${length}`);
    assert.ok(slots >= web.PROFILE_TICKER_RUN_MIN, `a run of ${length} is at least ${web.PROFILE_TICKER_RUN_MIN} wide`);
  }
});

/**
 * The band the module builds, read back as structure: its two tracks, each track's runs, and every item
 * of a run as the reading it prints. The fixtures carry no markup of their own, so the escaper handed to
 * the module is the identity and no entity has to be read back.
 */
function readBand(profile) {
  const markup = web.profileTickerMarkup(profile, { esc: (value) => String(value ?? ''), t, locale: 'ro-RO' });
  const tracks = [...markup.matchAll(
    /<div class="ownerTickerTrack" data-owner-ticker-slots="(\d+)" style="--tickerSpan:(\d+)s">([\s\S]*?)<\/div>/g,
  )].map(([, slots, span, body]) => ({
    slots: Number(slots),
    span: Number(span),
    runs: body.split('<span class="ownerTickerRun"').slice(1).map((chunk) => ({
      echo: /^ aria-hidden="true"/.test(chunk),
      items: chunk.split(/(?=<span class="ownerTickerItem")|(?=<button type="button" class="ownerTickerItem ownerTickerAction")/).slice(1),
    })),
  }));
  return {
    tracks,
    count: Number(/data-owner-ticker-count="(\d+)"/.exec(markup)[1]),
    span: Number(/^<div class="ownerTicker"[^>]*?style="--tickerSpan:(\d+)s"/.exec(markup)[1]),
  };
}

/** One item of a run: the reading it prints, and - when it is a door - where that door goes and what it says. */
function readItem(chunk) {
  const value = /<span class="ownerTickerValue">([^<]*)<\/span>/.exec(chunk);
  const counted = /<b>([^<]*)<\/b><small>([^<]*)<\/small>/.exec(chunk);
  const door = /data-owner-ticker-action="([^"]*)" data-owner-ticker-arg="([^"]*)"( tabindex="-1")? aria-label="([^"]*)"/.exec(chunk);
  return {
    reading: counted ? `${counted[1]} ${counted[2]}`.trim() : value[1],
    kind: door ? door[1] : null,
    arg: door ? door[2] : null,
    hidden: door ? Boolean(door[3]) : false,
    name: door ? door[4] : null,
  };
}

test('structura benzii citite din markupul web e cea pe care o desenează telefonul', () => {
  for (const [index, profile] of PROFILES.entries()) {
    const items = ticker.tickerItems(profile);
    const rows = ticker.tickerRows(items);
    const band = readBand(profile);
    const where = `profile ${index}`;
    // The readings a track prints are read in the module's own order, because the phone's first row is the
    // module's first row with the description moved to the front - the arithmetic below is the module's, and
    // that one reorder is asserted on its own in the test above.
    const theirs = web.profileTickerRows(web.profileTickerItems(profile, { t, locale: 'ro-RO' }));
    // The band's own span is the fallback the module's speed knob rewrites; each of the phone's rows
    // carries its own instead, because two rows of different lengths loop on two different spans.
    assert.equal(band.count, items.length, `${where}: the band counts the readings it carries`);
    assert.equal(band.span, web.profileTickerSpan(items.length), `${where}: band span`);
    assert.equal(band.tracks.length, rows.length, `${where}: one track per row`);
    band.tracks.forEach((track, rowIndex) => {
      const row = theirs[rowIndex];
      const readings = row.map(ticker.tickerReadingText);
      const at = `${where} row ${rowIndex}`;
      assert.equal(track.slots, ticker.tickerRunSlots(row), `${at}: slots`);
      assert.equal(track.span, ticker.tickerSpan(track.slots), `${at}: span`);
      assert.equal(track.runs.length, 2, `${at}: the reading and the echo arriving behind it`);
      track.runs.forEach((run, runIndex) => {
        assert.equal(run.echo, runIndex === 1, `${at}: only the echo is aria-hidden`);
        const read = run.items.map(readItem);
        assert.equal(read.length, track.slots, `${at}: every slot prints a reading`);
        assert.deepEqual(
          read.map((item) => item.reading),
          Array.from({ length: track.slots }, (_, slot) => readings[slot % row.length]),
          `${at}: the readings in the order the row prints them`,
        );
        read.forEach((item, slot) => {
          const source = row[slot % row.length];
          const expected = ticker.TICKER_DOORS.includes(source.kind) ? source.kind : null;
          assert.equal(item.kind, expected, `${at}: which readings are doors`);
          if (!expected) {
            assert.equal(item.arg, null, `${at}: only a door hands anything over`);
            assert.equal(item.name, null, `${at}: only a door says where it goes`);
            return;
          }
          assert.equal(item.arg, ticker.tickerDoorArg(source), `${at}: what the ${expected} door hands over`);
          assert.equal(item.name, `${ticker.tickerReadingText(source)} (${ticker.DOOR_HINTS[expected]})`, `${at}: what the ${expected} door says`);
          // The echo is the reading arriving behind the first one, so its doors wait outside the tab order.
          assert.equal(item.hidden, runIndex === 1, `${at}: a ${expected} door in the echo waits outside the tab order`);
        });
      });
    });
  }
});

/** The first of `properties` that `selector` sets, so a long form and a shorthand read the same way. */
function firstOf(selector, ...properties) {
  for (const property of properties) {
    const found = declarations(selector, property);
    if (found.length) return found[found.length - 1];
  }
  return assert.fail(`${selector} sets none of ${properties.join(', ')}`);
}

/** How far a row keeps its content off its own left edge: the long form, or the shorthand's fourth value. */
function insetOf(selector) {
  const long = declarations(selector, 'padding-left');
  if (long.length) return pixels(long[long.length - 1]);
  const parts = declaration(selector, 'padding').split(/\s+/);
  return lengthOf(parts[3] ?? parts[1]);
}

test('fiecare valoare a benzii e cea din foaia de stil', () => {
  const bandInk = tokens.ticker;
  // The band itself: `.ownerTicker`, and the style object the phone hands its own view.
  assert.equal(colourOf(declaration('.ownerTicker', 'background')), bandInk.surface);
  assert.equal(colourOf(declaration('.ownerTicker', 'color')), bandInk.ink);
  assert.equal(declaration('.ownerTicker', 'overflow'), 'hidden');
  assert.equal(declaration('.ownerTicker', 'pointer-events'), 'none', 'the band is not a control');
  const mask = declaration('.ownerTicker', 'mask-image');
  assert.equal(Number(/#000 (\d+)px/.exec(mask)[1]), bandInk.fade, 'the fade at the near end');
  assert.ok(mask.includes(`calc(100% - ${bandInk.fade}px)`), 'the same fade at the far end');
  assert.equal(bandInk.fadeInk, '#060c11', 'what that surface resolves to over the black hero');
  assert.equal(band.band.overflow, 'hidden');
  assert.equal(band.band.backgroundColor, bandInk.surface);
  assert.equal(colourOf(declaration('.ownerTicker', 'border-top')), bandInk.border);
  assert.equal(colourOf(declaration('.ownerTicker', 'border-bottom')), bandInk.border);
  assert.equal(band.band.borderTopColor, bandInk.border);
  assert.equal(band.band.borderBottomColor, bandInk.border);
  assert.equal(band.band.borderTopWidth, 1);
  assert.equal(band.band.borderBottomWidth, 1);
  assert.equal(band.band.marginTop, undefined, 'nothing between the identity and the band');
  assert.equal(band.band.marginBottom, undefined, 'and nothing between the band and the tabs');
  assert.equal(screen.tabsBlock.marginTop, undefined, 'the tabs follow the band with no gap of their own');
  // The two rows, and the hairline that parts them.
  const animation = declarations('.ownerTickerTrack', 'animation');
  assert.match(animation[0], /var\(--tickerSpan/, 'each row travels on its own span');
  assert.match(animation[0], /\blinear\b/);
  assert.match(animation[0], /\binfinite\b/);
  assert.equal(animation[animation.length - 1], 'none', 'a device that asks for less motion stands still');
  assert.equal(declaration('.ownerTicker.isHeld .ownerTickerTrack', 'animation-play-state'), 'paused');
  assert.equal(colourOf(declaration('.ownerTickerTrack+.ownerTickerTrack', 'border-top')), bandInk.rowBorder);
  assert.equal(band.trackHairline.borderTopColor, bandInk.rowBorder);
  assert.equal(band.trackRow.flexDirection, 'row', 'a run and its echo travel as one strip');
  assert.equal(declaration('.ownerTickerRun', 'white-space'), 'nowrap');
  assert.equal(band.run.flexDirection, 'row');
  // One reading: `.ownerTickerItem`.
  const padding = declaration('.ownerTickerItem', 'padding').split(/\s+/).map(lengthOf);
  const sides = [bandInk.itemPaddingBlock, bandInk.itemPaddingInlineEnd, bandInk.itemPaddingBlock, 0];
  assert.deepEqual(padding, sides, 'above, after, below, before');
  assert.match(declaration('.ownerTickerItem', 'display'), /\binline-flex\b/);
  assert.equal(declaration('.ownerTickerItem', 'align-items'), 'center');
  assert.equal(pixels(declaration('.ownerTickerItem', 'font-size')), bandInk.fontSize);
  assert.equal(Number(declaration('.ownerTickerItem', 'line-height')), bandInk.lineHeight);
  assert.equal(band.reading.paddingVertical, bandInk.itemPaddingBlock);
  assert.equal(band.reading.paddingRight, bandInk.itemPaddingInlineEnd);
  assert.equal(band.reading.flexDirection, 'row');
  assert.equal(band.reading.alignItems, 'center');
  assert.equal(band.value.color, bandInk.ink);
  assert.equal(band.value.fontSize, bandInk.fontSize);
  assert.equal(band.value.lineHeight, bandInk.fontSize * bandInk.lineHeight, '12.5 on 1.3');
  // The dot that opens every reading: `.ownerTickerSep`.
  assert.equal(pixels(firstOf('.ownerTickerSep', 'width')), bandInk.sepSize);
  assert.equal(pixels(firstOf('.ownerTickerSep', 'height')), bandInk.sepSize);
  assert.equal(pixels(firstOf('.ownerTickerSep', 'margin-right')), bandInk.sepMarginEnd);
  assert.equal(colourOf(firstOf('.ownerTickerSep', 'background', 'background-color')), bandInk.dot);
  assert.equal(Number(firstOf('.ownerTickerSep', 'opacity')), bandInk.dotOpacity);
  assert.equal(band.separator.width, bandInk.sepSize);
  assert.equal(band.separator.height, bandInk.sepSize);
  assert.equal(band.separator.borderRadius, bandInk.sepSize / 2, '3px is round at half its side');
  assert.equal(band.separator.marginRight, bandInk.sepMarginEnd);
  assert.equal(band.separator.backgroundColor, bandInk.dot);
  assert.equal(band.separator.opacity, bandInk.dotOpacity);
  // The glyph, the number and its unit.
  assert.equal(pixels(firstOf('.ownerTickerIcon', 'margin-right')), bandInk.iconMarginEnd);
  assert.equal(pixels(firstOf('.ownerTickerIcon', 'font-size')), bandInk.iconSize);
  assert.equal(band.icon.marginRight, bandInk.iconMarginEnd);
  assert.equal(band.icon.fontSize, bandInk.iconSize);
  assert.equal(colourOf(declaration('.ownerTickerItem b', 'color')), bandInk.countInk);
  assert.equal(pixels(declaration('.ownerTickerItem b', 'font-size')), bandInk.fontSize);
  assert.equal(declaration('.ownerTickerItem b', 'font-variant-numeric'), 'tabular-nums', 'the figures never jiggle');
  assert.equal(band.count.color, bandInk.countInk);
  assert.equal(band.count.fontSize, bandInk.fontSize);
  // A `b` is bold by default, so the stylesheet may leave the weight unsaid; when it says it, the phone
  // has to say the same.
  const weight = declarations('.ownerTickerItem b', 'font-weight');
  if (weight.length) assert.equal(band.count.fontWeight, weight[weight.length - 1]);
  assert.deepEqual(band.count.fontVariant, ['tabular-nums']);
  assert.equal(colourOf(declaration('.ownerTickerItem small', 'color')), bandInk.labelInk);
  assert.equal(pixels(declaration('.ownerTickerItem small', 'font-size')), bandInk.labelSize);
  assert.equal(band.label.color, bandInk.labelInk);
  assert.equal(band.label.fontSize, bandInk.labelSize);
  assert.equal(band.countRow.gap, pixels(declaration('.ownerTickerCount', 'gap')));
  assert.equal(band.countRow.gap, bandInk.countGap);
  assert.equal(band.countRow.alignItems, firstOf('.ownerTickerCount', 'align-items'));
  // A reading that is a door: `.ownerTickerAction`.
  assert.equal(band.door.minWidth, bandInk.minTarget);
  assert.equal(band.door.minHeight, bandInk.minTarget);
  assert.equal(pixels(declaration('.ownerTickerAction', 'min-width')), bandInk.minTarget);
  assert.equal(pixels(declaration('.ownerTickerAction', 'min-height')), bandInk.minTarget);
  assert.equal(declaration('.ownerTickerAction', 'pointer-events'), 'auto', 'only the doors take a press');
  assert.equal(declaration('.ownerTickerAction', 'color'), 'inherit', 'a door wears the face of the words');
  assert.equal(band.door.color, undefined, 'so it carries no ink of its own');
  assert.equal(colourOf(declaration('.ownerTickerAction:active', 'color')), bandInk.doorInk);
  assert.equal(colourOf(declaration('.ownerTickerAction:focus-visible', 'color')), bandInk.doorInk);
  assert.equal(band.valuePressed.color, bandInk.doorInk);
  // The mask the phone cannot wear: the same 22px, painted in the band's own colour, edge to edge.
  assert.deepEqual(band.fade, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 });
});

test('identitatea, banda și filele se urmează fără niciun gol', () => {
  const identity = captured('ownerIdentity');
  const row = captured('ownerTickerRow');
  const box = captured('ownerTicker');
  const actions = captured('ownerHeroActions');
  const tabs = captured('ownerTabsRegion');
  // The chain the whole band hangs in: the identity, its row, then the tabs, with nothing between them.
  assert.equal(bottomOf(identity), row.r[1], 'the band\'s row starts where the identity ends');
  assert.equal(bottomOf(row), tabs.r[1], 'the tabs start where the band\'s row ends');
  // The capture is the band from before this wave: one track, so only the chain and the widths are its.
  const tracks = capture.nodes.filter((node) => String(node.cls || '').split(/\s+/).includes('ownerTickerTrack'));
  assert.equal(tracks.length, 1, 'the capture carries the old single-row band');
  assert.ok(tracks[0].r[2] > capture.viewport.w, 'and its one run is wider than the screen it crosses');
  // The band is centred in the row it shares with the pencil cluster, which is as tall as either of them.
  assert.equal(row.r[3], actions.r[3], 'the row is as tall as the cluster beside the band');
  const above = box.r[1] - row.r[1];
  const below = row.r[1] + row.r[3] - bottomOf(box);
  assert.equal(above + below, row.r[3] - box.r[3]);
  assert.ok(Math.abs(above - below) <= 1, 'the band sits centred in its row');
  // The row's own arithmetic: its padding, the band, one gap, and the cluster out to the edge.
  const rowGap = pixels(firstOf('.ownerTickerRow', 'gap', 'column-gap'));
  const inset = insetOf('.ownerTickerRow');
  const button = pixels(declaration('.ownerHeroActions .heroIconButton', 'width'));
  assert.equal(declaration('.ownerTickerRow .ownerTicker', 'flex'), '1', 'the band takes the room left over');
  assert.equal(box.r[0], inset, 'the band starts where the row\'s own padding ends');
  assert.equal(actions.r[0], box.r[0] + box.r[2] + rowGap, 'the cluster follows the band by one row gap');
  assert.equal(actions.r[0] + actions.r[2], capture.viewport.w, 'and runs to the edge of the screen');
  assert.ok(actions.r[2] > button, 'the button keeps a little padding of the cluster\'s own');
  const clusterPadding = declarations('.ownerHeroActions', 'padding-right');
  if (clusterPadding.length) assert.equal(actions.r[2] - button, pixels(clusterPadding[clusterPadding.length - 1]));
  // The phone draws the same band, from the same numbers: the band takes the room left over in its row. The
  // pencil the web keeps at the right end of that row is **gone by the owner's decision** (`MIGRATION.md`
  // §19.2, `docs/PARITY-MATRIX.md`): the editor is one of the two wide buttons of the new header, so this
  // row carries the band alone and the band runs the whole width it is given.
  const phoneBand = capture.viewport.w - inset;
  assert.equal(identity.r[0] + identity.r[2], phoneBand, 'the identity ends on the same edge');
  // The phone has no band under that header any more: the owner's header prints every reading the band used
  // to carry - the description, the place, the age, the handle and the three counters (`MIGRATION.md` §19.2) -
  // so its row and cell are gone and the tabs follow the header directly. The numbers above stay the web's,
  // read from the capture, because the component itself remains the module's transcription.
  assert.equal(screen.bandRow, undefined, 'the band row left with the duplication it caused');
  assert.equal(screen.bandCell, undefined, 'and so did the cell its mask clipped');
  assert.equal(screen.editButton, undefined, 'the pencil of the web row no longer exists on the phone');
  // The capture's own cluster is 54px - the 44px button and its 10px padding - and it is the web's alone now.
  assert.equal(actions.r[2], button + 10, 'the capture keeps 10px inside its cluster');
  const headerSource = readFileSync(resolve(ROOT, 'src/components/ProfileHeader.tsx'), 'utf8');
  assert.match(headerSource, /HEADER_WORDS\.share|Distribuie profilul/, 'the header owns the share door');
  assert.match(headerSource, /onEditProfile/, 'and the editor door the pencil used to be');
});

test('fiecare citire are aceeași înălțime de linie și același centru', () => {
  const ink = tokens.ticker;
  const line = ink.fontSize * ink.lineHeight;
  // One line height across the band: the words, the bold number, its unit and the glyph all sit in it, so
  // no reading is taller than another and no baseline drifts because a number is bold.
  assert.equal(band.value.lineHeight, line, "12.5 on 1.3, the stylesheet's own leading");
  assert.equal(band.count.lineHeight, line, 'a bold number is not a taller number');
  assert.equal(band.label.lineHeight, line, 'and its unit keeps the same box, so the baseline holds');
  assert.equal(band.icon.lineHeight, line, 'the glyph too, so a reading with an icon is the same height');
  assert.equal(band.countRow.alignItems, 'baseline', 'the number and its unit share the line the module draws');
  // `.ownerTickerItem{align-items:center}` and `.ownerTickerRun{align-items:center}`: what the stylesheet
  // centres, this band centres as well - the dot, the words and the number on the band's centre line.
  assert.equal(declaration('.ownerTickerItem', 'align-items'), 'center');
  assert.equal(band.reading.alignItems, 'center');
  assert.equal(band.reading.justifyContent, 'center');
  assert.equal(band.run.alignItems, 'center');
  // The floor the stylesheet gives a door (`.ownerTickerAction{min-height:40px}`) is every reading's box
  // here, so a row of words and a row of numbers measure the same and each centre is the band's centre.
  assert.equal(pixels(declaration('.ownerTickerAction', 'min-height')), ink.minTarget);
  assert.equal(band.reading.minHeight, ink.readingHeight);
  assert.equal(band.reading.minHeight, ink.minTarget, 'the same 40px floor the action carries');
  // One gap between readings, one dot centred in it, and the same padding around every one of them.
  assert.equal(band.reading.paddingVertical, ink.itemPaddingBlock);
  assert.equal(band.reading.paddingRight, ink.itemPaddingInlineEnd);
  assert.equal(band.separator.marginRight, ink.sepMarginEnd);
  assert.equal(band.separator.width, ink.sepSize);
});

test('o cursă completă durează între 25 și 35 de secunde', () => {
  // The multiplier is the module's own `fast` knob (`PROFILE_TICKER_SPEEDS`), not a number invented here.
  const fast = web.PROFILE_TICKER_SPEEDS.find((speed) => speed.id === 'fast');
  assert.equal(ticker.TICKER_SPEED_FACTOR, fast.factor);
  // The arithmetic stays the module's, slot for slot; only the multiplier is this band's own choice.
  for (let slots = 0; slots <= 64; slots += 1) {
    assert.equal(
      ticker.tickerSpanFor(slots),
      Math.max(1, Math.round(web.profileTickerSpan(slots) * fast.factor)),
      `span for ${slots} slots`,
    );
  }
  // A real profile prints three counters in one row and three or four readings in the other, and
  // `PROFILE_TICKER_RUN_MIN` widens each of them to eight or nine slots: 30 to 34 seconds a loop.
  for (const slots of [8, 9]) {
    const span = ticker.tickerSpanFor(slots);
    assert.ok(span >= 25 && span <= 35, `${slots} slots take ${span}s`);
  }
  // A longer row takes proportionally longer - the module's constant is a speed, not a duration - so the
  // pace is the same on both rows and only the loop that carries more of them grows.
  assert.ok(ticker.tickerSpanFor(16) > ticker.tickerSpanFor(8));
});

test('banda se oprește sub deget și își reia cursa de unde era', () => {
  const source = readFileSync(resolve(ROOT, 'src/components/ProfileTicker.tsx'), 'utf8');
  // `.ownerTicker.isHeld .ownerTickerTrack{animation-play-state:paused}`: a finger anywhere on the band
  // holds both rows still, and lifting it lets them go.
  assert.ok(source.includes('onTouchStart={() => setHeld(true)}'), 'a finger on the band holds both rows');
  assert.ok(source.includes('onTouchEnd={() => setHeld(false)}'), 'lifting it lets them go');
  assert.ok(source.includes('onTouchCancel={() => setHeld(false)}'), 'and so does a cancelled touch');
  assert.ok(source.includes('held={held}'), 'one hold for both rows');
  // The released band travels on from where it stood instead of jumping to a fresh leg.
  assert.match(source, /travelled\.current = value/, 'the band remembers where it stands');
  assert.match(source, /roll\(travelled\.current\)/, 'and carries on from there');
  // Those three callbacks are direct touch events, never a responder: a drag that starts on the band still
  // belongs to the page under it, which is the one gesture the band must not swallow.
  assert.doesNotMatch(source, /onStartShouldSetResponder|onMoveShouldSetResponder|PanResponder/);
});

test('descrierea e text, iar ce duce undeva din ea se citește ca link', () => {
  const pieces = (text) => bioText.bioTokens(text).map((piece) => [piece.text, piece.link]);
  assert.deepEqual(pieces('vezi https://a.dev/x, apoi @nexus.'), [
    ['vezi ', null],
    ['https://a.dev/x', 'address'],
    [', apoi ', null],
    ['@nexus', 'mention'],
    ['.', null],
  ]);
  // The module's own rule for where an address ends, asked through the only thing it exports: the markup
  // it builds. The anchor says where the link stops and what the sentence keeps outside it.
  const module = loadModule(resolve(REPO, 'apps/nexus-web/public/profile-bio-text.js'), {}, true);
  const untouched = (html) => html.replace(/<\/?a[^>]*>/g, '');
  for (const text of ['https://a.dev/x.', 'https://a.dev/x)', 'https://a.dev/wiki/Foo_(bar)', 'www.a.dev, si']) {
    const markup = module.profileBioMarkup(text, (value) => String(value));
    const anchor = /<a href="([^"]*)"[^>]*>([^<]*)<\/a>([\s\S]*)$/.exec(markup);
    assert.ok(anchor, `${text}: the module anchors the address in it`);
    const tokens = bioText.bioTokens(text);
    const at = tokens.findIndex((piece) => piece.link === 'address');
    assert.ok(at >= 0, `${text}: and so does this phone`);
    assert.equal(tokens[at].text, anchor[2], `${text}: where the link ends`);
    assert.equal(tokens.slice(at + 1).map((piece) => piece.text).join(''), anchor[3], `${text}: what stays outside it`);
    assert.equal(untouched(markup), text, `${text}: the sentence itself is unchanged`);
  }
  // An address written without a scheme opens as `https`, exactly as the module's own href does.
  assert.equal(bioText.addressHref('www.a.dev'), 'https://www.a.dev');
  assert.equal(bioText.addressHref('https://a.dev'), 'https://a.dev');
  // A `@` that belongs to a word or to an address is not a mention.
  assert.deepEqual(bioText.bioTokens('scrie la x@nexus.com').filter((piece) => piece.link), []);
  assert.deepEqual(
    bioText.bioTokens('https://a.dev/@user').filter((piece) => piece.link).map((piece) => piece.link),
    ['address'],
  );
  // And the band draws exactly those pieces as links, with nothing else in a reading pressable.
  const source = readFileSync(resolve(ROOT, 'src/components/ProfileTicker.tsx'), 'utf8');
  assert.ok(source.includes('accessibilityRole="link"'), 'a link is read as a link');
  assert.ok(source.includes("onDoor?.('handle', token.href)"), 'a mention opens the profile it names');
  assert.ok(source.includes('openAddress(token.href)'), 'an address opens where this shell opens addresses');
  assert.ok(source.includes('if (!/^https?:\\/\\//i.test(href)) return;'), 'and only http(s) reaches it');
  // The band does not single out a description as a door: its words are the owner's words, and this screen's
  // header now prints them (with `Vezi mai mult`), so a bio reading stays text and nothing else pressable.
  assert.ok(!source.includes("item.kind === 'bio'"), 'a bio reading is words, not a door');
});

test('creionul a plecat din rândul benzii: editorul este un buton lat al antetului', () => {
  const screenSource = readFileSync(resolve(ROOT, 'src/screens/ProfileScreen.tsx'), 'utf8');
  const headerSource = readFileSync(resolve(ROOT, 'src/components/ProfileHeader.tsx'), 'utf8');
  /**
   * `profile-ticker.js`: "the pencil ... stays where it has always been: at the right end of this row, a
   * sibling of the band rather than a passenger inside it, so the band carries no control that writes". The
   * owner's header keeps that rule and moves the door (`MIGRATION.md` §19.2): the band still carries no
   * control that writes, and the editor is now the first of the header's two wide buttons.
   */
  assert.ok(!screenSource.includes('styles.editButton'), 'the pencil is no longer drawn in the band row');
  assert.ok(!screenSource.includes('styles.editGlyph'), 'nor its glyph');
  assert.match(headerSource, /onEditProfile/, 'the header takes the editor door');
  assert.match(headerSource, /styles\.buttonFill/, 'and prints it as a wide button of the row');
  assert.match(headerSource, /styles\.buttons/, 'both doors live in the header\'s own button row');
  // The band itself draws nothing: the only pressable things in it are its doors.
  const tickerSource = readFileSync(resolve(ROOT, 'src/components/ProfileTicker.tsx'), 'utf8');
  assert.ok(!tickerSource.includes('editButton'), 'the band carries no editor of its own');
});

/**
 * What the replay still owes. The wave and the live app are two copies of one band, and this prints the
 * rules the live copy is missing. It reports rather than asserts, because that is work in the app and not
 * a defect in the band - and it says nothing at all once the wave has landed in `apps/nexus-web/public`.
 */
if (CSS !== LIVE_CSS) {
  const ownerRulesOf = (file) => [...stripComments(readFileSync(file, 'utf8'))
    .matchAll(/([^{}]*ownerTicker[^{}]*)\{([^{}]*)\}/g)]
    .map(([, selectors, body]) => `${selectors.trim()}{${body}}`);
  const live = new Set(ownerRulesOf(LIVE_CSS));
  const missing = ownerRulesOf(CSS).filter((rule) => !live.has(rule));
  if (missing.length) {
    console.log(`replay: the live stylesheet is missing ${missing.length} of the wave's rules\n  ${missing.join('\n  ')}`);
  }
  const liveLocale = readFileSync(resolve(WEB, 'interface-locale.js'), 'utf8');
  const words = [...readFileSync(LOCALE, 'utf8').matchAll(/"((?:profile\.(?:ticker|posts|years))[^"]*)":/g)];
  const absent = [...new Set(words.map(([, key]) => key))].filter((key) => !liveLocale.includes(`"${key}":`));
  if (absent.length) {
    console.log(`replay: the live locale is missing ${absent.length} of the wave's words: ${absent.join(', ')}`);
  }
}


