import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Dimensions, FlatList, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { newMutationKey } from '../lib/idempotency';
import { flattenCommentRows, focusedCommentRows, rootCommentRows, type ThreadRow } from '../lib/commentRows';
import { commentFullDate, commentRelativeTime } from '../lib/commentTime';
import { createComment, fetchCommentEngagement, fetchComments, reportComment, setCommentReaction, setCommentSaved, setCommentShared, withdrawComment,
  type CommentEngagementItem, type CommentEngagementPage } from '../lib/postInteractions';
import { NexusApiError } from '../lib/nexusApi';
import {
  compactCount, initialsFor, mediaSourceForPath, reactionTotal, viewerReaction,
  type CommentPage, type CommentView, type ReactionSummary, type SocialPost,
} from '../lib/socialTypes';
import { socialTokens } from '../theme/social';
import { SolidViewerIcon } from './SolidViewerIcon';

type PendingComment = { tempId: number; key: string; body: string; parentId: number | null; createdAt: number; state: 'sending' | 'failed'; error?: string };
const C = socialTokens.comments;
const ACTION_HIT_SLOP = { top: 12, bottom: 12, left: 2, right: 2 } as const;
const REPORT_OPTIONS = [
  ['HARASSMENT_THREAT', 'Hărțuire sau amenințări'], ['HATE', 'Ură'],
  ['SCAM_FRAUD', 'Înșelătorie'], ['PERSONAL_DATA', 'Date personale'],
  ['MISINFORMATION_CONTEXT', 'Context înșelător'], ['IMPERSONATION', 'Impersonare'],
  ['SEXUAL_CONTENT', 'Conținut sexual'], ['CHILD_SAFETY', 'Siguranța copiilor'],
  ['ILLEGAL_GOODS', 'Bunuri ilegale'], ['ILLEGAL_CONTENT', 'Conținut ilegal'],
  ['COPYRIGHT', 'Drepturi de autor'],
] as const;

/**
 * The comment thread of one post, read from the same two routes the web reads
 * (`GET`/`POST /api/posts/:id/comments`, lib/api.js:3917/3948). It lists what the server returned,
 * states its own empty and failed cases, and posts a reply through the real endpoint - including the
 * "comentariul a fost oprit de o regulă automată" answer the server gives when a rule blocks it.
 */
