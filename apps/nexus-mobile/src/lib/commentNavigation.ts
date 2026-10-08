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
