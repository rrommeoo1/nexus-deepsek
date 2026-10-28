/**
 * The foot of a post read as a page: the one door that leaves it, and the room it reserves.
 *
 * Round 31 (owner, 31 October 2026). A page of words opened from a profile printed its author twice —
 * once in the route's 52dp chrome and once in the page's own head — and the chrome carried a counter,
 * `1/22`, that counted the *posts of the walk* rather than the pages of the document: a three-page
 * article opened from a profile therefore said `1/22` at the top while the paper said `1/3` at the
 * foot. Two headers and two numbers are one header and one number too many. The route now draws no
 * chrome over a page of words at all, and the number is the page's own (`lib/textPage.ts::folioLabel`).
 *
 * What the reader still needs is the way out. It stands where a book's thumb expects it — at the foot —
 * and it stands in a band the page has already given up: `readerBarHeight` is added to the page's own
 * bottom inset *before* anything is drawn (`PostCanvas` pads by it, `PostRail` climbs by it, and the
 * folio's own `PAGE_FOLIO` band ends above it), so no word and no button can ever stand under the door
 * and the door can never cover a line. That was the owner's rejection of round 30 in one sentence: a
 * control floating over the composition must not be the way the composition is read.
 *
 * Pure by design: `scripts/test-reader-page.cjs` loads it in plain Node.
 */

/** The band, the door and the margins of the foot of a page of words. */
export const READER_BAR = {
  /** The band itself, above the device's own bottom inset. */
  height: 48,
  /** The Back target: 44dp of press, the disc drawn inside it. */
  button: 44,
  /**
   * The disc itself — the header's 34 one point larger, because a page has no hairline under it to
   * hold the drawing: a 36dp plate on cream is the same weight the 34dp plate carries on a photograph.
   */
  disc: 36,
  /** The chevron, in points. */
  glyph: 26,
  /** The page margin the bar shares with the page it stands on. */
  inline: 10,
} as const;

/**
 * How much room the foot of a page of words reserves, device inset included.
 *
 * The inset is the gesture bar (`insets.bottom`), added — not merged — with the band, exactly as the
 * header adds the status clock on top: the door is drawn *above* the inset and the words end above the
 * door.
 */
export function readerBarHeight(insetBottom: number): number {
  return Math.max(0, Math.round(Number(insetBottom) || 0)) + READER_BAR.height;
}

/**
 * Where a page of words starts, now that no header stands above it.
 *
 * A page prints its author's head as the first thing on its paper, so it starts in the notification band
 * itself — the same number the feed hands `PostCard` (`insets.top`). Reserving the header's 52dp here
 * would print the page a band too low and leave a strip of cream under the status clock with nothing in
 * it: the very gap the route's header used to fill.
 */
export function readerPageTopInset(insetTop: number): number {
  return Math.max(0, Math.round(Number(insetTop) || 0));
}

/**
 * The foot of the same page, opened from a **profile** (round 32, owner, 31 October 2026).
 *
 * Round 31 put the way out of a page of words at its foot, and the door needed a band of its own above the
 * device's inset: 48dp the page gave up before it was drawn. Read again on the phone, that band is what the
 * owner saw as a gap — a `1/3` standing 130dp above the bottom of the screen, with nothing between it and
 * the phone's navigation bar.
 *
 * A page opened from a profile does not need that door: the phone's own Back *is* the way out there, and it
 * lands on the profile the reader came from, because the profile is still mounted under this route with its
 * scroll position (the door's own rule, `round 31`: history first, then the profile). So the band goes back
 * to the page: `profileReaderBottomInset` reserves the device's inset plus a strip of air — the paper's own
 * margin, not a control's room — and the folio, reprinted lower by `lib/textPage.ts::folioRow`, stands in
 * it. Nothing else changes: the words still end above the digits, the rail still climbs by the same inset,
 * and a page opened anywhere else (`readerBarHeight`) keeps the door and the band it needs.
 *
 * Pure by design: `scripts/test-reader-page.cjs` loads it in plain Node.
 */
export const PROFILE_READER_FOOT = {
  /**
   * The strip of paper kept under the folio, above the device's own band: enough that the last printed row
   * never sits on the edge of the navigation bar, and small enough to read as the page's margin.
   */
  air: 10,
} as const;

/** How much room the foot of a page of words reserves when it was opened from a profile, inset included. */
export function profileReaderBottomInset(insetBottom: number): number {
  return Math.max(0, Math.round(Number(insetBottom) || 0)) + PROFILE_READER_FOOT.air;
}

/**
 * Does a page of words still print the foot's door?
 *
 *   · a page that is not a page of words prints no door and never did (`wordPage` is `readsAsPage`);
 *   · a page opened from **anywhere but a profile** — the composer's receipt, which is the other caller of
 *     this route — keeps the door: it is the only way out of a page that was pushed over a composer that
 *     has already been dismissed;
 *   · a page opened from a profile does **not** print it (round 32): the phone's own Back stands in the
 *     navigation bar two centimetres under it and does the very same thing, and a second door on a page of
 *     paper is the redundancy the owner asked to remove (`close` is still the rule the header and a
 *     history-less entry use);
 *   · the one exception is the entry that has **no app history at all** — a `nexusdev://post/<id>` link,
 *     whose Back would leave the app: there the door is the only way to the profile the walk belongs to,
 *     so it stays (`router.canGoBack()` is `false`).
 */
export function readerDoorShown(input: {
  wordPage: boolean;
  profileOrigin: boolean;
  canGoBack: boolean;
}): boolean {
  if (!input.wordPage) return false;
  if (!input.profileOrigin) return true;
  return !input.canGoBack;
}
