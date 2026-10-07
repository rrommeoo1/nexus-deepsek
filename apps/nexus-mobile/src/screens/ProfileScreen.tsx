import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { nexusApi } from '../lib/nexusApi';
import type { ProfileResponse, SocialPost } from '../lib/socialTypes';
import { initialsFor, mediaKindOf, mediaSourceForPath, postMediaItems } from '../lib/socialTypes';
import { PostCard } from '../components/PostCard';
import { RemoteImageSource } from '../components/PostMedia';
import { ProfileTicker } from '../components/ProfileTicker';
import { socialTokens } from '../theme/social';

/** PROFILE_TABS of the server plus the label each one already prints. */
const TABS = [
  { id: 'flow', label: 'Flux' },
  { id: 'reels', label: 'Reels' },
  { id: 'shots', label: 'Fotografii' },
  { id: 'whispers', label: 'Șoapte' },
  { id: 'moments', label: 'Momente' },
] as const;

type TabId = typeof TABS[number]['id'];

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

  if (attempted !== key && !data) {
    return <View style={styles.screen}><ActivityIndicator color={socialTokens.colors.white} style={styles.loader} /></View>;
  }

  const profile = data?.profile ?? null;
  const posts = data?.posts ?? [];
  const filtered = filterTab(posts, tab);
  /** The posts that carry media: the gallery a card hands the full-screen reader (app.js:4913). */
  const gallery = filtered.filter((post) => postMediaItems(post).length > 0);

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

      <View style={styles.tabs}>
        {TABS.map((entry) => (
          <Pressable
            key={entry.id}
            accessibilityRole="tab"
            accessibilityLabel={entry.label}
            accessibilityState={{ selected: tab === entry.id }}
            onPress={() => setTab(entry.id)}
            style={styles.tab}
          >
            <Text style={[styles.tabText, tab === entry.id && styles.tabActive]}>{entry.label}</Text>
          </Pressable>
        ))}
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
        {filtered.map((post) => <PostCard key={post.id} post={post} gallery={gallery} />)}
      </View>
    </ScrollView>
  );
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
  tabs: {
    flexDirection: 'row',
    marginTop: 12,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.16)',
  },
  tab: { minHeight: 44, flexGrow: 1, flexBasis: 0, alignItems: 'center', justifyContent: 'center' },
  tabText: { color: 'rgba(255,255,255,0.62)', fontSize: 12, fontWeight: '700' },
  tabActive: { color: socialTokens.colors.white },
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

