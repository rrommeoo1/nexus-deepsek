/* global __dirname, process */
// The content region of a profile, phone against web. `src/screens/ProfileScreen.tsx` draws the region the web
// draws in `apps/nexus-web/public/profile-experience.js:229-308,485-555` and `profile-experience.css:77-117,
// 408-463`: the grid of tiles, the whisper cards with their shared replies, the shelf of the Momente tab and
// the empty state each tab answers with. This script asks the stylesheet, the captures and the web module
// itself what each of them is worth, and insists the phone answers with the same numbers, words and order.
//
// Three oracles, all real:
//   * `docs/web-ref/profile/tab-1.dom.json`, `tab-3.dom.json` and `tab-4.dom.json` are the captures of the
//     Reels, the Whispers and the Momente tabs: the grid's thirds, the 38px action row, the 36px open-reply
//     button and the two sentences of the empty state were measured there, so the phone is held against the
//     pixels the web actually painted.
//   * `profile-experience.js` is imported and asked the ordering questions the phone's own
//     `lib/profileContent.ts` answers, so the weave cannot be read two ways.
//   * `interface-locale.js` is the ro-RO bundle: every word a card prints is asserted against it, never
//     against a copy of itself.
//
// Usage: node scripts/test-profile-content-parity.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');
const react = require('react');

const ROOT = resolve(__dirname, '..');
const REPO = resolve(ROOT, '..', '..');
const WEB = resolve(REPO, 'apps/nexus-web/public');
const CSS = resolve(WEB, 'profile-experience.css');
// The shared reply card's own two rules live in the thread's stylesheet: `.postRepostedBy` and the button
// that opens the reply in its conversation (`.ownerSharedReplyOpen`).
const DETAIL_CSS = resolve(WEB, 'post-detail.css');
const EXPERIENCE = resolve(WEB, 'profile-experience.js');
const LOCALE = resolve(WEB, 'interface-locale.js');
const CAPTURES = resolve(REPO, 'docs/web-ref/profile');
const SCREEN = resolve(ROOT, 'src/screens/ProfileScreen.tsx');
const WHISPER = resolve(ROOT, 'src/components/ProfileWhisperCard.tsx');
const TILE = resolve(ROOT, 'src/components/ProfileTile.tsx');
const SHELF = resolve(ROOT, 'src/components/ProfileMomentsShelf.tsx');
const REACTIONS = resolve(ROOT, 'src/components/ReactionControl.tsx');

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

/** Anything a module imports that this contract does not read: usable, never called. */
const noop = () => null;
const loose = new Proxy(function loose() {}, {
  get: (target, key) => (key === '__esModule' ? true : loose), apply: () => loose, construct: () => loose,
});
const STUBS = {
  react,
  'react-native': {
    __esModule: true,
    Pressable: noop,
    ScrollView: noop,
    Text: noop,
    View: noop,
    StyleSheet: { create: (sheet) => sheet },
  },
  'react-native-svg': { __esModule: true, default: noop, Defs: noop, LinearGradient: noop, Rect: noop, Stop: noop },
};

function loadModule(file, overrides = {}) {
  const moduleShim = { exports: {} };
  const requireShim = (id) => (Object.prototype.hasOwnProperty.call(overrides, id) ? overrides[id] : loose);
  new Function('exports', 'require', 'module', compile(file))(moduleShim.exports, requireShim, moduleShim);
  return moduleShim.exports;
}

/** `StyleSheet.create` records every sheet it is handed, so a style block is read without a renderer. */
const sheets = [];
function loadWithSheets(file, overrides = {}) {
  sheets.length = 0;
  const exports = loadModule(file, {
    ...STUBS,
    'react-native': { ...STUBS['react-native'], StyleSheet: { create: (sheet) => { sheets.push(sheet); return sheet; } } },
    ...overrides,
  });
  return { exports, sheets };
}
function stylesWith(list, key) {
  const sheet = list.find((entry) => entry && Object.prototype.hasOwnProperty.call(entry, key));
  assert.ok(sheet, `no StyleSheet.create block carries a \`${key}\` style`);
  return sheet;
}

