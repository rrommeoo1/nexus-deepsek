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

test('the wall scrolls only near its edges, faster the closer the finger is, and by the second', () => {
  const viewport = { top: 100, height: 2000 };
  const band = drag.AUTO_SCROLL_BAND;
  const ceiling = drag.AUTO_SCROLL_MAX_SPEED;
  const floor = drag.AUTO_SCROLL_MIN_SPEED;
  assert.equal(drag.autoScrollSpeed(1100, viewport), 0, 'the middle of the wall does not move');
  assert.equal(drag.autoScrollSpeed(viewport.top + band, viewport), 0, 'the inner edge of the band is still');
  const topHalf = drag.autoScrollSpeed(viewport.top + band / 2, viewport);
  assert.ok(topHalf < 0, 'the top band scrolls up');
  assert.ok(Math.abs(topHalf) >= floor, 'and it starts at the gentle speed, not at nothing');
  assert.equal(drag.autoScrollSpeed(viewport.top, viewport), -ceiling, 'the very edge scrolls as fast as it may');
  assert.equal(drag.autoScrollSpeed(viewport.top - 400, viewport), -ceiling, 'a finger above the wall keeps scrolling up');
  assert.ok(drag.autoScrollSpeed(viewport.top + viewport.height - band / 2, viewport) > 0, 'the bottom band scrolls down');
  assert.equal(drag.autoScrollSpeed(viewport.top + viewport.height, viewport), ceiling);
  assert.equal(drag.autoScrollSpeed(viewport.top + viewport.height + 400, viewport), ceiling);
  // The speed grows from the band's inner edge to its outer one, so it never grabs the wall.
  let previous = 0;
  for (let depth = 0; depth <= band; depth += 4) {
    const speed = Math.abs(drag.autoScrollSpeed(viewport.top + band - depth, viewport));
    assert.ok(speed >= previous, 'the closer to the edge, the faster');
    previous = speed;
  }
  // The first half of the band is the careful half: half-way in, less than half the top speed.
  assert.ok(Math.abs(topHalf) < (floor + ceiling) / 2);
  assert.equal(drag.autoScrollSpeed(0, { top: 0, height: 0 }), 0, 'a wall that has not been measured does not scroll');

  /**
   * Speed is points per second now, and the frame's own length is what turns it into a distance: the same
   * wall travels the same distance whether a phone draws 60 frames a second or 40. The old constant was
   * points *per frame*, which is a speed only on a phone that never stutters.
   */
  assert.equal(drag.autoScrollStep(0, 16), 0);
  assert.equal(drag.autoScrollStep(ceiling, 0), 0);
  assert.equal(
    drag.autoScrollStep(ceiling, 64),
    (ceiling * 64) / 1000,
    'a 64 ms frame at the top speed travels 64 ms worth of wall',
  );
  assert.equal(
    drag.autoScrollStep(ceiling, 33.4),
    drag.autoScrollStep(ceiling, 16.7) * 2,
    'two long frames travel twice as far as one short one',
  );
  assert.equal(
    drag.autoScrollStep(ceiling, 5000),
    drag.autoScrollStep(ceiling, drag.AUTO_SCROLL_MAX_FRAME_MS),
    'a stalled frame is paid for at most once, so the wall resumes instead of jumping',
  );

  // A scroll asked for past either end of the wall is clamped, so the loop cannot run away.
  assert.equal(drag.clampScroll(-50, 4000, 2000), 0);
  assert.equal(drag.clampScroll(9000, 4000, 2000), 2000);
  assert.equal(drag.clampScroll(500, 4000, 2000), 500);
  assert.equal(drag.clampScroll(500, 1000, 2000), 0, 'content shorter than the window has nowhere to scroll');
  /**
   * But a content height of 0 is "not measured yet", not "an empty wall": a drag may start before the
   * scroller has reported its size, and clamping to 0 there would forbid every scroll of the gesture —
   * an auto-scroll that measures as working and still does not move a pixel.
   */
  assert.equal(drag.clampScroll(120, 0, 800), 120, 'an unmeasured wall is not a wall that cannot scroll');
});

/**
 * One long drag, frame by frame, exactly as `ProfileScreen` runs it: the finger is held at one spot, the
 * loop asks `autoScrollSpeed` for a rate, turns it into a distance with `autoScrollStep` (paying for the
 * ramp), clamps it against the content, and re-reads the gesture with the scrolled distance added once.
 *
 * This is the gesture the owner could not perform on the phone — moving a photo more than one screenful —
 * so it is simulated here over a wall of thirty rows, and then confirmed on the device.
 */
