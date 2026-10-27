import {
  compactCount, reactionTotal,
  type CommentView, type MediaItem, type ProfileResponse, type ProfileView, type RepostEntry, type RepostStamp,
  type SharedReplyEntry, type SocialPost, type StoryHighlight, type StoryView,
} from './socialTypes';
import { contentTypeOf, mediaOf } from './postPresentation';
import { arrangementRank, type Arrangement } from './profileGrid';

/**
 * The content region of a profile, ported from `apps/nexus-web/public/profile-experience.js`.
 *
 * The web builds one DOM node per post and moves those same nodes between three containers
 * (`profile-experience.js:485-555`): the Flow weaves them by time, the grid holds the media and the
 * list holds the words. This module states the same thing as data, so the phone can draw it with the
 * screen's own layout primitives: a post is a tile while it carries a photo or a clip and a whisper
 * card while it carries words (`profilePostKind`), the Flow is the two woven together, and Reels /
 * Fotografii / Șoapte are the same archive read in one kind only (`CONTENT_KINDS`).
 *
 * Nothing here invents a value: every number comes from the post the server returned, every order is
 * one of the three the arrow offers (`CONTENT_FILTERS`), and every word is the ro-RO bundle the web
 * reads (`interface-locale.js`).
 */

/**
 * `CONTENT_TAB_ORDER` (`profile-experience.js:19`) — the order the product reads its five tabs in.
 *
 * The fifth tab was `moments` (the saved-story shelf of the web). The owner replaced it on
 * 27 October 2026 with **Redistribuiri**: the posts this profile has actually redistributed, which is a
 * kind of post the archive already carries (`__repost`) and which had no tab of its own. The shelf did
 * not disappear with the tab — the Flow draws it above the wall when it holds anything
 * (`ProfileScreen`), because a saved story is still the owner's.
 */
export const CONTENT_TAB_ORDER = ['flow', 'reels', 'shots', 'whispers', 'redistribuiri'] as const;

export type ContentTab = typeof CONTENT_TAB_ORDER[number];

/** `CONTENT_TAB_GLYPHS` (`profile-experience.js:16`) — the bar prints the sign, not the word. */
export const CONTENT_TAB_GLYPHS: Record<ContentTab, string> = {
  flow: '≡', reels: '▶', shots: '▦', whispers: '❝', redistribuiri: '⟳',
};

/** The `profile.tab*` names of the ro-RO bundle: the accessible name of each tab, which is never printed. */
export const CONTENT_TAB_LABELS: Record<ContentTab, string> = {
  flow: 'Flux', reels: 'Reels', shots: 'Fotografii', whispers: 'Șoapte', redistribuiri: 'Redistribuiri',
};

/** `profilePostKind` (`profile-experience.js:82-86`): the kind of the post's cover media, or words. */
export type PostKind = 'video' | 'image' | 'text';

/**
 * The kind a tab reads. A tab is one of the three kinds of post — or `repost`, which is not a kind of
 * *post* but a kind of *node*: the same post can stand on the wall twice, once as itself and once as
 * the share somebody made of it (`archiveKey`), and Redistribuiri reads only the shares.
 */
export type ContentKind = PostKind | 'repost';

/**
 * `CONTENT_KINDS` (`profile-experience.js:13`): which kind of node a tab reads. Flow reads everything
 * (`null`), the three collection tabs read one kind of post, and Redistribuiri reads the shares —
 * a filter on `__repost`, which no other tab applies.
 */
export const CONTENT_KINDS: Record<ContentTab, ContentKind | null> = {
  flow: null, reels: 'video', shots: 'image', whispers: 'text', redistribuiri: 'repost',
};

/** `CONTENT_FILTERS` (`profile-experience.js:22`) and `profile.filter*` of the ro-RO bundle. */
export const CONTENT_FILTERS = ['newest', 'popular', 'relevant'] as const;

export type ContentReading = typeof CONTENT_FILTERS[number];

export const CONTENT_READING_LABELS: Record<ContentReading, string> = {
  newest: 'Cele mai noi', popular: 'Cele mai populare', relevant: 'Relevante pentru tine',
};

/**
 * `profileTabOrder` (`profile-experience.js:31-40`): a stored order is read the same forgiving way the
 * server writes it — unknown ids are dropped, anything the list forgot is appended in the product's own
 * order, so the bar always carries all five tabs exactly once.
 */
export function profileTabOrder(value: unknown): ContentTab[] {
  const list = Array.isArray(value) ? value : String(value ?? '').split(',');
  const wanted: ContentTab[] = [];
  for (const entry of list) {
    const id = String(entry ?? '').trim().toLowerCase();
    if ((CONTENT_TAB_ORDER as readonly string[]).includes(id) && !wanted.includes(id as ContentTab)) wanted.push(id as ContentTab);
  }
  for (const id of CONTENT_TAB_ORDER) if (!wanted.includes(id)) wanted.push(id);
  return wanted;
}

