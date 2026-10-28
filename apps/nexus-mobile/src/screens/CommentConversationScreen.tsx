import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommentsSheet } from '../components/CommentsSheet';
import { SolidViewerIcon } from '../components/SolidViewerIcon';
import { recalledCommentPost, rememberCommentPost } from '../lib/commentNavigation';
import { nexusApi } from '../lib/nexusApi';
import type { SocialPost } from '../lib/socialTypes';
import { socialTokens } from '../theme/social';

/**
 * The conversation of one post: a thread page, not a second rendering of the post.
 *
 * `/comments/[postId]` used to open the media reader (`MediaViewer`) with the thread on top of it. The
 * owner removed the full-screen post reading in round 8 — the 9:16 frame in the feed already is the
 * whole post — so the page now carries what it is for: one compact line saying whose post this is (no
 * media, nothing pressable), and the one comment surface the app has (`CommentsSheet` with
 * `presentation="page"`), with the one composer it already had.
 */
export function CommentConversationScreen({ postId, focusId }: { postId: number; focusId?: number }) {
  const insets = useSafeAreaInsets();
  const [post, setPost] = useState<SocialPost>(() => recalledCommentPost(postId) ?? { id: postId });
  const [postError, setPostError] = useState('');

  // A route reopened after process death can recover its real post by ID from the existing API.
  useEffect(() => {
    if (recalledCommentPost(postId)) return;
    let active = true;
    nexusApi<{ ok: true; post: SocialPost }>(`/api/posts/${postId}`)
      .then((answer) => {
        if (!active) return;
        if (answer.post?.id === postId) { rememberCommentPost(answer.post); setPost(answer.post); }
        else setPostError('Postarea nu este disponibilă; comentariile pot fi citite în continuare.');
      })
      .catch(() => { if (active) setPostError('Postarea nu a putut fi încărcată; comentariile pot fi citite în continuare.'); });
    return () => { active = false; };
  }, [postId]);

  const openThread = (current: SocialPost, commentId: number) => {
    rememberCommentPost(current);
    router.push({ pathname: '/comments/[postId]/[commentId]', params: { postId: String(postId), commentId: String(commentId) } });
  };

  const handle = post.author?.handle || 'nexus';
  const name = post.author?.display_name || handle;

  return (
    <View style={styles.fill}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Înapoi" onPress={() => router.back()} style={styles.back}>
          <SolidViewerIcon kind="back" size={22} />
        </Pressable>
        <Text style={styles.heading}>{focusId ? 'Firul comentariului' : 'Comentarii'}</Text>
      </View>

      {/**
       * The post as a line, not as a stage: the author and the first lines of the words. Nothing here is
       * pressable — the whole post is read in the feed, at its own 9:16 size.
       */}
      <View style={styles.context} accessible accessibilityLabel={`Postarea lui @${handle}`}>
        <Text style={styles.contextAuthor} numberOfLines={1}>{name}</Text>
        <Text style={styles.contextHandle} numberOfLines={1}>{`@${handle}`}</Text>
        {post.caption ? <Text style={styles.contextCaption} numberOfLines={3}>{post.caption}</Text> : null}
      </View>
      {postError ? <Text style={styles.postError}>{postError}</Text> : null}

      <CommentsSheet
        post={post}
        presentation="page"
        focusId={focusId}
        onClose={() => router.back()}
        onOpenThread={(commentId) => openThread(post, commentId)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: socialTokens.comments.surface },
  header: { minHeight: 54, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: socialTokens.comments.rowBorder },
  back: { width: 54, minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  heading: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  /** `.conversationContext`: the one line of post the thread is about, above its comments. */
  context: { paddingHorizontal: 16, paddingVertical: 10, gap: 2, borderBottomWidth: 1, borderBottomColor: socialTokens.comments.rowBorder },
  contextAuthor: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  contextHandle: { color: socialTokens.comments.actionMuted, fontSize: 12 },
  contextCaption: { color: '#e9eff4', fontSize: 13, lineHeight: 19, marginTop: 4 },
  postError: { color: '#ffffff', fontSize: 12, paddingHorizontal: 16, paddingVertical: 8 },
});
