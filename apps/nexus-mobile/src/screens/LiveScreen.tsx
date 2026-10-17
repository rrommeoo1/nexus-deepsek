import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { nexusApi } from '../lib/nexusApi';
import { RemoteImageSource } from '../components/PostMedia';
import { RelationButton } from '../components/RelationButton';
import { rememberPayload, useRelation } from '../lib/relations';
import { compactCount, initialsFor, mediaSourceForPath, type LivePage, type LiveSession } from '../lib/socialTypes';
import { socialTokens } from '../theme/social';
import { openSocialProfile } from '../lib/profileNavigation';

const describe = (cause: unknown) => (cause instanceof Error ? cause.message : 'Conexiunea nu este disponibilă.');

/**
 * The Live tab, read from `GET /api/social/live`. The endpoint answers with the sessions that are
 * really broadcasting, the creators who could host, and its own `transport` block - which on this
 * server says `GATED_NO_SFU`: there is no media server, so a session can be listed but a stream cannot
 * be watched. The screen prints that reason verbatim instead of showing a player that would show black.
 */
export function LiveScreen() {
  const [page, setPage] = useState<LivePage | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);

  // The read starts in the effect, but every setState runs inside a promise callback, so nothing is
  // written to state synchronously while React runs the effect (the pattern the profile and the feed
  // already use). Retry and refresh bump `nonce` to run the same read again.
  useEffect(() => {
    let alive = true;
    nexusApi<LivePage>('/api/social/live')
      .then((result) => {
        if (!alive) return;
        /** The hosts and creators carry `is_following`, so the store learns them from the same read. */
        rememberPayload(result);
        setPage(result);
        setError('');
      })
      .catch((cause) => { if (alive) setError(describe(cause)); })
      .finally(() => { if (alive) { setLoading(false); setRefreshing(false); } });
    return () => { alive = false; };
  }, [nonce]);

  const reload = () => { setError(''); setLoading(true); setNonce((value) => value + 1); };
  const refresh = () => { setRefreshing(true); setNonce((value) => value + 1); };

  if (loading) return <View style={styles.center}><ActivityIndicator color={socialTokens.colors.white} /></View>;

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Reîncearcă" onPress={reload} style={styles.retry}>
          <Text style={styles.retryText}>Reîncearcă</Text>
        </Pressable>
      </View>
    );
  }

  const live = page?.live ?? [];
  const creators = page?.creators ?? [];
  const transport = page?.transport;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={socialTokens.colors.white} />}
    >
      {transport && transport.public_broadcast !== true ? (
        <Text style={styles.gate}>
          {`Transmisiunea publică nu este configurată pe server (${transport.status ?? 'gated'}). Sesiunile de mai jos sunt reale; redarea live se activează când providerul este conectat.`}
        </Text>
      ) : null}

      <Text style={styles.sectionTitle}>Acum live</Text>
      {live.length === 0 ? <Text style={styles.empty}>Nicio transmisiune activă.</Text> : live.map((session) => <LiveRow key={`live-${session.id}`} session={session} viewers={session.organic_viewers} />)}

      <Text style={styles.sectionTitle}>Creatori</Text>
      {creators.length === 0 ? <Text style={styles.empty}>Niciun creator de afișat.</Text> : creators.map((creator) => <LiveRow key={`creator-${creator.user_id ?? creator.id}`} session={creator} viewers={creator.qualified_followers} followersLabel />)}
    </ScrollView>
  );
}

function LiveRow({ session, viewers, followersLabel = false }: { session: LiveSession; viewers?: number; followersLabel?: boolean }) {
  const avatar = mediaSourceForPath(session.avatar);
  const name = session.display_name || session.handle || 'Jungle Book';
  const count = compactCount(viewers);
  /**
   * A live host is somebody else's account, so the same relation button the profile prints stands here:
   * the live payload carries `is_following` for every session and the store keeps it
   * (`LiveSession.is_following`, `api.js` — `/api/social/live`).
   */
  const hostId = Number(session.host_id ?? session.user_id) || null;
  const relation = useRelation(hostId);
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Profilul lui @${session.handle}`} onPress={() => openSocialProfile(session.handle)} style={styles.avatar}>
        <RemoteImageSource source={avatar} fit="cover" style={styles.avatarImage} />
        {!avatar ? <Text style={styles.avatarInitials}>{initialsFor(name, session.handle)}</Text> : null}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Profilul lui @${session.handle}`} onPress={() => openSocialProfile(session.handle)} style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[`@${session.handle ?? 'junglebook'}`, count ? `${count} ${followersLabel ? 'urmăritori' : 'spectatori'}` : ''].filter(Boolean).join(' · ')}
        </Text>
      </Pressable>
      {session.title ? <Text style={styles.title} numberOfLines={1}>{session.title}</Text> : null}
      {hostId ? (
        <RelationButton
          variant="compact"
          target={{ userId: hostId, handle: session.handle, name, persona: 'social' }}
          relation={relation}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  content: { padding: 14, gap: 10 },
  gate: { color: socialTokens.colors.muted, fontSize: 12, lineHeight: 18 },
  sectionTitle: { color: socialTokens.colors.white, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', marginTop: 8 },
  empty: { color: socialTokens.colors.muted, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: '#111820', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { color: socialTokens.colors.text, fontSize: 14, fontWeight: '800' },
  rowText: { flex: 1, minWidth: 0 },
  name: { color: socialTokens.colors.text, fontSize: 14, fontWeight: '700' },
  meta: { color: socialTokens.colors.muted, fontSize: 12, marginTop: 2 },
  title: { color: socialTokens.colors.muted, fontSize: 12, maxWidth: 120, textAlign: 'right' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24, backgroundColor: '#000000' },
  error: { color: socialTokens.colors.text, fontSize: 14, textAlign: 'center' },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: socialTokens.colors.markBorder, borderRadius: 14 },
  retryText: { color: socialTokens.colors.white, fontWeight: '700', fontSize: 13 },
});