const tokens = loadModule(resolve(ROOT, 'src/theme/social.ts')).socialTokens;
const socialTypes = loadModule(resolve(ROOT, 'src/lib/socialTypes.ts'));
const content = loadModule(resolve(ROOT, 'src/lib/profileContent.ts'), { './socialTypes': socialTypes });
const web = loadModule(EXPERIENCE, {});
const screenSource = readFileSync(SCREEN, 'utf8');

const localeSource = readFileSync(LOCALE, 'utf8');
function romanian(key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`"${escaped}":\\s*"([^"]*)"`).exec(localeSource);
  assert.ok(match, `interface-locale.js has no ${key}`);
  return match[1];
}

/** The stylesheet, comments stripped, flattened into rules so one declaration can be read off a selector. */
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, ' ');
const cssRules = (file) => [...stripComments(readFileSync(file, 'utf8')).matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selectors, body]) => ({ selectors: selectors.split(',').map((entry) => entry.trim()), body }));
const rules = [...cssRules(CSS), ...cssRules(DETAIL_CSS)];

function declaration(selector, property) {
  const escaped = property.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  const pattern = new RegExp(`(?:^|;)\\s*${escaped}\\s*:\\s*([^;}]+)`, 'gi');
  const found = rules
    .filter((rule) => rule.selectors.includes(selector))
    .flatMap((rule) => [...rule.body.matchAll(pattern)].map((match) => match[1].trim()));
  assert.ok(found.length, `no stylesheet sets ${property} on ${selector}`);
  return found[found.length - 1];
}

const captures = new Map();
function capture(name) {
  if (!captures.has(name)) captures.set(name, JSON.parse(readFileSync(resolve(CAPTURES, `${name}.dom.json`), 'utf8')));
  return captures.get(name);
}
/** One measured node of a capture, by one of its classes: the geometry is what the web painted there. */
function node(name, className) {
  const found = capture(name).nodes.find((entry) => (entry.cls || '').split(' ').includes(className));
  assert.ok(found, `${name}.dom.json has no node with class ${className}`);
  return found;
}
function nodes(name, className) {
  return capture(name).nodes.filter((entry) => (entry.cls || '').split(' ').includes(className));
}
const px = (value) => Number.parseFloat(String(value).replace('px', ''));
/** The capture reports computed colours the way a browser does; these read one out of a stylesheet value. */
function rgba(value) {
  const parts = String(value).replace(/^rgba?\(|\)$/g, '').split(',').map((entry) => Number.parseFloat(entry));
  const [r, g, b, a = 1] = parts;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function rgb(value) {
  const hex = /^#([0-9a-f]{6})$/i.exec(String(value));
  if (hex) {
    const parsed = Number.parseInt(hex[1], 16);
    return `rgb(${(parsed >> 16) & 255}, ${(parsed >> 8) & 255}, ${parsed & 255})`;
  }
  return rgba(value).replace(/,\s*1\)$/, ')').replace('rgba(', 'rgb(');
}


test('cele cinci tab-uri poartă semnele și cuvintele web-ului', () => {
  const frozen = /const CONTENT_TAB_GLYPHS = Object\.freeze\(\{([^}]*)\}\)/.exec(readFileSync(EXPERIENCE, 'utf8'))[1];
  const webGlyphs = Object.fromEntries([...frozen.matchAll(/(\w+):\s*'([^']*)'/g)].map(([, key, value]) => [key, value]));
  assert.deepEqual({ ...content.CONTENT_TAB_GLYPHS }, webGlyphs);
  for (const [id, word] of Object.entries(content.CONTENT_TAB_LABELS)) {
    assert.equal(word, romanian(`profile.tab${id[0].toUpperCase()}${id.slice(1)}`), id);
  }
  // The bar keeps the web's own order and its own labels, read from the one list the web reads.
  assert.match(screenSource, /const TABS = CONTENT_TAB_ORDER\.map\(\(id\) => \(\{ id, label: CONTENT_TAB_LABELS\[id\], glyph: CONTENT_TAB_GLYPHS\[id\] \}\)\)/);
  assert.deepEqual([...content.CONTENT_TAB_ORDER], ['flow', 'reels', 'shots', 'whispers', 'moments']);
});

