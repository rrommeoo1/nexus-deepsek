/**
 * Where a keystroke lands in a paragraph that is being written.
 *
 * The emoji panel of the composer is a keyboard, and a keyboard types *at the caret*. The composer
 * did not: the field reported its selection to nobody (`onSelectionChange` spent it on releasing a
 * tap pin) and the insert request appended to the end of the paragraph, so an emoji pressed with the
 * caret in the middle of a sentence appeared after the last word — the owner's report of 28 October
 * 2026. The fix is arithmetic, not a new editor: the paragraph is a string, the phone reports the
 * range the finger selected, and the emoji is spliced into *that* range.
 *
 * Two things here are not obvious, and both are the reason this is a module with its own tests:
 *
 * 1. **A caret is a UTF-16 offset**, exactly like `String.prototype.slice`, so a splice never has to
 *    convert anything. But an offset can *point inside* a surrogate pair (a thumb dragged over an
 *    emoji, an `onSelectionChange` delivered mid-grapheme, a stale range from before a paste). Slicing
 *    there would cut a character in half and produce the `` that a corrupt emoji becomes, so a range
 *    is snapped outwards — the start down to the beginning of the pair, the end up to its end.
 * 2. **A range is used once.** The composer keeps the range the field last reported and spends it on
 *    the next insert; a second emoji pressed without touching the field must land after the first,
 *    which is what the returned `caret` is for. Nothing here caches anything by itself.
 *
 * Pure by design: `scripts/test-text-insert.cjs` loads it in plain Node.
 */

/** A half-open `[start, end)` range of UTF-16 offsets in one string. `start === end` is a caret. */
export type TextSelection = { start: number; end: number };

/** A UTF-16 code unit that begins a surrogate pair. */
function isHigh(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

/** A UTF-16 code unit that ends a surrogate pair. */
function isLow(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

/** One offset as the phone meant it, or `null` if the value is not a number at all. */
function readOffset(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = Number(value);
  return Number.isFinite(raw) ? Math.trunc(raw) : null;
}

/** One offset, clamped into `text` and moved off the middle of a surrogate pair. */
function snapOffset(text: string, offset: number, direction: 'down' | 'up'): number {
  let snapped = Math.max(0, Math.min(text.length, offset));
  if (snapped > 0 && snapped < text.length && isHigh(text.charCodeAt(snapped - 1)) && isLow(text.charCodeAt(snapped))) {
    snapped += direction === 'up' ? 1 : -1;
  }
  return snapped;
}

/**
 * The range a keystroke may use: clamped to the text, ordered, and on character boundaries.
 *
 * A missing or unreadable range is a caret at the end of the paragraph, which is what "no selection
 * was ever reported" means for a field that has just been opened — the old behaviour, kept for the
 * only case where there is nothing better to use. A *caret* is one place, so both of its sides move
 * the same way (out of the pair, to the left); a *range* grows outwards, because a selection that
 * stops inside an emoji would cut it.
 */
export function snapSelection(text: string, selection?: Partial<TextSelection> | null): TextSelection {
  const words = typeof text === 'string' ? text : '';
  const start = readOffset(selection?.start);
  const end = readOffset(selection?.end);
  if (start === null || end === null) return { start: words.length, end: words.length };
  const caret = start === end;
  return {
    start: snapOffset(words, Math.min(start, end), 'down'),
    end: snapOffset(words, Math.max(start, end), caret ? 'down' : 'up'),
  };
}

/**
 * Type `addition` into `text` at `selection`, replacing whatever the selection covered.
 *
 * The answer carries the text to show and the caret to leave after the insertion, so a second
 * keystroke knows where the first one ended. The caret is always on a boundary: `addition` is a whole
 * sequence of code points and the selection was snapped onto one.
 */
export function insertAtSelection(
  text: string,
  addition: string,
  selection?: Partial<TextSelection> | null,
): { text: string; caret: number } {
  const words = typeof text === 'string' ? text : '';
  const insert = typeof addition === 'string' ? addition : '';
  const { start, end } = snapSelection(words, selection);
  return {
    text: `${words.slice(0, start)}${insert}${words.slice(end)}`,
    caret: start + insert.length,
  };
}
