import type { MediaItem, SocialPost } from './socialTypes';

/**
 * The one presentation contract the universal 9:16 reader, the profile grid and the quote previews
 * share. It is deliberately **pure**: it imports nothing at runtime, so `scripts/test-post-presentation.cjs`
 * can load it with `typescript.transpileModule` and `node:test` the way the other `scripts/test-*.cjs`
 * suites load their modules.
 *
 * Rules of the product it encodes (a post is one record; presentation never duplicates it):
 *   - `MAX_MEDIA` attachments per post. The server still accepts 10 (`POST /api/posts`, `media_items`),
 *     so a post written before the cap is read as a carousel instead of losing items.
 *   - `MAX_TEXT_PAGES` pages in the text reading. The reader measures its own page and asks
 *     `textPageCapacity` how many characters fit; `TEXT_PAGE_CHARS` is only the pre-measure default,
 *     so a 20 000-character article is split by the screen it is read on, never by a fixed 420.
 *   - `MAX_QUOTE_LAYERS` visible panels: the latest quote, the previous one, and the original.
 *
 * The two media readers below mirror `postMediaItems` / `mediaKindOf` of `lib/socialTypes` without the
 * URL validation those add, because this module must stay importable outside React Native. Callers that
 * need a loadable source still use `postMediaItems` for rendering; this one only decides the layout.
 */

/** The product cap on attachments. */
export const MAX_MEDIA = 5;

/** The product cap on the pages of one text reading. */
export const MAX_TEXT_PAGES = 120;

/** The product cap on the visible panels of a quote chain (latest, previous, original). */
export const MAX_QUOTE_LAYERS = 3;

/** Characters per text page before the reader has measured itself. */
export const TEXT_PAGE_CHARS = 420;

/**
 * The room the lead picture takes on the first page of an article.
 *
 * `baseHeight` is the measured media cap (`34 %` of the page, at most `92 %` of its width and `420`),
 * and the author's frame scales that cap and may push it down (`y`). The block may never eat more than
 * `46 %` of the page height, `102 %` of its width or `480` points, so a zoomed picture cannot bury the
 * words; within that limit the first page's capacity is measured against this exact height, which is
 * why a pinch in the composer and a pinch on a published page produce the same text reflow.
 */
export function mediaLeadHeight(
  baseHeight: number,
  pageWidth: number,
  pageHeight: number,
  frame: { scale?: number; y?: number } = {},
): number {
  const base = Math.max(0, Number(baseHeight) || 0);
  if (!base) return 0;
  const scale = Number.isFinite(Number(frame.scale)) ? Number(frame.scale) : 1;
  const y = Number.isFinite(Number(frame.y)) ? Number(frame.y) : 0;
  const content = base * Math.max(0, scale);
  const offset = Math.max(0, y * base);
  const width = Math.max(0, Number(pageWidth) || 0);
  const height = Math.max(0, Number(pageHeight) || 0);
  return Math.max(0, Math.min(height * 0.46, width * 1.02, 480, content + offset + 12));
}

/**
 * How many characters one *measured* page can carry.
 *
 * The old reading split every article at 420 characters, a number chosen for a 2 000-character cap;
 * a paragraph on a tall phone was cut in half while a third of the page stayed empty. The page is a
 * box, so its capacity is computed from the box: the widest line that fits the measure, the number of
 * lines that fit the height, and the average glyph width of the chosen face. Paragraph breaks and the
 * uneven last line of every paragraph cost a little, hence the 0.92 fill.
 *
 * It is a pure function (the tests in `scripts/test-post-presentation.cjs` call it), and the reader
 * still scrolls a page vertically if the estimate was generous: a wrong number can never hide a word.
 */
