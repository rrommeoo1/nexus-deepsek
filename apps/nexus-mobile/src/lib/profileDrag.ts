/**
 * The profile grid's drag: one gesture, as a state machine and as arithmetic.
 *
 * The arrangement itself (`profileGrid.ts`) answers *where* a tile stands. This file answers what one
 * finger is doing while it moves a tile: which cell it holds, where that cell's middle is now, and which
 * place the finger is standing over. Every question here is answered as numbers, so the gesture can be
 * tested without a renderer and a wrong answer can be pointed at instead of felt.
 *
 * Why this exists as its own file
 * -------------------------------
 * The first version of the drag measured the finger with `PanResponder`'s `dx`/`dy`. Those two numbers
 * start at zero on the event that *grants* the responder, not on the finger's own touch down, so an
 * `onMoveShouldSetPanResponder` that waits for 4 points of movement loses those 4 points for good: the
 * tile then trails the finger by the slop for the whole gesture. Worse, the responder objects were
 * rebuilt whenever the archive was reloaded, and a rebuilt `PanResponder` starts its own offset at the
 * page position — a reload that landed mid-drag threw the held tile hundreds of points away and left it
 * there. This file therefore owns the arithmetic of the offset, and the screen owns the raw responder
 * (`onResponderGrant`/`onResponderMove`), which is created once and never rebuilt.
 *
 * The states
 * ----------
 *   idle ──hold──▶ managing ──handle down──▶ dragging ──release──▶ managing (order written)
 *                                              │  ├──cancel/terminate/Back──▶ managing (nothing written)
 *                                              └──done──▶ managing (drag state cleared, next tile usable)
 *
 * `beginDrag` is the only entry, `moveDrag` is the only transition while the finger is down, and
 * `releaseDrag` is the only exit. `releaseDrag` reports what to do instead of doing it, so a caller
 * cannot half-commit a gesture: either the finger moved (`moved: true`, commit the returned order) or
 * it did not (`moved: false`, write nothing).
 */
import { GRID_COLUMNS, GRID_GAP, gridSlot, moveWithin, type GridGeometry } from './profileGrid';

/** A point in the grid's own coordinates: from its top-left corner, not from the screen's. */
export type DragPoint = { x: number; y: number };

/**
 * The finger while it holds a cell.
 *
 * `tile` is the cell's identity (`tileId`, negative for a repost) and never an array index: a drag
 * reorders the list it reads from, so an index would name a different cell a frame later. `from` is the
 * place the gesture started at and stays fixed; `target` is the place the finger stands over now.
 */
export type DragGesture = {
  tile: number;
  from: number;
  target: number;
  /** The finger's offset from its touch down, in points, with the scroll of the wall already subtracted. */
  dx: number;
  dy: number;
};

/**
 * How far past a cell's edge the finger must travel before the target moves to the next cell.
 *
 * The target is kept while the finger stays inside the *current* cell grown by this fraction of a
 * cell — so leaving costs a deliberate 20% of a cell, and coming back costs the same. Without it, a
 * finger resting on the seam between two cells flips the target on every jitter of a millimetre, and
 * the wall behind it flickers between two arrangements.
 */
export const DRAG_TARGET_MARGIN = 0.2;

/** The band at the top and the bottom of the wall inside which a drag scrolls it, in points. */
export const AUTO_SCROLL_BAND = 88;

/** The fastest a drag scrolls the wall, in points per frame at the very edge of the band. */
export const AUTO_SCROLL_MAX = 14;

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const whole = (value: unknown, fallback = 0) => (Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback);

/** A cell held by its handle. Nothing has moved yet, so the target is the place it started from. */
export function beginDrag(tile: number, from: number): DragGesture {
  const place = Math.max(0, whole(from));
  return { tile: whole(tile), from: place, target: place, dx: 0, dy: 0 };
}


/**
 * The middle of the held cell, in the grid's coordinates.
 *
 * `scrollDelta` is how far the wall has been scrolled *by the drag itself* since it began: the content
 * moves under a stationary finger, so the finger stands over a place further down the wall than its own
 * screen position suggests, and the held cell has to travel with the content to stay under it. Adding it
 * is what lets auto-scroll carry a tile with the finger instead of against it.
 */
export function dragCentre(state: DragGesture, geometry: GridGeometry, scrollDelta = 0): DragPoint {
  const slot = gridSlot(state.from, geometry);
  const width = Math.max(0, Number(geometry.tileWidth) || 0);
  const height = Math.max(0, Number(geometry.tileHeight) || 0);
  return {
    x: slot.left + width / 2 + (Number(state.dx) || 0),
    y: slot.top + height / 2 + (Number(state.dy) || 0) + (Number(scrollDelta) || 0),
  };
}

/** The place whose middle is nearest to a point that stands for a cell's middle, clamped into the grid. */
export function placeNear(point: DragPoint, geometry: GridGeometry, count: number): number {
  const total = Math.max(0, whole(count));
  if (!total) return 0;
  const columns = Math.max(1, whole(geometry.columns ?? GRID_COLUMNS, GRID_COLUMNS) || GRID_COLUMNS);
  const gap = Math.max(0, Number(geometry.gap ?? GRID_GAP) || 0);
  const width = Math.max(1, Number(geometry.tileWidth) || 0);
  const height = Math.max(1, Number(geometry.tileHeight) || 0);
  const x = Number(point?.x) || 0;
  const y = Number(point?.y) || 0;
  const column = clamp(Math.round((x - width / 2) / (width + gap)), 0, columns - 1);
  const row = Math.max(0, Math.round((y - height / 2) / (height + gap)));
  return clamp(row * columns + column, 0, total - 1);
}

