/* global __dirname */
// The profile grid's drag: one gesture, as a state machine and as arithmetic.
//
// The wall used to read the gesture through `PanResponder`'s `dx`/`dy`, which begin at the event that
// grants the responder and were rebuilt by any render that changed the archive. On the phone that meant
// a tile that trailed the thumb by the slop, a first tile that could jump away when a reload landed
// mid-drag, and a mode that turned scrolling off so a long profile could not be reached at all. This
// suite holds the replacement to its promises as numbers, and the screen to its own shape as source:
// a drag can only start on the grip, only one write travels at a time, a refused write rolls back, and
// nothing keeps the drag state after a release, a cancel or an exit.
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

// `profileDrag.ts` is pure arithmetic over `profileGrid.ts`, so both load as the app would load them.
const grid = load('src/lib/profileGrid.ts', () => ({}));
const drag = load('src/lib/profileDrag.ts', (id) => {
  if (id === './profileGrid') return grid;
  throw new Error(`profileDrag.ts asked for ${id}`);
});

const read = (file) => readFileSync(resolve(ROOT, file), 'utf8');
const screen = read('src/screens/ProfileScreen.tsx');
const tile = read('src/components/ProfileTile.tsx');
/** Source without comments: a word inside a note is not a control. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const screenCode = code(screen);
const tileCode = code(tile);

/** The cell of a phone 1220 points wide, three columns and a 2-point gap: the Xiaomi's own numbers. */
const geometry = grid.tileSize(1220, 3, 2);
const strideX = geometry.width + geometry.gap;
const strideY = geometry.height + geometry.gap;


test('a gesture starts where the finger touched down, and a still finger commits nothing', () => {
  const state = drag.beginDrag(7, 3);
  assert.deepEqual(state, { tile: 7, from: 3, target: 3, dx: 0, dy: 0 });
  // A hold that never moved is not an arrangement: the release says so, and no order is written.
  assert.deepEqual(drag.releaseDrag(state), { tile: 7, from: 3, target: 3, moved: false });
  assert.equal(drag.releaseDrag(null), null, 'a release without a drag is not a release');

  // One cell of movement is one place, and the release carries the place the finger left it in.
  const moved = drag.moveDrag(state, { dx: 0, dy: strideY, geometry, count: 12 });
  assert.equal(moved.target, 6);
  assert.deepEqual(drag.releaseDrag(moved), { tile: 7, from: 3, target: 6, moved: true });
});

test('the first cell is measured exactly like the middle and the last one', () => {
  /**
   * The bug report was about the *first* tile, so the first tile is checked against the same arithmetic
   * as the others: no special case, no index offset, no page-versus-local confusion.
   */
  const first = drag.beginDrag(11, 0);
  assert.deepEqual(drag.dragCentre(first, geometry), { x: geometry.width / 2, y: geometry.height / 2 });
  assert.equal(drag.moveDrag(first, { dx: 0, dy: 0, geometry, count: 12 }).target, 0);
  assert.equal(drag.moveDrag(first, { dx: strideX, dy: 0, geometry, count: 12 }).target, 1);
  assert.equal(drag.moveDrag(first, { dx: strideX * 2, dy: strideY, geometry, count: 12 }).target, 5);
  assert.equal(drag.moveDrag(first, { dx: 0, dy: -strideY * 3, geometry, count: 12 }).target, 0, 'before the first place is the first place');

  const middle = drag.beginDrag(12, 4);
  assert.equal(drag.moveDrag(middle, { dx: 0, dy: -strideY, geometry, count: 12 }).target, 1);
  assert.equal(drag.moveDrag(middle, { dx: strideX, dy: 0, geometry, count: 12 }).target, 5);

  const last = drag.beginDrag(13, 11);
  assert.equal(drag.moveDrag(last, { dx: 0, dy: strideY * 4, geometry, count: 12 }).target, 11, 'past the last place is the last place');
  assert.equal(drag.moveDrag(last, { dx: -strideX * 2, dy: 0, geometry, count: 12 }).target, 9);

  // A wall that is not a whole number of rows keeps the last cell as its last place.
  const short = [0, 1, 2, 3].map((index) => drag.beginDrag(20 + index, index));
  assert.deepEqual(short.map((state) => drag.moveDrag(state, { dx: 0, dy: strideY * 9, geometry, count: 4 }).target), [3, 3, 3, 3]);
});