export function textPageCapacity(input: {
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
  /** Average glyph width as a fraction of the font size: serif ~0.5, sans ~0.52, mono ~0.6. */
  glyph?: number;
  /** Horizontal padding inside the page (the authored page keeps 14 on each side). */
  paddingHorizontal?: number;
  /** Vertical padding inside the page. */
  paddingVertical?: number;
}): number {
  const width = Math.max(0, Number(input.width) || 0);
  const height = Math.max(0, Number(input.height) || 0);
  const fontSize = Math.max(8, Number(input.fontSize) || 20);
  const lineHeight = Math.max(fontSize, Number(input.lineHeight) || fontSize * 1.45);
  if (width < 80 || height < 80) return TEXT_PAGE_CHARS;
  const usableWidth = width - (input.paddingHorizontal ?? 28);
  const usableHeight = height - (input.paddingVertical ?? 24);
  const glyph = Math.min(0.8, Math.max(0.4, input.glyph ?? 0.52));
  const perLine = Math.floor(usableWidth / (fontSize * glyph));
  const lines = Math.floor(usableHeight / lineHeight);
  if (perLine < 6 || lines < 2) return TEXT_PAGE_CHARS;
  return Math.max(200, Math.min(3000, Math.floor(perLine * lines * 0.92)));
}

/** How a gallery of N items is drawn: one big picture, two halves, a compact grid, or a carousel. */
export type MediaLayout = 'none' | 'single' | 'pair' | 'grid' | 'carousel';

export function mediaLayoutFor(count: number): MediaLayout {
  const total = Math.max(0, Math.trunc(Number(count) || 0));
  if (total <= 0) return 'none';
  if (total === 1) return 'single';
  if (total === 2) return 'pair';
  if (total <= MAX_MEDIA) return 'grid';
  return 'carousel';
}

function mediaKindOf(item?: MediaItem | null): 'image' | 'video' | 'audio' | null {
  if (!item) return null;
  if (item.kind) return item.kind;
  const mime = String(item.mime || '');
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('image/')) return 'image';
  return null;
}

/** `postMediaItems` without the URL check: the ordered gallery, or the single cover when no list exists. */
export function mediaOf(post?: SocialPost | null): MediaItem[] {
  const listed = Array.isArray(post?.media_list) ? post.media_list.filter((item) => Boolean(item?.hash)) : [];
  if (listed.length) return listed;
  return post?.media?.hash ? [post.media] : [];
}

/** The items a surface may print, in the order the author arranged them. */
export function galleryOf(post?: SocialPost | null): MediaItem[] {
  return mediaOf(post).slice(0, MAX_MEDIA);
}

/** The first clip of the gallery, or null when the post carries none. */
export function videoOf(post?: SocialPost | null): MediaItem | null {
  return mediaOf(post).find((item) => mediaKindOf(item) === 'video') ?? null;
}

/** The caption as one readable line; `title` is publishing metadata and is not the body of a post. */
export function textOf(post?: SocialPost | null): string {
  return String(post?.caption ?? '').replace(/\r\n?/g, '\n').trim();
}

/**
 * The two kinds of content the product publishes. This is a *type*, never a guess about what the post
 * happens to contain: the frame is 9:16 for both, and a caption is metadata on either.
 *
 *   `reel` - a video-first item (`posts.kind = 'video'` on the server, `repo.createPost`): the clip is
 *            the composition, the reactions hang on the vertical rail, and the caption is optional.
 *   `post` - everything else: text, photo, text + photo, text + video, repost, quote, conversation,
 *            long text. The reactions are one horizontal row under the words.
 */
export type ContentType = 'reel' | 'post';

/**
 * What a payload *says* it is, before anything is derived. `posts` has no `post_type` column today -
 * `kind` (`text` | `image` | `video`) is the authoritative stored field - but a fixture, or a server
 * that grows an explicit label, must win over any rule below, so all three spellings are read.
 */