/**
 * `profilePostKind` of the web: the archive's own bucket for a post - Reels, Fotografii or Șoapte.
 *
 * The Reel/Post decision is the one shared classifier (`contentTypeOf`), so a clip with a caption is still
 * read in the Reels tab even when the cover metadata is missing; every other post is bucketed by its cover,
 * and words are what is left.
 */
export function profilePostKind(post?: SocialPost | null): PostKind {
  if (contentTypeOf(post) === 'reel') return 'video';
  const cover = mediaOf(post)[0] ?? post?.media ?? null;
  if (cover?.kind === 'video') return 'video';
  if (cover?.kind === 'image') return 'image';
  return 'text';
}

/** A post as the archive reads it: the server's own shape plus the share it arrived through. */
export type ArchivePost = SocialPost & { __repost?: RepostStamp | null };

/**
 * One album of the Moments shelf, under the name the payload gives it (`repo.listStoryHighlights`). The
 * shelf reads `profile-experience.js:213-216`: the first story of the album is its cover, and the title it
 * falls back to is `x.profile.albums`.
 */
export type HighlightAlbum = StoryHighlight;

/** The stamp of one node: the share is the post's time when it arrived as a repost. */
export function archiveStamp(post?: ArchivePost | null): number {
  return Math.max(0, Math.floor(Number(post?.__repost?.reposted_at || post?.created_at || 0)));
}

/** The identity of one node in the archive: a repost and the post it carries are two different nodes. */
export function archiveKey(post: ArchivePost): string {
  return post.__repost ? `repost-${Number(post.__repost.id) || 0}` : `post-${Number(post.id) || 0}`;
}

/**
 * Whose share a cell stands for, in one line — the wall's contribution to the owner's rule that a
 * redistribution names the author it carries.
 *
 * A repost cell is somebody else's post wearing this profile's share. Saying only the original author
 * is not enough (the wall would look as if the profile had written it) and saying only "redistribuit"
 * is worse (it would hide who wrote it). So the line names the *share* here, and the cell's own words
 * are still the author's, which the tile prints and the reader repeats. `mine` keeps the first person
 * the web uses (`x.repost.mine`, `x.repost.by`).
 */
export function repostAttribution(post?: ArchivePost | null): string {
  const stamp = post?.__repost;
  if (!stamp) return '';
  if (stamp.mine) return 'Ai redistribuit';
  const handle = String(stamp.reposter?.handle ?? '').trim();
  return handle ? `Redistribuit de @${handle}` : 'Redistribuit';
}

/**
 * Where the cell a door was opened for really stands in the list a reader walks.
 *
 * A wall can hand its reader a *place* (the third cell of nine) or a *cell* (`archiveKey`), and only the
 * second one is safe. The reader fetches the archive again instead of receiving the wall's array, so
 * between the two fetches a drag the server has not answered yet, a pin, a deletion or a post written from
 * another device can move every cell by one — and a place is then a number about a list that no longer
 * exists. That is how a tap on the second thumbnail opened the third post.
 *
 * The key decides first, because it is the one identity that tells a repost from the post it carries
 * (both share `post.id`, and both are cells of the same wall). The post's own id is the second chance, for
 * a payload that stamped a share differently from the wall that was pressed. `-1` says the pressed cell is
 * not in this archive at all, which a caller must read as "open the post that was pressed" — never as
 * "open whichever post stands where it used to".
 */
export function walkAnchor(
  list: readonly ArchivePost[],
  wanted: { key?: string | null; id?: number | null },
): number {
  const nodes: readonly ArchivePost[] = Array.isArray(list) ? list : [];
  const key = String(wanted.key ?? '').trim();
  if (key) {
    const at = nodes.findIndex((post) => archiveKey(post) === key);
    if (at >= 0) return at;
  }
  const id = Number(wanted.id);
  if (Number.isSafeInteger(id) && id > 0) {
    const at = nodes.findIndex((post) => Number(post.id) === id);
    if (at >= 0) return at;
  }
  return -1;
}

