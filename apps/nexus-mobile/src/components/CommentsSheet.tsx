import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { createComment, fetchComments, setCommentReaction } from '../lib/postInteractions';
import {
  compactCount, initialsFor, mediaSourceForPath, reactionTotal, relativeTime, viewerReaction,
  type CommentPage, type CommentView, type SocialPost,
} from '../lib/socialTypes';

/**
 * The comment thread of one post, read from the same two routes the web reads
 * (`GET`/`POST /api/posts/:id/comments`, lib/api.js:3917/3948). It lists what the server returned,
 * states its own empty and failed cases, and posts a reply through the real endpoint - including the
 * "comentariul a fost oprit de o regulă automată" answer the server gives when a rule blocks it.
 */
export function CommentsSheet({ post, onClose }: { post: SocialPost; onClose: () => void }) {
  const [page, setPage] = useState<CommentPage | null>(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [ownReplies, setOwnReplies] = useState<CommentView[]>([]);
  const requestId = useRef(0);

  const load = useCallback(() => {
    const ticket = ++requestId.current;
    fetchComments(post.id)
      .then((result) => { if (ticket === requestId.current) { setPage(result); setError(''); } })
      .catch((cause) => {
        if (ticket !== requestId.current) return;
        setError(cause instanceof Error ? cause.message : 'Comentariile nu pot fi încărcate.');
      });
  }, [post.id]);

  useEffect(() => { load(); }, [load]);

  const send = useCallback(() => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    createComment(post.id, body)
      .then((result) => {
        setOwnReplies((previous) => [...previous, result.comment]);
        setDraft('');
        setError('');
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Comentariul nu a putut fi trimis.'))
      .finally(() => setSending(false));
  }, [draft, post.id, sending]);

  const comments = [...(page?.comments ?? []), ...ownReplies];
  const loading = !page && !error;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Închide comentariile" onPress={onClose} style={styles.dismiss} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.head}>
            <Text style={styles.title} numberOfLines={1}>{`Comentarii · ${compactCount(post.comment_count) || 0}`}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Închide" onPress={onClose} style={styles.close}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {loading ? <ActivityIndicator color="#ffffff" style={styles.loader} /> : null}
          {!loading && comments.length === 0 && !error ? <Text style={styles.empty}>Niciun comentariu încă.</Text> : null}

          <FlatList
            data={comments}
            keyExtractor={(comment) => String(comment.id)}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => <CommentRow comment={item} />}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Scrie un comentariu…"
              placeholderTextColor="#7d8b96"
              style={styles.input}
              multiline
              maxLength={1000}
              accessibilityLabel="Comentariu nou"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Trimite comentariul"
              onPress={send}
              disabled={sending || !draft.trim()}
              style={[styles.send, (sending || !draft.trim()) && styles.sendOff]}
            >
              {sending ? <ActivityIndicator color="#050507" /> : <Text style={styles.sendText}>Trimite</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function CommentRow({ comment }: { comment: CommentView }) {
  const [summary, setSummary] = useState(comment.reactions ?? null);
  const [busy, setBusy] = useState(false);
  const avatar = mediaSourceForPath(comment.author?.avatar);
  const handle = comment.author?.handle || 'nexus';
  const name = comment.author?.display_name || handle;
  const mine = viewerReaction(summary) === 'LIKE';

  const toggle = () => {
    if (busy) return;
    setBusy(true);
    // The same contract the web gives a comment: one kind, LIKE, toggled by `active` (lib/api.js:4173).
    setCommentReaction(comment.id, 'LIKE', !mine)
      .then((answer) => setSummary({ counts: answer.counts, viewer_reaction: answer.viewer_reaction }))
      .catch(() => { /* the row keeps the last server truth when the call fails */ })
      .finally(() => setBusy(false));
  };

  const replies = Array.isArray(comment.replies) ? comment.replies : [];

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        {avatar ? <Image source={avatar} style={styles.avatarImage} accessibilityIgnoresInvertColors />
          : <Text style={styles.avatarInitials}>{initialsFor(name, handle)}</Text>}
      </View>
      <View style={styles.body}>
        <Text style={styles.rowHead}>
          <Text style={styles.rowName}>{name}</Text>
          {`  @${handle}`}
          {relativeTime(comment.created_at) ? ` · ${relativeTime(comment.created_at)}` : ''}
        </Text>
        {comment.pinned_by_owner ? <Text style={styles.pinned}>Fixat de autor</Text> : null}
        {comment.parent_author?.handle ? (
          <Text style={styles.replyTo} numberOfLines={1}>{`↩ @${comment.parent_author.handle}`}</Text>
        ) : null}
        <Text style={styles.rowText}>{comment.body}</Text>
        <View style={styles.rowActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Apreciază comentariul"
            accessibilityState={{ selected: mine }}
            onPress={toggle}
            style={styles.rowAction}
          >
            <Text style={[styles.rowActionText, mine && styles.rowActionOn]}>
              {`❤ ${reactionTotal(summary) || ''}`.trim()}
            </Text>
          </Pressable>
          {comment.views ? <Text style={styles.rowMeta}>{`${compactCount(comment.views)} vederi`}</Text> : null}
        </View>
        {replies.length ? (
          <View style={styles.replies}>
            {replies.map((reply) => (
              <Text key={reply.id} style={styles.replyLine} numberOfLines={4}>
                <Text style={styles.replyName}>{`@${reply.author?.handle || 'nexus'} `}</Text>
                {reply.body}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.62)' },
  dismiss: { flex: 1 },
  sheet: {
    maxHeight: '82%', minHeight: '52%', backgroundColor: '#0a0d10',
    borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  grabber: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, marginTop: 8, backgroundColor: 'rgba(255,255,255,0.32)' },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  title: { color: '#f5f8fa', fontSize: 15, fontWeight: '800', flex: 1 },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  closeText: { color: '#f5f8fa', fontSize: 18, fontWeight: '700' },
  loader: { marginTop: 30 },
  list: { flexGrow: 0 },
  listContent: { paddingHorizontal: 14, paddingBottom: 10 },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.12)' },
  avatar: {
    width: 36, height: 36, borderRadius: 18, overflow: 'hidden', backgroundColor: '#111820',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { color: '#f5f8fa', fontSize: 12, fontWeight: '800' },
  body: { flex: 1, minWidth: 0 },
  rowHead: { color: '#96a2ad', fontSize: 12 },
  rowName: { color: '#f5f8fa', fontWeight: '800' },
  pinned: { color: '#f0c274', fontSize: 11, fontWeight: '700', marginTop: 2 },
  replyTo: { color: '#9fb4c2', fontSize: 11, marginTop: 2 },
  rowText: { color: '#e7eef3', fontSize: 14, lineHeight: 20, marginTop: 4 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6, minHeight: 26 },
  rowAction: { paddingVertical: 4, paddingRight: 6 },
  rowActionText: { color: '#96a2ad', fontSize: 12, fontWeight: '700' },
  rowActionOn: { color: '#ff315f' },
  rowMeta: { color: '#7d8b96', fontSize: 11 },
  replies: { marginTop: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: 'rgba(255,255,255,0.14)', gap: 6 },
  replyLine: { color: '#cbd7df', fontSize: 13, lineHeight: 18 },
  replyName: { color: '#f5f8fa', fontWeight: '700' },
  empty: { color: '#96a2ad', fontSize: 13, textAlign: 'center', paddingVertical: 24 },
  error: { color: '#ff9b9b', fontSize: 12, textAlign: 'center', paddingHorizontal: 16, paddingBottom: 6 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)' },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120, color: '#f5f8fa', fontSize: 14, lineHeight: 19,
    backgroundColor: '#141a21', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
  },
  send: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 14, backgroundColor: '#ff315f' },
  sendOff: { opacity: 0.5 },
  sendText: { color: '#050507', fontWeight: '900', fontSize: 13 },
});