function explicitTypeOf(post?: SocialPost | null): ContentType | null {
  if (!post) return null;
  const publishing = post.publishing as { type?: unknown; format?: unknown } | null | undefined;
  const candidates: unknown[] = [
    (post as { post_type?: unknown }).post_type,
    (post as { content_type?: unknown }).content_type,
    publishing?.type,
    publishing?.format,
  ];
  for (const value of candidates) {
    const label = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (label === 'reel' || label === 'reels' || label === 'clip') return 'reel';
    if (label === 'post' || label === 'posts' || label === 'photo' || label === 'text') return 'post';
  }
  return null;
}

/**
 * The one classifier every surface uses - feed filtering, feed rendering, the full-screen reader, the
 * profile grid and post navigation - so two screens can never disagree about the same record.
 *
 * Order of authority:
 *   1. an explicit label on the payload (`post_type` / `content_type` / `publishing.type`);
 *   2. the server's own `posts.kind`: `video` is a Reel **whether or not it has a caption**, `text` and
 *      `image` are Posts;
 *   3. a payload that carries no `kind` at all (older fixtures, hand-written test data): a clip with no
 *      words is read as a Reel, everything else as a Post.
 *
 * Deliberately *not* a rule: "has a caption, therefore a Post". The caption is optional on a Reel.
 *
 * Known limit of the schema: a video can only be stored as `kind = 'video'`, so a Post that *embeds* a
 * clip can only exist as a quote/repost of one, or as a payload that states `post_type: 'post'`. That
 * ambiguity belongs to the storage, not to this helper.
 */
export function contentTypeOf(post?: SocialPost | null): ContentType {
  if (!post) return 'post';
  const explicit = explicitTypeOf(post);
  if (explicit) return explicit;

  const kind = String(post.kind ?? '').trim().toLowerCase();
  if (kind === 'video') return 'reel';
  if (kind) return 'post';

  const clip = mediaOf(post).some((item) => mediaKindOf(item) === 'video');
  return clip && !textOf(post) ? 'reel' : 'post';
}

/**
 * Which renderer draws this post:
 *   `quote`   - it carries a reference to another post, so the conversation panels come first;
 *   `text`    - no media at all, the reading is the whole canvas;
 *   `reel`    - content classified as a Reel (`contentTypeOf`), exactly the reel the reader already knows;
 *   `article` - an authored text page (`text_style`) that carries photographs: the reading stays the
 *               composition, the first page opens with one bounded picture and the words continue on
 *               the following pages. It is deliberately **not** the immersive media page;
 *   `media`   - a picture without an authored text page, or a Post that embeds a clip: text above,
 *               media in the remaining area.
 */
export type PostStage = 'text' | 'media' | 'reel' | 'quote' | 'article';

/**
 * Whether this post is an article with photographs.
 *
 * The TEXT composer writes `text_style` on every page it publishes. A page that also carries pictures
 * is still an article: the owner asked that a tall photograph must not force the whole post into a Reel
 * composition, where the words become an overlay on the picture (25 October 2026). Photographs therefore
 * keep the article's paginated reading, and only posts without an authored page use the immersive
 * `ReelPage`.
 *
 * A clip is excluded: the store writes `kind = 'video'` for it, so it stays a Reel. A quote keeps its
 * conversation first. Audio alone is not a picture and does not make an article.
 */
export function isAuthoredArticle(post?: SocialPost | null): boolean {
  if (!post || !post.text_style || !textOf(post)) return false;
  if (contentTypeOf(post) === 'reel' || post.quoted_post) return false;
  const visual = mediaOf(post).filter((item) => mediaKindOf(item) !== 'audio');
  return visual.length > 0 && visual.every((item) => mediaKindOf(item) === 'image');
}

export function stageFor(post?: SocialPost | null): PostStage {
  if (!post) return 'text';
  if (contentTypeOf(post) === 'reel') return 'reel';
  if (post.quoted_post) return 'quote';
  const media = mediaOf(post);
  if (isAuthoredArticle(post)) return 'article';
  if (!media.length) return 'text';
  return 'media';
}