/**
 * The place the finger is standing over, with the hysteresis of `DRAG_TARGET_MARGIN`.
 *
 * The current target wins while the finger is still inside it, grown by the margin. Only once the
 * finger leaves that room does the nearest place take over — and it then has to be left by the same
 * margin before anything changes again. A place that is already the nearest one is never re-derived,
 * so a still finger costs nothing.
 */
export function settleTarget(options: {
  current: number;
  point: DragPoint;
  geometry: GridGeometry;
  count: number;
  margin?: number;
}): number {
  const total = Math.max(0, whole(options.count));
  if (!total) return 0;
  const current = clamp(whole(options.current), 0, total - 1);
  const geometry = options.geometry;
  const margin = Math.max(0, Number(options.margin ?? DRAG_TARGET_MARGIN) || 0);
  const slot = gridSlot(current, geometry);
  const width = Math.max(1, Number(geometry.tileWidth) || 0);
  const height = Math.max(1, Number(geometry.tileHeight) || 0);
  const padX = width * margin;
  const padY = height * margin;
  const x = Number(options.point?.x) || 0;
  const y = Number(options.point?.y) || 0;
  const inside = x >= slot.left - padX
    && x <= slot.left + width + padX
    && y >= slot.top - padY
    && y <= slot.top + height + padY;
  if (inside) return current;
  return placeNear(options.point, geometry, total);
}


/**
 * The gesture after the finger moved.
 *
 * The same object comes back when neither the offset nor the target changed, which is what lets the
 * caller skip a re-render on the many frames of a drag that change nothing (a finger holding still, or
 * moving inside the cell it already stands over).
 */
export function moveDrag(state: DragGesture, options: {
  dx: number;
  dy: number;
  geometry: GridGeometry;
  count: number;
  scrollDelta?: number;
  margin?: number;
}): DragGesture {
  const dx = Number(options.dx) || 0;
  const dy = Number(options.dy) || 0;
  const moved: DragGesture = { ...state, dx, dy };
  moved.target = settleTarget({
    current: state.target,
    point: dragCentre(moved, options.geometry, options.scrollDelta ?? 0),
    geometry: options.geometry,
    count: options.count,
    margin: options.margin,
  });
  const same = moved.target === state.target && dx === state.dx && dy === state.dy;
  return same ? state : moved;
}

/** What the end of a gesture means: the place to write, or nothing to write at all. */
export type DragRelease = {
  tile: number;
  from: number;
  target: number;
  /** False when the finger let go over the place it started from: there is no order to save. */
  moved: boolean;
};

/** The only exit of the gesture. `null` in, `null` out: a release without a drag is not a release. */
export function releaseDrag(state: DragGesture | null | undefined): DragRelease | null {
  if (!state) return null;
  const from = Math.max(0, whole(state.from));
  const target = Math.max(0, whole(state.target));
  return { tile: whole(state.tile), from, target, moved: target !== from };
}

/** The order a drag has just made: the held cell moved to `target`, everything between shifted by one. */
export function dragOrder(ids: readonly number[], tile: number, target: number): number[] {
  const list = Array.isArray(ids) ? ids : [];
  const from = list.indexOf(whole(tile));
  if (from < 0) return [...list];
  return moveWithin(list, from, target);
}

/**
 * How far a drag should scroll the wall this frame, in points; negative scrolls towards the top.
 *
 * `fingerY` is the finger's page position and `viewport` the wall's own box on the screen. Inside the
 * top or bottom band the answer grows linearly from nothing at the band's inner edge to
 * `AUTO_SCROLL_MAX` at the screen's edge, so the wall creeps at first and then moves — a constant jump
 * to full speed is what makes an auto-scroll feel like it grabbed the gesture away. A finger outside
 * the viewport (a drag that started low and moved past the wall) scrolls at full speed.
 */
export function autoScrollStep(fingerY: number, viewport: { top: number; height: number }, options: {
  band?: number;
  max?: number;
} = {}): number {
  const height = Number(viewport?.height) || 0;
  if (height <= 0) return 0;
  const band = Math.min(Math.max(1, Number(options.band ?? AUTO_SCROLL_BAND) || AUTO_SCROLL_BAND), height / 2);
  const max = Math.max(0, Number(options.max ?? AUTO_SCROLL_MAX) || 0);
  if (!max) return 0;
  const y = (Number(fingerY) || 0) - (Number(viewport?.top) || 0);
  if (y < band) return -max * Math.min(1, Math.max(0, (band - y) / band));
  if (y > height - band) return max * Math.min(1, Math.max(0, (y - (height - band)) / band));
  return 0;
}

/** A scroll offset the wall can really take: never above its top, never past its last point. */
export function clampScroll(offset: number, contentHeight: number, viewportHeight: number): number {
  const limit = Math.max(0, (Number(contentHeight) || 0) - (Number(viewportHeight) || 0));
  return clamp(Number(offset) || 0, 0, limit);
}
