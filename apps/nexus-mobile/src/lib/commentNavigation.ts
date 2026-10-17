import type { SocialPost } from './socialTypes';
import { router } from 'expo-router';

// Navigation holds only an in-memory view of posts already fetched from Railway.
// It is not persisted and never puts media paths or account data in route parameters.
const posts = new Map<number, SocialPost>();

export function rememberCommentPost(post: SocialPost): void {
  posts.set(post.id, post);
}

export function recalledCommentPost(postId: number): SocialPost | null {
  return posts.get(postId) ?? null;
}

export function openCommentsPage(post: SocialPost): void {
  rememberCommentPost(post);
  router.push({ pathname: '/comments/[postId]', params: { postId: String(post.id) } });
}

/**
 * A shared reply opens the conversation it was written in, at the reply the share names. It is the same
 * page a comment count opens, and the route reads the second parameter as the focus of the thread
 * (`app/comments/[postId]/[commentId].tsx` hands it to `CommentConversationScreen` as `focusId`), which
 * is what the web's `data-open-reply` press does (`profile-experience.js:306`).
 *
 * The post travels with the call the way a comment count already travels: a page holds only what the
 * archive it was opened from had fetched, and it asks the server for the record when the hand is empty.
 */
export function openReplyThread(post: SocialPost, commentId: number): void {
  rememberCommentPost(post);
  router.push({
    pathname: '/comments/[postId]/[commentId]',
    params: { postId: String(post.id), commentId: String(commentId) },
  });
}