/**
 * Whether a post is *read as a page of words* — the one composition whose paper is its own chrome.
 *
 * It is `PostCanvas`'s own rule (`wordPage`), named once so the route that opens a post on its own can
 * ask the same question the canvas asks. A page of words prints its author's head on the paper, so it
 * needs no header above it and keeps its door at its foot (`lib/readerBar.ts`); a picture, a clip and a
 * quote carry no head of their own and keep the route's 52dp chrome.
 *
 * A quote is deliberately *not* a page of words: it is a conversation (`stage === 'quote'`) drawn on the
 * dark plate, and a matte door printed on it would be the one control the palette cannot place.
 */
export function readsAsPage(post?: SocialPost | null): boolean {
  const stage = stageFor(post);
  return stage === 'text' || stage === 'article';
}

/**
 * Whether a page can be filled with a picture or a clip. A soundtrack alone (`kind: 'audio'`) is not a
 * picture: a post that carries one is still read as a page of words, because the immersive page would
 * have nothing to cover it with. A file whose kind the payload does not name counts as visual — it has a
 * hash, so the media surface will try to draw it.
 */
export function hasVisualMedia(post?: SocialPost | null): boolean {
  return mediaOf(post).some((item) => mediaKindOf(item) !== 'audio');
}

export type QuoteRole = 'latest' | 'previous' | 'original';
export type QuoteLayer = { post: SocialPost; role: QuoteRole };
export type QuoteChain = { layers: QuoteLayer[]; omitted: number; total: number };

/** A quote chain can never be longer than this in practice; the walk stops there as a guard. */
const QUOTE_WALK_LIMIT = 32;

/**
 * The bounded conversation of a quote post (section 7 of the specification), walked **up** the
 * references:
 *
 *   [latest]   the post being read,
 *   [previous] the post it quotes (only when a second quote layer exists),
 *   [original] the oldest post of the chain.
 *
 * One quote prints two panels, every later quote prints three, and the layers left out of the compact
 * preview are counted in `omitted` rather than thrown away - the conversation detail view reads them
 * from the same walk. A repeated id (a corrupt or circular chain) ends the walk instead of looping.
 */
export function quoteChain(post?: SocialPost | null): QuoteChain {
  const chain: SocialPost[] = [];
  const seen = new Set<number>();
  let node: SocialPost | null | undefined = post ?? null;
  while (node && chain.length < QUOTE_WALK_LIMIT) {
    const id = Number(node.id);
    if (Number.isFinite(id)) {
      if (seen.has(id)) break;
      seen.add(id);
    }
    chain.push(node);
    node = node.quoted_post ?? null;
  }
  const total = chain.length;
  if (!total) return { layers: [], omitted: 0, total: 0 };
  const latest: QuoteLayer = { post: chain[0], role: 'latest' };
  if (total === 1) return { layers: [latest], omitted: 0, total };
  const original: QuoteLayer = { post: chain[total - 1], role: 'original' };
  if (total === 2) return { layers: [latest, original], omitted: 0, total };
  const previous: QuoteLayer = { post: chain[1], role: 'previous' };
  return { layers: [latest, previous, original], omitted: total - MAX_QUOTE_LAYERS, total };
}

export type TextPages = { pages: string[]; overflow: boolean };

/**
 * Deterministic pagination of one caption. Words are never split, a single newline stays inside the
 * page and a blank line (a paragraph break) is kept, so the same text always produces the same pages.
 * When the text somehow needs more than `maxPages`, the rest is merged into the last page (`overflow`),
 * which that page scrolls - nothing is silently dropped.
 *
 * `limitFor` receives the zero-based page index, because an article's **first** page may open with a
 * picture and therefore carry fewer characters than the pages after it (`textPagesWithLead`).
 */
