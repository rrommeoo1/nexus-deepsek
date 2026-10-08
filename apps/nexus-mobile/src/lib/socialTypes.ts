import { API_ORIGIN } from './apiOrigin';
import { mediaUrl } from './nexusApi';
import { mediaHeaders } from './session';
import type { StudioManifest } from './studioManifest';

/**
 * The shapes the existing endpoints answer with. They are read from apps/nexus-web/lib/api.js
 * (`socialPostView`, `storyApiView`, `/api/me`, `/api/profiles/:handle`) and are narrowed to the
 * fields the screens actually print - nothing is invented and nothing is defaulted with fake data.
 */
export type MediaKind = 'image' | 'video' | 'audio';

export type MediaItem = {
  hash?: string;
  ext?: string;
  mime?: string;
  kind?: MediaKind;
  size?: number;
  position?: number;
};

export type PostAuthor = {
  id?: number;
  handle?: string;
  display_name?: string;
  avatar?: string | null;
};

/** `SOCIAL_REACTIONS` of lib/repo.js, in the order the reaction bar prints them. */
export const SOCIAL_REACTIONS = ['LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY', 'FAKE_OPINION', 'DISLIKE'] as const;

export type ReactionKind = typeof SOCIAL_REACTIONS[number];

/**
 * `repo.postReactionSummary` / `repo.commentReactionSummary`: the per-kind counts plus the one kind
 * the viewer already chose. The web prints the total of `counts`, which is the same number here.
 */
export type ReactionSummary = {
  counts?: Record<string, number> | null;
  viewer_reaction?: string | null;
  private_dislike_by_me?: boolean;
};

export type SocialPost = {
  id: number;
  publishing?: { allowComments?: boolean } | null;
  user_id?: number;
  persona?: string;
  kind?: string;
  caption?: string | null;
  title?: string | null;
  created_at?: number | string | null;
  author?: PostAuthor | null;
  media?: MediaItem | null;
  media_list?: MediaItem[];
  comment_count?: number;
  /** `post.reposts` of the web card: the count the rail prints beside the distribute control. */
  reposts?: number;
  view_stats?: { viewers?: number; impressions?: number } | null;
  saved_by_me?: boolean;
  reposted_by_me?: boolean;
  pinned_at?: number;
  /** `post.ranking` of the web: the reading the feed gave this post (`profileRank` counts its reasons). */
  ranking?: { reasons?: string[] } | null;
  following_me?: boolean;
  follow_request_pending?: boolean;
  tags?: string[];
  /** `socialPostView().reactions` — the real summary, never a naked number. */
  reactions?: ReactionSummary | null;
  /** Soundtrack of the clip, when the author attached one (`post.audio` of the web card). */
  audio?: MediaItem | null;
  external_audio?: {
    provider?: string; id?: string; name?: string; artist?: string;
    attribution?: string; audio_url?: string; duration?: number;
    segment_seconds?: number; preview_offset?: number;
  } | null;
  audio_attribution?: string | null;
  creator_studio?: { integrity?: string; manifest?: StudioManifest | null } | null;
  language?: string | null;
  status?: string;
};

export type NewsItem = { title?: string; url?: string; source?: string; published_at?: string | number | null };

export type FeedPage = {
  ok: true;
  posts: SocialPost[];
  lens?: string;
  format?: string;
  next_cursor?: string | null;
  news?: NewsItem[];
  near?: { status?: string };
  provider?: { status?: string; reason?: string } | null;
};

export type PersonaRow = {
  persona?: string;
  name?: string;
  bio?: string;
  avatar?: string | null;
  cover?: string | null;
  counts?: Record<string, number>;
  visibility?: string;
};

export type MeResponse = {
  ok: true;
  user: { id: number; handle: string; email?: string; display_name?: string; avatar?: string | null };
  persona: string;
  profiles?: PersonaRow[];
};

export type ProfileLocked = { locked: true; profile: { handle?: string; name?: string; visibility?: string; is_following?: boolean; follow_request_pending?: boolean }; posts: [] };

export type ProfileView = {
  user_id?: number;
  handle?: string;
  persona?: string;
  name?: string;
  bio?: string;
  location?: string;
  age?: number | null;
  avatar?: string | null;
  cover?: string | null;
  cover_focus?: number;
  cover_mode?: string;
  orbit_mood?: string | null;
  orbit_place?: string | null;
  orbit_now?: string | null;
  visibility?: string;
  is_self?: boolean;
  is_following?: boolean;
  counts?: Record<string, number>;
  earned_sigil?: { level?: number; label?: string } | null;
};