test('grila pune trei plăci de 155 pe rând, cu 2px între ele, iar rândul incomplet rămâne incomplet', () => {
  const tiles = nodes('tab-1', 'profileTile');
  assert.ok(tiles.length >= 3, 'the Reels tab has tiles');
  const [first, second, third] = tiles;
  assert.deepEqual(first.r.slice(2), [155, 155]);
  assert.equal(second.r[0] - first.r[0], 157);
  assert.equal(third.r[0] - second.r[0], 157);
  // 3 * 155 + 2 * 2 = 469, the arithmetic the capture shows on the phone's own viewport.
  assert.equal(155 * 3 + 2 * 2, capture('tab-1').viewport.w);
  assert.equal(px(declaration('.ownerPostGrid', 'gap')), 2);
  assert.equal(declaration('.ownerPostGrid', 'grid-template-columns'), 'repeat(3,1fr)');

  const tile = stylesWith(loadWithSheets(TILE, { '../theme/social': { socialTokens: tokens } }).sheets, 'tile').tile;
  assert.equal(tile.aspectRatio, 1);
  const rows = stylesWith(loadWithSheets(SCREEN, {
    '../lib/profileContent': content, '../theme/social': { socialTokens: tokens },
  }).sheets, 'tileRow');
  assert.equal(rows.tileRow.gap, 2);
  assert.equal(rows.tileSpacer.flexBasis, 0);
  assert.equal(rows.tileSpacer.aspectRatio, tile.aspectRatio);
  assert.equal(tokens.archive.gridColumns, 3);
});

test('cardul de șoaptă are numerele măsurate în captura filei Șoapte', () => {
  const card = node('tab-3', 'ownerWhisperCard');
  const actions = node('tab-3', 'ownerWhisperActions');
  const plates = nodes('tab-3', 'ownerWhisperAction');
  const openReply = node('tab-3', 'ownerSharedReplyOpen');
  assert.equal(card.r[0], 12);

  const sheet = stylesWith(loadWithSheets(WHISPER, { '../theme/social': { socialTokens: tokens } }).sheets, 'card');
  assert.equal(px(declaration('.ownerWhisperCard', 'padding')), sheet.card.padding);
  assert.equal(px(declaration('.ownerWhisperCard', 'gap')), sheet.card.gap);
  assert.equal(px(declaration('.ownerWhisperCard', 'border-radius')), sheet.card.borderRadius);
  assert.equal(px(declaration('.ownerWhisperActions', 'gap')), sheet.actions.gap);
  assert.equal(actions.r[3], sheet.action.minHeight);
  assert.equal(px(declaration('.ownerWhisperAction', 'min-height')), sheet.action.minHeight);
  assert.equal(px(declaration('.ownerWhisperAction', 'padding').split(' ')[1]), sheet.action.paddingHorizontal);
  assert.equal(px(declaration('.ownerWhisperAction', 'border-radius')), sheet.action.borderRadius);
  assert.equal(plates[0].s.br, `${sheet.action.borderRadius}px`);
  assert.equal(plates[0].s.bg, rgba(declaration('.ownerWhisperAction', 'background')));
  assert.equal(rgba(sheet.action.backgroundColor), rgba(declaration('.ownerWhisperAction', 'background')));
  assert.equal(openReply.r[3], sheet.openReply.minHeight);
  assert.equal(px(declaration('.ownerSharedReplyOpen', 'min-height')), sheet.openReply.minHeight);
  assert.equal(px(declaration('.ownerSharedReplyOpen', 'padding').split(' ')[1]), sheet.openReply.paddingHorizontal);
  /** The card's four edges, read off the border the capture painted: the left one is the card's own mark. */
  const edges = (measured) => measured.match(/rgba?\([^)]*\)/g);
  assert.equal(edges(card.s.bd)[3], rgb(sheet.sharedCard.borderLeftColor));
  assert.equal(sheet.sharedCard.borderLeftColor, tokens.archive.cardShareEdge);
  assert.equal(edges(nodes('tab-3', 'ownerWhisperCard')[1].s.bd)[3], rgba(sheet.card.borderLeftColor));
});

