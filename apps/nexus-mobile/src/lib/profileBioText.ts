/**
 * The owner's description is text, and an address inside it stays a link:
 * `apps/nexus-web/public/profile-bio-text.js` is the contract, transcribed here without a renderer.
 * Escaping belongs to whoever draws the string, so what this module answers is the description cut
 * into the pieces a reading has to treat differently.
 *
 * Two kinds of piece lead somewhere. An address (`https?://…` or `www.…`) is the module's own link,
 * punctuation included in the rule that decides where the address ends - a full stop that closes the
 * sentence stays outside it (`splitTrailingPunctuation`, verbatim). A mention (`@handle`) is this
 * shell's addition, and it is written down rather than hidden: the web anchors addresses only, while
 * a mention here is read through the door the band already has for a handle
 * (`PROFILE_TICKER_ACTIONS.handle`), so `@nexus` opens that profile. A `@` that belongs to a word or
 * to an address (`x@y.com`, `https://host/@user`) is not a mention: the address alternative is tried
 * first at every position, and a mention that follows a letter, a digit, a dot or another `@` is left
 * exactly where it was written.
 */
export const BIO_ADDRESS_PATTERN = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi;
export const BIO_MENTION_PATTERN = /@[a-z0-9_]{2,30}/gi;

/** Both kinds of piece in one alternation: the address first, so an address is never read as a mention. */
const PIECE = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)|(@[a-z0-9_]{2,30})/gi;

/** The character before a mention that makes it part of something else: `x@y.com` is not a mention. */
const WORD_BEFORE = /[A-Za-z0-9_.@]/;

export type BioLink = 'address' | 'mention';

/** One piece of a description: plain text, or a piece that leads somewhere. */
export type BioToken = { text: string; link: BioLink | null; href: string };

/**
 * A sentence that ends with an address puts its full stop right after it: the punctuation belongs to
 * the sentence, not to the link. A closing bracket is only taken back while it has no opening bracket
 * inside the address, so `.../wiki/Foo_(bar)` keeps its own parenthesis. Copied from the module.
 */
export function splitTrailingPunctuation(match: string): [string, string] {
  let value = String(match ?? '');
  let tail = '';
  for (;;) {
    const last = value.slice(-1);
    if (!last) break;
    if (/[.,;:!?\]}\u2019\u201d\u2026]/.test(last)) { tail = last + tail; value = value.slice(0, -1); continue; }
    if (last === ')' && value.split('(').length < value.split(')').length) {
      tail = last + tail;
      value = value.slice(0, -1);
      continue;
    }
    break;
  }
  return [value, tail];
}

/** The module's own rule: an address written without a scheme is read as an `https` one. */
export function addressHref(value: string): string {
  const address = String(value ?? '').trim();
  if (!address) return '';
  return /^www\./i.test(address) ? `https://${address}` : address;
}

/** The description as pieces: what is plain text, and what leads somewhere. */
export function bioTokens(text?: string | null): BioToken[] {
  const source = String(text ?? '');
  if (!source) return [];
  const tokens: BioToken[] = [];
  let cursor = 0;
  const plain = (until: number) => {
    if (until <= cursor) return;
    const text = source.slice(cursor, until);
    /** Neighbouring text stays one piece: a reading draws one nested text per run, not one per match. */
    const last = tokens[tokens.length - 1];
    if (last && last.link === null) last.text += text;
    else tokens.push({ text, link: null, href: '' });
  };
  PIECE.lastIndex = 0;
  for (let match = PIECE.exec(source); match; match = PIECE.exec(source)) {
    const at = match.index;
    if (match[2]) {
      // A mention that continues a word is not a mention at all, and neither is the `@` of an address.
      if (at > 0 && WORD_BEFORE.test(source[at - 1])) continue;
      plain(at);
      tokens.push({ text: match[2], link: 'mention', href: match[2].slice(1).toLowerCase() });
      cursor = at + match[2].length;
      continue;
    }
    const [value, tail] = splitTrailingPunctuation(match[1]);
    if (!value) continue;
    plain(at);
    tokens.push({ text: value, link: 'address', href: addressHref(value) });
    // The punctuation that was taken back belongs to the sentence: it is read as the text after it.
    if (tail) tokens.push({ text: tail, link: null, href: '' });
    cursor = at + match[1].length;
  }
  plain(source.length);
  return tokens;
}

/** Only the pieces that lead somewhere: what a reading turns into links. */
export function bioLinks(text?: string | null): BioToken[] {
  return bioTokens(text).filter((token) => token.link !== null);
}

/**
 * The first address the description carries. The profile record keeps no link of its own - its one
 * place for an external address is the description, which the web already turns into anchors - so
 * this is the address the editor's link field edits and the reading the band makes tappable.
 */
export function firstAddress(text?: string | null): string {
  const found = bioLinks(text).filter((token) => token.link === 'address');
  return found.length ? found[0].text : '';
}

/** The description without one address: the line it stood on is tidied, not left blank. */
function withoutAddress(text: string, address: string): string {
  return text
    .replace(address, '')
    .replace(/[ \t]+\n/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

/**
 * The description after the link field was used: the address that was there is replaced, an address
 * that was not there is added on a line of its own, and an emptied link field removes the address
 * instead of leaving half a line behind. Nothing else in the description is touched.
 */
export function withAddress(text: string | null | undefined, address: string): string {
  const current = String(text ?? '');
  const next = String(address ?? '').trim();
  const found = firstAddress(current);
  if (!next) return found ? withoutAddress(current, found) : current;
  if (found === next) return current;
  if (found) return current.replace(found, next);
  const body = current.replace(/\s+$/u, '');
  return body ? `${body}\n${next}` : next;
}