/** `profileContentBuckets` (`profile-experience.js:110-119`): newest first, then by id, split by kind. */
export function profileContentBuckets(posts: ArchivePost[], options: { stamp?: (post: ArchivePost) => number } = {}): {
  list: ArchivePost[];
  tiles: ArchivePost[];
  whispers: ArchivePost[];
} {
  const at = typeof options.stamp === 'function' ? options.stamp : (post: ArchivePost) => Number(post?.created_at || 0);
  const list = (Array.isArray(posts) ? posts : [])
    .slice()
    .sort((a, b) => at(b) - at(a) || Number(b?.id || 0) - Number(a?.id || 0));
  return {
    list,
    tiles: list.filter((post) => profilePostKind(post) !== 'text'),
    whispers: list.filter((post) => profilePostKind(post) === 'text'),
  };
}

/**
 * `postOrderAttributes` (`profile-experience.js:93-104`) with the three sorters of `applyOrder`
 * (`profile-experience.js:499-503`): `stamp` is when it was written, `score` is how much it was
 * answered (reactions, comments and the distinct people who watched it), `rank` is how many reasons
 * the feed gave it, and `pin` is where the owner put it.
 */
export type OrderAttributes = { stamp: number; score: number; rank: number; pin: number };

export function postOrderAttributes(post: ArchivePost, stamp = archiveStamp(post)): OrderAttributes {
  const reasons = post?.ranking?.reasons;
  return {
    stamp: Math.max(0, Math.floor(Number(stamp) || 0)),
    score: reactionTotal(post?.reactions)
      + Math.max(0, Number(post?.comment_count) || 0)
      + Math.max(0, Number(post?.view_stats?.viewers) || 0),
    rank: Array.isArray(reasons) ? reasons.length : 0,
    pin: Math.max(0, Math.floor(Number(post?.pinned_at) || 0)),
  };
}

/**
 * `applyOrder` (`profile-experience.js:516-528`): every reading falls back to the next one, and on a tab
 * read as a collection the owner pinned ones come first, oldest pin first (`repo.js:83` counts a third
 * pin as the limit). The Flow is a timeline and stays one — there a pin is only a mark on the tile,
 * because a timeline that jumps is not a timeline. Equal stamps keep the order the buckets gave them
 * (newest first, then by id), which is the insertion order the web's own stable sort would have kept.
 */
export function orderArchive(posts: ArchivePost[], reading: ContentReading, options: { hoistPins?: boolean; arrangement?: Arrangement | null } = {}): ArchivePost[] {
  type Rated = { post: ArchivePost; index: number; order: OrderAttributes; place: number | null };
  const decorated: Rated[] = posts.map((post, index) => ({
    post, index, order: postOrderAttributes(post), place: arrangementRank(post, options.arrangement),
  }));
  /**
   * The owner's own order, and only for the newest reading: the tiles were dragged into this order
   * (`POST /api/posts/order`), so "newest" on this phone is "the order I made, with anything I have not
   * placed above it". A post with no place is not place zero - it keeps where time put it, which is how
   * a post written after the last drag is still the first thing the owner sees. `popular` and
   * `relevant` are measurements (answers, signals), and a measurement that obeyed a drag would not be
   * one, so they ignore the places entirely.
   */
  const placed = (entry: Rated) => (reading === 'newest' && entry.place !== null ? entry.place : -1);
  const byNewest = (a: Rated, b: Rated) => placed(a) - placed(b) || b.order.stamp - a.order.stamp || a.index - b.index;
  const byPopular = (a: Rated, b: Rated) => b.order.score - a.order.score || byNewest(a, b);
  const byRelevant = (a: Rated, b: Rated) => b.order.rank - a.order.rank || byPopular(a, b);
  const sorter = reading === 'popular' ? byPopular : reading === 'relevant' ? byRelevant : byNewest;
  const compare = options.hoistPins === true ? pinnedFirst(sorter) : sorter;
  return [...decorated].sort(compare).map((entry) => entry.post);
}

/** `applyOrder`'s own catalogue limit (`profile-experience.js:499`): the archive shows its first 24. */
export const PROFILE_ARCHIVE_LIMIT = 24;

/** A node of the archive is a share when the payload stamped it with the share it arrived through. */
export function isRepost(post?: ArchivePost | null): boolean {
  return Boolean(post?.__repost);
}

/**
 * `CONTENT_KINDS` read as one list: the tab's nodes, still in the order `orderArchive` gave them.
 *
 * Redistribuiri is the one tab that reads a *node* rather than a kind of post: a share of a reel, a
 * share of a photograph and a share of a page of words are all redistributions, and the original post
 * standing on the wall beside them is not — even when the owner wrote it. That is the difference the
 * owner asked to see, and it is decided by the node's own stamp (`__repost`), never by the post.
 */
