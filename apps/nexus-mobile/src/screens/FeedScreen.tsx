import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Linking, PanResponder, Pressable, RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { nexusApi, NexusApiError } from '../lib/nexusApi';
import { decideSocialGesture } from '../lib/socialGesture';
import type { FeedPage, NewsItem, SocialPost } from '../lib/socialTypes';
import { postMediaItems, relativeTime } from '../lib/socialTypes';
import { PostCard } from '../components/PostCard';
import { MediaViewer } from '../components/MediaViewer';
import { ReelsReader } from '../components/ReelsReader';
import { socialTokens } from '../theme/social';
import { openCommentsPage } from '../lib/commentNavigation';

const PAGE_SIZE = 30;

/** How far a flick has to move before the feed takes it over: well under the 72px that decides it. */
const CLAIM_TRAVEL = 24;

/** Whether a move is clearly horizontal, the way `decideSocialGesture` reads a finished gesture. */
function horizontalIntent(dx: number, dy: number): boolean {
  return Math.abs(dx) >= CLAIM_TRAVEL && Math.abs(dx) > Math.abs(dy) * 1.2;
}

export type FeedModeId = 'reels' | 'whispers' | 'news';

/**
 * The Social feed. It reads the same endpoint the web reads (`GET /api/social/feed`) with the same
 * mode contract (`FEED_MODE_CONTRACT` in feed-surface.js), keeps the cursor for paging, and answers
 * every state honestly: a skeleton while the first page is in flight, an error with a retry that
 * never doubles a post, an empty line when the server really has nothing, and the provider's own
 * reason when Breaking News has no configured source.
 */
