/* global __dirname */
// The profile grid: the owner's arrangement, the two actions of a cell, and the reader the grid opens.
//
// The archive is not a gallery of somebody else's order. A press held for a second opens the arrangement,
// a drag writes the order to the server (`POST /api/posts/order`), a pin hoists one post without
// rewriting the places of the others, and a deletion waits for its own confirmation. This suite checks
// the arithmetic of all of that as numbers, and the contracts of the screen and the route as source,
// because the physical result still needs the Xiaomi.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');

function load(file, requireShim) {
  const code = ts.transpileModule(readFileSync(resolve(ROOT, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleShim = { exports: {} };
  new Function('module', 'exports', 'require', code)(moduleShim, moduleShim.exports, requireShim);
  return moduleShim.exports;
}

const grid = load('src/lib/profileGrid.ts', () => ({}));
const social = load('src/lib/socialTypes.ts', () => ({}));
const content = load('src/lib/profileContent.ts', (id) => {
  if (id === './socialTypes') return social;
  if (id === './postPresentation') return load('src/lib/postPresentation.ts', () => ({}));
  if (id === './profileGrid') return grid;
  throw new Error(`profileContent.ts asked for ${id}`);
});

const read = (file) => readFileSync(resolve(ROOT, file), 'utf8');
const screen = read('src/screens/ProfileScreen.tsx');
const tile = read('src/components/ProfileTile.tsx');
const route = read('src/app/post/[id].tsx');
const band = read('src/components/ProfileBand.tsx');
/** Source without comments: a word inside a note is not a control. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const screenCode = code(screen);
const tileCode = code(tile);
const routeCode = code(route);

test('the arrangement is read from the places the server wrote, and from nowhere else', () => {
  const places = grid.arrangementMap([
    { id: 3, grid_position: 0 },
    { id: 1 },
    { id: 2, grid_position: 1 },
    { id: 4, grid_position: null },
    { id: 5, grid_position: 'x' },
  ]);
  assert.deepEqual([...places.entries()], [[3, 0], [2, 1]]);
  assert.equal(grid.arrangementRank({ id: 3 }, places), 0);
  assert.equal(grid.arrangementRank({ id: 1 }, places), null, 'a post nobody placed has no place at all');
  assert.equal(grid.arrangementRank({ id: 3 }, null), null);

  const preview = grid.optimisticArrangement([9, 7, 9, 0]);
  assert.deepEqual([...preview.entries()], [[9, 0], [7, 1]], 'the first place wins and nothing invalid is placed');
  assert.deepEqual([...grid.optimisticArrangement(null).entries()], []);
});

test('a drag moves one cell and leaves every other cell in its own order', () => {
  assert.deepEqual(grid.moveWithin([1, 2, 3, 4], 0, 3), [2, 3, 4, 1], 'first to last');
  assert.deepEqual(grid.moveWithin([1, 2, 3, 4], 3, 0), [4, 1, 2, 3], 'last to first');
  assert.deepEqual(grid.moveWithin([1, 2, 3, 4], 1, 2), [1, 3, 2, 4], 'one place down');
  assert.deepEqual(grid.moveWithin([1, 2, 3, 4], 2, 2), [1, 2, 3, 4], 'a tap that did not drag');
  assert.deepEqual(grid.moveWithin([1, 2, 3, 4], -5, 99), [2, 3, 4, 1], 'a place outside the grid is clamped');
  assert.deepEqual(grid.moveWithin([1], 0, 1), [1]);
  assert.deepEqual(grid.moveWithin(null, 0, 1), []);
});

test('a cell is 9:16 and the columns fill the width exactly', () => {
  const geometry = grid.tileSize(360, 3, 2);
  assert.equal(Math.round(geometry.width * 100) / 100, 118.67);
  assert.equal(Math.round(geometry.height * 100) / 100, 210.96, 'a 9:16 cell of that width');
  assert.equal(3 * geometry.width + 2 * geometry.gap, 360, 'three columns and two gaps are the whole width');
  assert.equal(geometry.columns, 3);
  assert.equal(geometry.tileWidth, geometry.width);

  const first = grid.gridSlot(0, geometry);
  const second = grid.gridSlot(1, geometry);
  const third = grid.gridSlot(2, geometry);
  const fourth = grid.gridSlot(3, geometry);
  assert.deepEqual([first.left, first.top], [0, 0]);
  assert.equal(second.left, geometry.width + 2, 'the next cell starts one cell and one gap further');
  assert.equal(third.column, 2);
  assert.equal(fourth.row, 1, 'the fourth cell opens the second row');
  assert.equal(fourth.top, geometry.height + 2);
  // A zero-width measurement (the first frame) must not divide by anything or place a cell nowhere.
  assert.deepEqual(grid.gridSlot(0, grid.tileSize(0, 3, 2)), { row: 0, column: 0, left: 0, top: 0 });
});

test('the place a drag names is the slot under the finger, and never outside the grid', () => {
  const geometry = grid.tileSize(360, 3, 2);
  const strideX = geometry.width + geometry.gap;
  const strideY = geometry.height + geometry.gap;
  assert.equal(grid.gridTarget({ index: 1, dx: 0, dy: 0, count: 9, geometry }), 1, 'no movement is no move');
  assert.equal(grid.gridTarget({ index: 0, dx: strideX * 2, dy: 0, count: 9, geometry }), 2, 'across to the third column');
  assert.equal(grid.gridTarget({ index: 0, dx: 0, dy: strideY, count: 9, geometry }), 3, 'down one row');
  assert.equal(grid.gridTarget({ index: 0, dx: strideX, dy: strideY, count: 9, geometry }), 4);
  assert.equal(grid.gridTarget({ index: 4, dx: 0, dy: -strideY, count: 9, geometry }), 1, 'up one row');
  assert.equal(grid.gridTarget({ index: 8, dx: 0, dy: strideY * 4, count: 9, geometry }), 8, 'past the last cell is the last cell');
  assert.equal(grid.gridTarget({ index: 0, dx: -strideX * 3, dy: -strideY * 3, count: 9, geometry }), 0, 'before the first cell is the first');
  assert.equal(grid.gridTarget({ index: 3, dx: 0, dy: 0, count: 4, geometry }), 3, 'a short archive keeps its own last place');
  assert.equal(grid.gridTarget({ index: 0, dx: 0, dy: 0, count: 0, geometry }), 0);
});

test('a pin is offered until three are pinned, and a deletion only on a post of your own', () => {
  const stranger = grid.manageActions({ id: 4 }, { isOwner: false, pinnedCount: 0 });
  assert.deepEqual([stranger.canPin, stranger.canDelete], [false, false], 'nothing is offered on an archive of somebody else');

  const mine = grid.manageActions({ id: 4 }, { isOwner: true, pinnedCount: 0 });
  assert.deepEqual([mine.canPin, mine.canDelete, mine.pinWord], [true, true, 'Fixează']);

  const pinned = grid.manageActions({ id: 4, pinned_at: 1700000000 }, { isOwner: true, pinnedCount: 3 });
  assert.equal(pinned.canPin, true, 'a post already pinned may be unpinned even at the limit');
  assert.equal(pinned.pinWord, 'Scoate din fixate');
  assert.equal(pinned.pinReason, '');

  const blocked = grid.manageActions({ id: 5 }, { isOwner: true, pinnedCount: 3 });
  assert.equal(blocked.canPin, false);
  assert.match(blocked.pinReason, /3/, 'the refusal names the allowance it ran out of');
  assert.equal(blocked.canDelete, true, 'the allowance of pins is not the allowance of deletions');

  assert.equal(grid.pinnedCount([{ pinned_at: 1 }, { pinned_at: 0 }, {}]), 1);

  /**
   * A reposted cell is the owner's archive but somebody else's work: the server places only this
   * account's own posts (`repo.setProfileGridOrder`) and withdraws only its own (`repo.withdrawPost`), so
   * neither control may be painted on a foreign cell.
   */
  const foreign = grid.manageActions({ id: 9, user_id: 7 }, { isOwner: true, ownerId: 5, pinnedCount: 0 });
  assert.deepEqual([foreign.canPin, foreign.canDelete, foreign.canPlace], [false, false, false]);
  const ownWork = grid.manageActions({ id: 9, user_id: 5 }, { isOwner: true, ownerId: 5, pinnedCount: 0 });
  assert.deepEqual([ownWork.canPin, ownWork.canDelete, ownWork.canPlace], [true, true, true]);
});

test('a drag over a reposted cell lands on the closest cell the server will place', () => {
  const posts = [
    { id: 1, user_id: 5 }, { id: 2, user_id: 7 }, { id: 3, user_id: 5 }, { id: 4, user_id: 7 },
  ];
  assert.equal(grid.nearestPlaceable(posts, 0, 5), 0);
  assert.equal(grid.nearestPlaceable(posts, 1, 5), 2, 'downwards first');
  assert.equal(grid.nearestPlaceable(posts, 3, 5), 2, 'then upwards, at the end of the grid');
  assert.equal(grid.nearestPlaceable(posts, 9, 5), 2, 'an index outside the grid is clamped, then searched backwards');
  assert.equal(grid.nearestPlaceable([{ id: 1, user_id: 7 }], 0, 5), 0, 'nothing placeable still names a place');
  assert.deepEqual(grid.placeableIds(posts, 5), [1, 3]);
  assert.deepEqual(grid.placeableIds(posts, null), [1, 2, 3, 4], 'no owner to compare is no refusal to make');
  assert.equal(grid.isOwnPost({ id: 1, user_id: 5 }, 5), true);
  assert.equal(grid.isOwnPost({ id: 1, user_id: 7 }, 5), false);
});


test('the grid draws the pins first and the arrangement inside them', () => {
  const posts = [
    { id: 1, caption: 'unu', created_at: 100 },
    { id: 2, caption: 'doi', created_at: 200, pinned_at: 900 },
    { id: 3, caption: 'trei', created_at: 300, pinned_at: 950 },
    { id: 4, caption: 'patru', created_at: 400 },
  ];
  const places = grid.optimisticArrangement([3, 1, 4]);
  const ordered = content.orderArchive(posts, 'newest', { hoistPins: true, arrangement: places });
  assert.deepEqual(ordered.map((post) => post.id), [2, 3, 1, 4], 'the pins hoisted oldest first, then the arrangement, then the unplaced post');
  // A second pin keeps the first pin first: pinning again does not reshuffle the places.
  assert.deepEqual(ordered.filter((post) => post.pinned_at).map((post) => post.id), [2, 3]);
  const both = content.orderArchive(posts, 'newest', { hoistPins: true, arrangement: grid.optimisticArrangement([2, 3, 1, 4]) });
  assert.deepEqual(both.map((post) => post.id), [2, 3, 1, 4]);
  // Popular is a measurement: it does not obey a drag.
  const popular = content.orderArchive(
    [{ id: 1, created_at: 100, reactions: { counts: { LIKE: 9 } } }, { id: 2, created_at: 200 }],
    'popular',
    { hoistPins: true, arrangement: grid.optimisticArrangement([2, 1]) },
  );
  assert.deepEqual(popular.map((post) => post.id), [1, 2]);
  // A post nobody placed stays where time put it: above the arrangement, newest first.
  const unplaced = content.orderArchive(
    [{ id: 1, created_at: 100, grid_position: 0 }, { id: 2, created_at: 500 }, { id: 3, created_at: 300 }],
    'newest',
    { arrangement: grid.arrangementMap([{ id: 1, grid_position: 0 }]) },
  );
  assert.deepEqual(unplaced.map((post) => post.id), [2, 3, 1], 'unplaced posts keep time order above the arrangement');
});

test('a press held on a cell opens the arrangement, and the wall keeps scrolling', () => {
  // A hold, not a tap, and not a whole second: the old full-second threshold raced the finger's own
  // release, so a deliberate hold regularly opened the post instead of the wall's arrangement.
  assert.match(screenCode, /const HOLD_TO_MANAGE_MS = 500;/);
  assert.match(tileCode, /holdMs = 500/);
  assert.match(tileCode, /delayLongPress=\{holdMs\}/);
  assert.match(tileCode, /onLongPress=\{onManage\}/);
  assert.match(screenCode, /onManage=\{isOwner \? beginManaging : undefined\}/);
  assert.match(screenCode, /holdMs=\{HOLD_TO_MANAGE_MS\}/);
  // Scrolling is never taken away: a mode that forbids it makes a long profile unreachable, and a drag
  // needs the scroller anyway for its own edge-scrolling.
  assert.doesNotMatch(screenCode, /scrollEnabled=\{!managing\}/);
  assert.match(screenCode, /onScroll=\{onScrollWall\}/);
  // The mode's own bar is a dock outside the scroller, so its exit cannot scroll out of reach.
  assert.match(screenCode, /accessibilityLabel="Gata, păstrează ordinea"/);
  assert.match(screenCode, /styles\.manageDock/);
  // The bar above the wall is drawn in both modes, with the same height: hiding it would lift the whole
  // wall by its own height under the finger that opened the mode.
  assert.doesNotMatch(screenCode, /isOwner && !managing/);
  assert.match(screenCode, /minHeight: 60,/);
  assert.match(screenCode, /Grila de aranjat/);
  assert.match(screenCode, /accessibilityLabel=\{managing \? 'Gata, păstrează ordinea' : 'Aranjează grila'\}/);
});

test('the arrangement is written to the route that stores it, and the order is read back', () => {
  assert.match(screenCode, /nexusApi<\{ ok: true; order: number\[\]; entries\?: unknown\[\] \}>\('\/api\/posts\/order', \{/);
  assert.match(screenCode, /const entries = orderEntries\(ids\);/);
  assert.match(screenCode, /body: JSON\.stringify\(\{ order: entries \}\)/);
  assert.match(screenCode, /setArranged\(reordered\)/);
  assert.match(screenCode, /void persistOrder\(placeableIds\(/);
  assert.match(screenCode, /const arrangement = useMemo<Arrangement>\(\s+\(\) => \(arranged \? optimisticArrangement\(arranged\) : arrangementMap\(archive\.posts\)\),/);
  assert.match(screenCode, /archiveNodes\(archive, reading, \{ hoistPins: true, arrangement \}\)/);
  assert.match(screenCode, /nodesOfTab\(archive\.posts, tab, reading, arrangement\)/);
});

test('a repost is a tile of the same arrangement, written to its own share', () => {
  /**
   * A repost shows somebody else's post on this profile. It is the owner's *entry*, so it can be dragged;
   * the place is written to `post_shares.grid_position`, and the original post's own `grid_position` is
   * never read for it and never written by it.
   */
  assert.equal(grid.tileId({ id: 12 }), 12);
  assert.equal(grid.tileId({ id: 12, __repost: { id: 4 } }), -4, 'a repost is its share, and the sign keeps it apart');
  assert.equal(grid.tileId({ __repost: { id: 4 }, grid_position: 0 }), -4, 'the post id may be absent from a repost node');
  assert.equal(grid.tileId({ id: 0 }), 0);
  assert.equal(grid.tileId(null), 0);

  assert.deepEqual(grid.tileEntry(12), { post_id: 12 });
  assert.deepEqual(grid.tileEntry(-4), { share_id: 4 });
  assert.equal(grid.tileEntry(0), null);
  assert.deepEqual(grid.orderEntries([12, -4, 13]), [{ post_id: 12 }, { share_id: 4 }, { post_id: 13 }]);

  const posts = [
    { id: 12, user_id: 12, grid_position: 1 },
    { id: 8, user_id: 99, __repost: { id: 4, grid_position: 0 } },
  ];
  const places = grid.arrangementMap(posts);
  assert.equal(places.get(-4), 0, "the repost's own place is the share's");
  assert.equal(places.get(12), 1);
  // The post inside the repost carries no place of its own here: reading it would move someone else's grid.
  assert.equal(places.get(8), undefined);
  assert.equal(grid.arrangementRank(posts[1], places), 0);
  assert.deepEqual(grid.placeableIds(posts, 12), [12, -4], 'both tiles are the owner’s to arrange');

  const repost = grid.manageActions({ id: 8, user_id: 99, __repost: { id: 4 } }, { isOwner: true, ownerId: 12, pinnedCount: 0 });
  assert.deepEqual([repost.canPin, repost.canDelete, repost.canPlace], [false, false, true], 'arrange yes, pin and delete no');
  const foreign = grid.manageActions({ id: 8, user_id: 99 }, { isOwner: true, ownerId: 12, pinnedCount: 0 });
  assert.equal(foreign.canPlace, false, 'somebody else’s post that is not a repost is not arrangeable');

  // A finger that lets go over a repost now lands on that repost, not on the nearest post beside it.
  const mixed = [{ id: 12 }, { id: 8, __repost: { id: 4 } }, { id: 13 }];
  assert.equal(grid.nearestPlaceable(mixed, 1, 12), 1);
});

test('the archive keeps a repost’s place from the payload, not the post’s own', () => {
  const payload = {
    posts: [{ id: 12, caption: 'a', created_at: 100, grid_position: 1 }],
    reposts: [{
      share_id: 4,
      reposted_at: 200,
      grid_position: 0,
      repost: { id: 4, reposted_at: 200, mine: true },
      post: { id: 8, caption: 'b', created_at: 50, grid_position: 7 },
    }],
  };
  const archive = content.profileArchive(payload);
  const repost = archive.posts.find((post) => Number(post.id) === 8);
  assert.ok(repost && repost.__repost, 'the shared post arrives as a repost node');
  assert.equal(repost.__repost.id, 4, 'the stamp keeps the share id a drag writes');
  assert.equal(repost.__repost.grid_position, 0, 'the place is the share’s');

  const places = grid.arrangementMap(archive.posts);
  assert.equal(places.get(-4), 0);
  assert.equal(places.get(12), 1);
  assert.equal(places.get(8), undefined, 'the original post’s own place from another profile is never adopted');
});

test('pin and delete are the two actions of a managed cell, on the routes the server owns', () => {
  assert.match(tileCode, /accessibilityLabel=\{`\$\{manage\.pinWord\} postarea \$\{post\.id\}`\}/);
  assert.match(tileCode, /accessibilityLabel=\{`Șterge postarea \$\{post\.id\}`\}/);
  assert.match(tileCode, /disabled=\{!manage\.canPin \|\| manage\.busy\}/);
  assert.match(screenCode, /nexusApi\(`\/api\/posts\/\$\{Number\(post\.id\)\}\/pin`, \{ method: 'POST', body: JSON\.stringify\(\{ pinned: next \}\) \}\)/);
  assert.match(screenCode, /nexusApi\(`\/api\/posts\/\$\{Number\(post\.id\)\}`, \{ method: 'DELETE' \}\)/);
  assert.match(screenCode, /manageActions\(post, \{ isOwner, pinnedCount: pinnedNow, ownerId \}\)/);
  // Nobody's post but the owner's is ever painted with a delete control.
  assert.match(screenCode, /const isOwner = data\?\.profile\?\.is_self === true;/);
});

test('a deletion asks first, and cancelling it changes nothing', () => {
  assert.match(screenCode, /<Modal visible=\{confirmDelete !== null\} transparent animationType="fade"/);
  assert.match(screenCode, /accessibilityLabel="Anulează ștergerea"/);
  assert.match(screenCode, /onPress=\{\(\) => setConfirmDelete\(null\)\}/);
  assert.match(screenCode, /onPress=\{\(\) => \{ if \(confirmDelete\) void deleteConfirmed\(confirmDelete\); \}\}/);
  // The confirmation is the only caller of the deletion: the trash control opens the sheet.
  assert.equal((screenCode.match(/deleteConfirmed/g) || []).length, 2, 'the definition and the one confirmation');
  assert.match(screenCode, /onDelete: \(\) => setConfirmDelete\(post\)/);
});


test('a cell carries the order it was opened from, and the reader walks that order', () => {
  assert.match(tileCode, /params: door\s+\? \{ id: String\(post\.id\), profile: door\.handle, tab: door\.tab, reading: door\.reading, index: String\(door\.index\) \}/);
  assert.match(screenCode, /door=\{\{ handle: String\(profile\?\.handle \|\| handle\), tab, reading: readings\[tab\], index: placeOf\[archiveKey\(post\)\] \?\? 0 \}\}/);
  assert.match(routeCode, /const walkMode = handle\.length > 0;/);
  assert.match(routeCode, /archiveNodes\(archive, reading, \{ hoistPins: true, arrangement \}\)/);
  assert.match(routeCode, /contentOfTab\(orderArchive\(archive\.posts, reading, \{ hoistPins: true, arrangement \}\), tab\)\.list/);
  assert.match(routeCode, /arrangementMap\(answer\.posts \?\? \[\]\)/);
  // Vertical, one page per screen, and the reader's own horizontal swipes stay inside the page.
  assert.match(routeCode, /pagingEnabled/);
  assert.match(routeCode, /getItemLayout=\{\(_, index\) => \(\{ length: height, offset: height \* index, index \}\)\}/);
  assert.match(routeCode, /initialScrollIndex=\{Math\.min\(startIndex, list\.length - 1\)\}/);
  assert.match(routeCode, /onMomentumScrollEnd=\{\(event\) => \{/);
  assert.doesNotMatch(routeCode, /feed\b/, 'the walk never falls back to a feed');
  // Back is the stack's own, which keeps the grid mounted with its scroll position.
  assert.match(routeCode, /if \(router\.canGoBack\(\)\) router\.back\(\);/);
});

test('the band stands still when the system asks for less motion', () => {
  assert.match(band, /AccessibilityInfo\.isReduceMotionEnabled\(\)/);
  assert.match(band, /AccessibilityInfo\.addEventListener\('reduceMotionChanged'/);
  assert.match(band, /if \(reduceMotion\) \{/);
  assert.match(band, /reduceMotion=\{reduceMotion\}/);
  assert.match(band, /\[paused, reduceMotion, runWidth, signature, resync, shift\]/);
  // The line now names the setting as one it reads.
  assert.match(band, /The system's reduced-motion setting is consulted/);
});


test('opening the arrangement leaves the wall where the finger found it, and Back leaves the mode', () => {
  /**
   * Opening the mode used to scroll the wall (`scrollTo gridTop - 132`) so the mode's bar would be in
   * view. That scroll is what made a held tile slide downwards under a finger that had not moved, and it
   * is gone: the bar is a dock at the foot of the screen instead.
   */
  assert.doesNotMatch(screenCode, /revealGrid/);
  assert.doesNotMatch(screenCode, /gridTop/);
  assert.match(screenCode, /const beginManaging = useCallback\(\(\) => \{/);
  assert.match(screenCode, /const endManaging = useCallback\(\(\) => \{/);
  // The shell the dock is placed in is the box an edge-scroll is measured against.
  assert.match(screenCode, /const shellRef = useRef<View>\(null\);/);
  assert.match(screenCode, /shellRef\.current\?\.measureInWindow/);
  // Back is the mode's own exit: pressing it once leaves the arrangement, not the profile.
  assert.match(screenCode, /BackHandler\.addEventListener\('hardwareBackPress'/);
  assert.match(screenCode, /const subscription = BackHandler\.addEventListener\('hardwareBackPress', \(\) => \{ endManaging\(\); return true; \}\);/);
});

