import { nexusApi } from './nexusApi';
import type { CommentPage, CommentView, ReactionSummary } from './socialTypes';

/**
 * The real interaction endpoints of this product, taken from apps/nexus-web/lib/api.js - none of
 * them is invented, and every one of them is the single call the web client itself makes:
 *
 *   POST /api/posts/:id/reaction  { kind, active }   lib/api.js:3858  (SOCIAL_REACTIONS)
 *   POST /api/posts/:id/save      { active }         lib/api.js:4380
 *   POST /api/posts/:id/repost    { active }         lib/api.js:4397
 *   POST /api/posts/:id/share                        lib/api.js:4393  (currently 409 by design)
 *   GET  /api/posts/:id/comments  ?sort&cursor       lib/api.js:3917
 *   POST /api/posts/:id/comments  { body, parent_id }lib/api.js:3948
 *
 * `nexusApi` already mints the `Idempotency-Key` the server's replay boundary demands, so these
 * helpers only describe the payload and the honest shape of the answer.
 */
export type ReactionAnswer = ReactionSummary & {
  ok: true;
  post_id: number;
  reaction: string;
  active: boolean;
};

export type SaveAnswer = { ok: true; post_id: number; saved: boolean; private?: boolean };

export type RepostAnswer = ReactionSummary & { ok: true; post_id: number; active: boolean; reposted_by_me?: boolean };

export type CommentCreated = { ok: true; post_id: number; parent_id: number | null; comment: CommentView };
export type CommentEngagementItem = {
  id?: number; user_id: number; actor_persona: string; handle: string; display_name: string;
  avatar?: string | null; body?: string; created_at: number;
};
export type CommentEngagementPage = {
  ok: true; comment_id: number; post_id: number; items: CommentEngagementItem[];
  total_visible: number; next_cursor: string | null;
};

export function setPostReaction(postId: number, kind: string, active: boolean): Promise<ReactionAnswer> {
  return nexusApi<ReactionAnswer>(`/api/posts/${postId}/reaction`, {
    method: 'POST',
    body: JSON.stringify({ kind, active }),
  });
}

export function setPostSaved(postId: number, active: boolean): Promise<SaveAnswer> {
  return nexusApi<SaveAnswer>(`/api/posts/${postId}/save`, {
    method: 'POST',
    body: JSON.stringify({ active }),
  });
}

export function setPostRepost(postId: number, active: boolean): Promise<RepostAnswer> {
  return nexusApi<RepostAnswer>(`/api/posts/${postId}/repost`, {
    method: 'POST',
    body: JSON.stringify({ active }),
  });
}

/**
 * Sharing is disabled server-side on purpose ("Nexus interactions stay internal"), and the web client
 * ships the same button so the reader learns the rule instead of wondering where it went. The call is
 * forwarded unchanged and the 409 travels back as a `NexusApiError` with the server's own sentence.
 */
export function sharePost(postId: number): Promise<{ ok: true; feature?: string }> {
  return nexusApi<{ ok: true; feature?: string }>(`/api/posts/${postId}/share`, { method: 'POST' });
}

export function fetchComments(postId: number, options: { sort?: 'relevant' | 'newest' | 'oldest'; cursor?: number } = {}): Promise<CommentPage> {
  const params = new URLSearchParams();
  params.set('sort', options.sort ?? 'relevant');
  params.set('cursor', String(options.cursor ?? 0));
  return nexusApi<CommentPage>(`/api/posts/${postId}/comments?${params.toString()}`);
}

export function createComment(postId: number, body: string, parentId?: number, idempotencyKey?: string): Promise<CommentCreated> {
  return nexusApi<CommentCreated>(`/api/posts/${postId}/comments`, {
    method: 'POST',
    ...(idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}),
    body: JSON.stringify(parentId ? { body, parent_id: parentId } : { body }),
  });
}

/** The server only permits the original comment author/persona to edit and inspect versions. */
export function editComment(commentId: number, body: string): Promise<{ ok: true; comment_id: number; comment: CommentView; edited: true }> {
  return nexusApi(`/api/comments/${commentId}`, { method: 'PATCH', body: JSON.stringify({ body }) });
}

export type CommentVersion = { version: number; body: string; created_at: number; content_commitment: string };
export function fetchCommentVersions(commentId: number): Promise<{ ok: true; versions: CommentVersion[] }> {
  return nexusApi(`/api/comments/${commentId}/versions`);
}

/** Actors and authored citations are server records; an old Railway backend returns an explicit error. */
export function fetchCommentEngagement(commentId: number, kind: 'likes' | 'quotes', cursor = 0): Promise<CommentEngagementPage> {
  return nexusApi<CommentEngagementPage>(`/api/comments/${commentId}/${kind}?cursor=${cursor}&limit=20`);
}

/** Author-only withdrawal: the server keeps the tombstone and every child reply. */
export function withdrawComment(commentId: number): Promise<{ ok: true; tombstone: true }> {
  return nexusApi(`/api/comments/${commentId}`, { method: 'DELETE' });
}

/** A report is recorded, not an automatic deletion. */
export function reportComment(commentId: number, category: string): Promise<{ ok: true; content_removed: false }> {
  return nexusApi(`/api/comments/${commentId}/report`, {
    method: 'POST', body: JSON.stringify({ category, details: '' }),
  });
}

/** `POST /api/comments/:id/reaction` — lib/api.js:4173, the same kind/active contract as a post. */
export function setCommentReaction(commentId: number, kind: string, active: boolean): Promise<ReactionAnswer> {
  return nexusApi<ReactionAnswer>(`/api/comments/${commentId}/reaction`, {
    method: 'POST',
    body: JSON.stringify({ kind, active }),
  });
}

/** `POST /api/comments/:id/save` — lib/api.js:4191. */
export function setCommentSaved(commentId: number, active: boolean): Promise<{ ok: true; comment_id?: number; saved: boolean }> {
  return nexusApi<{ ok: true; comment_id?: number; saved: boolean }>(`/api/comments/${commentId}/save`, {
    method: 'POST',
    body: JSON.stringify({ active }),
  });
}

/** POST /api/comments/:id/share is the web's internal repost action for one reply. */
export function setCommentShared(commentId: number, active: boolean): Promise<{ ok: true; shared_by_me: boolean; shares: number }> {
  return nexusApi(`/api/comments/${commentId}/share`, {
    method: 'POST',
    body: JSON.stringify({ active }),
  });
}