export function FeedScreen({ mode, onModeChange }: {
  mode: FeedModeId;
  onModeChange: (mode: FeedModeId) => void;
}) {
  const contract = socialTokens.feedModes.find((entry) => entry.id === mode) ?? socialTokens.feedModes[0];
  const url = useMemo(() => {
    const params = new URLSearchParams({ format: contract.format, limit: String(PAGE_SIZE) });
    if (contract.lens) params.set('lens', contract.lens);
    return `/api/social/feed?${params.toString()}`;
  }, [contract.format, contract.lens]);

  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [newsNotice, setNewsNotice] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [emptyNote, setEmptyNote] = useState('');
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);
  const requestId = useRef(0);
  /** Where the column stands, so the swipe decides with the same number the web hands its decision. */
  const scrollTop = useRef(0);
  /** The posts a card would open the full-screen reader with (app.js:4913): the ones that carry media. */
  const gallery = useMemo(() => posts.filter((post) => postMediaItems(post).length > 0), [posts]);
  /**
   * The end of a horizontal flick on the feed (app.js:2960-3030 `wireSocialChannelSwipe`). The decision is
   * the web's, taken with the same 72px threshold and the same scroll position, and the walk it takes is
   * `nextMode`: the order the rail prints, wrapping at both ends (`activateFeedMode(nextFeedMode(feedMode,
   * offset))`, app.js:2999). A pull at the very top is not answered here — the native `RefreshControl`
   * already owns it and reloads exactly the page that branch would have asked for.
   */
  const endSwipe = useCallback((dx: number, dy: number) => {
    const decision = decideSocialGesture({ dx, dy, scrollTop: scrollTop.current });
    if (decision.action !== 'channel') return;
    onModeChange(nextMode(mode, decision.offset));
  }, [mode, onModeChange]);
  /**
   * The surface that reads the flick. Only a move that is clearly horizontal is taken over — 24px of travel
   * and more than 1.2× the vertical one — so the column's own scroll and every tap stay with their owner.
   *
   * The compiler rule below reads `PanResponder.create` as a call that could run its handlers while the
   * component renders; `endSwipe` is only ever reached on a release, which is exactly where reading where
   * the column stands is allowed (the same disable sits on the media reader of `PostMedia.tsx`).
   */
  // eslint-disable-next-line react-hooks/refs
  const channelSwipe = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) => horizontalIntent(gesture.dx, gesture.dy),
    onMoveShouldSetPanResponderCapture: (_event, gesture) => horizontalIntent(gesture.dx, gesture.dy),
    onPanResponderRelease: (_event, gesture) => endSwipe(gesture.dx, gesture.dy),
    onPanResponderTerminate: () => {},
  }), [endSwipe]);

  const applyPage = useCallback((page: FeedPage, kind: 'initial' | 'more') => {
    setCursor(typeof page.next_cursor === 'string' ? page.next_cursor : null);
    setPosts((previous) => {
      if (kind === 'more') {
        const seen = new Set(previous.map((post) => post.id));
        return [...previous, ...(page.posts ?? []).filter((post) => !seen.has(post.id))];
      }
      return page.posts ?? [];
    });
    setNews(Array.isArray(page.news) ? page.news : null);
    setNewsNotice(contract.id === 'news' && page.provider?.status === 'disabled'
      ? String(page.provider.reason || 'Sursa de știri nu este configurată pe server.')
      : '');
    setEmptyNote(page.near?.status === 'consent_required'
      ? 'Feedul local are nevoie de acordul tău pentru regiune.'
      : 'Nu sunt postări de afișat.');
    setError('');
  }, [contract.id]);

  const describe = useCallback((cause: unknown) => (cause instanceof NexusApiError && cause.status === 409
    ? 'Profilul Social nu este activ pe această sesiune.'
    : cause instanceof Error ? cause.message : 'Conexiunea nu este disponibilă.'), []);

  // The first page is fetched when the address changes. Every state update happens after the
  // promise resolves, so nothing renders twice for the same request.
  useEffect(() => {
    const ticket = ++requestId.current;
    let cancelled = false;
    nexusApi<FeedPage>(url)
      .then((page) => {
        if (cancelled || ticket !== requestId.current) return;
        applyPage(page, 'initial');
        setLoadedUrl(url);
      })
      .catch((cause) => {
        if (cancelled || ticket !== requestId.current) return;
        setError(describe(cause));
        setLoadedUrl(url);
      });
    return () => { cancelled = true; };
  }, [applyPage, describe, reloadNonce, url]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    const ticket = ++requestId.current;
    nexusApi<FeedPage>(url)
      .then((page) => { if (ticket === requestId.current) { applyPage(page, 'initial'); setLoadedUrl(url); } })
      .catch((cause) => { if (ticket === requestId.current) setError(describe(cause)); })
      .finally(() => { if (ticket === requestId.current) setRefreshing(false); });
  }, [applyPage, describe, url]);

  const onLoadMore = useCallback(() => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const ticket = requestId.current;
    nexusApi<FeedPage>(`${url}&cursor=${encodeURIComponent(cursor)}`)
      .then((page) => { if (ticket === requestId.current) applyPage(page, 'more'); })
      .catch((cause) => { if (ticket === requestId.current) setError(describe(cause)); })
      .finally(() => { if (ticket === requestId.current) setLoadingMore(false); });
  }, [applyPage, cursor, describe, loadingMore, url]);

  const onRetry = useCallback(() => {
    setError('');
    setLoadedUrl(null);
    setReloadNonce((value) => value + 1);
  }, []);

  /** Where the full-screen reader stands: the index of the tapped post inside the media gallery. */
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const openInViewer = useCallback((post: SocialPost) => {
    const index = gallery.findIndex((entry) => entry.id === post.id);
    if (index >= 0) setViewerIndex(index);
  }, [gallery]);

  if (loadedUrl !== url) return <FeedSkeleton />;

  // The clips reading is the immersive one (`presentation-immersive` of feed-surface.css), so it gets
  // the full-viewport reader. Whispers and News keep the card list. When the clips reading is empty or
  // failed the card list stays in place, which is where the empty and error lines live.
  if (mode === 'reels' && posts.length > 0) {
    return (
      <>
        <View style={styles.surface} {...channelSwipe.panHandlers}>
          <ReelsReader
            posts={posts}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onEndReached={onLoadMore}
            loadingMore={loadingMore}
            onOpenPost={openInViewer}
            onOpenComments={openCommentsPage}
          />
        </View>
        {/**
         * `tapVideo` of the web (app.js:3216-3239) opens the reel full screen on a single tap; the reader
         * it opens is the same `#mediaViewer` every other card opens, and it is handed the media posts of
         * this surface (`gallery`), with the tapped post as its first frame.
         */}
        <MediaViewer
          post={viewerIndex !== null ? gallery[viewerIndex] ?? null : null}
          gallery={gallery}
          onClose={() => setViewerIndex(null)}
          onOpenCommentsRoot={(post) => { setViewerIndex(null); openCommentsPage(post); }}
        />
      </>
    );
  }

  return (
    <FlatList
      {...channelSwipe.panHandlers}
      data={posts}
      keyExtractor={(post) => String(post.id)}
      renderItem={({ item }) => <PostCard post={item} gallery={gallery} />}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={socialTokens.colors.white} />}
      onEndReachedThreshold={0.6}
      onEndReached={onLoadMore}
      onScroll={(event) => { scrollTop.current = event.nativeEvent.contentOffset.y; }}
      scrollEventThrottle={16}
      ListHeaderComponent={mode === 'news' && (news || newsNotice) ? <NewsBlock items={news ?? []} notice={newsNotice} /> : null}
      ListFooterComponent={loadingMore ? <ActivityIndicator color={socialTokens.colors.white} style={styles.footer} /> : null}
      ListEmptyComponent={(
        <View style={styles.emptyBox}>
          <Text style={styles.empty}>{error || emptyNote}</Text>
          {error ? (
            <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
              <Text style={styles.retryText}>Reîncearcă</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={() => onModeChange(nextMode(mode))} style={styles.retry}>
            <Text style={styles.retryText}>{`Vezi ${socialTokens.feedModes.find((entry) => entry.id === nextMode(mode))?.title}`}</Text>
          </Pressable>
        </View>
      )}
      removeClippedSubviews={false}
    />
  );
}