export function contentOfTab(posts: ArchivePost[], tab: ContentTab): { list: ArchivePost[]; tiles: ArchivePost[]; whispers: ArchivePost[] } {
  const wanted = CONTENT_KINDS[tab];
  const list = wanted === null
    ? posts
    : wanted === 'repost'
      ? posts.filter((post) => isRepost(post))
      : posts.filter((post) => profilePostKind(post) === wanted);
  return {
    list,
    tiles: list.filter((post) => profilePostKind(post) !== 'text'),
    whispers: list.filter((post) => profilePostKind(post) === 'text'),
  };
}

/**
 * One band of the region: either a row of tiles (three of them fill a row, the grid's
 * `repeat(3,1fr)` with its 2px gap) or one whisper card, which is its own full-width row. The Flow is
 * the only tab that produces both, and it is the reason this is a row list rather than a chunked array.
 */
export type ContentRow = { key: string; kind: 'tiles'; posts: ArchivePost[] };

/** One card the Flow reads as a band of its own: a whisper of the archive, or a reply shared from a thread. */
export type ContentCard =
  | { key: string; kind: 'whisper'; post: ArchivePost }
  | { key: string; kind: 'reply'; reply: SharedReplyCard };

/** A band of the region: a row of tiles, or one card that takes the whole width of the stream. */
export type ArchiveBand = ContentRow | ContentCard;

/** The grid tabs: the first `limit` tiles, in rows of `columns`. */
export function tileRows(posts: ArchivePost[], columns = 3, limit = PROFILE_ARCHIVE_LIMIT): ContentRow[] {
  const width = Math.max(1, Math.floor(columns) || 1);
  const kept = posts.filter((post) => profilePostKind(post) !== 'text').slice(0, Math.max(0, limit));
  const rows: ContentRow[] = [];
  for (let index = 0; index < kept.length; index += width) {
    const posts_ = kept.slice(index, index + width);
    rows.push({ key: `row-${index}-${archiveKey(posts_[0])}`, kind: 'tiles', posts: posts_ });
  }
  return rows;
}

/**
 * One node of the archive as the region reads it: a media tile, a whisper of the archive, or a reply
 * that was shared from a conversation. The three sit in the same archive, so the readings sort them as
 * one list — which is what makes the Flow one timeline instead of a gallery with a diary under it.
 */
export type ArchiveNode =
  | { key: string; kind: 'tile'; post: ArchivePost }
  | { key: string; kind: 'whisper'; post: ArchivePost }
  | { key: string; kind: 'reply'; reply: SharedReplyCard };

/** A share carries no score, no reasons of its own and no pin (`profile-experience.js:300`). */
function sharedReplyOrder(reply: SharedReplyCard): OrderAttributes {
  return { stamp: Math.max(0, Math.floor(Number(reply.stamp) || 0)), score: 0, rank: 0, pin: 0 };
}

/**
 * `applyOrder`'s pin rule (`profile-experience.js:520-526`), read by both orders below: a pinned node
 * comes first, the oldest pin first, and the reading decides everything else.
 */
function pinnedFirst<T extends { order: OrderAttributes }>(sorter: (a: T, b: T) => number): (a: T, b: T) => number {
  return (a, b) => {
    if ((a.order.pin > 0) !== (b.order.pin > 0)) return a.order.pin > 0 ? -1 : 1;
    if (a.order.pin > 0 && b.order.pin > 0 && a.order.pin !== b.order.pin) return a.order.pin - b.order.pin;
    return sorter(a, b);
  };
}

/**
 * `applyOrder` over the whole region (`profile-experience.js:485-528`): the tiles, the whispers and the
 * shared replies all carry the same four numbers, and the reader's reading orders them together. The
 * web sorts the node list it collected from the document — the grid's tiles, then the whispers, then
 * the shared replies — with a stable sort, so a tie keeps that order; each node is seeded in it here,
 * the tiles first, which is why the seed is ranked by kind before it is ranked by position.
 */
