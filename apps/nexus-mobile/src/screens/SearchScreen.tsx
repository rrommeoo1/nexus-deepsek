import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { nexusApi } from '../lib/nexusApi';
import { PostCard } from '../components/PostCard';
import { RemoteImageSource } from '../components/PostMedia';
import { RelationButton } from '../components/RelationButton';
import { rememberPayload, useRelation } from '../lib/relations';
import {
  initialsFor, mediaSourceForPath, postMediaItems, type SearchProfile, type SocialSearchPage,
} from '../lib/socialTypes';
import { socialTokens } from '../theme/social';
import { openSocialProfile } from '../lib/profileNavigation';

/**
 * People and posts, read from the one endpoint the web search reads (`GET /api/social/search?q=`).
 * The server owns the rules (it refuses queries under two characters and rate limits), so the screen
 * mirrors them instead of inventing results: it asks for at least two characters, prints the server's
 * sentence when the query is refused, and shows each returned profile exactly as the payload carries
 * it. Nothing is cached between searches - a new query replaces the page.
 */
/**
 * `initialQuery` is the question the screen opens on. A place written on a profile is a reading with a
 * screen behind it, so the band's location door hands the search screen the text it already prints
 * (`openProfileTickerDoor` fills `social-search-input` and submits the form) instead of the reader
 * typing the city a second time.
 */
export function SearchScreen({ initialQuery = '' }: { initialQuery?: string } = {}) {
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState<SocialSearchPage | null>(null);
  const [asked, setAsked] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const describe = (cause: unknown) => (cause instanceof Error ? cause.message : 'Conexiunea nu este disponibilă.');

  const run = useCallback(async () => {
    const term = query.trim();
    if (term.replace(/^@/, '').length < 2) {
      setError('Scrie cel puțin 2 caractere pentru a căuta.');
      setPage(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await nexusApi<SocialSearchPage>(`/api/social/search?q=${encodeURIComponent(term)}`);
      /** The people this search answered with feed the one relation store (`lib/relations.ts`). */
      rememberPayload(result);
      setPage(result);
      setAsked(result.query || term);
    } catch (cause) {
      setError(describe(cause));
      setPage(null);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const posts = page?.posts ?? [];
  const profiles = page?.profiles ?? [];
  const empty = page !== null && posts.length === 0 && profiles.length === 0;
  /** The results that carry media: the gallery a card hands the full-screen reader (app.js:4913). */
  const gallery = posts.filter((post) => postMediaItems(post).length > 0);

  return (
    <View style={styles.screen}>
      <View style={styles.searchBar}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void run()}
          placeholder="Caută oameni sau conținut"
          placeholderTextColor={socialTokens.colors.muted}
          accessibilityLabel="Caută oameni și conținut"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Caută" onPress={() => void run()} style={styles.go}>
          <Text style={styles.goText}>Caută</Text>
        </Pressable>
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={socialTokens.colors.white} /></View> : null}
      {!loading && error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && empty ? <Text style={styles.empty}>{`Niciun rezultat pentru „${asked}”.`}</Text> : null}

      {!loading && !error && page && !empty ? (
        <FlatList
          data={posts}
          keyExtractor={(post) => String(post.id)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={profiles.length ? (
            <View style={styles.people}>
              {profiles.map((person) => <ProfileRow key={person.id} person={person} />)}
            </View>
          ) : null}
          renderItem={({ item }) => <PostCard post={item} gallery={gallery} />}
        />
      ) : null}
    </View>
  );
}

function ProfileRow({ person }: { person: SearchProfile }) {
  const avatar = mediaSourceForPath(person.avatar);
  const name = person.name || person.handle;
  /** The same record the profile and the lists print: one relation, one answer (`lib/relations.ts`). */
  const relation = useRelation(person.id);
  return (
    <View style={styles.person}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Profilul lui @${person.handle}`} onPress={() => openSocialProfile(person.handle)} style={styles.avatar}>
        <RemoteImageSource source={avatar} fit="cover" style={styles.avatarImage} />
        {!avatar ? <Text style={styles.avatarInitials}>{initialsFor(name, person.handle)}</Text> : null}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Profilul lui @${person.handle}`} onPress={() => openSocialProfile(person.handle)} style={styles.personText}>
        <Text style={styles.personName} numberOfLines={1}>{name}</Text>
        <Text style={styles.personMeta} numberOfLines={1}>{`@${person.handle}`}</Text>
      </Pressable>
      <RelationButton
        variant="compact"
        target={{ userId: person.id, handle: person.handle, name, persona: 'social' }}
        relation={relation}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  input: {
    flex: 1, minHeight: 44, paddingHorizontal: 14, borderRadius: 14, color: socialTokens.colors.text,
    backgroundColor: '#101a22', borderWidth: 1, borderColor: socialTokens.colors.markBorder, fontSize: 14,
  },
  go: { minHeight: 44, paddingHorizontal: 16, borderRadius: 14, justifyContent: 'center', borderWidth: 1, borderColor: socialTokens.colors.markBorder },
  goText: { color: socialTokens.colors.white, fontWeight: '700', fontSize: 13 },
  list: { paddingTop: 4, paddingBottom: 24, paddingHorizontal: 10 },
  people: { gap: 8, paddingBottom: 12 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  avatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: '#111820', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { color: socialTokens.colors.text, fontSize: 13, fontWeight: '800' },
  personText: { flex: 1, minWidth: 0 },
  personName: { color: socialTokens.colors.text, fontSize: 14, fontWeight: '700' },
  personMeta: { color: socialTokens.colors.muted, fontSize: 12, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: socialTokens.colors.text, fontSize: 14, paddingHorizontal: 18, paddingTop: 20 },
  empty: { color: socialTokens.colors.muted, fontSize: 13, paddingHorizontal: 18, paddingTop: 20 },
});
