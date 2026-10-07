import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { nexusApi } from '../lib/nexusApi';
import type { ProfileResponse, SocialPost } from '../lib/socialTypes';
import { initialsFor, mediaKindOf, mediaSourceForPath, postMediaItems, reactionTotal } from '../lib/socialTypes';
import { PostCard } from '../components/PostCard';
import { RemoteImageSource } from '../components/PostMedia';
import { ProfileTicker } from '../components/ProfileTicker';
import { socialTokens } from '../theme/social';

/**
 * The five content tabs, as the web prints them: `CONTENT_TAB_GLYPHS` of `profile-experience.js:16`
 * (`{ flow:'≡', reels:'▶', shots:'▦', whispers:'❝', moments:'✦' }`), one icon per tab, and the word for
 * each one lives only in its label (`profile.tabFlow` = „Flux", `tabReels` = „Reels", `tabShots` =
 * „Fotografii", `tabWhispers` = „Șoapte", `tabMoments` = „Momente").
 */
const TABS = [
  { id: 'flow', label: 'Flux', glyph: '≡' },
  { id: 'reels', label: 'Reels', glyph: '▶' },
  { id: 'shots', label: 'Fotografii', glyph: '▦' },
  { id: 'whispers', label: 'Șoapte', glyph: '❝' },
  { id: 'moments', label: 'Momente', glyph: '✦' },
] as const;

/** `CONTENT_FILTERS` (`profile-experience.js:22`) with the labels `profile.filterNewest|Popular|Relevant`. */
const READINGS = [
  { id: 'newest', label: 'Cele mai noi' },
  { id: 'popular', label: 'Cele mai populare' },
  { id: 'relevant', label: 'Relevante pentru tine' },
] as const;

type TabId = typeof TABS[number]['id'];
type ReadingId = typeof READINGS[number]['id'];


/**
 * The owner profile, drawn with the values of profile-experience.css (.ownerCover 72px,
 * .ownerAvatar 78px with the monochrome Social border, .ownerHero on black) and filled from the
 * endpoint the web reads (`GET /api/profiles/:handle?persona=social`). The five content tabs are real
 * filters over the payload the server returns, so no tab is a button that pretends to do something.
 */