test('linia semnalelor și farfuria reacțiilor poartă numerele capturii', () => {
  const reason = node('tab-3', 'rankReason');
  const label = node('tab-3', 'rankReasonLabel');
  const metric = node('tab-3', 'reactionMetric');
  const inside = capture('tab-3').nodes.filter((entry) => entry.n > metric.n && entry.n < metric.n + 3);
  const glyph = inside.find((entry) => entry.tag === 'b');
  const count = inside.find((entry) => entry.tag === 'em');
  assert.ok(glyph && count, 'the reaction metric holds a glyph and a count');

  const card = stylesWith(loadWithSheets(WHISPER, { '../theme/social': { socialTokens: tokens } }).sheets, 'card');
  assert.equal(reason.s.fs, `${card.reason.fontSize}px`);
  assert.equal(reason.s.color, rgb(card.reason.color));
  assert.equal(label.s.color, rgb(card.reasonLabel.color));

  const plate = stylesWith(loadWithSheets(REACTIONS, { '../theme/social': { socialTokens: tokens } }).sheets, 'whisperButton');
  assert.equal(px(glyph.s.fs), plate.whisperGlyph.fontSize);
  assert.equal(px(count.s.fs), plate.whisperCount.fontSize);
  assert.equal(plate.whisperButton.minHeight, card.action.minHeight);
  assert.equal(plate.whisperButton.paddingHorizontal, card.action.paddingHorizontal);
  assert.equal(plate.whisperButton.borderRadius, card.action.borderRadius);
  assert.equal(plate.whisperButton.backgroundColor, card.action.backgroundColor);
  assert.equal(plate.whisperButtonOn.borderColor, tokens.archive.actionOnBorder);
  // The card hands its summary to the plate, and the plate floats its palette above its own button.
  assert.match(readFileSync(WHISPER, 'utf8'), /<ReactionControl variant="whisper" summary=\{summary\} onReact=\{react\} \/>/);
  assert.equal(plate.whisperPalette.bottom, card.action.minHeight + 6);
});


