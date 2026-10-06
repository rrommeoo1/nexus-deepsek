import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { nexusApi, NexusApiError } from '../lib/nexusApi';
import type { FeedPage, NewsItem, SocialPost } from '../lib/socialTypes';
import { relativeTime } from '../lib/socialTypes';
import { PostCard } from '../components/PostCard';
import { socialTokens } from '../theme/social';

const PAGE_SIZE = 30;

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

  if (loadedUrl !== url) return <FeedSkeleton />;

  return (
    <FlatList
      data={posts}
      keyExtractor={(post) => String(post.id)}
      renderItem={({ item }) => <PostCard post={item} />}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={socialTokens.colors.white} />}
      onEndReachedThreshold={0.6}
      onEndReached={onLoadMore}
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

export function nextMode(mode: FeedModeId): FeedModeId {
  const order: FeedModeId[] = ['reels', 'whispers', 'news'];
  return order[(order.indexOf(mode) + 1) % order.length];
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

