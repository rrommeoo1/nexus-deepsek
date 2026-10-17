import {
  compactCount, reactionTotal,
  type CommentView, type MediaItem, type ProfileResponse, type ProfileView, type RepostEntry, type RepostStamp,
  type SharedReplyEntry, type SocialPost, type StoryHighlight, type StoryView,
} from './socialTypes';

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

/** `CONTENT_TAB_ORDER` (`profile-experience.js:19`) — the order the product reads its five tabs in. */
export const CONTENT_TAB_ORDER = ['flow', 'reels', 'shots', 'whispers', 'moments'] as const;

export type ContentTab = typeof CONTENT_TAB_ORDER[number];

/** `CONTENT_TAB_GLYPHS` (`profile-experience.js:16`) — the bar prints the sign, not the word. */
export const CONTENT_TAB_GLYPHS: Record<ContentTab, string> = {
  flow: '≡', reels: '▶', shots: '▦', whispers: '❝', moments: '✦',
};

/** The `profile.tab*` names of the ro-RO bundle: the accessible name of each tab, which is never printed. */
export const CONTENT_TAB_LABELS: Record<ContentTab, string> = {
  flow: 'Flux', reels: 'Reels', shots: 'Fotografii', whispers: 'Șoapte', moments: 'Momente',
};

/** `profilePostKind` (`profile-experience.js:82-86`): the kind of the post's cover media, or words. */
export type PostKind = 'video' | 'image' | 'text';

/**
 * The kind a tab reads. `moments` is not a kind of post at all: the web names it `'moment'`
 * (`profile-experience.js:13`), which `profilePostKind` never returns, so the shelf is empty by
 * construction — the saved stories answer in their own panel instead of in a list of posts.
 */
export type ContentKind = PostKind | 'moment';

/**
 * `CONTENT_KINDS` (`profile-experience.js:13`): which kind of node a tab reads. Flow reads everything
 * (`null`), and Moments reads a kind no post has, which is what makes its own shelf the only answer.
 */
export const CONTENT_KINDS: Record<ContentTab, ContentKind | null> = {
  flow: null, reels: 'video', shots: 'image', whispers: 'text', moments: 'moment',
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

/** `profilePostKind` of the web: the cover media decides, and words are what is left. */
export function profilePostKind(post?: SocialPost | null): PostKind {
  if (post?.media?.kind === 'video') return 'video';
  if (post?.media?.kind === 'image') return 'image';
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
export function orderArchive(posts: ArchivePost[], reading: ContentReading, options: { hoistPins?: boolean } = {}): ArchivePost[] {
  type Rated = { post: ArchivePost; index: number; order: OrderAttributes };
  const decorated: Rated[] = posts.map((post, index) => ({ post, index, order: postOrderAttributes(post) }));
  const byNewest = (a: Rated, b: Rated) => b.order.stamp - a.order.stamp || a.index - b.index;
  const byPopular = (a: Rated, b: Rated) => b.order.score - a.order.score || byNewest(a, b);
  const byRelevant = (a: Rated, b: Rated) => b.order.rank - a.order.rank || byPopular(a, b);
  const sorter = reading === 'popular' ? byPopular : reading === 'relevant' ? byRelevant : byNewest;
  const compare = options.hoistPins === true ? pinnedFirst(sorter) : sorter;
  return [...decorated].sort(compare).map((entry) => entry.post);
}

/** `applyOrder`'s own catalogue limit (`profile-experience.js:499`): the archive shows its first 24. */
export const PROFILE_ARCHIVE_LIMIT = 24;

/** `CONTENT_KINDS` read as one list: the tab's nodes, still in the order `orderArchive` gave them. */
export function contentOfTab(posts: ArchivePost[], tab: ContentTab): { list: ArchivePost[]; tiles: ArchivePost[]; whispers: ArchivePost[] } {
  const wanted = CONTENT_KINDS[tab];
  const list = wanted === null ? posts : posts.filter((post) => profilePostKind(post) === wanted);
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
  options: { hoistPins?: boolean } = {},
): ArchiveNode[] {
  type Rated = { node: ArchiveNode; index: number; order: OrderAttributes };
  const seed = Math.max(1, archive.posts.length);
  const tiles = archive.posts.filter((post) => profilePostKind(post) !== 'text');
  const whispers = archive.posts.filter((post) => profilePostKind(post) === 'text');
  const decorated: Rated[] = [
    ...tiles.map((post, index): Rated => ({ node: { key: archiveKey(post), kind: 'tile', post }, index, order: postOrderAttributes(post) })),
    ...whispers.map((post, index): Rated => ({ node: { key: archiveKey(post), kind: 'whisper', post }, index: seed + index, order: postOrderAttributes(post) })),
    ...archive.sharedReplies.map((reply, index): Rated => ({ node: { key: reply.key, kind: 'reply', reply }, index: seed * 2 + index, order: sharedReplyOrder(reply) })),
  ];
  const byNewest = (a: Rated, b: Rated) => b.order.stamp - a.order.stamp || a.index - b.index;
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
  moments: { title: 'Niciun moment salvat', detail: 'Story-urile salvate apar aici, în ordinea în care le-ai păstrat.' },
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
    .map((entry): ArchivePost => ({ ...entry.post, __repost: entry.repost ?? null }));
  const bucket = profileContentBuckets([...posts, ...reposts], {
    stamp: (post) => Math.max(0, Number(post?.__repost?.reposted_at || post?.created_at || 0)),
  });
  const sharedReplies: SharedReplyCard[] = (Array.isArray(payload?.shared_replies) ? payload.shared_replies : [])
    .filter((entry): entry is SharedReplyEntry & { comment: CommentView; post: SocialPost } => Boolean(entry?.comment && entry?.post))
    .slice(0, PROFILE_ARCHIVE_LIMIT)
    .map((entry) => {
      const name = entry.comment.display_name || entry.comment.handle || 'Nexus';
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