export function archiveNodes(
  archive: { posts: ArchivePost[]; sharedReplies: SharedReplyCard[] },
  reading: ContentReading,
  options: { hoistPins?: boolean; arrangement?: Arrangement | null } = {},
): ArchiveNode[] {
  type Rated = { node: ArchiveNode; index: number; order: OrderAttributes; place: number | null };
  const seed = Math.max(1, archive.posts.length);
  const tiles = archive.posts.filter((post) => profilePostKind(post) !== 'text');
  const whispers = archive.posts.filter((post) => profilePostKind(post) === 'text');
  const place = (post: ArchivePost) => arrangementRank(post, options.arrangement);
  const decorated: Rated[] = [
    ...tiles.map((post, index): Rated => ({ node: { key: archiveKey(post), kind: 'tile', post }, index, order: postOrderAttributes(post), place: place(post) })),
    ...whispers.map((post, index): Rated => ({ node: { key: archiveKey(post), kind: 'whisper', post }, index: seed + index, order: postOrderAttributes(post), place: place(post) })),
    ...archive.sharedReplies.map((reply, index): Rated => ({ node: { key: reply.key, kind: 'reply', reply }, index: seed * 2 + index, order: sharedReplyOrder(reply), place: null })),
  ];
  const placed = (entry: Rated) => (reading === 'newest' && entry.place !== null ? entry.place : -1);
  const byNewest = (a: Rated, b: Rated) => placed(a) - placed(b) || b.order.stamp - a.order.stamp || a.index - b.index;
  const byPopular = (a: Rated, b: Rated) => b.order.score - a.order.score || byNewest(a, b);
  const byRelevant = (a: Rated, b: Rated) => b.order.rank - a.order.rank || byPopular(a, b);
  const sorter = reading === 'popular' ? byPopular : reading === 'relevant' ? byRelevant : byNewest;
  const compare = options.hoistPins === true ? pinnedFirst(sorter) : sorter;
  return [...decorated].sort(compare).map((entry) => entry.node);
}

/**
 * The Flow (`profile-experience.js:459` + `.ownerFlowStream`): tiles gather into rows of three and a
 * card — a whisper or a shared reply — takes a row of its own, which is what `grid-column:1/-1` does to
 * the row the tiles before it had started. Each kind keeps the web's own ceiling of 24 nodes
 * (`applyOrder`, `profile-experience.js:499`).
 */
export function archiveBands(nodes: ArchiveNode[], options: { columns?: number; tileLimit?: number; cardLimit?: number } = {}): ArchiveBand[] {
  const columns = Math.max(1, Math.floor(options.columns ?? 3) || 1);
  const tileLimit = Math.max(0, options.tileLimit ?? PROFILE_ARCHIVE_LIMIT);
  const cardLimit = Math.max(0, options.cardLimit ?? PROFILE_ARCHIVE_LIMIT);
  const bands: ArchiveBand[] = [];
  let row: ArchivePost[] = [];
  let tiles = 0;
  let cards = 0;
  const flush = () => {
    if (!row.length) return;
    bands.push({ key: `band-${bands.length}-${archiveKey(row[0])}`, kind: 'tiles', posts: row });
    row = [];
  };
  for (const node of nodes) {
    if (node.kind === 'tile') {
      if (tiles >= tileLimit) continue;
      tiles += 1;
      row.push(node.post);
      if (row.length === columns) flush();
      continue;
    }
    if (cards >= cardLimit) continue;
    cards += 1;
    flush();
    bands.push(node.kind === 'whisper'
      ? { key: `card-${node.key}`, kind: 'whisper', post: node.post }
      : { key: `card-${node.key}`, kind: 'reply', reply: node.reply });
  }
  flush();
  return bands;
}

/**
 * A grid tab's bands when every post of the tab is a tile — which is now every tab that is not the
 * Flow (`profile-experience.js:459`, `.ownerPostGrid`).
 *
 * The web gives a text post the full width of the whisper list because a whisper there is a *card*:
 * an avatar, a handle, three lines and an action row, which needs the width it takes. In an archive of
 * thumbnails that same post is not a card but a miniature — the 9:16 typographic tile `PostCanvas`
 * already draws for it — and letting it take the width of the screen broke the wall of thirds: one
 * sentence became a band of its own between two rows of pictures.
 *
 * The rows are the grid's own `repeat(3,1fr)` with the archive's ceiling of 24 nodes, so a tab reads
 * the same number of nodes it read before; only their shape changed.
 */
export function tileBands(nodes: ArchiveNode[], options: { columns?: number; tileLimit?: number } = {}): ContentRow[] {
  const columns = Math.max(1, Math.floor(options.columns ?? 3) || 1);
  const limit = Math.max(0, options.tileLimit ?? PROFILE_ARCHIVE_LIMIT);
  const posts = nodes
    .filter((node): node is Extract<ArchiveNode, { kind: 'tile' } | { kind: 'whisper' }> => node.kind !== 'reply')
    .map((node) => node.post)
    .slice(0, limit);
  const rows: ContentRow[] = [];
  for (let index = 0; index < posts.length; index += columns) {
    const slice = posts.slice(index, index + columns);
    rows.push({ key: `row-${index}-${archiveKey(slice[0])}`, kind: 'tiles', posts: slice });
  }
  return rows;
}

