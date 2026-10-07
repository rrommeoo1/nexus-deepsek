import { API_ORIGIN } from './apiOrigin';
import { mediaUrl } from './nexusApi';
import { mediaHeaders } from './session';

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
  view_stats?: { viewers?: number; impressions?: number } | null;
  saved_by_me?: boolean;
  reposted_by_me?: boolean;
  following_me?: boolean;
  follow_request_pending?: boolean;
  tags?: string[];
  /** `socialPostView().reactions` — the real summary, never a naked number. */
  reactions?: ReactionSummary | null;
  /** Soundtrack of the clip, when the author attached one (`post.audio` of the web card). */
  audio?: MediaItem | null;
  external_audio?: { name?: string; attribution?: string; audio_url?: string } | null;
  audio_attribution?: string | null;
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
  const stamp = typeof value === 'number' ? value : Date.parse(String(value ?? ''));
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

/** The glyph the reaction palette prints for each kind of `SOCIAL_REACTIONS`. */
export const REACTION_GLYPHS: Record<string, string> = {
  LIKE: '👍', LOVE: '❤️', HAHA: '😂', WOW: '😮', SAD: '😢', ANGRY: '😡', FAKE_OPINION: '🟥', DISLIKE: '👎',
};

/** One comment as `commentThreadView` of lib/api.js returns it. */
export type CommentView = {
  id: number;
  post_id?: number;
  user_id?: number;
  parent_id?: number | null;
  body?: string;
  created_at?: number | string | null;
  author?: PostAuthor | null;
  status?: string;
  reactions?: ReactionSummary | null;
  saved_by_me?: boolean;
  can_pin?: boolean;
  pinned_by_owner?: boolean;
  views?: number;
  parent_author?: { id?: number; handle?: string; display_name?: string; withdrawn?: boolean } | null;
  replies?: CommentView[];
};

/** `GET /api/posts/:id/comments` */
export type CommentPage = {
  ok: true;
  post_id: number;
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