test('fluxul împletește plăcile cu cardurile, iar filele de colecție ridică fixatele', () => {
  const media = { kind: 'image', hash: 'a'.repeat(64), ext: 'jpg' };
  const posts = [1, 2, 3, 4, 5].map((id) => ({ id, created_at: 1000 - id, media }));
  const whisper = { id: 9, created_at: 1000.5, caption: 'un cuvânt' };
  const archive = { posts: [...posts, whisper], sharedReplies: [] };

  const bands = content.archiveBands(content.archiveNodes(archive, 'newest'));
  // The whisper is the newest node, so it opens the stream; the tiles after it keep their rows of three.
  assert.deepEqual(bands.map((band) => band.kind), ['whisper', 'tiles', 'tiles']);
  assert.deepEqual(bands[1].posts.map((post) => post.id), [1, 2, 3]);
  assert.deepEqual(bands[2].posts.map((post) => post.id), [4, 5]);

  // The web's own buckets are the oracle for what a tile is, what a whisper is and how the two are ordered
  // (`profilePostKind` + `profileContentBuckets`); the phone also keeps the merged `list` the weave reads.
  const webBuckets = web.profileContentBuckets([...posts, whisper]);
  const phoneBuckets = content.profileContentBuckets([...posts, whisper]);
  assert.deepEqual(phoneBuckets.tiles.map((post) => post.id), webBuckets.tiles.map((post) => post.id));
  assert.deepEqual(phoneBuckets.whispers.map((post) => post.id), webBuckets.whispers.map((post) => post.id));
  assert.equal(phoneBuckets.list.length, posts.length + 1);
  for (const id of [1, 2, 3, 4, 5]) {
    assert.equal(content.profilePostKind(posts[id - 1]), web.profilePostKind(posts[id - 1]));
  }
  assert.equal(content.profilePostKind(whisper), web.profilePostKind(whisper));
  // The web writes the four numbers as attributes on the node (`postOrderAttributes`); the phone keeps them
  // as the record the same four questions are answered with.
  const attributes = web.postOrderAttributes(posts[1], 998);
  const measured = Object.fromEntries(
    [...attributes.matchAll(/data-profile-(\w+)="(-?\d+)"/g)].map(([, key, value]) => [key, Number(value)]),
  );
  const rated = content.postOrderAttributes(posts[1], 998);
  assert.deepEqual({ stamp: rated.stamp, score: rated.score, rank: rated.rank, pin: rated.pin }, measured);

  // A pin is a decision about the profile: a collection hoists it, a timeline only marks it.
  const pinned = [
    { id: 1, created_at: 10, media, pinned_at: 500 },
    { id: 2, created_at: 20, media },
  ];
  assert.deepEqual(content.orderArchive(pinned, 'newest', { hoistPins: true }).map((post) => post.id), [1, 2]);
  assert.deepEqual(content.orderArchive(pinned, 'newest', { hoistPins: false }).map((post) => post.id), [2, 1]);
  assert.equal(content.postOrderAttributes(pinned[0]).pin, 500);
  // The tile states the hoisted pin, which is what `applyOrder` toggles on the node itself.
  assert.match(screenSource, /pinnedFirst=\{hoistPins && Number\(post\.pinned_at \|\| 0\) > 0\}/);
  assert.match(screenSource, /const hoistPins = tab === 'reels' \|\| tab === 'shots';/);
});

test('tab-ul Momente răspunde cu raftul măsurat, apoi cu propozițiile capturii', () => {
  const panel = node('tab-4', 'ownerMomentsPanel');
  const block = node('tab-4', 'ownerEmptyState');
  const inside = capture('tab-4').nodes.filter((entry) => entry.n > block.n && entry.n < block.n + 8);
  const title = inside.find((entry) => entry.tag === 'b');
  const detail = inside.find((entry) => entry.tag === 'span');
  assert.ok(title && detail, 'the moment empty state holds a title and a detail');
  assert.equal(content.PROFILE_EMPTY_STATES.moments.title, title.text);
  assert.equal(content.PROFILE_EMPTY_STATES.moments.detail, detail.text);
  assert.equal(romanian('profile.moments'), 'Moments');
  assert.equal(panel.r[0], 0);

  const shelf = stylesWith(loadWithSheets(SHELF, { '../theme/social': { socialTokens: tokens } }).sheets, 'circle');
  assert.equal(px(declaration('.ownerMomentsPanel', 'padding').split(' ')[0]), shelf.panel.paddingTop);
  assert.equal(px(declaration('.ownerMomentsPanel', 'padding').split(' ')[2]), shelf.panel.paddingBottom);
  assert.equal(px(declaration('.ownerMomentsPanel>div', 'gap')), shelf.row.gap);
  assert.equal(px(declaration('.ownerMomentsPanel button i', 'width')), shelf.circle.width);
  assert.equal(shelf.circle.borderRadius, shelf.circle.width / 2);
  assert.equal(declaration('.ownerMomentsPanel button i', 'border'), `2px solid ${shelf.circle.borderColor}`);
  assert.equal(px(declaration('.ownerMomentsPanel button small', 'font-size')), shelf.label.fontSize);
  // Both are drawn: the shelf answers the tab, and the empty state follows it when it holds nothing.
  assert.match(screenSource, /<ProfileMomentsShelf shelf=\{shelf\} \/>/);
  assert.match(screenSource, /shelf\.tiles\.length \? null : <ProfileEmptyState tab="moments" \/>/);
});