/**
 * The Flow draws a whisper as a full-width card; a *profile* reads its posts as cells. This gathers the
 * whispers of a stream into rows of three 9:16 cells and leaves every other band where it was, so the Flow
 * is the same wall of miniatures the collection tabs draw — text posts included. The band builder itself
 * (`archiveBands`) is untouched, so the web-parity suite still reads the same buckets.
 *
 * A card (a shared reply) used to flush the row it interrupted, which left a row of one or two cells and
 * two empty thirds beside it - the "unexplained gap" the owner saw on the phone. The cells of the Flow are
 * therefore gathered by their own order across the cards and cut into full rows of three; the cards keep
 * their own order and stand after the wall, where they have the width they were drawn for.
 */
export function flowBands(bands: ArchiveBand[], columns = 3): ArchiveBand[] {
  const width = Math.max(1, Math.floor(columns) || 1);
  const posts: ArchivePost[] = [];
  const cards: ArchiveBand[] = [];
  for (const band of bands) {
    if (band.kind === 'tiles') posts.push(...band.posts);
    else if (band.kind === 'whisper') posts.push(band.post);
    else cards.push(band);
  }
  const rows: ArchiveBand[] = [];
  for (let index = 0; index < posts.length; index += width) {
    const slice = posts.slice(index, index + width);
    rows.push({ key: `whisper-row-${archiveKey(slice[0])}`, kind: 'tiles', posts: slice });
  }
  return [...rows, ...cards];
}

/**
 * The bands a profile's wall draws, in the order it draws them: one definition for the screen that draws
 * them and for the reader a cell of them opens.
 *
 * This exists because the two lists drifted once already. The wall drew its cells from the archive *nodes*
 * (`archive.posts`, reposts included), while the reader rebuilt the same list from the payload's raw
 * `posts`, so a repost had no place in the reader's arrangement (`arrangementMap` reads `-shareId`) and
 * sorted above every placed cell — the reader opened on the right post and then offered the wall's last
 * cell as the second page. One function, called by both, is the only way that stays true.
 *
 * The tab's own reading applies: the Flow is every node woven by time with the whispers regathered as
 * cells (`flowBands`), a collection tab is its own kind of post in rows of three (`tileBands`), and Moments
 * reads no post at all, which is why its own shelf is the only answer there.
 */
export function wallBands(
  archive: { posts: ArchivePost[]; sharedReplies: SharedReplyCard[] },
  tab: ContentTab,
  reading: ContentReading,
  options: { arrangement?: Arrangement | null; columns?: number } = {},
): ArchiveBand[] {
  const columns = Math.max(1, Math.floor(options.columns ?? 3) || 1);
  if (tab === 'flow') {
    return flowBands(archiveBands(archiveNodes(archive, reading, { hoistPins: true, arrangement: options.arrangement })), columns);
  }
  const content = contentOfTab(orderArchive(archive.posts, reading, { hoistPins: true, arrangement: options.arrangement }), tab);
  /**
   * A collection tab draws its media first and its pages of words after that, because a tab of one kind
   * never holds both. Redistribuiri holds both — a share of a reel and a share of a page of words are the
   * same kind of node — so it keeps the archive's own order instead of sorting words to the end: the tab
   * is a list of shares, in the order the profile shares them.
   */
  const nodes: ArchiveNode[] = tab === 'redistribuiri'
    ? content.list.map((post): ArchiveNode => ({
      key: archiveKey(post),
      kind: profilePostKind(post) === 'text' ? 'whisper' : 'tile',
      post,
    }))
    : [
      ...content.tiles.map((post): ArchiveNode => ({ key: archiveKey(post), kind: 'tile', post })),
      ...content.whispers.map((post): ArchiveNode => ({ key: archiveKey(post), kind: 'whisper', post })),
    ];
  return tileBands(nodes, { columns });
}

/**
 * The cells of a wall, in the order it draws them: the rows flattened, one post per cell, and the shared
 * replies left out because a reply is a comment that was shared — it can be neither placed, pinned nor
 * opened as a post. This is the list a vertical swipe walks.
 */
export function wallPosts(bands: readonly ArchiveBand[] | null | undefined): ArchivePost[] {
  const list: ArchivePost[] = [];
  for (const band of Array.isArray(bands) ? bands : []) {
    if (band.kind === 'tiles') list.push(...band.posts);
    else if (band.kind === 'whisper') list.push(band.post);
  }
  return list;
}

/** `profileCompactCount` (`profile-experience.js:106-108`): the ro-RO compact reading of a count. */
export function profileCompactCount(value?: number | null): string {
  const count = Math.max(0, Math.floor(Number(value) || 0));
  if (!count) return '';
  try {
    return new Intl.NumberFormat('ro-RO', { notation: 'compact', maximumFractionDigits: 1 }).format(count);
  } catch {
    return compactCount(count);
  }
}

/**
 * The words of an empty region (`profile-experience.js:200-208`): what is missing, and the one verb that
 * fixes it. Moments is the exception the web makes on purpose — its shelf holds what the owner saved,
 * and nothing it can draw is something the owner can write here.
 */
