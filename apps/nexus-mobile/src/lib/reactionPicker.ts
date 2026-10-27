/**
 * Where the finger is inside the reaction panel (owner's rule, 19 October 2026).
 *
 * The owner asked the panel to behave the way a phone's own reaction bar does: it opens while the
 * plate is held, the emoji under the thumb grows a little, and sliding the thumb moves that growth
 * from one emoji to the next, so the reaction is chosen by the same gesture that opened the panel.
 * That needs one rule, and only one: a point of the window becomes an index of `SOCIAL_REACTIONS`.
 * The rule is a pure function so it can be run, not just read, and so the bar under a page of words
 * and the row beside a clip cannot drift apart.
 *
 * The owner's second correction (the same day) is why the row is the only shape: the "column" beside a
 * clip opened upward, and he asked it to open **horizontally** like the one under a page of words. So
 * the panel is always a row of `PICKER_CELL` cells with one `PICKER_EDGE` of padding, and only the
 * edge it grows from changes — `right` beside the rail of a clip and at the right end of a text page's
 * bar (the thumb that opened it is on the right of the pill, so the first emoji must be under that
 * thumb), `left` under a card's plate.
 *
 * The owner's third correction is the *outside*: "dacă ridic degetul de pe reacție, vreau ca aceasta să
 * fie anulată — să nu forțez utilizatorul să selecteze o icoană". A release must be able to choose
 * nothing, so a point farther than `PICKER_SLACK` from the pill is no index at all (`-1`), never a
 * clamped end. The slack is one cell wide because the thumb that opens the panel rests on the plate,
 * just outside the pill, and while it stays there it still counts as the first emoji — the growth it
 * sees is the one it opened on.
 *
 * The owner's fourth correction (the same evening) is why the plate counts too: the row beside a clip
 * now floats *above* the rail's plate, so the finger that holds it is below the pill and must not be
 * read as "off the reaction". The plate is handed in as `plate`, and the thumb's corridor — the row,
 * down to the plate's own bottom, across both their widths — is one region: the finger slides left
 * under the lifted row and never falls into a gap between the two. A thumb past the plate still
 * chooses nothing, so a release can still cancel. Without that, lifting the row would have turned
 * every slide into a cancel.
 */
export const PICKER_CELL = 46;
export const PICKER_EDGE = 6;

/**
 * A hold, not a tap: a plate that answers a touch at once would steal the like the owner still expects
 * from a short press (`ReactionControl` keeps that), so the panel needs a moment that is clearly a
 * decision — long enough that a scroll begun on the plate never opens it, short enough to feel held.
 */
export const PICKER_HOLD_MS = 240;

/**
 * How far outside the pill a thumb may wander and still be pointing at an emoji. One cell: the plate
 * that opens the panel sits a thumb's width from the first cell, and a thumb that lifts off the pill
 * by more than that is outside the choice — the release then answers nothing.
 */
export const PICKER_SLACK = PICKER_CELL;

/**
 * How much the emoji under the finger grows, and how far it lifts out of the line. The owner asked for
 * a magnifier, not a menu: the nearest face grows a little and its neighbours are already shrinking,
 * so the eye can follow the finger without reading a name.
 */
export const PICKER_GROW = 1.32;
export const PICKER_LIFT = -10;

/** The panel's rectangle in window coordinates, as `measureInWindow` reports it. */
export type PickerBox = { x: number; y: number; width: number; height: number };
/** The finger, in the same window coordinates as the event's `pageX` / `pageY`. */
export type PickerPoint = { x: number; y: number };
/**
 * The edge the first emoji sits on. `right` is the row beside a clip and the bar at the foot of a text
 * page, where the plate is the last press of the line (so the row grows to the left and the first emoji
 * is under the thumb); `left` is a card's compact row, whose plate opens the line and whose row grows to
 * the right.
 */
export type PickerAnchor = 'left' | 'right';

/**
 * Where the finger stands inside the row, in *cells*, continuously — `0` is the middle of the first
 * emoji and `7.5` is between the eighth and the edge. `-1` means "nowhere near the pill", the same
 * contract `pickerIndexAt` has.
 *
 * This is the number the magnifier follows. The owner's fourth and fifth corrections (19 October 2026)
 * were about a row that answered only when the thumb had already reached the next cell: the growth
 * jumped from one emoji to the next, so the finger could never see the face it was approaching. A
 * fraction is what makes the interpolation continuous — the emoji under the finger is at `round(at)`,
 * and `lib/reactionPicker.ts` hands the row the fraction so each face grows as the finger comes closer
 * and shrinks as it leaves.
 *
 * `plate` is the plate that opened the panel, read exactly as `pickerIndexAt` reads it: where it is
 * given, the row and the plate are one corridor for the thumb, so a finger holding a lifted row from
 * below still points at a cell.
 */
export function pickerPositionAt(
  box: PickerBox,
  point: PickerPoint,
  anchor: PickerAnchor,
  count: number,
  plate?: PickerBox | null,
): number {
  if (count <= 0 || !(box.width > 0) || !(box.height > 0)) return -1;
  const nearPill =
    point.x >= box.x - PICKER_SLACK && point.x <= box.x + box.width + PICKER_SLACK &&
    point.y >= box.y - PICKER_SLACK && point.y <= box.y + box.height + PICKER_SLACK;
  const inCorridor = plate && plate.width > 0 && plate.height > 0
    ? point.x >= Math.min(box.x, plate.x) &&
      point.x <= Math.max(box.x + box.width, plate.x + plate.width) &&
      point.y >= Math.min(box.y, plate.y) &&
      point.y <= Math.max(box.y + box.height, plate.y + plate.height)
    : false;
  if (!nearPill && !inCorridor) return -1;
  const offset = anchor === 'right'
    ? box.x + box.width - PICKER_EDGE - point.x
    : point.x - (box.x + PICKER_EDGE);
  /**
   * The edges are walls, not holes: past the first cell the first emoji stays the nearest one, and past
   * the last the last one does. Only leaving the pill's slack answers `-1`, and a release from there
   * chooses nothing.
   */
  return Math.min(count - 1, Math.max(0, offset / PICKER_CELL));
}

/**
 * The index under the finger, clamped to the panel's ends inside the slack, and `-1` when the finger is
 * nowhere near the pill or the panel has not been measured yet. The caller treats `-1` as "nothing is
 * pointed at": a move clears the growth, a release closes the panel without a reaction.
 *
 * It is the *cell* the finger is over — the one a release chooses and the one whose name the chip
 * prints — and it is `pickerPositionAt` rounded down, so the growth and the choice can never disagree.
 */
export function pickerIndexAt(
  box: PickerBox,
  point: PickerPoint,
  anchor: PickerAnchor,
  count: number,
  plate?: PickerBox | null,
): number {
  const at = pickerPositionAt(box, point, anchor, count, plate);
  return at < 0 ? -1 : Math.floor(at);
}

