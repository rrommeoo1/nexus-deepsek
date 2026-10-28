/**
 * The three marks a post's words carry on this network, read the way the web reads them:
 *
 *   `#subiect`  a tag the post is filed under (`tagsOf`, `lib/postPresentation`), printed in the
 *               brand's teal wherever it appears inside the sentence;
 *   `@nume`     a door to a creator (`app.js:9313` `openProfile`) — a mention, not an address, so an
 *               e-mail or a handle written inside a URL stays plain text;
 *   `https://…` a link, underlined so a reader can tell it opens something.
 *
 * The splitter is pure and dependency-free (`scripts/test-rich-text.cjs` runs it through
 * `typescript` exactly the way the other `lib` modules are tested), because the renderer
 * (`components/RichText.tsx`) only maps the segments it returns onto nested `<Text>` nodes: a `Text`
 * cannot be styled in the middle without a child `Text`, and a `Text` is the only thing a caption can
 * be, so the split is the whole formatting model.
 */

/** What a stretch of a post's words is: the sentence itself, or one of the three marks inside it. */
export type RichTextKind = 'text' | 'hashtag' | 'mention' | 'link';

/** One stretch of a post's words, in reading order. The segments always concatenate to the input. */
export type RichTextSegment = { text: string; kind: RichTextKind };

/**
 * `#tag`, `@handle`, `https://…` and `www.…` — one alternative each, matched left to right. Tags and
 * handles are bounded at 60+1 characters because the composer's own limit is a sentence, not a page:
 * a "tag" longer than that is somebody pasting a URL fragment, and painting it as a tag would lie.
 */
const TOKEN = /(https?:\/\/[^\s]+|www\.[^\s]+|#[\p{L}\p{N}_]{1,60}|@[\p{L}\p{N}._]{1,60})/gu;

/** The characters that glue a token to the word before it, making it not a token at all. */
const GLUE = /[\p{L}\p{N}_@#/.]/u;

/**
 * A URL's own trailing sentence punctuation is not part of the address: `vezi https://x.ro/a.` ends
 * the link at `a`, and the full stop stays in the sentence where the author put it.
 */
function trimLink(token: string): string {
  let end = token.length;
  while (end > 0 && '.,;:!?)]}»”'.includes(token[end - 1])) end -= 1;
  return token.slice(0, end);
}

/** The prefixes that make a token an address rather than a word that happens to start like one. */
const SCHEME = /^(?:https?:\/\/|www\.)/i;

/**
 * After the trailing punctuation is gone, a token has to keep something to open: `https://` and
 * `www.` are schemes, not addresses, so they stay in the sentence instead of becoming a link that
 * does nothing. `www.` also promises a domain — `www.exemplu` is a word, not a host.
 */
function isAddress(token: string): boolean {
  const rest = token.replace(SCHEME, '');
  if (!rest) return false;
  return !/^www\./i.test(token) || rest.includes('.');
}

/**
 * Split a post's words into the stretches the renderer paints. An empty or non-string caption
 * answers with no segments at all (the caller draws nothing), and a caption with no marks is one
 * `text` segment, so the renderer never has to special-case the plain case.
 */
export function richTextSegments(caption?: string | null): RichTextSegment[] {
  const value = typeof caption === 'string' ? caption : '';
  if (!value) return [];
  const segments: RichTextSegment[] = [];
  let cursor = 0;
  TOKEN.lastIndex = 0;
  let match = TOKEN.exec(value);
  while (match) {
    const start = match.index;
    const token = match[0];
    // A token begins a word: `ana@exemplu.ro` is an address and `C#` is a language, and neither is a
    // mention or a tag. The rejected characters are folded back into the sentence by `cursor`.
    const glued = start > 0 && GLUE.test(value[start - 1]);
    const painted = token.startsWith('#') || token.startsWith('@') ? token : trimLink(token);
    if (glued || !painted || !isAddress(painted)) {
      match = TOKEN.exec(value);
      continue;
    }
    const kind: RichTextKind = painted.startsWith('#') ? 'hashtag' : painted.startsWith('@') ? 'mention' : 'link';
    if (start > cursor) segments.push({ text: value.slice(cursor, start), kind: 'text' });
    segments.push({ text: painted, kind });
    cursor = start + painted.length;
    // The trimmed tail (`.,`) has to be read as the sentence it belongs to, so the scan resumes there.
    TOKEN.lastIndex = cursor;
    match = TOKEN.exec(value);
  }
  if (cursor < value.length) segments.push({ text: value.slice(cursor), kind: 'text' });
  return segments;
}

/** The tags a caption carries, without the mark — the same reading `tagsOf` gives a post's payload. */
export function captionTags(caption?: string | null): string[] {
  return richTextSegments(caption)
    .filter((segment) => segment.kind === 'hashtag')
    .map((segment) => segment.text.replace(/^#/, ''))
    .filter(Boolean);
}
