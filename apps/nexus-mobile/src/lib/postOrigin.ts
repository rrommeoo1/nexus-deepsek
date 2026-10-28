import type { ContentProvenance } from './publishClient';

/**
 * What the reader is allowed to see about how a post was made.
 *
 * The declaration has existed on the writing side since the first composer (`PROVENANCE_LABELS`,
 * `lib/publishClient.ts`), and `socialPostView` has always answered with it. Nothing on the reading side
 * drew it until round 33; round 34 settled *which* answers deserve a line on the page
 * (`JUNGLE_BOOK_PROGRESS.md` §34.6).
 *
 * Three rules shape these words:
 *
 * 1. **Only a disclosure is drawn.** „Asistat de AI" and „Generat cu AI" tell a reader something they
 *    cannot see for themselves, so they are printed. Ordinary authorship, camera captures and posts that
 *    declare nothing draw nothing: a label on almost every post would say the same thing about all of
 *    them, which is nothing. An undeclared post is not quietly re-labelled „creat de autor" either —
 *    nobody declared that.
 * 2. **The words are the composer's; the honesty is in the hint.** The visible line is two words because
 *    it sits under a place name, so it does not say who declared anything nor that it is unverified.
 *    `POST_ORIGIN_HINT` still tells a screen reader both facts. The server stores the author's choice; it
 *    does not audit the picture (`normalizeProvenance`, `apps/nexus-web/lib/moderation.js`), and the saved
 *    value keeps its spelling and its validation — only the display changed.
 * 3. **`originOf` never infers.** An unknown value, a missing field, or a value from a newer server
 *    answers `''` and the reader keeps the old layout. Nothing here guesses that a post „looks AI": the
 *    label repeats a saved declaration or it does not appear.
 *
 * The strings below use `\u` escapes for the Romanian letters so the file stays pure ASCII: the value the
 * app shows and the test reads is the same, and no editor or encoding step can silently damage it.
 */
export const POST_ORIGIN_LABELS: Record<ContentProvenance, string> = {
  NOT_DECLARED: '',
  CAMERA_CAPTURED_DECLARED: '',
  AI_ASSISTED: 'Asistat de AI',
  AI_GENERATED: 'Generat cu AI',
};

/** The sentence a screen reader adds after the label: what the declaration is, and what it is not. */
export const POST_ORIGIN_HINT = 'Ce a declarat autorul despre cum a fost f\u0103cut con\u021binutul. Jungle Book nu verific\u0103 declara\u021bia.';

/** The label a post's declaration earns, or `''` when the post declares nothing this app can quote. */
export function originOf(post?: { provenance?: unknown } | null): string {
  const value = typeof post?.provenance === 'string' ? post.provenance.trim() : '';
  if (!value) return '';
  return POST_ORIGIN_LABELS[value as ContentProvenance] ?? '';
}
