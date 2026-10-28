/**
 * The chrome a page of a post that was opened on its own needs: a real header, and a head that cannot
 * lose its words to the door beside them.
 *
 * Two defects of round 30 are answered here, both with arithmetic instead of a magic offset:
 *
 *   1. the Back button of `/post/[id]` was a 42dp circle floating at `top: inset + 8` **over** the
 *      page, so it landed on the author's name — the page drew under it and nothing had reserved the
 *      room. `postHeaderHeight` is that room: the route draws a header of exactly this height and the
 *      page below starts under it, so a name cannot be under a button at any font scale or cutout;
 *   2. the author's line of a post (name, `@handle`, date, place) shared one row with the relation
 *      door (`Urmărește`, `Editează profilul`), and the place was glued into that line — a long place
 *      ran into the button. `postHeadArrangement` decides from the **measured width and the reader's
 *      font scale** whether the door may stand beside the words or has to stand under them, and the
 *      place is no longer part of the line: it wraps on its own, to two lines at most.
 *
 * Pure by design: `scripts/test-post-chrome.cjs` loads it in plain Node.
 */

/** The header of a post opened on its own: one 44dp door, one line of name, one counter. */
export const POST_HEADER = {
  /** The content band, under the device's own top inset. */
  height: 52,
  /** The Back target. Apple's 44 and Android's 48 both fit; the row is 52 tall. */
  button: 44,
  /** The chevron inside the disc, in points. */
  glyph: 30,
  /** The page margin the header shares with the page it covers. */
  inline: 10,
  /** Air between the Back disc and the name it must never touch. */
  gap: 8,
  /** The name of the author, in the reading face, one line, tail-ellipsized. */
  titleSize: 13,
  /** The `3/22` of the walk, on the right — the same digits the page's own folio prints. */
  counterSize: 11,
  /** The disc the chevron sits in: the header's own material, drawn with a hairline. */
  disc: 34,
  radius: 22,
} as const;

/**
 * How tall the header really is, for the page that has to keep clear of it.
 *
 * The inset is the status clock and the cutout (`insets.top`), added — not merged — with the content
 * band, because the header is drawn *below* the inset and the page starts below the header.
 */
export function postHeaderHeight(insetTop: number): number {
  return Math.max(0, Math.round(Number(insetTop) || 0)) + POST_HEADER.height;
}

/** The same number, named for what the page does with it. */
export function postPageTopInset(insetTop: number): number {
  return postHeaderHeight(insetTop);
}

/**
 * The width the header's name has, with the two doors it shares the row with taken out.
 *
 * A name is ellipsized against this number, never against the screen: the Back disc and the counter
 * keep their own pixels at every font scale, which is what stops a long `@handle` from running under
 * either of them.
 */
export function postHeaderNameWidth(input: { width: number; counter?: boolean }): number {
  const width = Math.max(0, Number(input.width) || 0);
  const doors = POST_HEADER.button + POST_HEADER.gap + (input.counter === false ? 0 : POST_HEADER.counterSize * 4);
  return Math.max(0, width - POST_HEADER.inline * 2 - doors);
}

/**
 * The head of a post: what the author block needs, and where the relation door may stand.
 *
 * `identityMin` is the width below which a name, a handle and a face stop being readable (132dp: the
 * 54dp face of a page and a name of about ten characters), and `actionMin` is the narrowest a door can
 * be and still say its word (~96dp at the label size the relation library uses).
 */
export const POST_HEAD = {
  /** The gap between the author block and the door. */
  gap: 8,
  /** The narrowest a face + name + handle may be. */
  identityMin: 132,
  /** The narrowest `Urmărește` / `Editează profilul` may be. */
  actionMin: 96,
  /** How many lines a place may take before it is ellipsized. A place is metadata, not the post. */
  locationLines: 2,
  /** The door sits two points above the author's own line, away from the place under it. */
  actionTop: 2,
  /** Air between the handle line and the place. */
  locationGap: 1,
  /** How many lines a declaration may take. It is two words and a colon; two lines is the whole sentence. */
  originLines: 2,
} as const;

/** Where the door goes: beside the words, or under them. */
export type PostHeadArrangement = 'row' | 'stack';

/**
 * Decide the arrangement from the measured room, not from a guess about the phone.
 *
 * `width` is the composition's own width (the frame, measured), `padding` is what the page takes off
 * each side, and `fontScale` is the reader's own text scale — a 1.3 system font makes an `Editează
 * profilul` a third wider without changing a single point of layout, so the measurement is scaled with
 * it. A door whose own width is known (`actionWidth`) is honoured; otherwise the minimum is used.
 */
export function postHeadArrangement(input: {
  width: number;
  padding?: number;
  fontScale?: number;
  actionWidth?: number;
}): PostHeadArrangement {
  const width = Math.max(0, Number(input.width) || 0);
  const padding = Math.max(0, Number(input.padding) || 0);
  const scale = Math.max(0.8, Math.min(2.5, Number(input.fontScale) || 1));
  const action = Math.max(POST_HEAD.actionMin, Number(input.actionWidth) || 0);
  const available = width - padding * 2;
  const needed = (POST_HEAD.identityMin + action + POST_HEAD.gap) * scale;
  return available < needed ? 'stack' : 'row';
}