export const PROFILE_EMPTY_STATES: Record<ContentTab, { title: string; detail: string }> = {
  flow: { title: 'Nicio postare încă.', detail: 'Creează prima.' },
  reels: { title: 'Niciun reel încă.', detail: 'Înregistrează primul.' },
  shots: { title: 'Nicio fotografie încă.', detail: 'Încarcă prima.' },
  whispers: { title: 'Nicio șoaptă încă.', detail: 'Împărtășește prima.' },
  redistribuiri: {
    title: 'Nicio redistribuire încă.',
    detail: 'Postările pe care le redistribui din feed apar aici, cu autorul lor.',
  },
};

/**
 * The reasons a feed may explain a post with (`ranking-reasons.js:4-13`). The vocabulary is closed on this
 * side too: nothing here invents a sentence, and an unknown key is dropped rather than printed as prose.
 * `RANKING_REASON_LIMIT` is the ceiling the line keeps — four sentences, no more.
 */
export const RANKING_REASON_LIMIT = 4;

export const RANKING_REASON_KEYS = [
  'exploration_new', 'following_author', 'similar_liked', 'language_preference', 'region_preference',
  'organic_conversation', 'seen_before', 'author_less', 'community_dislike', 'marked_opinion',
  'older_post', 'fresh_eligible', 'repost_shared',
] as const;

const RANKING_REASON_SET = new Set<string>(RANKING_REASON_KEYS);

/** `rankingReasonKeys` (`ranking-reasons.js:17-27`): the known keys, once each, in the server's order. */
export function rankingReasonKeys(post?: SocialPost | null): string[] {
  const reasons = post?.ranking?.reasons ?? [];
  const keys: string[] = [];
  for (const reason of reasons) {
    const key = String(reason ?? '').trim();
    if (!RANKING_REASON_SET.has(key) || keys.includes(key)) continue;
    keys.push(key);
    if (keys.length >= RANKING_REASON_LIMIT) break;
  }
  return keys;
}

/** The `why.*` sentences of the ro-RO bundle: the words behind each key the server may send. */
export const RANKING_REASON_WORDS: Record<string, string> = {
  exploration_new: 'Conținut nou eligibil: nu l-ai văzut niciodată',
  following_author: 'Urmărești creatorul',
  similar_liked: 'Ai apreciat conținut similar',
  language_preference: 'Într-o limbă pe care ai ales-o',
  region_preference: 'Relevant în regiunea aleasă',
  organic_conversation: 'Conversație organică, fără impulsizare',
  seen_before: 'Ai mai văzut-o de câteva ori',
  author_less: 'Ai cerut mai puțin din partea acestui autor',
  community_dislike: 'Comunitatea a reacționat negativ la ea',
  marked_opinion: 'A fost marcată ca opinie, nu ca fapt',
  older_post: 'Este mai veche de trei zile',
  fresh_eligible: 'Este recentă și publicată de un om',
  repost_shared: 'Ajunge la tine fiindcă altcineva a distribuit-o, fără avans',
};

/**
 * `rankingReasonPrefixKey` (`ranking-reasons.js:36-38`): the prefix says which question is being answered,
 * and on a profile the question is the reader's own signals — `profile.whySignals` of the ro-RO bundle.
 */
export const PROFILE_WHY_SIGNALS = 'Semnal pentru tine';

/**
 * `rankingReasonMarkup` (`ranking-reasons.js:40-51`) as the two strings a `Text` needs: the prefix, and the
 * sentences the line prints after it, joined by the same middle dot the web joins them with. An archive is
 * read newest first, so the line never claims an order — it names the signals, nothing more.
 */
export function whySignals(post?: SocialPost | null): { label: string; sentences: string } | null {
  const keys = rankingReasonKeys(post);
  if (!keys.length) return null;
  return { label: PROFILE_WHY_SIGNALS, sentences: keys.map((key) => RANKING_REASON_WORDS[key]).join(' · ') };
}

/**
 * One shared reply as the archive reads it (`profile-experience.js:295-307`): the reply keeps its own
 * author and time, and the line above it says which post it came from, because a share is not an
 * original. `stamp` is the profile's own ordering key for it — the share's time, or the reply's when the
 * payload did not say.
 */
export type SharedReplyCard = {
  key: string;
  comment: CommentView;
  post: SocialPost;
  author: { name: string; handle: string; avatar: string | null };
  /** `@handle` of the post's author, or nothing when the payload did not name one. */
  onPostBy: string;
  mine: boolean;
  at: number;
  stamp: number;
};