/**
 * `nextFeedMode` of feed-surface.js:66-69: one place along the rail, wrapping at both ends, over the order
 * the rail itself prints (`socialTokens.feedModes`). An unknown mode falls back to the first reading, the
 * way the web's own `Math.max(0, …)` floor does, so a stale mode can never throw the rail away.
 */
export function nextMode(mode: FeedModeId, offset = 1): FeedModeId {
  const order: FeedModeId[] = socialTokens.feedModes.map((entry) => entry.id);
  const step = Number(offset || 0);
  return order[(Math.max(0, order.indexOf(mode)) + step + order.length) % order.length];
}

/** The headlines an allow-listed provider returned, or the provider's own reason for having none. */
function NewsBlock({ items, notice }: { items: NewsItem[]; notice: string }) {
  return (
    <View style={styles.news}>
      {notice ? <Text style={styles.newsNotice}>{notice}</Text> : null}
      {items.map((item, index) => (
        <Pressable
          key={`${item.url ?? 'news'}-${index}`}
          accessibilityRole="link"
          accessibilityLabel={item.title || 'Știre'}
          disabled={!item.url}
          onPress={() => { if (item.url) void Linking.openURL(item.url); }}
          style={styles.newsItem}
        >
          <Text style={styles.newsTitle}>{item.title}</Text>
          <Text style={styles.newsMeta}>{[item.source, relativeTime(item.published_at)].filter(Boolean).join(' · ')}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function FeedSkeleton() {
  return (
    <View style={styles.list}>
      {[0, 1, 2, 3].map((index) => (
        <View key={index} style={styles.skeletonCard}>
          <View style={styles.skeletonRow}>
            <View style={[styles.skeletonBlock, styles.skeletonAvatar]} />
            <View style={[styles.skeletonBlock, styles.skeletonName]} />
          </View>
          <View style={[styles.skeletonBlock, styles.skeletonMedia]} />
          <View style={[styles.skeletonBlock, styles.skeletonLine]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 10, paddingHorizontal: 10, paddingBottom: 24 },
  /** The surface the horizontal flick is read on: the whole body of the feed, above its own scrolling. */
  surface: { flex: 1 },
  footer: { paddingVertical: 16 },
  emptyBox: { alignItems: 'center', gap: 12, paddingTop: 60, paddingHorizontal: 24 },
  empty: { color: socialTokens.colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retry: {
    minHeight: 44, justifyContent: 'center', paddingHorizontal: 16,
    borderWidth: 1, borderColor: socialTokens.colors.markBorder, borderRadius: 14,
  },
  retryText: { color: socialTokens.colors.white, fontWeight: '700', fontSize: 13 },
  news: { gap: 10, marginBottom: 12 },
  newsNotice: { color: socialTokens.colors.muted, fontSize: 13, lineHeight: 19 },
  newsItem: {
    padding: 12, gap: 4, borderWidth: 1, borderColor: socialTokens.colors.postBorder,
    borderRadius: 14, backgroundColor: socialTokens.colors.cardSurface,
  },
  newsTitle: { color: socialTokens.colors.text, fontSize: 15, fontWeight: '700' },
  newsMeta: { color: socialTokens.colors.muted, fontSize: 12 },
  skeletonCard: {
    marginBottom: socialTokens.post.marginBottom, padding: socialTokens.post.padding,
    borderWidth: 1, borderColor: socialTokens.colors.postBorder,
    borderRadius: socialTokens.post.radius, backgroundColor: socialTokens.colors.postSurface, gap: 10,
  },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  skeletonBlock: { backgroundColor: '#131c25', borderRadius: 8 },
  skeletonAvatar: { width: 40, height: 40, borderRadius: 20 },
  skeletonName: { flex: 1, height: 14 },
  skeletonMedia: { width: '100%', height: 240, borderRadius: 12 },
  skeletonLine: { width: '70%', height: 14 },
});