test('a finger resting on the seam between two cells does not flip the target', () => {
  /**
   * The hysteresis is what stops the wall from flickering between two arrangements while a thumb rests on
   * a boundary: the target only moves once the finger has travelled `DRAG_TARGET_MARGIN` past the edge of
   * the cell it stands in, and it has to travel the same distance back to return.
   */
  const margin = drag.DRAG_TARGET_MARGIN;
  assert.ok(margin > 0 && margin < 0.5);
  const state = drag.beginDrag(30, 0);
  /**
   * The margin is measured from the held cell's own middle against that cell's own box, so the finger
   * has to be half a cell plus the margin past the start before the second place takes over. A finger
   * one point past the seam — where the nearest cell is already the second — is not a move.
   */
  const seam = geometry.width * 0.5 + 1;
  const pastMargin = geometry.width * (0.5 + margin) + 2;
  const nearSeam = drag.moveDrag(state, { dx: seam, dy: 0, geometry, count: 12 });
  assert.equal(nearSeam.target, 0, 'the seam itself belongs to the place the finger is already in');
  const wellPast = drag.moveDrag(state, { dx: pastMargin, dy: 0, geometry, count: 12 });
  assert.equal(wellPast.target, 1);
  // And it holds: a point back at the seam stays on the second place, so small jitter is not a move.
  const backAtSeam = drag.moveDrag(wellPast, { dx: seam, dy: 0, geometry, count: 12 });
  assert.equal(backAtSeam.target, 1);
  // Only a deliberate return to the first cell takes the target back.
  const home = drag.moveDrag(wellPast, { dx: geometry.width * 0.1, dy: 0, geometry, count: 12 });
  assert.equal(home.target, 0);
});

test('a frame that changes nothing is not a frame that redraws the wall', () => {
  const state = drag.beginDrag(40, 0);
  const moved = drag.moveDrag(state, { dx: 3, dy: 2, geometry, count: 12 });
  assert.equal(drag.moveDrag(moved, { dx: 3, dy: 2, geometry, count: 12 }), moved, 'the same object comes back');
  const further = drag.moveDrag(moved, { dx: 9, dy: 4, geometry, count: 12 });
  assert.notEqual(further, moved, 'a new offset is a new gesture');
  assert.equal(further.target, moved.target, 'a new offset inside the same cell is not a new place');
});


test('the held cell keeps its identity when the wall is redrawn', () => {
  /**
   * A drag reorders the very list it is reading, so it names a cell by `tileId` and never by an index:
   * a repost is negative, and the sign is what keeps a share from being confused with a post.
   */
  assert.deepEqual(drag.dragOrder([12, -4, 13, 14], -4, 0), [-4, 12, 13, 14]);
  assert.deepEqual(drag.dragOrder([12, -4, 13, 14], 14, 1), [12, 14, -4, 13]);
  assert.deepEqual(drag.dragOrder([12, -4], 99, 0), [12, -4], 'an identity the wall does not hold moves nothing');
  assert.deepEqual(drag.dragOrder([], 12, 0), []);
  // The optimistic arrangement keeps the repost's place, which is why a dragged repost used to look stuck.
  assert.deepEqual([...grid.optimisticArrangement([-4, 12, 13]).entries()], [[-4, 0], [12, 1], [13, 2]]);
});

test('scrolling under a held finger carries the cell and the place it stands over', () => {
  /**
   * Auto-scroll moves the content, not the finger, so the place under the finger is a content position.
   * Both numbers have to move together: the carried face stays under the thumb, and the hole it would
   * take travels down the wall with it.
   */
  const state = drag.beginDrag(50, 0);
  const scrolled = drag.moveDrag(state, { dx: 0, dy: 0, geometry, count: 12, scrollDelta: strideY * 2 });
  assert.equal(scrolled.target, 6, 'two rows of content scrolled under a still finger is two rows further down');
  assert.deepEqual(
    drag.dragCentre(scrolled, geometry, strideY * 2),
    { x: geometry.width / 2, y: geometry.height / 2 + strideY * 2 },
    'the cell sits two rows lower in the content, so it stays under the finger on screen',
  );
  // Scrolling back up is the same rule in the other direction.
  const up = drag.moveDrag(drag.beginDrag(51, 6), { dx: 0, dy: 0, geometry, count: 12, scrollDelta: -strideY * 2 });
  assert.equal(up.target, 0);
});

