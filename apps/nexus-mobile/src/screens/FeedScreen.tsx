import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { blackSilver } from '../theme/blackSilver';
import {
  ActivityIndicator, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View,
  type NativeScrollEvent, type NativeSyntheticEvent, type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { nexusApi, NexusApiError } from '../lib/nexusApi';
import { usePostImpression } from '../lib/impressions';
import { rememberPayload } from '../lib/relations';
import { hasVisualMedia, isAuthoredArticle } from '../lib/postPresentation';
import type { FeedPage, NewsItem, SocialPost } from '../lib/socialTypes';
import { appNavHeight } from '../components/AppNav';
import { PostCard } from '../components/PostCard';
import { ReelPage } from '../components/ReelsReader';
import { editorial } from '../theme/editorial';

const PAGE_SIZE = 30;

/**
 * `t("feed.breakingDisabled")` and `t("feed.breakingDisabledDetail")` of the web, Romanian voice
 * (interface-locale.js:84), with the product's own name in the sentence (`test-brand.cjs`: no visible
 * string may still say "Nexus"). Kept — together with `NewsBlock` below — because the owner removed the
 * *button* that opened the news reading, not the news itself: the endpoint, the notice and its two
 * sentences stay in the app for the surface that will read them next.
 */
export const NEWS_DISABLED_TITLE = 'Știrile sunt pregătite, dar oprite';
export const NEWS_DISABLED_DETAIL = 'Nicio sursă nu a fost aprobată încă. Fără o decizie de owner pentru un agregator din lista aprobată, Jungle Book nu are de unde lua titluri reale — și nu inventează niciunul.';

/**
 * The Universal feed: one full-screen page per post.
 *
 * One request (`GET /api/social/feed?format=all`), one list, one decision per item taken by the one
 * classifier every surface shares (`hasVisualMedia` / `isAuthoredArticle`): a page that carries a
 * picture or a clip is the reader's immersive page (`ReelPage` — media edge to edge, actions up the
 * right rail), unless it is an authored article with photographs, which stays the editorial
 * composition (`PostCard`). A page of words is the editorial composition too. Both are
 * drawn by `PostCanvas`, and both own the *whole* viewport — the page is the post, so a swipe is one
 * uniform page of one size.
 *
 * Round 8 changed the page, on the owner's word:
 *
 *   no filter      the Toate · Postări · Reel-uri toggle is gone; the feed carries every type together;
 *   no bands       the page starts under the status clock and ends at the gesture bar, so a 9:16 post is
 *                  never fitted into a smaller 9:16 box inside a black page;
 *   no resize      the page height is the viewport, not `viewport − chrome`. The old code removed the tab
 *                  bar's band while a swipe was in flight, which resized every card mid-gesture: the
 *                  "content shrinks or grows" the owner saw. The band is now constant, and only the
 *                  words keep clear of it (`bottomInset`), so a post never moves when the bar leaves.
 *
 * Round 8, item 2 added a rule of the owner: a picture is read with the rail, exactly as a clip is — so the
 * immersive page is asked for by the *media*, not by the content type.
 *
 * Round 9 (20 October 2026) gave a page of words that same rail. The owner asked for the horizontal bar at
 * its foot to climb the right of the page — „zona cu reacții orizontală de jos, mutată vertical, exact la
 * fel ca la reels… același sistem de comentarii, de paletă" — and for the head of such a page to sit in the
 * notification band. Two consequences live here: every page now takes `onPanelChange` (the reaction panel
 * stops the pager, as on a reel), and the feed opens on the server's own first post again — the rule that
 * lifted a picture to the front (`openWithMedia`) existed only because a page of words had a bar where the
 * menu stands, and that bar is gone.
 *
 * Round 10 (20 October 2026) closed that band for good. The owner asked for the tab bar to stop
 * sliding away — "vreau sa faci footer ul sa nu mia dispara la scroll..va ramane permananet" — so there is
 * no vacated band to descend into, no clock to follow, and no `chromeHidden` to react to. Every page keeps
 * the same foot, the bar stands over it, and the words end above it (`bottomInset`): the feed takes no
 * props any more, because it has no chrome of its own left to move.
 *
 * Round 43 (31 October 2026) gave the page of **media** the head its neighbours already had. Until this
 * round the feed asked `ReelPage` for `layout="reel"`, which stamped the author above the caption at the
 * foot of the frame, while a page of words in the same feed and the same reel opened from a profile both
 * printed the author at the top. The owner asked for one rule: the head at the top, the caption at the
 * foot, everywhere — so this screen now asks for `layout="post"`, hands the notch in as `topInset` (the
 * number a page of words and the profile route use) and asks for the author's relation door, because the
 * page of words beside it has one. Nothing else about the page moved: the rail, the clip's clock, the
 * caption's `Citește tot`, the tab bar's band and the reactions are the same components they were.
 */
export function FeedScreen() {
  const insets = useSafeAreaInsets();
  /**
   * The band the floating tab bar owns at the foot of the page — a constant, because the bar is constant
   * (round 10). The media still runs under it, and the words, the actions and the rail end above it, so
   * nothing of a post is ever behind the glass and no page changes size for a swipe.
   */
  const navReserve = appNavHeight(insets.bottom);

  const url = useMemo(() => {
    const params = new URLSearchParams({ format: 'all', lens: 'for-you', limit: String(PAGE_SIZE) });
    return `/api/social/feed?${params.toString()}`;
  }, []);

  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);
  const requestId = useRef(0);
  /**
   * The page: the list's own height, measured once. It does not depend on the tab bar, on the header (the
   * feed has none) or on the item — that is what makes every swipe one page of one size.
   */
  const [pageHeight, setPageHeight] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  /**
   * A page whose reaction column is open stops the pager: the column's panel is chosen by dragging up
   * the page (`ReactionControl` → `ReelPage`), and the pager would take that drag at the native level.
   */
  const [paletteOpen, setPaletteOpen] = useState(false);
  const viewability = useMemo(() => ({ itemVisiblePercentThreshold: 60 }), []);

  const applyPage = useCallback((page: FeedPage, kind: 'initial' | 'more') => {
    setCursor(typeof page.next_cursor === 'string' ? page.next_cursor : null);
    setPosts((previous) => {
      if (kind === 'more') {
        const seen = new Set(previous.map((post) => post.id));
        return [...previous, ...(page.posts ?? []).filter((post) => !seen.has(post.id))];
      }
      /**
       * The server's order, untouched (`openWithMedia` is gone with the footer it existed for): the first
       * page of the feed may be a page of words now, because that page's presses climb the rail above the
       * menu instead of standing on it.
       */
      return page.posts ?? [];
    });
    setError('');
  }, []);

  const describe = useCallback((cause: unknown) => (cause instanceof NexusApiError && cause.status === 409
    ? 'Profilul Social nu este activ pe această sesiune.'
    : cause instanceof Error ? cause.message : 'Conexiunea nu este disponibilă.'), []);

  useEffect(() => {
    const ticket = ++requestId.current;
    let cancelled = false;
    nexusApi<FeedPage>(url)
      .then((page) => {
        if (cancelled || ticket !== requestId.current) return;
        rememberPayload(page);
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
      .then((page) => { if (ticket === requestId.current) { rememberPayload(page); applyPage(page, 'initial'); setLoadedUrl(url); } })
      .catch((cause) => { if (ticket === requestId.current) setError(describe(cause)); })
      .finally(() => { if (ticket === requestId.current) setRefreshing(false); });
  }, [applyPage, describe, url]);

  const onLoadMore = useCallback(() => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const ticket = requestId.current;
    nexusApi<FeedPage>(`${url}&cursor=${encodeURIComponent(cursor)}`)
      .then((page) => { if (ticket === requestId.current) { rememberPayload(page); applyPage(page, 'more'); } })
      .catch((cause) => { if (ticket === requestId.current) setError(describe(cause)); })
      .finally(() => { if (ticket === requestId.current) setLoadingMore(false); });
  }, [applyPage, cursor, describe, loadingMore, url]);

  const onRetry = useCallback(() => {
    setError('');
    setLoadedUrl(null);
    setReloadNonce((value) => value + 1);
  }, []);

  /**
   * Every post, in the order the server sent it, on the page the server's classifier gave it: a clip is
   * the reel (rail on the right), anything else is the editorial composition (actions under the words).
   * There is no slice any more — the owner removed the filter, so this list is the feed.
   */
  const visible = posts;

  /**
   * The page the reader has settled on. Only the index is read now: the tab bar is permanent (round 10),
   * so there is no chrome to hide on a forward swipe and none to bring back on the first page. The
   * gesture that carried that decision is gone, and the feed is a plain pager again.
   */
  const onMomentumEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageHeight <= 0) return;
    const index = Math.max(0, Math.round(event.nativeEvent.contentOffset.y / pageHeight));
    setActiveIndex(index);
  }, [pageHeight]);

  const onViewableItemsChanged = useCallback((info: { viewableItems: ViewToken[] }) => {
    const first = info.viewableItems.find((entry) => entry.isViewable);
    if (first && typeof first.index === 'number') setActiveIndex(first.index);
  }, []);

  /**
   * The page the reader is on is a view, and the only one this feed has to report: the ledger
   * (`lib/impressions.ts`) measures how long the page held the screen and sends it on the route the web
   * already uses. A feed that never reported a reading was why every count stayed at zero.
   */
  usePostImpression(visible[activeIndex]?.id);

  if (loadedUrl !== url) return <FeedSkeleton />;

  /**
   * The page is the post. Every item — a clip or a post — is drawn into exactly the viewport's height, and
   * the media is `cover` behind the composition, so the picture reaches the status clock at the top and the
   * gesture bar at the bottom. Nothing is fitted into a smaller 9:16 box inside a black page, because that
   * box was the band the owner saw, and a page whose height came from `viewport − chrome` was what made the
   * swipe resize the content.
   *
   * The only parts that keep clear of the device are the words: `topInset` for the notch and the status
   * clock, `bottomInset` for the floating tab bar and the gesture sign.
   */
  return (
    <View
      style={styles.surface}
      onLayout={(event) => {
        const { height } = event.nativeEvent.layout;
        setPageHeight((previous) => (previous === height ? previous : height));
      }}
    >
      <FlatList
        data={visible}
        keyExtractor={(post) => String(post.id)}
        pagingEnabled
        /** The reaction column of a page owns its own drag while its panel is open. */
        scrollEnabled={!paletteOpen}
        snapToInterval={pageHeight || undefined}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        getItemLayout={pageHeight ? (_, index) => ({ length: pageHeight, offset: pageHeight * index, index }) : undefined}
        onMomentumScrollEnd={onMomentumEnd}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewability}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={editorial.leaf} progressViewOffset={8} />}
        onEndReachedThreshold={0.8}
        onEndReached={onLoadMore}
        renderItem={({ item, index }) => {
          /**
           * A page with a picture or a clip is the reader's immersive page (`ReelPage`): the media covers
           * the viewport and the five actions climb the right rail, exactly as the owner reads a reel. An
           * authored text page (`text_style`) keeps the article composition even when it carries
           * photographs (`isAuthoredArticle`): the theme stays the page, the first picture is a bounded
           * block in the reading, and the words continue page by page. A page of words without media is
           * the same editorial composition (`PostCard`), which mounts that very rail (`PostRail`) over the
           * canvas.
           */
          const immersive = hasVisualMedia(item) && !isAuthoredArticle(item);
          const active = index === activeIndex;
          /** Nothing is drawn before the page has a height: a page of 0 is a flash of nothing. */
          if (!pageHeight) return null;
          return (
            <View style={[styles.page, { height: pageHeight }]}>
              {immersive ? (
                <ReelPage
                  post={item}
                  height={pageHeight}
                  overlayBottom={navReserve}
                  /**
                   * Round 43: the feed's page of media is read exactly like a page of words beside it, and
                   * exactly like the same reel opened from a profile. The head stands at the **top** of the
                   * frame (`layout="post"`), in the one arrangement the canvas draws for a page: the same
                   * 54dp face, the same 17dp name, the same `@handle`, the same place line and the same
                   * relation door — because it is the same block (`PostCanvas`), not a second one tuned for
                   * the feed. Until this round the feed asked for `reel`, which kept the author above the
                   * caption at the foot, so the same post had two different heads depending on where it was
                   * opened.
                   *
                   * `topInset` is the device's own notch, which is also the number the page of words and
                   * the profile route use (`readerPageTopInset` is the inset itself): the head of a page
                   * begins in the notification band on all three surfaces. The foot stays the feed's own,
                   * `overlayBottom={navReserve}` — the floating tab bar is a feed band and a profile route
                   * does not have it.
                   */
                  topInset={insets.top}
                  layout="post"
                  follow
                  active={active}
                  muted={muted}
                  onToggleMute={() => setMuted((value) => !value)}
                  onPanelChange={setPaletteOpen}
                />
              ) : (
                <PostCard
                  post={item}
                  height={pageHeight}
                  topInset={insets.top}
                  bottomInset={navReserve}
                  active={active}
                  onPanelChange={setPaletteOpen}
                />
              )}
            </View>
          );
        }}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={editorial.leaf} style={styles.footer} /> : null}
        ListEmptyComponent={(
          <View style={styles.emptyBox}>
            <Text style={styles.empty}>{error || 'Nu sunt postări de afișat.'}</Text>
            {error ? (
              <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
                <Text style={styles.retryText}>Reîncearcă</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}

/**
 * The headlines an allow-listed provider returned, or the provider's own notice when there is none.
 *
 * The notice is the two locale sentences the web prints (`feed.breakingDisabled*`), title over detail, in
 * the same plate a headline gets — the disabled source is a state of that reading, not an error under it.
 * It is exported and kept intact: round 6 removed the header button that opened the news reading, not the
 * reading itself, and the endpoint that feeds it is untouched.
 */
export function NewsBlock({ items, notice }: { items: NewsItem[]; notice: { title: string; detail: string } | null }) {
  return (
    <View style={styles.news}>
      {notice ? (
        <View style={styles.newsNoticeBox}>
          <Text style={styles.newsNoticeTitle}>{notice.title}</Text>
          <Text style={styles.newsNotice}>{notice.detail}</Text>
        </View>
      ) : null}
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
          <Text style={styles.newsMeta}>{[item.source, item.published_at].filter(Boolean).join(' · ')}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * The first page's shape: one full-bleed plate with the head and the foot of a post, so the real page
 * lands exactly where the skeleton stood. A pair of 9:16 cards would be a smaller page than the feed now
 * draws, which is the jump this plate exists to avoid.
 */
function FeedSkeleton() {
  return (
    <View style={styles.skeletonPage}>
      <View style={styles.skeletonRow}>
        <View style={[styles.skeletonBlock, styles.skeletonAvatar]} />
        <View style={[styles.skeletonBlock, styles.skeletonName]} />
      </View>
      <View style={styles.skeletonFill} />
      <View style={[styles.skeletonBlock, styles.skeletonLine]} />
      <View style={[styles.skeletonBlock, styles.skeletonActions]} />
    </View>
  );
}

const styles = StyleSheet.create({
  /** The surface the pages are measured in: the whole window, from the notch to the gesture sign. */
  surface: { flex: 1, backgroundColor: '#000000' },
  /** One item per page: the page *is* the post, so it carries no padding and no centring of its own. */
  page: { width: '100%', backgroundColor: '#000000', overflow: 'hidden' },
  footer: { paddingVertical: 16 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 120, paddingHorizontal: 28 },
  empty: { color: editorial.inkMuted, fontSize: 14, textAlign: 'center', lineHeight: 21 },
  emptyHint: { color: editorial.inkQuiet, fontSize: 12, textAlign: 'center' },
  retry: {
    minHeight: 44, justifyContent: 'center', paddingHorizontal: 18,
    borderWidth: 1, borderColor: editorial.leafEdge, borderRadius: 14,
    backgroundColor: editorial.leafFaint,
  },
  retryText: { color: editorial.ink, fontWeight: '800', fontSize: 13 },
  news: { gap: 10, marginBottom: 12 },
  newsNoticeBox: {
    padding: 12, gap: 4, borderWidth: 1, borderColor: editorial.hairline,
    borderRadius: 14, backgroundColor: editorial.cardTop,
  },
  newsNoticeTitle: { color: editorial.ink, fontSize: 15, fontWeight: '800' },
  newsNotice: { color: editorial.inkMuted, fontSize: 13, lineHeight: 19 },
  newsItem: {
    padding: 12, gap: 4, borderWidth: 1, borderColor: editorial.hairline,
    borderRadius: 14, backgroundColor: editorial.cardTop,
  },
  newsTitle: { color: editorial.ink, fontSize: 15, fontWeight: '700' },
  newsMeta: { color: editorial.inkMuted, fontSize: 12 },
  /**
   * The skeleton of a page: full bleed, with the author's row at the top and the words at the foot, in the
   * same safe insets the real composition uses. Nothing here is 9:16 — the page no longer is.
   */
  skeletonPage: {
    flex: 1, backgroundColor: blackSilver.matteBlack, paddingHorizontal: 14, paddingTop: 74, paddingBottom: 96, gap: 12,
  },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  skeletonBlock: { backgroundColor: '#1B2320', borderRadius: 8 },
  skeletonAvatar: { width: 40, height: 40, borderRadius: 20 },
  skeletonName: { width: 170, height: 14 },
  skeletonFill: { flex: 1, width: '100%', borderRadius: 18, backgroundColor: blackSilver.graphite },
  skeletonLine: { width: '64%', height: 14 },
  skeletonActions: { width: '100%', height: 38 },
});