function paginate(caption: string | null | undefined, limitFor: (page: number) => number, maxPages: number): TextPages {
  const text = String(caption ?? '').replace(/\r\n?/g, '\n').trim();
  if (!text) return { pages: [], overflow: false };
  const cap = Math.max(1, Math.trunc(maxPages) || MAX_TEXT_PAGES);

  const tokens: { word: string; paragraph: boolean }[] = [];
  text.split(/\n{2,}/).forEach((block, blockIndex) => {
    block.split(/\s+/).filter(Boolean).forEach((word, wordIndex) => {
      tokens.push({ word, paragraph: blockIndex > 0 && wordIndex === 0 });
    });
  });

  const pages: string[] = [];
  let current = '';
  for (const token of tokens) {
    const limit = limitFor(pages.length);
    const separator = current ? (token.paragraph ? '\n\n' : ' ') : '';
    if (current && current.length + separator.length + token.word.length > limit) {
      pages.push(current);
      current = token.word;
      continue;
    }
    current = `${current}${separator}${token.word}`;
  }
  if (current.trim()) pages.push(current);

  if (pages.length > cap) {
    const head = pages.slice(0, cap - 1);
    const tail = pages.slice(cap - 1).join('\n\n');
    return { pages: [...head, tail], overflow: true };
  }
  return { pages, overflow: false };
}

export function textPages(caption?: string | null, maxChars: number = TEXT_PAGE_CHARS, maxPages: number = MAX_TEXT_PAGES): TextPages {
  const limit = Math.max(120, Math.trunc(maxChars) || TEXT_PAGE_CHARS);
  return paginate(caption, () => limit, maxPages);
}

/**
 * The same pagination, for an article whose first page also carries a picture.
 *
 * `firstMaxChars` is the capacity of the measured page **minus the picture block**; every page after
 * it uses the normal `maxChars`. The picture is part of the first page, not a page of its own, so the
 * article can still start with words and the rest of them continue on page two. A very short first
 * capacity is floored at 80 characters: if the estimate is still generous, that page scrolls rather
 * than hiding a word.
 */
export function textPagesWithLead(
  caption: string | null | undefined,
  firstMaxChars: number,
  maxChars: number = TEXT_PAGE_CHARS,
  maxPages: number = MAX_TEXT_PAGES,
): TextPages {
  const rest = Math.max(120, Math.trunc(maxChars) || TEXT_PAGE_CHARS);
  const first = Math.max(80, Math.trunc(firstMaxChars) || rest);
  return paginate(caption, (page) => (page === 0 ? first : rest), maxPages);
}


/** A one-block preview for a list or a quote panel: cut on a word boundary, with an honest ellipsis. */
export function textPreview(caption?: string | null, max = 280): { text: string; hasMore: boolean } {
  const text = String(caption ?? '').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
  if (text.length <= max) return { text, hasMore: false };
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  const kept = (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.!?\u2013\u2014-]+$/, '');
  return { text: `${kept}\u2026`, hasMore: true };
}

/** The location the author attached, when the publishing block carries one (`publishing.location`). */
export function locationOf(post?: SocialPost | null): string {
  const publishing = post?.publishing as { location?: unknown } | null | undefined;
  const value = publishing?.location;
  return typeof value === 'string' ? value.trim() : '';
}

/** Hashtags the post carries: its own `tags` first, the ones written in the caption after. */
export function tagsOf(post?: SocialPost | null): string[] {
  const own = Array.isArray(post?.tags) ? post.tags.filter((tag) => typeof tag === 'string' && tag.trim()) : [];
  const seen = new Set(own.map((tag) => tag.replace(/^#/, '').toLowerCase()));
  const inline = textOf(post).match(/#[\p{L}\p{N}_]{2,}/gu) ?? [];
  const extra = inline.map((tag) => tag.slice(1)).filter((tag) => !seen.has(tag.toLowerCase()));
  return Array.from(new Set([...own, ...extra]));
}