test('the wall scrolls only near its edges, and faster the closer the finger is', () => {
  const viewport = { top: 100, height: 2000 };
  const band = drag.AUTO_SCROLL_BAND;
  const max = drag.AUTO_SCROLL_MAX;
  assert.equal(drag.autoScrollStep(1100, viewport), 0, 'the middle of the wall does not move');
  assert.equal(drag.autoScrollStep(viewport.top + band, viewport), 0, 'the inner edge of the band is still');
  assert.ok(drag.autoScrollStep(viewport.top + band / 2, viewport) < 0, 'the top band scrolls up');
  assert.equal(drag.autoScrollStep(viewport.top, viewport), -max, 'the very edge scrolls as hard as it can');
  assert.equal(drag.autoScrollStep(viewport.top - 400, viewport), -max, 'a finger above the wall keeps scrolling up');
  assert.ok(drag.autoScrollStep(viewport.top + viewport.height - band / 2, viewport) > 0, 'the bottom band scrolls down');
  assert.equal(drag.autoScrollStep(viewport.top + viewport.height, viewport), max);
  assert.equal(drag.autoScrollStep(viewport.top + viewport.height + 400, viewport), max);
  // The speed grows from the band's inner edge to its outer one, so it never grabs the wall.
  let previous = 0;
  for (let depth = 0; depth <= band; depth += 4) {
    const step = Math.abs(drag.autoScrollStep(viewport.top + band - depth, viewport));
    assert.ok(step >= previous, 'the closer to the edge, the faster');
    previous = step;
  }
  assert.equal(drag.autoScrollStep(0, { top: 0, height: 0 }), 0, 'a wall that has not been measured does not scroll');

  // A scroll asked for past either end of the wall is clamped, so the timer cannot run away.
  assert.equal(drag.clampScroll(-50, 4000, 2000), 0);
  assert.equal(drag.clampScroll(9000, 4000, 2000), 2000);
  assert.equal(drag.clampScroll(500, 4000, 2000), 500);
  assert.equal(drag.clampScroll(500, 1000, 2000), 0, 'content shorter than the window has nowhere to scroll');
});