function holdAtEdge({ from, count, fingerY, viewport, contentHeight, cell, ms = 2000, startScroll = 0 }) {
  let state = drag.beginDrag(101, from);
  let scroll = startScroll;
  let bandSince = 0;
  let frames = 0;
  const frame = 1000 / 60;
  for (let stamp = 0; stamp < ms; stamp += frame) {
    const rate = drag.autoScrollSpeed(fingerY, viewport);
    if (!rate) { bandSince = 0; continue; }
    if (!bandSince) bandSince = stamp;
    const ramp = Math.min(1, (stamp - bandSince) / drag.AUTO_SCROLL_RAMP_MS);
    const step = drag.autoScrollStep(rate, frame) * ramp;
    const next = drag.clampScroll(scroll + step, contentHeight, viewport.height);
    if (next !== scroll) { scroll = next; frames += 1; }
    // The gesture is told how far the wall moved *since the finger touched down*, which is the offset it
    // began at subtracted from where the wall stands now.
    state = drag.moveDrag(state, { dx: 0, dy: 0, geometry: cell, count, scrollDelta: scroll - startScroll });
  }
  return { state, scroll, moved: scroll - startScroll, frames };
}

/**
 * The reference phone's own cell, in *points*: the Xiaomi is 469 points wide at 416 dpi, so a third of it
 * is ~155 wide and ~275 tall. The geometry above is the same arithmetic fed the pixel count, which is
 * fine for coordinate questions and useless for "how many rows did one second of scrolling buy".
 */
const phone = grid.tileSize(469, 3, 2);
const phoneStrideY = phone.height + phone.gap;

test('a cell can be carried past every screenful: the edge scroll keeps running while the finger rests', () => {
  const viewport = { top: 0, height: 873 };
  const rows = 30;
  const count = rows * 3;
  const contentHeight = rows * phoneStrideY;
  const fingerY = viewport.height - 2;

  const down = holdAtEdge({ from: 0, count, fingerY, viewport, contentHeight, cell: phone, ms: 4000 });
  assert.ok(down.frames > 30, `the loop really scrolled: ${down.frames} frames moved the wall`);
  assert.ok(down.scroll > 600, `more than one screenful of wall travelled: ${Math.round(down.scroll)}`);
  const rowsDown = Math.floor(down.state.target / 3);
  assert.ok(rowsDown >= 5, `the first cell reached row ${rowsDown + 1}, at least five rows down`);
  assert.equal(drag.releaseDrag(down.state).moved, true, 'a long drag is an arrangement, not a hold');
  /**
   * And the cell is still under the finger: as the wall scrolls, the carried cell's own content position
   * grows by exactly the scrolled distance, so on screen it has not moved at all.
   */
  const startY = drag.dragCentre(drag.beginDrag(101, 0), phone, 0).y;
  const endY = drag.dragCentre(down.state, phone, down.moved).y;
  assert.equal(Math.round(endY - startY), Math.round(down.moved), 'the cell stays pinned to the thumb');
  // The order a release writes puts the carried cell exactly where the hole stopped, once.
  const ids = Array.from({ length: count }, (_, index) => 101 + index);
  const order = drag.dragOrder(ids, 101, down.state.target);
  assert.equal(order.indexOf(101), down.state.target);
  assert.equal(new Set(order).size, count, 'every cell is still in the order exactly once');

  // The same wall read from its last row, carried back up under a finger held near the top. It takes as
  // long as the wall is tall — that is what the edge scroll is for — so the loop is given the time.
  const up = holdAtEdge({
    from: count - 1, count, fingerY: 2, viewport, contentHeight, cell: phone, ms: 20000,
    startScroll: contentHeight - viewport.height,
  });
  assert.equal(Math.round(up.scroll), 0, 'the wall reached its own top');
  assert.ok(up.state.target <= 8, `the last cell came back to the first rows (place ${up.state.target + 1})`);
});