export function ProfileScreen({ handle, reloadKey = 0 }: { handle: string; reloadKey?: number }) {
  const address = `/api/profiles/${encodeURIComponent(handle)}?persona=social`;
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [tab, setTab] = useState<TabId>('flow');
  /** The web keeps one reading per tab (`readings` map of profile-experience.js:169). */
  const [readings, setReadings] = useState<Record<TabId, ReadingId>>({ flow: 'newest', reels: 'newest', shots: 'newest', whispers: 'newest', moments: 'newest' });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(0);
  const [attempted, setAttempted] = useState('');
  const key = `${address}#${reloadKey}#${pending}`;

  const describe = useCallback((cause: unknown) => (cause instanceof Error ? cause.message : 'Conexiunea nu este disponibilă.'), []);

  useEffect(() => {
    let cancelled = false;
    nexusApi<ProfileResponse>(address)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError('');
        setAttempted(key);
      })
      .catch((cause) => {
        if (cancelled) return;
        setError(describe(cause));
        setAttempted(key);
      });
    return () => { cancelled = true; };
  }, [address, describe, key]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    nexusApi<ProfileResponse>(address)
      .then((result) => { setData(result); setError(''); })
      .catch((cause) => setError(describe(cause)))
      .finally(() => setRefreshing(false));
  }, [address, describe]);

  const onRetry = useCallback(() => {
    setError('');
    setAttempted('');
    setPending((value) => value + 1);
  }, []);

  /** The tab filters the payload the server already returned, then its reading orders it (`applyOrder`). */
  const filtered = useMemo(() => filterTab(data?.posts ?? [], tab), [data, tab]);
  const ordered = useMemo(() => orderPosts(filtered, readings[tab]), [filtered, readings, tab]);

  if (attempted !== key && !data) {
    return <View style={styles.screen}><ActivityIndicator color={socialTokens.colors.white} style={styles.loader} /></View>;
  }

  const profile = data?.profile ?? null;
  /** The posts that carry media: the gallery a card hands the full-screen reader (app.js:4913). */
  const gallery = ordered.filter((post) => postMediaItems(post).length > 0);
  const readingLabel = READINGS.find((entry) => entry.id === readings[tab])?.label || READINGS[0].label;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={socialTokens.colors.white} />}
    >
      <View style={styles.cover}>
        <RemoteImageSource source={mediaSourceForPath(profile?.cover)} fit="cover" style={styles.coverImage} />
      </View>

      <View style={styles.hero}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            {mediaSourceForPath(profile?.avatar) ? (
              <RemoteImageSource source={mediaSourceForPath(profile?.avatar)} fit="cover" style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitials}>{initialsFor(profile?.name, profile?.handle)}</Text>
            )}
          </View>
          <View style={styles.identityText}>
            <Text style={styles.name} numberOfLines={2}>{profile?.name || profile?.handle || handle}</Text>
            <Text style={styles.sub} numberOfLines={1}>{`@${profile?.handle || handle}`}</Text>
            {profile?.location ? <Text style={styles.sub} numberOfLines={1}>{profile.location}</Text> : null}
          </View>
        </View>
        {profile ? <ProfileTicker profile={profile} /> : null}
      </View>

      {/**
       * `.ownerTabsRegion` + `nav.ownerContentTabs[role=tablist][aria-label="Conținut profil"]`: the bar
       * holds five icons and ends in the arrow that opens the readings of the tab the reader is on
       * (`profile-experience.js:443-453`).
       */}
      <View style={styles.tabsBlock}>
        <View style={styles.tabsRegion}>
          <View accessibilityRole="tablist" accessibilityLabel="Conținut profil" style={styles.tabs}>
            {TABS.map((entry) => (
              <Pressable
                key={entry.id}
                accessibilityRole="tab"
                accessibilityLabel={entry.label}
                accessibilityState={{ selected: tab === entry.id }}
                onPress={() => { setTab(entry.id); setFiltersOpen(false); }}
                style={[styles.tab, tab === entry.id && styles.tabOn]}
              >
                <Text accessible={false} style={[styles.tabGlyph, tab === entry.id && styles.tabGlyphOn]}>{entry.glyph}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Mod de citire: ${readingLabel}`}
            accessibilityState={{ expanded: filtersOpen }}
            onPress={() => setFiltersOpen((open) => !open)}
            style={styles.filtersToggle}
          >
            <Text style={[styles.filtersToggleGlyph, readings[tab] !== 'newest' && styles.filtersToggleOn]}>▾</Text>
          </Pressable>
        </View>

        {filtersOpen ? (
          <View accessibilityLabel="Filtre" style={styles.filters}>
            {READINGS.map((reading) => (
              <Pressable
                key={reading.id}
                accessibilityRole="button"
                accessibilityLabel={reading.label}
                accessibilityState={{ selected: readings[tab] === reading.id }}
                onPress={() => { setReadings((previous) => ({ ...previous, [tab]: reading.id })); setFiltersOpen(false); }}
                style={[styles.filterChip, readings[tab] === reading.id && styles.filterChipOn]}
              >
                <Text style={[styles.filterChipText, readings[tab] === reading.id && styles.filterChipTextOn]}>{reading.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>Profilul nu poate fi încărcat</Text>
          <Text style={styles.errorDetail}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
            <Text style={styles.retryText}>Reîncearcă</Text>
          </Pressable>
        </View>
      ) : null}

      {data?.locked && !error ? (
        <Text style={styles.locked}>
          {`@${profile?.handle || handle} are profilul restricționat (${profile?.visibility || 'privat'}).`}
        </Text>
      ) : null}

      {!error && !data?.locked && filtered.length === 0 ? <Text style={styles.empty}>Nimic aici încă.</Text> : null}

      <View style={styles.posts}>
        {ordered.map((post) => <PostCard key={post.id} post={post} gallery={gallery} />)}
      </View>
    </ScrollView>
  );
}

/**
 * `postOrderAttributes` + the three sorters of `applyOrder` (`profile-experience.js:495-503`):
 *   `profileStamp` = the post's own time; `profileScore` = reactions + comments + viewers;
 *   `profileRank` = how many reasons the feed gave it. Every reading falls back to the next one.
 */
function stampOf(post: SocialPost): number {
  return Math.max(0, Math.floor(Number(post.created_at) || 0));
}

function scoreOf(post: SocialPost): number {
  return reactionTotal(post.reactions)
    + Math.max(0, Number(post.comment_count) || 0)
    + Math.max(0, Number(post.view_stats?.viewers) || 0);
}

function rankOf(post: SocialPost): number {
  return Array.isArray(post.ranking?.reasons) ? post.ranking.reasons.length : 0;
}

function orderPosts(posts: SocialPost[], reading: ReadingId): SocialPost[] {
  const byNewest = (a: SocialPost, b: SocialPost) => stampOf(b) - stampOf(a);
  const byPopular = (a: SocialPost, b: SocialPost) => scoreOf(b) - scoreOf(a) || byNewest(a, b);
  const byRelevant = (a: SocialPost, b: SocialPost) => rankOf(b) - rankOf(a) || byPopular(a, b);
  const sorter = reading === 'popular' ? byPopular : reading === 'relevant' ? byRelevant : byNewest;
  return [...posts].sort(sorter);
}

/** The tab filters the payload the server already returned, reading the kind the media really has. */
function filterTab(posts: SocialPost[], tab: TabId): SocialPost[] {
  if (tab === 'flow') return posts;
  if (tab === 'reels') return posts.filter((post) => mediaKindOf(postMediaItems(post)[0]) === 'video');
  if (tab === 'shots') return posts.filter((post) => mediaKindOf(postMediaItems(post)[0]) === 'image');
  if (tab === 'whispers') return posts.filter((post) => postMediaItems(post).length === 0);
  return [];
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  content: { paddingBottom: 18 },
  loader: { marginTop: 80 },
  /** `.ownerCover{height:72px}` */
  cover: { height: 72, overflow: 'hidden', backgroundColor: '#091724' },
  coverImage: { width: '100%', height: 72 },
  /** `.ownerHero{padding:12px 14px 0}` on the black Social shell. */
  hero: { paddingTop: 12, paddingHorizontal: 14, backgroundColor: '#000000' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  /** `.phoneScreen:has(.accountScreen) .ownerAvatar` — 78px, white edge, #090a0c disc. */
  avatar: {
    width: 78,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    borderWidth: 2,
    borderColor: socialTokens.colors.white,
    borderRadius: 39,
    backgroundColor: '#090a0c',
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 37 },
  avatarInitials: { color: socialTokens.colors.white, fontSize: 24, fontWeight: '600' },
  identityText: { flex: 1, minWidth: 0, gap: 2 },
  name: { color: '#eef8fb', fontSize: 17, lineHeight: 20, fontWeight: '700' },
  sub: { color: '#9eacb5', fontSize: 12, lineHeight: 16 },
  /** The bar and the arrow are one region (`.ownerTabsRegion`), and the readings open anchored under them. */
  tabsBlock: { position: 'relative', marginTop: 12, backgroundColor: '#000000' },
  tabsRegion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.16)',
  },
  /** `.ownerContentTabs{display:grid;grid-template-columns:repeat(5,1fr);background:#000}` */
  tabs: { flex: 1, minWidth: 0, flexDirection: 'row' },
  /** `.ownerContentTabs button{min-height:46px;border-bottom:2px solid transparent;color:rgba(255,255,255,.62)}` */
  tab: {
    minHeight: 46,
    flexGrow: 1,
    flexBasis: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  /** `.ownerContentTabs button[aria-selected=true]{border-color:#fff;color:#fff}` */
  tabOn: { borderBottomColor: '#ffffff' },
  /** `.ownerContentTabs button i{font-style:normal;font-size:17px;line-height:1}` — the tab is an icon. */
  tabGlyph: { color: 'rgba(255,255,255,0.62)', fontSize: 17, lineHeight: 19 },
  tabGlyphOn: { color: '#ffffff' },
  /** `.ownerFiltersToggle{flex:0 0 44px;min-height:46px;color:#9fb2bb;font-size:13px}` */
  filtersToggle: { flexGrow: 0, flexBasis: 44, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  filtersToggleGlyph: { color: '#9fb2bb', fontSize: 13, lineHeight: 15 },
  /** `[aria-expanded=true],[data-reading=popular|relevant]{color:#67f5ed}` */
  filtersToggleOn: { color: '#67f5ed' },
  /** `.ownerContentFilters{top:100%;left:8px;flex-direction:column;gap:6px;min-width:190px;padding:8px;border:1px solid #26343d;border-radius:16px;background:#0b151d}` */
  filters: {
    position: 'absolute',
    zIndex: 6,
    top: '100%',
    right: 8,
    gap: 6,
    minWidth: 190,
    padding: 8,
    borderWidth: 1,
    borderColor: '#26343d',
    borderRadius: 16,
    backgroundColor: '#0b151d',
  },
  /** `.ownerContentFilters button{min-height:38px;padding:0 12px;border:1px solid #26343d;border-radius:14px;background:#0f1a23;color:#9fb2bb;font-size:12.5px}` */
  filterChip: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#26343d',
    borderRadius: 14,
    backgroundColor: '#0f1a23',
  },
  /** `button[aria-pressed=true]{border-color:#2fbdb3;background:#0d2a2c;color:#dff9f6}` */
  filterChipOn: { borderColor: '#2fbdb3', backgroundColor: '#0d2a2c' },
  filterChipText: { color: '#9fb2bb', fontSize: 12.5 },
  filterChipTextOn: { color: '#dff9f6' },
  posts: { paddingTop: 12, paddingHorizontal: 10 },
  empty: { color: socialTokens.colors.muted, fontSize: 13, textAlign: 'center', paddingTop: 30 },
  locked: { color: socialTokens.colors.muted, fontSize: 13, lineHeight: 19, padding: 18 },
  errorBox: { alignItems: 'center', gap: 10, paddingVertical: 40, paddingHorizontal: 24 },
  error: { color: socialTokens.colors.text, fontSize: 15, fontWeight: '700' },
  errorDetail: { color: socialTokens.colors.muted, fontSize: 13, textAlign: 'center' },
  retry: {
    minHeight: 44, justifyContent: 'center', paddingHorizontal: 16,
    borderWidth: 1, borderColor: socialTokens.colors.markBorder, borderRadius: 14,
  },
  retryText: { color: socialTokens.colors.white, fontWeight: '700', fontSize: 13 },
});