test('a drag can only start on the grip, so a pin or a delete can never become one', () => {
  // The grip is the only element that carries the responder; the cell itself carries none.
  assert.match(tileCode, /\{handle \? \(\s*<View\s*\{\.\.\.handle\}/);
  assert.doesNotMatch(tileCode, /\{\.\.\.handlers\}/);
  // The two actions are Pressables of their own, drawn only while the cell is not being carried.
  assert.match(tileCode, /onPress=\{manage\.onPin\}/);
  assert.match(tileCode, /onPress=\{manage\.onDelete\}/);
  assert.match(tileCode, /\{handle \? \(\s*<View/);
  assert.match(tileCode, /dragging \? null : \(/);
  // The screen hands a grip only to a cell this account may place, and never during a write.
  assert.match(screenCode, /handle=\{actions\.canPlace \? gripHandlers\(tileId\(post\), Boolean\(manageBusy\)\) : undefined\}/);
  // The grip claims the touch at its start, so the first move carries an exact offset (no slop lag); it
  // claims nothing while an order is already travelling.
  assert.match(screenCode, /onStartShouldSetResponder: \(\) => !busy/);
  assert.match(screenCode, /const gripHandlers = useCallback\(\(tile: number, busy = false\) => \(\{/);
  assert.match(screenCode, /onResponderTerminationRequest: \(\) => false/);
  // `pageX`/`pageY` are read raw: the gesture never trusts a rebuilt responder's own offset again.
  assert.doesNotMatch(screenCode, /PanResponder/);
  assert.match(screenCode, /onResponderGrant: \(event: GestureResponderEvent\) => \{/);
  assert.match(screenCode, /const \{ pageX, pageY \} = event\.nativeEvent;/);
  assert.match(screenCode, /onResponderMove: \(event: GestureResponderEvent\) => \{\s*applyFinger\(event\.nativeEvent\.pageX, event\.nativeEvent\.pageY\);/);
});

test('every way out of a drag resets it', () => {
  // Release commits; a termination (the system taking the touch, a modal, an unmount) commits nothing.
  assert.match(screenCode, /onResponderRelease: \(\) => finishDrag\(true\)/);
  assert.match(screenCode, /onResponderTerminate: \(\) => finishDrag\(false\)/);
  // One exit, and it always clears the refs, the animated offset and the drawn hole before it decides.
  const exit = screenCode.slice(screenCode.indexOf('const finishDrag = useCallback'), screenCode.indexOf('const gripHandlers = useCallback'));
  assert.match(exit, /stopAutoScroll\(\);/);
  assert.match(exit, /dragRef\.current = null;/);
  assert.match(exit, /grip\.current = null;/);
  assert.match(exit, /lift\.setValue\(\{ x: 0, y: 0 \}\);/);
  assert.match(exit, /setDrag\(null\);/);
  assert.match(exit, /if \(!commit \|\| !released \|\| !released\.moved\) return;/);
  // Leaving the mode takes the same state with it.
  const leaving = screenCode.slice(screenCode.indexOf('const endManaging = useCallback'), screenCode.indexOf('BackHandler.addEventListener'));
  assert.match(leaving, /stopAutoScroll\(\);/);
  assert.match(leaving, /dragRef\.current = null;/);
  assert.match(leaving, /setDrag\(null\);/);
});

test('one order travels at a time, and a refused one rolls back', () => {
  const writer = screenCode.slice(screenCode.indexOf('const persistOrder = useCallback'), screenCode.indexOf('const togglePin = useCallback'));
  assert.match(writer, /if \(orderInFlight\.current\) return;/);
  assert.match(writer, /orderInFlight\.current = true;/);
  assert.match(writer, /orderInFlight\.current = false;/);
  // The optimistic order is only dropped once the server's own places have arrived.
  assert.match(writer, /await reloadQuietly\(\);\s*setArranged\(null\);/);
  // A refusal puts the wall back and says why: nothing is removed optimistically.
  assert.match(writer, /catch \(cause\) \{[\s\S]*setArranged\(null\);[\s\S]*setManageNote\(describe\(cause\)\);/);
  assert.match(writer, /body: JSON\.stringify\(\{ order: entries \}\)/);
});

test('the arranged wall is one keyed list of placed cells, so a reorder moves a view', () => {
  // Each cell is placed by the same arithmetic the drop uses, and keyed by its identity.
  assert.match(screenCode, /<ManageCell\s+key=\{archiveKey\(post\)\}\s+left=\{slot\.left\}\s+top=\{slot\.top\}/);
  assert.match(screenCode, /const slot = gridSlot\(index, geometry\);/);
  assert.match(screenCode, /const previewIds = useMemo\(\(\) => \(drag \? dragOrder\(dragIds, drag\.tile, drag\.target\) : dragIds\), \[drag, dragIds\]\);/);
  assert.match(screenCode, /const previewPosts = useMemo\(\(\) => previewIds/);
  // The carried face is an overlay that takes no touch and follows the animated offset.
  assert.match(screenCode, /<Animated\.View\s+pointerEvents="none"\s+accessible=\{false\}/);
  assert.match(screenCode, /transform: lift\.getTranslateTransform\(\)/);
  assert.match(screenCode, /const lift = useRef\(new Animated\.ValueXY\(\{ x: 0, y: 0 \}\)\)\.current;/);
  // The cells that give way animate from the slot they just left, on the native driver.
  assert.match(screenCode, /function ManageCell\(\{ left, top, width, height, children \}/);
  assert.match(screenCode, /offset\.setValue\(\{ x: dx, y: dy \}\);/);
  assert.match(screenCode, /useNativeDriver: true/);
  // The lifted cell is drawn above the wall.
  assert.match(screenCode, /lifted: \{\s*position: 'absolute', zIndex: 20, elevation: 20/);
});