test('fiecare cuvânt al cardurilor vine din pachetul ro-RO', () => {
  const whisperSource = readFileSync(WHISPER, 'utf8');
  assert.equal(romanian('x.repost.mine'), 'Ai repostat');
  assert.equal(romanian('x.repost.by'), 'a repostat');
  for (const key of ['x.repost.mine', 'x.repost.by', 'profile.openReply', 'profile.sharedReplyOn', 'comments.title', 'post.repost']) {
    assert.ok(whisperSource.includes(romanian(key)), `ProfileWhisperCard.tsx does not print ${key}`);
  }
  assert.ok(readFileSync(REACTIONS, 'utf8').includes(romanian('post.openReactions')));
  // The shared reply's sentence is the bundle's words plus the handle it names.
  assert.ok(whisperSource.includes('`la postarea ${reply.onPostBy}`'));
  // The line above a whisper answers the profile's question, never the feed's.
  assert.equal(content.PROFILE_WHY_SIGNALS, romanian('profile.whySignals'));
  assert.ok(whisperSource.includes('<Text style={styles.reasonLabel}>{signals.label}</Text>'));
  // The plate's own words are the ones the feed's picker prints, from one list.
  assert.equal(romanian('comments.title'), 'Comentarii');
});

test('răspunsul distribuit spune pe ce postare a fost scris și se deschide în conversația lui', () => {
  const reposted = node('tab-3', 'postRepostedBy');
  const line = capture('tab-3').nodes.filter((entry) => entry.n > reposted.n && entry.n < reposted.n + 4);
  const who = line.find((entry) => entry.tag === 'b');
  const on = line.find((entry) => entry.tag === 'span');
  assert.ok(who && on, 'the share line holds who shared it and the post it came from');
  assert.equal(who.text, romanian('x.repost.mine'));
  assert.equal(on.text, `${romanian('profile.sharedReplyOn')} @test`);

  const opened = node('tab-3', 'ownerSharedReplyOpen');
  assert.equal(opened.text, romanian('profile.openReply'));
  const sheet = stylesWith(loadWithSheets(WHISPER, { '../theme/social': { socialTokens: tokens } }).sheets, 'openReply');
  assert.equal(declaration('.ownerSharedReplyOpen', 'color'), sheet.openReplyText.color);
  assert.equal(px(declaration('.ownerSharedReplyOpen', 'border-radius')), sheet.openReply.borderRadius);
  assert.equal(declaration('.postRepostedBy', 'color'), tokens.archive.repostLineInk);
  assert.equal(sheet.repostWho.color, tokens.archive.repostLineInk);
  assert.equal(sheet.repostHandle.color, tokens.archive.repostLineHandle);
  assert.equal(declaration('.postRepostedBy bdi', 'color'), sheet.repostHandle.color);
  assert.equal(declaration('.ownerSharedReplyCard .postRepostedBy span', 'color'), sheet.repostMuted.color);
  // Its one press is the reply's own thread, never the post's conversation.
  assert.match(readFileSync(WHISPER, 'utf8'), /openReplyThread\(reply\.post, Number\(reply\.comment\.id\)\)/);
  const model = readFileSync(resolve(ROOT, 'src/lib/profileContent.ts'), 'utf8');
  assert.match(model, /onPostBy: entry\.post_author\?\.handle \? `@\$\{entry\.post_author\.handle\}` : ''/);
});

