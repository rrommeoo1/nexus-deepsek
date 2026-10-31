/**
 * What the phone did with the reaction gesture (30 October 2026, round 42).
 *
 * The owner reported a difference that no reading of the code explained: holding the Like press and
 * sliding the thumb across the emoji worked on a page of words and failed on a reel. Both surfaces mount
 * the same `ReactionControl`, so the difference is not in the panel — it is in the *touch stream*, which
 * a native view above the control can take away (a pager's `onInterceptTouchEvent`, a video surface, a
 * full-page press). None of that is visible from JavaScript, and neither logcat nor a screenshot can say
 * "the touch was cancelled at 240ms".
 *
 * So the control keeps the last events it received, and the phone can be asked. The record is bounded
 * (a ring of `REACTION_TRACE_MAX`), synchronous, and costs nothing outside a gesture: a hold writes three
 * entries, a slide writes one per *cell* change (not per pixel), and a release closes it.
 *
 * It is a diagnostic, not state: nothing is rendered from it and nothing is decided by it. `test-reaction-
 * gesture.cjs` runs the ring itself, so the panel's one gesture is still the one thing that can be tested
 * without a phone; the phone's entries are the evidence for what the *device* did.
 */
export const REACTION_TRACE_MAX = 64;

/**
 * The events the control records:
 *
 *   `grant`     the wrapper became the responder — the finger is down on the plate;
 *   `hold`      the hold timer fired and the panel is being drawn (the decision point);
 *   `aim`       the cell under the finger changed (the only per-move entry, so a slide is cheap);
 *   `release`   the finger lifted while the wrapper still owned the gesture;
 *   `terminate` something *else* took the gesture — the answer to "why did the slide stop working";
 *   `request`   a native view asked for the gesture while the panel was open (the refusal path).
 *
 * `variant` is the surface the control was drawn as (`rail` beside a picture or a clip, `row` under a
 * card's words, `whisper`, `card`), because the rail is the one the owner reported broken.
 */
export type ReactionTraceKind = 'grant' | 'hold' | 'aim' | 'release' | 'terminate' | 'request';

export type ReactionTraceEntry = {
  /** The index of the entry in the ring, so an event and its consequence can be read in order. */
  seq: number;
  kind: ReactionTraceKind;
  /** `ReactionControl`'s own variant. */
  variant: string;
  /** Milliseconds since the module was loaded — enough to see the hold's 240ms and a steal's delay. */
  at: number;
  /** The last cell the finger pointed at (`-1` when it pointed at nothing), for `aim`/`release`. */
  cell?: number;
  /** Whether the panel was open when the event arrived. */
  open?: boolean;
  /** The thumb's place on the page, in dp, when the event carries one. */
  x?: number;
  y?: number;
};

const ring: ReactionTraceEntry[] = [];
let seq = 0;
const started = Date.now();

/** One entry, with the fields the caller has. Returns it, so a caller can print it in one line. */
export function traceReaction(kind: ReactionTraceKind, variant: string, detail: {
  cell?: number; open?: boolean; x?: number; y?: number;
} = {}): ReactionTraceEntry {
  const entry: ReactionTraceEntry = {
    seq: ++seq,
    kind,
    variant,
    at: Date.now() - started,
    ...(typeof detail.cell === 'number' ? { cell: detail.cell } : {}),
    ...(typeof detail.open === 'boolean' ? { open: detail.open } : {}),
    ...(typeof detail.x === 'number' ? { x: Math.round(detail.x) } : {}),
    ...(typeof detail.y === 'number' ? { y: Math.round(detail.y) } : {}),
  };
  ring.push(entry);
  if (ring.length > REACTION_TRACE_MAX) ring.shift();
  return entry;
}

/** The last events, oldest first — a copy, so a reader cannot disturb the ring. */
export function reactionTrace(): ReactionTraceEntry[] {
  return ring.map((entry) => ({ ...entry }));
}

/** Forget everything (a test, or the start of a new reading on the phone). */
export function clearReactionTrace() {
  ring.length = 0;
  seq = 0;
}

/**
 * One line a log can carry: `[reaction] #12 storeopen@240ms variant=rail cell=2 open=false (page 1000,700)`.
 * A developer's meter, not a sentence for the owner.
 */
export function describeReactionTrace(entry: ReactionTraceEntry): string {
  const where = typeof entry.x === 'number' && typeof entry.y === 'number' ? ` (page ${entry.x},${entry.y})` : '';
  const cell = typeof entry.cell === 'number' ? ` cell=${entry.cell}` : '';
  const open = typeof entry.open === 'boolean' ? ` open=${entry.open}` : '';
  return `[reaction] #${entry.seq} ${entry.kind}@${entry.at}ms variant=${entry.variant}${cell}${open}${where}`;
}