export function CommentsSheet({ post, onClose, onCommentCreated, onCountSeen, onOpenThread, focusId, presentation = 'sheet' }: {
  post: SocialPost;
  onClose: () => void;
  onCommentCreated?: (postId: number) => void;
  onCountSeen?: (postId: number, count: number) => void;
  onOpenThread?: (commentId: number) => void;
  focusId?: number;
  presentation?: 'sheet' | 'viewer' | 'page';
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState<CommentPage | null>(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<PendingComment[]>([]);
  const [sort, setSort] = useState<'relevant' | 'newest'>('relevant');
  const [engagementKind, setEngagementKind] = useState<'likes' | 'quotes' | null>(null);
  const [engagementPage, setEngagementPage] = useState<CommentEngagementPage | null>(null);
  const [engagementError, setEngagementError] = useState('');
  const [engagementLoading, setEngagementLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [revealed, setRevealed] = useState<Record<number, number>>({});
  const [likes, setLikes] = useState<Record<number, ReactionSummary>>({});
  const [likeBusy, setLikeBusy] = useState<Record<number, boolean>>({});
  const [menuTarget, setMenuTarget] = useState<CommentView | null>(null);
  const [reportTarget, setReportTarget] = useState<CommentView | null>(null);
  const [clock, setClock] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [replyTo, setReplyTo] = useState<{ id: number; handle: string } | null | undefined>(undefined);
  const requestId = useRef(0);
  const engagementTicket = useRef(0);
  const nextTempId = useRef(-1);
  const scrollToComment = useRef<number | null>(null);
  const list = useRef<FlatList<ThreadRow>>(null);
  const composer = useRef<TextInput>(null);
  const countSeen = useRef(onCountSeen);
  useEffect(() => { countSeen.current = onCountSeen; }, [onCountSeen]);

  const load = useCallback((cursor = 0, refresh = false) => {
    const ticket = ++requestId.current;
    if (cursor !== 0) setLoadingMore(true);
    if (refresh) setRefreshing(true);
    fetchComments(post.id, { sort, cursor })
      .then((result) => {
        if (ticket !== requestId.current) return;
        if (!result.ok || result.post_id !== post.id || result.sort !== sort || result.cursor !== String(cursor) || !Array.isArray(result.comments)) {
          throw new Error('Răspunsul comentariilor nu este valid.');
        }
        setPage((previous) => cursor === 0 ? result : {
          ...result,
          comments: [...(previous?.comments ?? []), ...result.comments.filter((entry) => !previous?.comments.some((known) => known.id === entry.id))],
        });
        if (!result.next_cursor && cursor === 0) countSeen.current?.(post.id, result.comments.length);
        setError('');
      })
      .catch((cause) => {
        if (ticket !== requestId.current) return;
        setError(cause instanceof Error ? cause.message : 'Comentariile nu pot fi încărcate.');
      })
      .finally(() => { if (ticket === requestId.current) { setLoadingMore(false); setRefreshing(false); } });
  }, [post.id, sort]);

  useEffect(() => {
    const timer = setTimeout(() => load(0), 0);
    return () => { clearTimeout(timer); requestId.current += 1; };
  }, [load]);

  const loadEngagement = useCallback((kind: 'likes' | 'quotes', cursor = 0) => {
    if (!focusId) return;
    const ticket = ++engagementTicket.current;
    setEngagementLoading(true);
    setEngagementError('');
    fetchCommentEngagement(focusId, kind, cursor)
      .then((result) => {
        if (ticket !== engagementTicket.current) return;
        if (result.comment_id !== focusId || !Array.isArray(result.items)) throw new Error('Lista de interacțiuni nu este validă.');
        setEngagementPage((previous) => cursor === 0 ? result : {
          ...result, items: [...(previous?.items ?? []), ...result.items.filter((item) =>
            !previous?.items.some((known) => kind === 'quotes' ? known.id === item.id : known.user_id === item.user_id && known.actor_persona === item.actor_persona))],
        });
      })
      .catch((cause) => {
        if (ticket !== engagementTicket.current) return;
        setEngagementError(cause instanceof NexusApiError && cause.status === 404
          ? 'Lista nu este disponibilă pe versiunea actuală a backend-ului Railway.'
          : cause instanceof Error ? cause.message : 'Lista nu poate fi încărcată.');
      })
      .finally(() => { if (ticket === engagementTicket.current) setEngagementLoading(false); });
  }, [focusId]);

  useEffect(() => {
    if (!focusId || !engagementKind) return;
    const timer = setTimeout(() => loadEngagement(engagementKind), 0);
    return () => { clearTimeout(timer); engagementTicket.current += 1; };
  }, [engagementKind, focusId, loadEngagement]);

  useEffect(() => {
    const initial = setTimeout(() => setClock(Date.now()), 0);
    const timer = setInterval(() => setClock(Date.now()), 1_000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const shown = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(Math.max(0, event.endCoordinates.height));
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { shown.remove(); hidden.remove(); };
  }, []);

  const submitPending = useCallback((entry: PendingComment) => {
    setPending((items) => items.map((item) => item.key === entry.key ? { ...item, state: 'sending', error: undefined } : item));
    createComment(post.id, entry.body, entry.parentId ?? undefined, entry.key)
      .then((answer) => {
        setPending((items) => items.filter((item) => item.key !== entry.key));
        setPage((previous) => previous ? {
          ...previous,
          comments: previous.comments.some((item) => item.id === answer.comment.id)
            ? previous.comments : [...previous.comments, answer.comment],
        } : previous);
        // Reveal every ancestor of this reply so that the confirmed row can be reached.
        setCollapsed({});
        setRevealed((current) => ({ ...current, ...(entry.parentId ? { [entry.parentId]: 1000 } : {}) }));
        scrollToComment.current = answer.comment.id;
        onCommentCreated?.(post.id);
      })
      .catch((cause) => {
        const message = cause instanceof Error ? cause.message : 'Comentariul nu a putut fi trimis.';
        setPending((items) => items.map((item) => item.key === entry.key ? { ...item, state: 'failed', error: message } : item));
      });
  }, [onCommentCreated, post.id]);

  const send = useCallback(() => {
    const body = draft.trim();
    if (!body || post.publishing?.allowComments === false) return;
    const entry: PendingComment = { tempId: nextTempId.current--, key: newMutationKey('comment'), body, parentId: replyTo === undefined ? focusId ?? null : replyTo?.id ?? null, createdAt: Date.now(), state: 'sending' };
    setPending((items) => [...items, entry]);
    if (entry.parentId) {
      const byId = new Map((page?.comments ?? []).map((comment) => [comment.id, comment]));
      const ancestors: Record<number, number> = {};
      let parentId: number | null = entry.parentId;
      const visited = new Set<number>();
      while (parentId && !visited.has(parentId)) {
        visited.add(parentId);
        ancestors[parentId] = 1000;
        parentId = byId.get(parentId)?.parent_id ?? null;
      }
      setCollapsed((state) => { const next = { ...state }; for (const id of visited) next[id] = false; return next; });
      setRevealed((state) => ({ ...state, ...ancestors }));
    }
    setDraft('');
    setReplyTo(focusId ? undefined : null);
    submitPending(entry);
  }, [draft, focusId, page?.comments, post.publishing?.allowComments, replyTo, submitPending]);

  const toggleLike = useCallback((comment: CommentView) => {
    if (likeBusy[comment.id]) return;
    const previous = likes[comment.id] ?? comment.reactions ?? { counts: {}, viewer_reaction: null };
    const active = viewerReaction(previous) !== 'LIKE';
    const counts = { ...(previous.counts ?? {}) };
    const priorKind = viewerReaction(previous);
    if (active && priorKind && priorKind !== 'LIKE') counts[priorKind] = Math.max(0, Number(counts[priorKind] ?? 0) - 1);
    counts.LIKE = Math.max(0, Number(counts.LIKE ?? 0) + (active ? 1 : -1));
    setLikes((state) => ({ ...state, [comment.id]: { ...previous, counts, viewer_reaction: active ? 'LIKE' : null } }));
    setLikeBusy((state) => ({ ...state, [comment.id]: true }));
    setCommentReaction(comment.id, 'LIKE', active)
      .then((answer) => setLikes((state) => ({ ...state, [comment.id]: { counts: answer.counts, viewer_reaction: answer.viewer_reaction } })))
      .catch((cause) => {
        setLikes((state) => ({ ...state, [comment.id]: previous }));
        setError(cause instanceof Error ? cause.message : 'Aprecierea nu a fost salvată.');
      })
      .finally(() => setLikeBusy((state) => ({ ...state, [comment.id]: false })));
  }, [likeBusy, likes]);

  const comments = useMemo(() => {
    const confirmed = page?.comments ?? [];
    const provisional: CommentView[] = pending.map((entry) => ({
      id: entry.tempId, parent_id: entry.parentId, user_id: page?.viewer_id,
      actor_persona: page?.viewer_persona, body: entry.body, created_at: entry.createdAt,
      display_name: 'Tu', handle: 'tu', status: entry.state,
    }));
    return [...confirmed, ...provisional];
  }, [page, pending]);
  const activeReplyTo = replyTo === undefined && focusId
    ? { id: focusId, handle: comments.find((comment) => comment.id === focusId)?.handle || 'nexus' }
    : replyTo;
  const rows = useMemo(() => focusId
    ? engagementKind
      ? [
        ...focusedCommentRows(comments, focusId).slice(0, 2),
        ...(engagementPage?.items ?? []).map((item, index): ThreadRow => ({
          kind: 'engagement', key: engagementKind === 'quotes' ? `quote:${item.id}` : `like:${item.user_id}:${item.actor_persona}:${index}`,
          item, engagementKind,
        })),
      ]
      : focusedCommentRows(comments, focusId)
    : onOpenThread ? rootCommentRows(comments) : flattenCommentRows(comments, collapsed, revealed),
  [comments, collapsed, engagementKind, engagementPage?.items, focusId, onOpenThread, revealed]);
  useEffect(() => {
    if (!focusId || !page?.next_cursor || comments.some((comment) => comment.id === focusId) || loadingMore || error) return;
    const cursor = Number(page.next_cursor);
    if (!Number.isSafeInteger(cursor)) return;
    const timer = setTimeout(() => load(cursor), 0);
    return () => clearTimeout(timer);
  }, [comments, error, focusId, load, loadingMore, page?.next_cursor]);
  useEffect(() => {
    const target = scrollToComment.current;
    if (target === null) return;
    const index = rows.findIndex((item) => item.kind === 'comment' && item.comment.id === target);
    if (index < 0) return;
    scrollToComment.current = null;
    setTimeout(() => list.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 }), 100);
  }, [rows]);
  const loading = !page && !error;

  const content = (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[
            presentation === 'sheet' ? styles.sheet : presentation === 'page' ? styles.page : styles.viewerPanel,
            { paddingBottom: insets.bottom },
            keyboardHeight > 0 && Platform.OS === 'android' ? {
              marginBottom: keyboardHeight,
              ...(presentation === 'sheet' ? {
                maxHeight: Math.max(240, Dimensions.get('screen').height - keyboardHeight),
                minHeight: 0,
              } : {}),
            } : null,
          ]}
        >
          {presentation === 'sheet' ? <View style={styles.grabber} /> : null}
          {presentation === 'sheet' ? <View style={styles.head}>
            <Text style={styles.title} numberOfLines={1}>{`Comentarii · ${compactCount(post.comment_count) || 0}`}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Închide" onPress={onClose} style={styles.close}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View> : null}

          {!focusId ? <View style={styles.sortBar} accessibilityRole="tablist" accessibilityLabel="Sortarea comentariilor">
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: sort === 'relevant' }} onPress={() => { if (sort !== 'relevant') { setError(''); setSort('relevant'); } }} style={styles.sortButton}>
              <Text style={[styles.sortText, sort === 'relevant' && styles.sortSelected]}>Relevante</Text>
            </Pressable>
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: sort === 'newest' }} onPress={() => { if (sort !== 'newest') { setError(''); setSort('newest'); } }} style={styles.sortButton}>
              <Text style={[styles.sortText, sort === 'newest' && styles.sortSelected]}>Cele mai noi</Text>
            </Pressable>
          </View> : null}

          {loading ? <View style={styles.skeletonWrap} accessibilityLabel="Se încarcă comentariile">
            {[0, 1, 2].map((value) => <View key={value} style={styles.skeletonRow}><View style={styles.skeletonAvatar} /><View style={styles.skeletonLines}><View style={styles.skeletonLineShort} /><View style={styles.skeletonLine} /></View></View>)}
          </View> : null}
          {post.publishing?.allowComments === false ? <Text style={styles.disabled}>Comentariile sunt oprite pentru această postare.</Text> : null}

          <FlatList
            ref={list}
            data={rows}
            keyExtractor={(item) => item.key}
            style={styles.list}
            contentContainerStyle={[styles.listContent, width <= 360 && styles.listContentNarrow]}
            extraData={{ likes, clock, page, pending }}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={9}
            refreshing={engagementKind ? engagementLoading : refreshing}
            onRefresh={() => engagementKind ? loadEngagement(engagementKind) : load(0, true)}
            onScrollToIndexFailed={({ index }) => setTimeout(() => list.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 }), 300)}
            ListEmptyComponent={!loading && !error && !page?.next_cursor ? <Text style={styles.empty}>{focusId ? 'Comentariul nu este disponibil.' : 'Niciun comentariu încă.'}</Text> : null}
            renderItem={({ item }) => item.kind === 'sort-tabs' ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.detailTabs} accessibilityRole="tablist" accessibilityLabel="Răspunsuri și interacțiuni">
              <Pressable accessibilityRole="tab" accessibilityLabel="Cele mai relevante" accessibilityState={{ selected: !engagementKind && sort === 'relevant' }} onPress={() => { setEngagementKind(null); if (sort !== 'relevant') { setError(''); setSort('relevant'); } }} style={styles.detailTab}><Text style={[styles.detailTabText, !engagementKind && sort === 'relevant' && styles.detailTabSelected]}>Cele mai relevante</Text></Pressable>
              <Pressable accessibilityRole="tab" accessibilityLabel="Cele mai noi" accessibilityState={{ selected: !engagementKind && sort === 'newest' }} onPress={() => { setEngagementKind(null); if (sort !== 'newest') { setError(''); setSort('newest'); } }} style={styles.detailTab}><Text style={[styles.detailTabText, !engagementKind && sort === 'newest' && styles.detailTabSelected]}>Cele mai noi</Text></Pressable>
              <Pressable accessibilityRole="tab" accessibilityLabel="View likes" accessibilityState={{ selected: engagementKind === 'likes' }} onPress={() => { if (engagementKind !== 'likes') { setEngagementPage(null); setEngagementKind('likes'); } }} style={styles.detailTab}><Text style={[styles.detailTabText, engagementKind === 'likes' && styles.detailTabSelected]}>Aprecieri</Text></Pressable>
              <Pressable accessibilityRole="tab" accessibilityLabel="View quotes" accessibilityState={{ selected: engagementKind === 'quotes' }} onPress={() => { if (engagementKind !== 'quotes') { setEngagementPage(null); setEngagementKind('quotes'); } }} style={styles.detailTab}><Text style={[styles.detailTabText, engagementKind === 'quotes' && styles.detailTabSelected]}>Citări</Text></Pressable>
            </ScrollView> : item.kind === 'engagement' ? <EngagementRow item={item.item} kind={item.engagementKind} now={clock} /> : item.kind === 'empty-replies' ? <Text style={styles.empty}>Niciun răspuns încă.</Text> : item.kind === 'toggle' ? <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.collapsed ? `${item.hiddenCount} răspunsuri ascunse. Extinde firul` : item.hiddenCount ? `Vezi încă ${item.hiddenCount} răspunsuri` : 'Strânge firul'}
              accessibilityState={{ expanded: !item.collapsed }}
              onPress={() => {
                if (item.collapsed) setCollapsed((state) => ({ ...state, [item.parentId]: false }));
                else if (item.hiddenCount) setRevealed((state) => ({ ...state, [item.parentId]: (state[item.parentId] ?? 3) + 3 }));
                else setCollapsed((state) => ({ ...state, [item.parentId]: true }));
              }}
              style={[styles.repliesToggle, { marginLeft: Math.min(item.depth, C.maxIndent) * C.indentStep + 54 }]}
            ><Text style={styles.repliesToggleText}>{item.collapsed ? `▸ ${item.hiddenCount} răspunsuri ascunse` : item.hiddenCount ? `▾ Vezi încă ${item.hiddenCount} răspunsuri` : '▾ Strânge firul'}</Text></Pressable>
              : <CommentRow
                comment={item.comment} depth={item.depth} now={clock}
                pending={pending.find((entry) => entry.tempId === item.comment.id)}
                summary={likes[item.comment.id] ?? item.comment.reactions ?? null}
                onLike={() => toggleLike(item.comment)}
                onRetry={(entry) => submitPending(entry)}
                onReply={(comment) => {
                  setReplyTo({ id: comment.id, handle: comment.handle || comment.author?.handle || 'nexus' });
                  composer.current?.focus();
                }}
                onOpenThread={onOpenThread && item.comment.id !== focusId ? () => onOpenThread(item.comment.id) : undefined}
                childCount={item.childCount}
                prominent={item.comment.id === focusId}
                onCollapse={item.parentId ? () => setCollapsed((state) => ({ ...state, [item.parentId!]: true })) : item.childCount ? () => setCollapsed((state) => ({ ...state, [item.comment.id]: !state[item.comment.id] })) : undefined}
                onMenu={() => setMenuTarget(item.comment)}
                onError={setError}
              />}
            ListFooterComponent={engagementKind ? <View style={styles.engagementFooter}>
              {engagementLoading && !engagementPage ? <Text style={styles.empty}>Se încarcă lista…</Text> : null}
              {engagementError ? <Text style={styles.error}>{engagementError}</Text> : null}
              {engagementError ? <Pressable accessibilityRole="button" accessibilityLabel="Reîncearcă încărcarea listei" onPress={() => loadEngagement(engagementKind)} style={styles.more}><Text style={styles.moreText}>Reîncearcă</Text></Pressable> : null}
              {!engagementLoading && !engagementError && engagementPage?.items.length === 0 ? <Text style={styles.empty}>{engagementKind === 'likes' ? 'Nicio apreciere încă.' : 'Nicio citare încă.'}</Text> : null}
              {engagementPage?.next_cursor && !engagementError ? <Pressable accessibilityRole="button" accessibilityLabel="Încarcă mai multe" disabled={engagementLoading} onPress={() => {
                const cursor = Number(engagementPage.next_cursor);
                if (Number.isSafeInteger(cursor)) loadEngagement(engagementKind, cursor);
              }} style={styles.more}><Text style={styles.moreText}>{engagementLoading ? 'Se încarcă…' : 'Mai multe'}</Text></Pressable> : null}
            </View> : !focusId && page?.next_cursor ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Încarcă mai multe comentarii" disabled={loadingMore} onPress={() => {
                const cursor = Number(page.next_cursor);
                if (Number.isSafeInteger(cursor)) load(cursor);
              }} style={styles.more}>
                <Text style={styles.moreText}>{loadingMore ? 'Se încarcă…' : 'Mai multe conversații'}</Text>
              </Pressable>
            ) : null}
          />

          {error ? <View style={styles.errorRow}><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="Reîncearcă încărcarea comentariilor" onPress={() => { setError(''); load(page?.next_cursor ? Number(page.next_cursor) : 0); }}><Text style={styles.retry}>Reîncearcă</Text></Pressable></View> : null}

          {menuTarget ? <View style={styles.actionMenu}>
            <Pressable accessibilityRole="button" accessibilityLabel="Închide meniul comentariului" onPress={() => setMenuTarget(null)} style={styles.actionMenuButton}><Text style={styles.actionMenuText}>Închide</Text></Pressable>
            {menuTarget.user_id === page?.viewer_id && menuTarget.actor_persona === page?.viewer_persona ? <Pressable accessibilityRole="button" accessibilityLabel="Retrage comentariul" style={styles.actionMenuButton} onPress={() => {
              const target = menuTarget; setMenuTarget(null);
              Alert.alert('Retrage comentariul?', 'Textul va dispărea, dar firul și istoricul rămân.', [
                { text: 'Anulează', style: 'cancel' },
                { text: 'Retrage', style: 'destructive', onPress: () => withdrawComment(target.id).then(() => load(0)).catch((cause) => setError(cause instanceof Error ? cause.message : 'Retragerea nu a reușit.')) },
              ]);
            }}><Text style={styles.actionMenuText}>Retrage</Text></Pressable> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Raportează comentariul" style={styles.actionMenuButton} onPress={() => { setReportTarget(menuTarget); setMenuTarget(null); }}><Text style={styles.actionMenuText}>Raportează</Text></Pressable>
          </View> : null}
          {reportTarget ? <View style={styles.reportMenu}>
            <Text style={styles.reportTitle}>De ce raportezi acest comentariu?</Text>
            <FlatList data={REPORT_OPTIONS} keyExtractor={(item) => item[0]} style={styles.reportList} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={item[1]} style={styles.actionMenuButton} onPress={() => {
              const target = reportTarget; setReportTarget(null);
              reportComment(target.id, item[0]).then(() => Alert.alert('Raport trimis', 'Raportul a fost înregistrat; conținutul nu este eliminat automat.')).catch((cause) => setError(cause instanceof Error ? cause.message : 'Raportul nu a putut fi trimis.'));
            }}><Text style={styles.actionMenuText}>{item[1]}</Text></Pressable>} />
            <Pressable accessibilityRole="button" accessibilityLabel="Anulează raportarea" onPress={() => setReportTarget(null)} style={styles.actionMenuButton}><Text style={styles.actionMenuText}>Anulează</Text></Pressable>
          </View> : null}

          <View style={styles.composer}>
            <View style={styles.composerLine}>
            <TextInput
              ref={composer}
              value={draft}
              onChangeText={setDraft}
              placeholder={post.publishing?.allowComments === false ? 'Comentariile sunt oprite' : activeReplyTo ? `Răspuns pentru @${activeReplyTo.handle}…` : 'Adaugă un comentariu…'}
              placeholderTextColor="#7d8b96"
              style={styles.input}
              multiline
              maxLength={1000}
              editable={post.publishing?.allowComments !== false}
              accessibilityLabel="Comentariu nou"
            />
            {replyTo ? <Pressable accessibilityRole="button" accessibilityLabel="Anulează răspunsul" onPress={() => setReplyTo(focusId ? undefined : null)} style={styles.cancelReply}><Text style={styles.cancelReplyText}>×</Text></Pressable> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Trimite comentariul"
              onPress={send}
              disabled={!draft.trim() || post.publishing?.allowComments === false}
              style={[styles.send, (!draft.trim() || post.publishing?.allowComments === false) && styles.sendOff]}
            >
              <Text style={styles.sendText}>➤</Text>
            </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
  );

  if (presentation !== 'sheet') return content;
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Închide comentariile" onPress={onClose} style={styles.dismiss} />
        {content}
      </View>
    </Modal>
  );
}