export type ProfileResponse = {
  ok: true;
  profile: ProfileView;
  posts?: SocialPost[];
  locked?: boolean;
  stories?: unknown[];
  highlights?: unknown[];
};

/**
 * `safeInternalMediaUrl` of the web client: only an internal `/media/<64 hex>.<ext>` path is trusted,
 * so a payload can never make the app load a third-party address.
 */
export function internalMediaUrl(value?: string | null): string | null {
  const candidate = String(value ?? '');
  return /^\/media\/[a-f0-9]{64}\.[a-z0-9]{2,8}$/.test(candidate) ? `${API_ORIGIN}${candidate}` : null;
}

export function mediaItemUrl(item?: MediaItem | null): string | null {
  return mediaUrl(item ? { hash: item.hash, ext: item.ext } : null);
}

/** The initials the web prints when a profile has no picture. */
export function initialsFor(name?: string, handle?: string): string {
  const source = String(name || handle || '').trim();
  if (!source) return '··';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

/** "acum 3 min" style reading the web prints on a post. */
export function relativeTime(value?: number | string | null, now = Date.now()): string {
  // SQLite's unixepoch() travels through the API in seconds. Date.parse handles ISO strings;
  // a millisecond epoch is already large enough to leave unchanged.
  const numeric = typeof value === 'number' ? value : /^\d+$/.test(String(value ?? '')) ? Number(value) : NaN;
  const stamp = Number.isFinite(numeric) ? numeric < 1_000_000_000_000 ? numeric * 1000 : numeric : Date.parse(String(value ?? ''));
  if (!Number.isFinite(stamp) || stamp <= 0) return '';
  const seconds = Math.max(0, Math.round((now - stamp) / 1000));
  if (seconds < 60) return 'acum';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} z`;
  return new Date(stamp).toLocaleDateString('ro-RO');
}

export function compactCount(value?: number | null): string {
  const count = Number(value);
  if (!Number.isFinite(count) || count <= 0) return '';
  if (count < 1000) return String(count);
  if (count < 1_000_000) return `${(count / 1000).toFixed(count < 10_000 ? 1 : 0)} k`;
  return `${(count / 1_000_000).toFixed(1)} M`;
}

/**
 * A ready-to-use source for `<Image>` and `expo-video`, with the session attached.
 *
 * `/media/` answers `401` without a session (verified on production), and React Native components do
 * not share `fetch`'s cookie jar on every platform, so the headers `mediaHeaders()` returns are what
 * actually makes a remote picture or clip load. The same page renders identically with a black
 * rectangle when they are missing - the failure the phone was showing.
 */
export type MediaSource = { uri: string; headers: Record<string, string> };

export function mediaSourceFor(item?: MediaItem | null): MediaSource | null {
  const uri = mediaItemUrl(item);
  return uri ? { uri, headers: mediaHeaders() } : null;
}

/** The same, for the plain `/media/…` path strings a profile answers with (avatar, cover). */
export function mediaSourceForPath(value?: string | null): MediaSource | null {
  const uri = internalMediaUrl(value);
  return uri ? { uri, headers: mediaHeaders() } : null;
}

/** The ordered carousel the web reads (`media_list`), falling back to the single cover. */
export function postMediaItems(post: SocialPost): MediaItem[] {
  const listed = Array.isArray(post.media_list) ? post.media_list.filter((item) => mediaItemUrl(item)) : [];
  if (listed.length) return listed;
  return post.media && mediaItemUrl(post.media) ? [post.media] : [];
}

/** `media.kind`, derived from the mime type when the server left the field out. */
export function mediaKindOf(item?: MediaItem | null): MediaKind | null {
  if (!item) return null;
  if (item.kind) return item.kind;
  const mime = String(item.mime || '');
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('image/')) return 'image';
  return null;
}

/** The number the web prints next to the reaction button: the sum of the real per-kind counts. */
export function reactionTotal(summary?: ReactionSummary | null): number {
  const counts = summary?.counts ?? {};
  return Object.values(counts).reduce((total, value) => total + (Number(value) || 0), 0);
}

export function viewerReaction(summary?: ReactionSummary | null): string | null {
  return summary?.viewer_reaction ?? null;
}

/**
 * `REACTION_GLYPHS` of the web, verbatim (`app.js:3567`): the heart, the four faces, and the two
 * geometric marks. Measured against the web: FAKE_OPINION is a diamond and DISLIKE a triangle, not
 * the thumbs the phone used to draw.
 */
export const REACTION_GLYPHS: Record<string, string> = {
  LIKE: '\u2665', LOVE: '\u{1F497}', HAHA: '\u{1F602}', WOW: '\u{1F62E}',
  SAD: '\u{1F622}', ANGRY: '\u{1F620}', FAKE_OPINION: '\u25C6', DISLIKE: '\u25BC',
};

/** The word each reaction carries in the picker: `reaction.*` of `interface-locale.js` (RO). */
export const REACTION_TITLES: Record<string, string> = {
  LIKE: 'Like', LOVE: 'Love', HAHA: 'Haha', WOW: 'Wow',
  SAD: 'Trist', ANGRY: 'Furios', FAKE_OPINION: 'Fake?', DISLIKE: 'Dislike',
};

/**
 * `reactionSummary()` of the web (`app.js:3579-3595`): the counts ranked, the total, and the two or
 * three glyphs the compact control prints. When one reaction owns at least 85 % of the total the
 * summary collapses to that glyph carrying the whole number; three entries are the ceiling, and an
 * untouched summary prints the plain heart with a zero.
 */
export type ReactionSummaryEntry = { kind: string; count: number; glyph: string };

export function reactionSummary(counts?: Record<string, number> | null): {
  entries: ReactionSummaryEntry[];
  total: number;
  distributed: boolean;
  collapsed: boolean;
} {
  const ranked = Object.keys(REACTION_GLYPHS)
    .map((kind) => ({ kind, count: Number(counts?.[kind] ?? 0) }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);
  const total = ranked.reduce((sum, entry) => sum + entry.count, 0);
  const dominant = ranked[0];
  const dominantShare = dominant && total ? dominant.count / total : 0;
  const visible = !ranked.length
    ? [{ kind: 'LIKE', count: 0 }]
    : dominantShare >= 0.85
      ? [{ ...dominant, count: total }]
      : ranked.slice(0, 3);
  return {
    entries: visible.map((entry) => ({ ...entry, glyph: REACTION_GLYPHS[entry.kind] })),
    total,
    distributed: visible.length > 1,
    collapsed: ranked.length > 1 && dominantShare >= 0.85,
  };
}

/** One comment as `commentThreadView` of lib/api.js returns it. */
export type CommentView = {
  id: number;
  post_id?: number;
  user_id?: number;
  parent_id?: number | null;
  actor_persona?: string;
  body?: string;
  created_at?: number | string | null;
  /** repo.listComments returns the comment author's fields flat. */
  handle?: string;
  display_name?: string;
  avatar?: string | null;
  author?: PostAuthor | null;
  status?: string;
  edited_at?: number | string | null;
  withdrawn_at?: number | string | null;
  reactions?: ReactionSummary | null;
  saved_by_me?: boolean;
  can_pin?: boolean;
  pinned_by_owner?: boolean;
  views?: number;
  reply_count?: number;
  reply_shares?: number;
  shared_by_me?: boolean;
  parent_author?: { id?: number; handle?: string; display_name?: string; withdrawn?: boolean } | null;
  replies?: CommentView[];
};

/** `GET /api/posts/:id/comments` */
export type CommentPage = {
  ok: true;
  post_id: number;
  viewer_id?: number;
  viewer_persona?: string;
  comments: CommentView[];
  sort?: string;
  cursor?: string;
  next_cursor?: string | null;
  root_count?: number;
};

/**
 * The soundtrack line of a clip, derived exactly the way the web derives it
 * (`public/app.js`: `externalAudio?.attribution || item.audio_attribution || 'Audio original · ' + name`).
 */
export function audioAttributionFor(post: SocialPost, authorName: string): string {
  return post.external_audio?.attribution
    || post.audio_attribution
    || `Audio original · ${authorName}`;
}

/** `repo.listSocialRelations` — one real person per row (never a placeholder). */
export type RelationPerson = {
  user_id: number;
  handle: string;
  name?: string | null;
  bio?: string | null;
  avatar?: string | null;
  relation?: 'followers' | 'following';
  following_me?: boolean;
  counts?: { following?: number; followers?: number } | null;
};

/** `GET /api/social/relations?kind=…` */
export type RelationsPage = { ok: true; kind?: string; people?: RelationPerson[]; next_cursor?: string | null };

/** `repo.listFollowRequests` — a pending request, exactly as the server holds it. */
export type FollowRequest = {
  id: number;
  requester_id?: number;
  target_id?: number;
  persona?: string;
  status?: string;
  created_at?: number | string | null;
  handle?: string;
  name?: string | null;
  avatar?: string | null;
};

/** `GET /api/follow/requests?direction=…` */
export type FollowRequestsPage = { ok: true; direction?: string; requests?: FollowRequest[] };

/** `GET /api/follows` — the two real counters the web prints. */
export type FollowCounts = { ok: true; following?: number; followers?: number };

/** `GET /api/social/search?q=…` */
/**
 * `repo.searchSocial` — a public profile row of the search index. It is keyed by `id`, not by the
 * `user_id` the relation lists carry (`SELECT u.id, u.handle, p.name, … FROM users …` in
 * repo.js:1078 vs `SELECT u.id user_id, …` in `listSocialRelations`), so it is its own type: reusing
 * `RelationPerson` here made every row arrive with an undefined key.
 */
export type SearchProfile = {
  id: number;
  handle: string;
  name?: string | null;
  bio?: string | null;
  avatar?: string | null;
  visibility?: string;
  followers?: number;
};

export type SocialSearchPage = { ok: true; query?: string; profiles?: SearchProfile[]; posts?: SocialPost[]; next_cursor?: string | null };

/** One participant of a conversation (`getConversationDetails().participants`). */
export type ConversationParticipant = {
  id: number;
  handle: string;
  display_name?: string | null;
  avatar?: string | null;
  role?: string;
  state?: string;
};

/** `repo.getConversationMessage` — one real message row. */
export type ChatMessage = {
  id: number;
  conversation_id?: number;
  sender_id?: number;
  sender_persona?: string;
  kind?: string;
  body?: string | null;
  created_at?: number | string | null;
  status?: string;
  encryption_mode?: string;
  sender_handle?: string;
  sender_display_name?: string | null;
  attachment_url?: string | null;
  media_kind?: string | null;
};

/** `repo.getConversationDetails` — the inbox row the unified messenger prints. */
export type Conversation = {
  id: number;
  kind?: string;
  context_persona?: string;
  status?: string;
  created_by?: number;
  title?: string | null;
  updated_at?: number | string | null;
  participants?: ConversationParticipant[];
  last_message?: ChatMessage | null;
  unread?: number;
  blocked?: boolean;
};

/** `GET /api/chat/conversations` */
export type ConversationsPage = { ok: true; conversations?: Conversation[]; next_cursor?: string | null };

/**
 * `GET /api/notifications?persona=all` — the envelope the bar's second counter comes from. Only two of
 * its numbers are read here: `unread` is every unread row of the account and `unread_non_message` is the
 * share of them that is not a message, which is the count the activity mark owns (app.js:2435-2454).
 */
export type NotificationsPage = {
  ok: true;
  notifications?: { id: number; persona?: string; type?: string }[];
  unread?: number;
  unread_non_message?: number;
};

/** `storyApiView` of lib/api.js:4576 - the shape `GET /api/stories` prints, nothing invented. */
export type StoryAuthor = { id?: number; handle?: string; display_name?: string | null; avatar?: string | null };

export type StoryView = {
  id: number;
  user_id?: number;
  persona?: string;
  caption?: string;
  visibility?: string;
  status?: string;
  expires_at?: number | null;
  content_commitment?: string;
  created_at?: number | null;
  viewed_by_me?: boolean;
  view_progress?: number;
  author?: StoryAuthor | null;
  media?: MediaItem | null;
  lifecycle?: string;
};

/** `GET /api/stories?state=unseen` (lib/api.js:4588). */
export type StoriesPage = {
  ok: true;
  viewer_id?: number;
  viewer_persona?: string;
  state?: string;
  stories?: StoryView[];
};

/** `GET /api/chat/conversations/:id/messages` */
export type ConversationThread = {
  ok: true;
  conversation?: Conversation;
  messages?: ChatMessage[];
  transport?: { plaintext_available?: boolean; label?: string };
};

/** `GET /api/social/live` — the sessions (and creators) the reader may open. */
export type LiveSession = {
  id: number;
  host_id?: number;
  user_id?: number;
  handle?: string;
  display_name?: string | null;
  avatar?: string | null;
  title?: string | null;
  visibility?: string;
  status?: string;
  transport_status?: string;
  started_at?: number | string | null;
  organic_viewers?: number;
  qualified_followers?: number;
  is_following?: boolean;
};

/** `GET /api/social/live` envelope, including the provider's own (gated) reasons. */
export type LivePage = {
  ok: true;
  live?: LiveSession[];
  creators?: LiveSession[];
  competitions?: Record<string, unknown>[];
  transport?: { status?: string; public_broadcast?: boolean; provider_configured?: boolean };
};