/**
 * `profileArchive` (`profile-experience.js:186-224` + `:292-308`): what the tabs read.
 *
 * The posts and the reposts are one archive — a repost keeps the original post and is stamped with when
 * it was shared, so the two are sorted by the same rule and nothing is counted twice. The shared replies
 * are the second kind of internal share and are kept apart, because they are not posts: they sit in the
 * same region as the whispers and open their own thread.
 */
export function profileArchive(payload?: ProfileResponse | null): { posts: ArchivePost[]; sharedReplies: SharedReplyCard[] } {
  const posts: ArchivePost[] = Array.isArray(payload?.posts) ? payload.posts : [];
  const reposts: ArchivePost[] = (Array.isArray(payload?.reposts) ? payload.reposts : [])
    .filter((entry): entry is RepostEntry & { post: SocialPost } => Boolean(entry?.post))
    .map((entry): ArchivePost => ({
      ...entry.post,
      // The stamp keeps the share's own id — which is what a drag writes — and the place the owner put it
      // in. Falling back to `share_id` matters because a payload may omit the nested `repost` object.
      __repost: {
        ...(entry.repost ?? {}),
        id: Number(entry.repost?.id ?? entry.share_id) || undefined,
        grid_position: entry.grid_position ?? null,
      },
    }));
  const bucket = profileContentBuckets([...posts, ...reposts], {
    stamp: (post) => Math.max(0, Number(post?.__repost?.reposted_at || post?.created_at || 0)),
  });
  const sharedReplies: SharedReplyCard[] = (Array.isArray(payload?.shared_replies) ? payload.shared_replies : [])
    .filter((entry): entry is SharedReplyEntry & { comment: CommentView; post: SocialPost } => Boolean(entry?.comment && entry?.post))
    .slice(0, PROFILE_ARCHIVE_LIMIT)
    .map((entry) => {
      const name = entry.comment.display_name || entry.comment.handle || 'Jungle Book';
      return {
        key: `reply-${Number(entry.comment.id) || 0}`,
        comment: entry.comment,
        post: entry.post,
        author: { name, handle: entry.comment.handle || '', avatar: entry.comment.avatar ?? null },
        onPostBy: entry.post_author?.handle ? `@${entry.post_author.handle}` : '',
        mine: entry.mine === true,
        at: Math.max(0, Number(entry.comment.created_at) || 0),
        stamp: Math.max(0, Math.floor(Number(entry.shared_at || entry.comment.created_at || 0))),
      };
    });
  return { posts: bucket.list, sharedReplies };
}

/** One item of the Moments shelf: an album of saved stories, or one active story when there is none. */
export type MomentTile = {
  key: string;
  /**
   * Which of the shelf's two lists the tile came from, because the two print different signs when they
   * have no cover to show (`albumTiles` falls back to '▣' and `storyTiles` to '✦',
   * `profile-experience.js:207-216`) — and because an album opens at its first story while a story tile
   * opens at its own index (`profile-experience.js:475-482`).
   */
  kind: 'album' | 'story';
  title: string;
  cover: MediaItem | null;
  /** What opening this tile plays: the album's stories, or the profile's own active ones. */
  gallery: StoryView[];
};

/**
 * The shelf of saved stories (`profile-experience.js:207-216`, `:462`).
 *
 * Albums win when the profile has any — a profile is not the place to publish a story, and the rail shows
 * the archive when it exists. Without one, the active stories stay reachable. Either way the shelf holds
 * eight of them, its header is `x.profile.albums` while there are albums and `profile.moments` when
 * there are only stories, and a tile without a cover falls back to its own sign ('▣' for an album, '✦'
 * for a story) instead of a picture frame.
 */
export function profileMomentShelf(profile?: ProfileView | null, stories?: StoryView[] | null): { title: string; tiles: MomentTile[] } {
  const active = (Array.isArray(stories) ? stories : []).slice(0, 8);
  const albums = (Array.isArray(profile?.highlights) ? profile.highlights : []).slice(0, 8);
  const tiles: MomentTile[] = albums.length
    ? albums.map((album, index) => {
      const gallery = Array.isArray(album?.stories) ? album.stories.slice(0, 40) : [];
      return {
        key: `album-${Number(album?.id) || index}`,
        kind: 'album' as const,
        title: String(album?.title || 'Albume'),
        cover: gallery[0]?.media ?? null,
        gallery,
      };
    })
    : active.map((story, index) => ({
      key: `story-${Number(story?.id) || index}`,
      kind: 'story' as const,
      title: String(story?.caption || 'Moment'),
      cover: story?.media ?? null,
      gallery: active,
    }));
  return { title: albums.length ? 'Albume' : 'Moments', tiles };
}