function CommentRow({ comment, depth, now, pending, summary, childCount, prominent, onLike, onRetry, onReply, onOpenThread, onCollapse, onMenu, onError }: {
  comment: CommentView;
  depth: number;
  now: number;
  pending?: PendingComment;
  summary: ReactionSummary | null;
  onLike: () => void;
  onRetry: (entry: PendingComment) => void;
  onReply: (comment: CommentView) => void;
  onOpenThread?: () => void;
  childCount: number;
  prominent: boolean;
  onCollapse?: () => void;
  onMenu: () => void;
  onError: (message: string) => void;
}) {
  const [saved, setSaved] = useState(Boolean(comment.saved_by_me));
  const [shared, setShared] = useState(Boolean(comment.shared_by_me));
  const [shares, setShares] = useState(comment.reply_shares ?? 0);
  const [expanded, setExpanded] = useState(false);
  const [hasMoreLines, setHasMoreLines] = useState(false);
  const avatar = mediaSourceForPath(comment.avatar || comment.author?.avatar);
  const handle = comment.handle || comment.author?.handle || 'nexus';
  const name = comment.display_name || comment.author?.display_name || handle;
  const mine = viewerReaction(summary) === 'LIKE';

  const toggleSave = () => {
    const next = !saved;
    setSaved(next);
    setCommentSaved(comment.id, next)
      .then((result) => setSaved(result.saved))
      .catch((cause) => { setSaved(!next); onError(cause instanceof Error ? cause.message : 'Salvarea a eșuat.'); });
  };

  const toggleShare = () => {
    const next = !shared;
    setShared(next);
    setCommentShared(comment.id, next)
      .then((result) => { setShared(result.shared_by_me); setShares(result.shares); })
      .catch((cause) => { setShared(!next); onError(cause instanceof Error ? cause.message : 'Redistribuirea a eșuat.'); });
  };

  return (
    <View style={[styles.rowWrap, { marginLeft: Math.min(depth, C.maxIndent) * C.indentStep }]}>
      {depth > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Strânge firul" hitSlop={{ left: 15, right: 15 }} onPress={onCollapse} style={styles.threadLine} /> : null}
      <Pressable accessibilityRole={onOpenThread ? 'button' : undefined} accessibilityLabel={onOpenThread ? `Citește comentariul lui ${name} și răspunsurile` : undefined} onPress={onOpenThread} style={[styles.row, depth > 0 && styles.replyRow, prominent && styles.prominentRow]}>
      <View style={[styles.avatar, prominent && styles.prominentAvatar]}>
        {avatar ? <Image source={avatar} style={styles.avatarImage} accessibilityIgnoresInvertColors />
          : <Text style={styles.avatarInitials}>{initialsFor(name, handle)}</Text>}
      </View>
      <View style={styles.body}>
        <View style={styles.rowHead}>
          <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
          <Text style={styles.rowHandle} numberOfLines={1}>{`@${handle}`}</Text>
          {!prominent ? <Text style={styles.rowTime}>{commentRelativeTime(comment.created_at, now)}</Text> : null}
        </View>
        {comment.pinned_by_owner ? <Text style={styles.pinned}>Fixat de autor</Text> : null}
        {comment.status === 'withdrawn' ? <Text style={styles.tombstone}>Comentariu retras · istoricul este păstrat</Text> : <View>
          <Text style={[styles.rowText, prominent && styles.prominentText]} numberOfLines={expanded || prominent ? undefined : 5} onTextLayout={(event) => {
            // The full measurement is rendered off-layout below; length in characters is not a proxy for lines.
            if (expanded && event.nativeEvent.lines.length > 5) setHasMoreLines(true);
          }}>{comment.body}</Text>
          {!hasMoreLines ? <Text style={styles.measureText} onTextLayout={(event) => {
            if (event.nativeEvent.lines.length > 5) setHasMoreLines(true);
          }}>{comment.body}</Text> : null}
          {hasMoreLines ? <Pressable accessibilityRole="button" accessibilityLabel={expanded ? 'Vezi mai puțin' : 'Vezi mai mult'} onPress={(event) => { event.stopPropagation(); setExpanded((value) => !value); }} style={styles.expandButton}><Text style={styles.expandText}>{expanded ? 'Vezi mai puțin' : 'Vezi mai mult'}</Text></Pressable> : null}
        </View>}
        {prominent && commentFullDate(comment.created_at) ? <Text style={styles.fullDate}>{commentFullDate(comment.created_at)}</Text> : null}
        {pending ? <Pressable accessibilityRole="button" accessibilityLabel={pending.state === 'failed' ? 'Reîncearcă trimiterea comentariului' : 'Comentariul se trimite'} disabled={pending.state !== 'failed'} onPress={(event) => { event.stopPropagation(); onRetry(pending); }} style={styles.pendingState}><Text style={styles.pendingText}>{pending.state === 'failed' ? `Nu s-a trimis · Reîncearcă${pending.error ? ` · ${pending.error}` : ''}` : 'Se trimite…'}</Text></Pressable> : null}
        <View style={styles.rowActions}>
          <Pressable accessibilityRole="button" accessibilityLabel={onOpenThread ? `Deschide ${childCount} ${childCount === 1 ? 'răspuns' : 'răspunsuri'} la comentariul lui ${name}` : `Răspunde la comentariul lui ${name}`} hitSlop={ACTION_HIT_SLOP} disabled={Boolean(pending)} onPress={(event) => { event.stopPropagation(); (onOpenThread ?? (() => onReply(comment)))(); }} style={styles.rowAction}>
            <SolidViewerIcon kind="comment" size={C.actionIconSize} color={C.actionMuted} /><Text style={styles.rowActionText}>{onOpenThread ? childCount : 'Răspunde'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Redistribuie răspunsul" accessibilityState={{ selected: shared }} hitSlop={ACTION_HIT_SLOP} disabled={Boolean(pending)} onPress={(event) => { event.stopPropagation(); toggleShare(); }} style={styles.rowAction}>
            <SolidViewerIcon kind="repost" size={C.actionIconSize} color={shared ? '#ff315f' : C.actionMuted} /><Text style={styles.rowActionText}>{shares}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Apreciază comentariul"
            accessibilityState={{ selected: mine }}
            hitSlop={ACTION_HIT_SLOP}
            disabled={Boolean(pending)}
            onPress={(event) => { event.stopPropagation(); onLike(); }}
            style={styles.rowAction}
          >
            <SolidViewerIcon kind="heart" size={C.actionIconSize} color={mine ? '#ff315f' : C.actionMuted} />
            <Text style={[styles.rowActionText, mine && styles.rowActionOn]}>{reactionTotal(summary) || 0}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={saved ? 'Scoate răspunsul din salvate' : 'Salvează răspunsul'} accessibilityState={{ selected: saved }} hitSlop={ACTION_HIT_SLOP} disabled={Boolean(pending)} onPress={(event) => { event.stopPropagation(); toggleSave(); }} style={styles.rowAction}>
            <SolidViewerIcon kind="save" size={C.actionIconSize} color={saved ? '#ff315f' : C.actionMuted} />
          </Pressable>
          {!onOpenThread ? <Text style={styles.rowMeta}>{comment.reply_count ?? childCount} răsp.</Text> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Mai multe opțiuni pentru comentariu" hitSlop={ACTION_HIT_SLOP} disabled={Boolean(pending)} onPress={(event) => { event.stopPropagation(); onMenu(); }} style={styles.rowAction}><Text style={styles.moreGlyph}>•••</Text></Pressable>
        </View>
      </View>
      </Pressable>
    </View>
  );
}

function EngagementRow({ item, kind, now }: { item: CommentEngagementItem; kind: 'likes' | 'quotes'; now: number }) {
  const avatar = mediaSourceForPath(item.avatar);
  const name = item.display_name || item.handle;
  return <View style={styles.engagementRow}>
    <View style={styles.avatar}>{avatar ? <Image source={avatar} style={styles.avatarImage} accessibilityIgnoresInvertColors />
      : <Text style={styles.avatarInitials}>{initialsFor(name, item.handle)}</Text>}</View>
    <View style={styles.body}>
      <View style={styles.rowHead}><Text style={styles.rowName} numberOfLines={1}>{name}</Text>
        <Text style={styles.rowHandle} numberOfLines={1}>{`@${item.handle}`}</Text>
        <Text style={styles.rowTime}>{commentRelativeTime(item.created_at, now)}</Text></View>
      {kind === 'quotes' ? <Text style={styles.rowText}>{item.body}</Text> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.62)' },
  dismiss: { flex: 1 },
  sheet: {
    maxHeight: '82%', minHeight: '52%', backgroundColor: C.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  viewerPanel: {
    flex: 1, backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  page: { flex: 1, backgroundColor: C.surface },
  grabber: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, marginTop: 8, backgroundColor: 'rgba(255,255,255,0.32)' },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  title: { color: '#f5f8fa', fontSize: 15, fontWeight: '800', flex: 1 },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  closeText: { color: '#f5f8fa', fontSize: 18, fontWeight: '700' },
  loader: { marginTop: 30 },
  sortBar: { height: 36, minHeight: 36, paddingHorizontal: 12, flexDirection: 'row', gap: 22, backgroundColor: C.surface },
  sortButton: { minHeight: 34, justifyContent: 'center' },
  sortText: { color: '#92979d', fontSize: 12, fontWeight: '700' },
  sortSelected: { color: '#ffffff', fontWeight: '900', borderBottomWidth: 2, borderBottomColor: '#ffffff' },
  detailTabs: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: C.rowBorder, marginBottom: C.threadGap, gap: 16 },
  detailTab: { minHeight: 44, justifyContent: 'center' },
  detailTabText: { color: C.actionMuted, fontSize: C.handleSize + 2, fontWeight: '700' },
  detailTabSelected: { color: '#ffffff', fontWeight: '900', borderBottomWidth: 2, borderBottomColor: '#ffffff' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: C.listPaddingHorizontal, paddingTop: C.listPaddingTop, paddingBottom: C.listPaddingBottom },
  listContentNarrow: { paddingHorizontal: 14 },
  rowWrap: { position: 'relative', marginBottom: C.threadGap, maxWidth: C.threadMaxWidth },
  threadLine: { position: 'absolute', left: -7, top: 0, bottom: 0, width: 14, borderLeftWidth: 1, borderLeftColor: C.threadLine, minHeight: 44 },
  row: {
    flexDirection: 'row', gap: C.columnGap, minHeight: C.rowMinHeight, marginBottom: C.rowMarginBottom,
    paddingVertical: C.rowPaddingVertical, paddingHorizontal: C.rowPaddingHorizontal,
    borderWidth: 1, borderColor: C.rowBorder, borderRadius: C.rowRadius,
    backgroundColor: C.rowBackgroundTop,
  },
  replyRow: { backgroundColor: C.replyBackgroundTop, borderColor: C.replyBorder },
  prominentRow: { paddingVertical: C.rowPaddingVertical + 6, borderColor: C.rowBorder },
  prominentAvatar: { width: C.avatarSize + 8, height: C.avatarSize + 8, borderRadius: (C.avatarSize + 8) / 2 },
  prominentText: { fontSize: C.bodySize + 3, lineHeight: C.bodyLineHeight + 4 },
  avatar: {
    width: C.avatarSize, height: C.avatarSize, borderRadius: C.avatarSize / 2, overflow: 'hidden', backgroundColor: C.avatarBackground,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { color: '#f5f8fa', fontSize: 10, fontWeight: '900' },
  body: { flex: 1, minWidth: 0 },
  rowHead: { height: C.headerHeight, flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowName: { color: '#ffffff', fontSize: C.nameSize, lineHeight: C.headerHeight, fontWeight: '900', maxWidth: '45%' },
  rowHandle: { color: '#92979d', fontSize: C.handleSize, lineHeight: C.headerHeight, flexShrink: 1 },
  rowTime: { color: '#777d84', fontSize: C.timeSize, lineHeight: C.headerHeight, marginLeft: 'auto' },
  fullDate: { color: C.actionMuted, fontSize: C.timeSize + 2, marginTop: 5, marginBottom: 3 },
  pinned: { color: '#f0c274', fontSize: 11, fontWeight: '700', marginTop: 2 },
  rowText: { color: C.bodyColor, fontSize: C.bodySize, lineHeight: C.bodyLineHeight, marginTop: 1 },
  measureText: { position: 'absolute', opacity: 0, zIndex: -1, color: C.bodyColor, fontSize: C.bodySize, lineHeight: C.bodyLineHeight, left: 0, right: 0 },
  expandButton: { minHeight: 44, justifyContent: 'center' },
  expandText: { color: '#d3d6da', fontSize: 10, fontWeight: '800' },
  tombstone: { color: '#83969d', fontSize: 10, fontStyle: 'italic', marginTop: 2 },
  pendingState: { minHeight: 44, justifyContent: 'center' },
  pendingText: { color: '#ff9b9b', fontSize: 11 },
  rowActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: C.actionHeight },
  rowAction: { minWidth: 44, minHeight: C.actionHeight, flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  rowActionText: { color: C.actionMuted, fontSize: C.actionCounterSize, fontWeight: '700' },
  rowActionOn: { color: '#ff315f' },
  rowMeta: { color: '#7d8b96', fontSize: C.actionCounterSize, textAlign: 'center', minWidth: 44 },
  moreGlyph: { color: C.actionMuted, fontSize: 20, fontWeight: '800' },
  engagementRow: { flexDirection: 'row', gap: C.columnGap, paddingVertical: 11, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: C.rowBorder, minHeight: 58 },
  engagementFooter: { paddingBottom: 12 },
  repliesToggle: { minHeight: 44, justifyContent: 'center' },
  repliesToggleText: { color: C.toggleColor, fontSize: 10, fontWeight: '800' },
  replyLine: { color: '#cbd7df', fontSize: 13, lineHeight: 18 },
  replyName: { color: '#f5f8fa', fontWeight: '700' },
  empty: { color: '#96a2ad', fontSize: 13, textAlign: 'center', paddingVertical: 24 },
  disabled: { color: '#aeb4ba', fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  skeletonWrap: { paddingHorizontal: C.listPaddingHorizontal, paddingTop: C.listPaddingTop },
  skeletonRow: { flexDirection: 'row', gap: C.columnGap, minHeight: C.rowMinHeight, padding: C.rowPaddingHorizontal, marginBottom: C.threadGap, borderRadius: C.rowRadius, backgroundColor: C.rowBackgroundBottom },
  skeletonAvatar: { width: C.avatarSize, height: C.avatarSize, borderRadius: C.avatarSize / 2, backgroundColor: '#25282d' },
  skeletonLines: { flex: 1, justifyContent: 'center', gap: 8 },
  skeletonLineShort: { width: '45%', height: 8, borderRadius: 4, backgroundColor: '#25282d' },
  skeletonLine: { width: '85%', height: 8, borderRadius: 4, backgroundColor: '#25282d' },
  error: { color: '#ff9b9b', fontSize: 12, textAlign: 'center', paddingHorizontal: 16, paddingBottom: 6 },
  errorRow: { alignItems: 'center', gap: 4, paddingVertical: 5 },
  retry: { color: '#ffffff', fontSize: 12, fontWeight: '800', paddingVertical: 8 },
  more: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  moreText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  composer: { paddingHorizontal: 10, paddingTop: 7, paddingBottom: 7, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)', backgroundColor: C.surface },
  composerLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  input: {
    flex: 1, minHeight: C.composerInputHeight, maxHeight: 120, color: '#ffffff', fontSize: C.composerInputFontSize, lineHeight: 19,
    backgroundColor: C.composerInputBackground, borderRadius: C.composerInputRadius,
    borderWidth: 1, borderColor: C.composerInputBorder, paddingHorizontal: 14, paddingVertical: 8,
  },
  send: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22, backgroundColor: C.composerSendBackground },
  sendOff: { opacity: 0.5 },
  sendText: { color: C.composerSendInk, fontWeight: '900', fontSize: 16 },
  cancelReply: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  cancelReplyText: { color: '#ffffff', fontSize: 25 },
  actionMenu: { borderTopWidth: 1, borderColor: C.rowBorder, backgroundColor: C.surface, paddingHorizontal: 12 },
  actionMenuButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  actionMenuText: { color: '#ffffff', fontSize: 13 },
  reportMenu: { maxHeight: 250, backgroundColor: C.surface, borderTopWidth: 1, borderColor: C.rowBorder },
  reportTitle: { color: '#ffffff', fontSize: 13, fontWeight: '800', padding: 12 },
  reportList: { flexGrow: 0 },
});
