import { API_ORIGIN } from './apiOrigin';
import { mediaUrl } from './nexusApi';

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
  tags?: string[];
  /** Any of the reaction counts the post summary carries; read only when present. */
  reaction_count?: number;
  reposts?: number;
  shares?: number;
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
