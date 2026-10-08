import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommentsSheet } from '../components/CommentsSheet';
import { MediaViewer } from '../components/MediaViewer';
import { SolidViewerIcon } from '../components/SolidViewerIcon';
import { recalledCommentPost, rememberCommentPost } from '../lib/commentNavigation';
import { nexusApi } from '../lib/nexusApi';
import type { SocialPost } from '../lib/socialTypes';
import { socialTokens } from '../theme/social';

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
      .catch(() => { if (active) setPostError('Media postării nu poate fi încărcată acum; comentariile pot fi citite în continuare.'); });
    return () => { active = false; };
  }, [postId]);

  const openThread = (current: SocialPost, commentId: number) => {
    rememberCommentPost(current);
    router.push({ pathname: '/comments/[postId]/[commentId]', params: { postId: String(postId), commentId: String(commentId) } });
  };

  if (!focusId) return (
    <View style={styles.fill}>
      {postError ? <Text style={[styles.mediaError, { top: insets.top + 8 }]}>{postError}</Text> : null}
      <MediaViewer post={post} embedded startWithComments onClose={() => router.back()} onOpenThread={openThread} />
    </View>
  );

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Înapoi la conversația anterioară" onPress={() => router.back()} style={styles.back}>
          <SolidViewerIcon kind="back" size={22} />
        </Pressable>
        <Text style={styles.heading}>Firul comentariului</Text>
      </View>
      <CommentsSheet post={post} presentation="page" focusId={focusId} onClose={() => router.back()} onOpenThread={(commentId) => openThread(post, commentId)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: socialTokens.comments.surface },
  header: { minHeight: 54, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: socialTokens.comments.rowBorder },
  back: { width: 54, minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  heading: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  mediaError: { position: 'absolute', zIndex: 4, left: 12, right: 12, color: '#ffffff', fontSize: 12 },
});
