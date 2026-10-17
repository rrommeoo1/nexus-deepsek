/**
 * The band's motion as arithmetic (`MIGRATION.md` §20.2).
 *
 * The owner's decision replaced the old rule — "stand still when the system asks for reduced motion" —
 * with a switch of the product's own (`Banda derulantă`, off only when the reader turns it off). That
 * makes pause and resume first-class: a touch stops the line **exactly** where it stands, the second one
 * sends it on from the same point with the usual speed, and the whole thing survives the screen being
 * left open, the app being sent to the background and coming back.
 *
 * The position is never read back from the animated value. With `useNativeDriver: true` the value lives
 * on the native side and the JS copy stays at whatever it was last set to, so reading it mid-flight would
 * answer with the point the travel started at, not the point it reached. Instead a segment remembers when
 * it started and where it started from, and the position at any later moment is arithmetic:
 *
 *     position = (from + elapsedMs · runWidth / cycleMs) mod runWidth
 *
 * Pausing is "read the clock, freeze at that position"; resuming is "travel the rest of the run in the
 * remaining share of the cycle". Both are pure, which is what the tests pin.
 */

/** A stretch of travel: it left `from` at `startedAt` and moves one run per cycle. */
export type BandSegment = { from: number; startedAt: number };

/** What `Animated.timing` needs to finish the current run: the end of the run and how long is left. */
export type BandPlan = { toValue: number; duration: number };

/** Pixels per millisecond: one run per cycle, so a longer run travels at the same speed. */
export function bandSpeed(runWidth: number, cycleMs: number): number {
  if (!(runWidth > 0) || !(cycleMs > 0)) return 0;
  return runWidth / cycleMs;
}

/**
 * A position on the run, always in `[0, runWidth)`: the strip leaves 0 and reaches `runWidth` as the next
 * copy takes the first one's place, which is the same picture — so `runWidth` is 0 again, not a jump.
 */
export function bandWrap(position: number, runWidth: number): number {
  if (!(runWidth > 0) || !Number.isFinite(position)) return 0;
  const wrapped = position % runWidth;
  return wrapped < 0 ? wrapped + runWidth : wrapped;
}

/**
 * Where the line stands at `now`. A segment whose start is in the future (a clock that stepped back)
 * stands at its own `from`, and time spent in the background counts exactly like time spent watching:
 * the arithmetic does not care whether anyone was looking.
 */
export function bandPositionAt(segment: BandSegment, now: number, runWidth: number, cycleMs: number): number {
  if (!(runWidth > 0)) return 0;
  const from = bandWrap(segment.from, runWidth);
  const elapsed = Math.max(0, now - segment.startedAt);
  return bandWrap(from + elapsed * bandSpeed(runWidth, cycleMs), runWidth);
}

/**
 * What is left of the run from `position`: `Animated.timing` towards `-runWidth`, for the share of the
 * cycle the remaining distance deserves. The duration never drops below one millisecond — a timer that
 * never fires would leave the line stuck a hair from the seam.
 */
export function bandResumePlan(position: number, runWidth: number, cycleMs: number): BandPlan {
  if (!(runWidth > 0) || !(cycleMs > 0)) return { toValue: 0, duration: 1 };
  const from = bandWrap(position, runWidth);
  const remaining = runWidth - from;
  return { toValue: -runWidth, duration: Math.max(1, Math.round(remaining / bandSpeed(runWidth, cycleMs))) };
}

/**
 * The identity of what the band carries. A profile of somebody else, or an edit of this one, is a new
 * line and starts from the beginning; a re-render that only re-read the clock is the same line and keeps
 * travelling. The separator is a control character, so no reading can forge another's signature.
 */
export function bandSignature(items: readonly { kind?: string; text: string; icon?: string }[]): string {
  return items.map((item) => `${item.kind ?? ''}\u001f${item.icon ?? ''}\u001f${item.text}`).join('\u001e');
}