test('the scroll stops the moment the finger leaves the band, and the wall stays where it is', () => {
  const viewport = { top: 0, height: 873 };
  const count = 90;
  const contentHeight = 30 * phoneStrideY;
  const edge = holdAtEdge({ from: 0, count, fingerY: viewport.height - 2, viewport, contentHeight, cell: phone, ms: 1200 });
  const still = holdAtEdge({ from: 0, count, fingerY: viewport.height / 2, viewport, contentHeight, cell: phone, ms: 1200 });
  assert.equal(still.scroll, 0, 'the middle of the wall is not scrolled by a still finger');
  assert.equal(still.frames, 0);
  assert.equal(still.state.target, 0, 'and the insertion place does not move either');
  assert.ok(edge.scroll > 200, 'while the same finger at the edge had scrolled by then');
  // One frame is never more than a few points, so the wall can never lurch when a thumb drifts into a band.
  const first = Math.abs(drag.autoScrollStep(drag.autoScrollSpeed(viewport.height - 2, viewport), 1000 / 60));
  assert.ok(first < drag.AUTO_SCROLL_MAX_SPEED / 30, `one frame moved ${first} points`);
});

test('at the end of the wall the scroll is clamped, and no frame past it moves anything', () => {
  const viewport = { top: 0, height: 873 };
  const count = 9;
  const contentHeight = 3 * phoneStrideY;   // a short profile: three rows, barely taller than one screen
  const end = holdAtEdge({ from: 0, count, fingerY: viewport.height - 2, viewport, contentHeight, cell: phone, ms: 4000 });
  const limit = Math.max(0, contentHeight - viewport.height);
  assert.equal(Math.round(end.scroll), Math.round(limit), 'the wall stops at its last point, not past it');
  assert.equal(drag.clampScroll(limit + 500, contentHeight, viewport.height), limit);
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

test('the edge scroll runs on the screen\u2019s own frames, and adds finger and scroll exactly once', () => {
  // A frame loop, not a timer: `setInterval` is a promise the JS thread does not have to keep, and a tick
  // with no frame to draw on is a stutter instead of a scroll.
  assert.doesNotMatch(screenCode, /setInterval/);
  assert.match(screenCode, /loop\.frame = requestAnimationFrame\(\(stamp\) => frameRef\.current\(stamp\)\);/);
  assert.match(screenCode, /loop\.frame = requestAnimationFrame\(\(value\) => frameRef\.current\(value\)\);/);
  assert.match(screenCode, /cancelAnimationFrame\(loop\.frame\)/);
  // The time the frame really took is what the speed is multiplied by.
  assert.match(screenCode, /const dt = loop\.last \? Math\.min\(AUTO_SCROLL_MAX_FRAME_MS, Math\.max\(1, stamp - loop\.last\)\) : 16;/);
  assert.match(screenCode, /const rate = autoScrollSpeed\(held\.y, visible\);/);
  assert.match(screenCode, /const step = autoScrollStep\(rate, dt\) \* ramp;/);
  // The wall is measured on the scroller itself, and a failed measurement falls back to the window
  // instead of to a height of 0 (which would forbid every scroll of the gesture).
  assert.match(screenCode, /scrollRef\.current\?\.measureInWindow\?\.\(/);
  assert.match(screenCode, /viewport\.current = \{ top: 0, height: windowHeight, source: 'window' \};/);
  assert.doesNotMatch(screenCode, /shellRef/);
  // The finger's own movement and the wall's scroll are two numbers: the gesture gets the first and the
  // scrolled distance separately, the carried face gets their sum.
  assert.match(screenCode, /const dyFinger = y - held\.originY;/);
  assert.match(screenCode, /lift\.setValue\(\{ x: dx, y: dyFinger \+ scrollDelta \}\);/);
  assert.match(screenCode, /moveDrag\(state, \{ dx, dy: dyFinger, geometry, count: dragIds\.length, scrollDelta \}\)/);
  // The loop's own clock and handle live in refs, so a re-render costs the gesture nothing.
  assert.match(screenCode, /const autoLoop = useRef<\{ frame: number \| null; last: number; bandSince: number \}>/);
  assert.match(screenCode, /if \(loop\.frame !== null\) return;/);
  // The dock covers the wall's foot only if it is drawn over it, so its top edge is measured instead of
  // guessed: a band lifted by a wrong inset starts scrolling a third of the way up the screen.
  assert.match(screenCode, /const dockTop = useRef\(0\);/);
  assert.match(screenCode, /dockRef\.current\?\.measureInWindow\(\(_x, y\) => \{ dockTop\.current = y; \}\);/);
  assert.match(screenCode, /const dockFoot = dockTop\.current > 0 \? Math\.max\(0, bottom - dockTop\.current\) : 0;/);
  assert.match(screenCode, /ref=\{dockRef\}/);
  // The numbers a device can be asked for are live, not a snapshot of one render.
  assert.match(screenCode, /auto: autoTrace\.current,/);
  assert.match(screenCode, /Object\.assign\(autoTrace\.current, \{/);
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
