import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavReserve } from '../../components/AppNav';
import { PostCard } from '../../components/PostCard';
import { NexusApiError, nexusApi } from '../../lib/nexusApi';
import { normalizeTag } from '../../lib/tagNavigation';
import { rememberPayload } from '../../lib/relations';
import type { SocialPost, SocialTagPage } from '../../lib/socialTypes';
import { editorial, editorialType } from '../../theme/editorial';

/**
 * The tag's own page — what a `#subiect` in a post's words opens (owner's rule, 19 October 2026).
 *
 * It is the phone's answer to `.tagPageLayer` of the web (`app.js:4170-4210`): the same read
 * (`GET /api/social/tags/hashtag/:tag`), the same head — the tag, then "N postări · M persoane" from
 * `repo.tagStats`, never an invented number — and the same list, page by page (`next_before`). It is a
 * pushed route rather than a slot of the shell, so the feed it was opened from stays exactly where the
 * reader left it and the arrow back returns to that page.
 *
 * The words are the web's own (`interface-locale.js` `tags.*`, `search.more`), because a tag page is
 * read in the same voice as the caption that opened it.
 */
export default function TagRoute() {
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const value = normalizeTag(typeof tag === 'string' ? tag : '');
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {value
        ? <TagScreen key={value} tag={value} onBack={() => router.back()} />
        : <Text style={styles.error}>Tag indisponibil.</Text>}
    </View>
  );
}

function TagScreen({ tag, onBack }: { tag: string; onBack: () => void }) {
  const navReserve = useNavReserve();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [stats, setStats] = useState({ posts: 0, authors: 0 });
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  /** The server's own cursor, not a page number: `before` is the `created_at` of the last post read. */
  const read = useCallback(async (before: number | null) => {
    const cursor = before === null ? '' : `&before=${encodeURIComponent(String(before))}`;
    const page = await nexusApi<SocialTagPage>(
      `/api/social/tags/hashtag/${encodeURIComponent(tag)}?limit=20${cursor}`,
    );
    rememberPayload(page);
    return page;
  }, [tag]);

  /** What a refusal is worth to a reader: the shell's own sentence for a persona that is not Social. */
  const describe = (cause: unknown) => (cause instanceof NexusApiError && cause.status === 409
    ? 'Profilul Social nu este activ pe această sesiune.'
    : cause instanceof Error ? cause.message : 'Conexiunea nu este disponibilă.');

  /**
   * One read per mount: the route keys `TagScreen` by the tag itself, so a new tag is a new component
   * and `loading` already starts `true` — there is nothing to reset here, and setting it from the
   * effect would only be a state change the first render has already made.
   */
  useEffect(() => {
    let cancelled = false;
    read(null)
      .then((page) => {
        if (cancelled) return;
        setPosts(page.posts ?? []);
        setStats({ posts: Number(page.stats?.posts ?? 0), authors: Number(page.stats?.authors ?? 0) });
        setNextBefore(typeof page.next_before === 'number' ? page.next_before : null);
        setError('');
      })
      .catch((cause) => { if (!cancelled) setError(describe(cause)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [read]);

  const more = () => {
    if (nextBefore === null || loadingMore) return;
    setLoadingMore(true);
    read(nextBefore)
      .then((page) => {
        setPosts((previous) => {
          const seen = new Set(previous.map((post) => post.id));
          return [...previous, ...(page.posts ?? []).filter((post) => !seen.has(post.id))];
        });
        setNextBefore(typeof page.next_before === 'number' ? page.next_before : null);
        setError('');
      })
      .catch((cause) => setError(describe(cause)))
      .finally(() => setLoadingMore(false));
  };

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Înapoi" onPress={onBack} style={styles.back}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{`#${tag}`}</Text>
      </View>

      <View style={styles.head}>
        <Text style={styles.counts}>
          {`${stats.posts} ${stats.posts === 1 ? 'postare' : 'postări'} · ${stats.authors} ${stats.authors === 1 ? 'persoană' : 'persoane'}`}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={editorial.leaf} /></View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(post) => String(post.id)}
          contentContainerStyle={[styles.list, { paddingBottom: navReserve + 28 }]}
          renderItem={({ item }) => <PostCard post={item} />}
          ListEmptyComponent={(
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Nicio postare cu acest tag încă</Text>
              <Text style={styles.emptyDetail}>Tagul apare aici când cineva îl folosește.</Text>
            </View>
          )}
          ListFooterComponent={nextBefore !== null ? (
            <Pressable accessibilityRole="button" onPress={more} style={styles.more}>
              {loadingMore
                ? <ActivityIndicator color={editorial.leaf} />
                : <Text style={styles.moreText}>Mai multe rezultate</Text>}
            </Pressable>
          ) : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  backGlyph: { color: editorial.ink, fontSize: 26, lineHeight: 30, marginTop: -2 },
  title: { flex: 1, color: editorial.ink, ...editorialType.display, fontSize: 19 },
  head: {
    paddingHorizontal: 16, paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: editorial.hairline,
  },
  counts: { color: editorial.inkMuted, fontSize: 12, letterSpacing: 0.3 },
  list: { paddingTop: 12, paddingHorizontal: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  error: { color: editorial.danger, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  emptyBox: { alignItems: 'center', gap: 6, paddingTop: 64, paddingHorizontal: 24 },
  emptyTitle: { color: editorial.ink, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  emptyDetail: { color: editorial.inkMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  more: {
    minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4,
    borderWidth: 1, borderColor: editorial.leafEdge, borderRadius: 14, backgroundColor: editorial.leafFaint,
  },
  moreText: { color: editorial.leafInk, fontSize: 13, fontWeight: '800' },
});
