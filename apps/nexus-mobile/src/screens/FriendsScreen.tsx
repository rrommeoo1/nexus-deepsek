import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { nexusApi } from '../lib/nexusApi';
import { RemoteImageSource } from '../components/PostMedia';
import {
  initialsFor, mediaSourceForPath, relativeTime,
  type FollowRequest, type FollowRequestsPage, type RelationPerson, type RelationsPage,
} from '../lib/socialTypes';
import { socialTokens } from '../theme/social';

/** The three panes the Friends mark opens. Requests first: it is the only one that can change state. */
const TABS = [
  { id: 'requests', label: 'Cereri' },
  { id: 'followers', label: 'Urmăritori' },
  { id: 'following', label: 'Urmărești' },
] as const;

type TabId = typeof TABS[number]['id'];

const describe = (cause: unknown) => (cause instanceof Error ? cause.message : 'Conexiunea nu este disponibilă.');

/**
 * The account's relations, drawn from the endpoints the web already reads: the pending requests
 * (`GET /api/follow/requests`, decided with `POST /api/follow/requests/:id/decision`) and the two
 * relation lists (`GET /api/social/relations`). Every press is a real call; the screen never shows a
 * person the server did not return, and it says so when the server has nothing (or refuses) instead
 * of filling the list with placeholders.
 */
export function FriendsScreen() {
  const [tab, setTab] = useState<TabId>('requests');
  const [requests, setRequests] = useState<FollowRequest[] | null>(null);
  const [people, setPeople] = useState<RelationPerson[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [loadedTab, setLoadedTab] = useState<TabId | null>(null);
  const [nonce, setNonce] = useState(0);

  // The read starts in the effect but every setState runs inside a promise callback, so nothing is
  // written to state synchronously while React runs the effect (the pattern the profile and the feed
  // already use). A tab change or a retry bumps `nonce` to run the same read again.
  useEffect(() => {
    let alive = true;
    const request = tab === 'requests'
      ? nexusApi<FollowRequestsPage>('/api/follow/requests?direction=incoming')
        .then((page) => { if (alive) { setRequests(page.requests ?? []); setError(''); setNotice(''); setLoadedTab(tab); } })
      : nexusApi<RelationsPage>(`/api/social/relations?kind=${tab}`)
        .then((page) => { if (alive) { setPeople(page.people ?? []); setError(''); setNotice(''); setLoadedTab(tab); } });
    request
      .catch((cause) => { if (alive) { setError(describe(cause)); setLoadedTab(tab); } })
      .finally(() => { if (alive) { setLoading(false); setRefreshing(false); } });
    return () => { alive = false; };
  }, [tab, nonce]);

  const reloadTab = () => { setError(''); setNotice(''); setLoading(true); setNonce((value) => value + 1); };
  const refreshTab = () => { setRefreshing(true); setNonce((value) => value + 1); };
  const showLoading = loading || loadedTab !== tab;

  const decide = useCallback(async (request: FollowRequest, decision: 'accept' | 'decline') => {
    setBusyId(request.id);
    setNotice('');
    try {
      await nexusApi(`/api/follow/requests/${request.id}/decision`, {
        method: 'POST', body: JSON.stringify({ decision }),
      });
      setRequests((previous) => (previous ?? []).filter((row) => row.id !== request.id));
      setNotice(decision === 'accept' ? 'Cererea a fost acceptată.' : 'Cererea a fost refuzată.');
    } catch (cause) {
      setNotice(describe(cause));
    } finally {
      setBusyId(null);
    }
  }, []);

  const toggleFollow = useCallback(async (person: RelationPerson, active: boolean) => {
    setBusyId(person.user_id);
    setNotice('');
    try {
      await nexusApi('/api/follow', {
        method: 'POST', body: JSON.stringify({ user_id: person.user_id, persona: 'social', active }),
      });
      // The list is a relation list, so a person who is no longer followed leaves it: the server,
      // not the screen, is the authority on who belongs here.
      setPeople((previous) => (previous ?? []).filter((row) => row.user_id !== person.user_id));
      setNotice(active ? `Urmărești @${person.handle}.` : `Nu mai urmărești @${person.handle}.`);
    } catch (cause) {
      setNotice(describe(cause));
    } finally {
      setBusyId(null);
    }
  }, []);

  const rows: (RelationPerson | FollowRequest)[] = tab === 'requests' ? (requests ?? []) : (people ?? []);

  return (
    <View style={styles.screen}>
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

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      {showLoading ? (
        <View style={styles.center}><ActivityIndicator color={socialTokens.colors.white} /></View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Reîncearcă" onPress={reloadTab} style={styles.retry}>
            <Text style={styles.retryText}>Reîncearcă</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList<RelationPerson | FollowRequest>
          data={rows}
          keyExtractor={(row) => String('id' in row ? row.id : row.user_id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshTab} tintColor={socialTokens.colors.white} />}
          ListEmptyComponent={<Text style={styles.empty}>{tab === 'requests' ? 'Nicio cerere în așteptare.' : 'Nimeni aici încă.'}</Text>}
          renderItem={({ item }) => (tab === 'requests'
            ? <RequestRow request={item as FollowRequest} busy={busyId === (item as FollowRequest).id} onDecide={decide} />
            : <PersonRow person={item as RelationPerson} busy={busyId === (item as RelationPerson).user_id} onFollow={toggleFollow} />)}
        />
      )}
    </View>
  );
}

function RequestRow({ request, busy, onDecide }: {
  request: FollowRequest;
  busy: boolean;
  onDecide: (request: FollowRequest, decision: 'accept' | 'decline') => void;
}) {
  const avatar = mediaSourceForPath(request.avatar);
  const name = request.name || request.handle || 'Nexus';
  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <RemoteImageSource source={avatar} fit="cover" style={styles.avatarImage} />
        {!avatar ? <Text style={styles.avatarInitials}>{initialsFor(name, request.handle)}</Text> : null}
      </View>
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.meta} numberOfLines={1}>{`@${request.handle ?? 'nexus'}${relativeTime(request.created_at) ? ` · ${relativeTime(request.created_at)}` : ''}`}</Text>
      </View>
      <View style={styles.rowActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Acceptă cererea de la @${request.handle ?? 'nexus'}`} disabled={busy} onPress={() => onDecide(request, 'accept')} style={[styles.pill, styles.pillPrimary]}>
          <Text style={styles.pillTextOn}>Acceptă</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Refuză cererea de la @${request.handle ?? 'nexus'}`} disabled={busy} onPress={() => onDecide(request, 'decline')} style={styles.pill}>
          <Text style={styles.pillText}>Refuză</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PersonRow({ person, busy, onFollow }: {
  person: RelationPerson;
  busy: boolean;
  onFollow: (person: RelationPerson, active: boolean) => void;
}) {
  const avatar = mediaSourceForPath(person.avatar);
  const name = person.name || person.handle;
  const following = person.relation === 'following';
  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <RemoteImageSource source={avatar} fit="cover" style={styles.avatarImage} />
        {!avatar ? <Text style={styles.avatarInitials}>{initialsFor(name, person.handle)}</Text> : null}
      </View>
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.meta} numberOfLines={1}>{`@${person.handle}${person.following_me ? ' · te urmărește' : ''}`}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={following ? `Nu mai urmări @${person.handle}` : `Urmărește @${person.handle}`}
        disabled={busy}
        onPress={() => onFollow(person, !following)}
        style={[styles.pill, following && styles.pillQuiet]}
      >
        <Text style={following ? styles.pillText : styles.pillTextOn}>{following ? 'Urmărești' : 'Urmărește'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.16)' },
  tab: { minHeight: 44, flexGrow: 1, flexBasis: 0, alignItems: 'center', justifyContent: 'center' },
  tabText: { color: 'rgba(255,255,255,0.62)', fontSize: 12, fontWeight: '700' },
  tabActive: { color: socialTokens.colors.white },
  notice: { color: socialTokens.colors.muted, fontSize: 12, paddingHorizontal: 14, paddingTop: 10 },
  list: { paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: '#111820', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { color: socialTokens.colors.text, fontSize: 14, fontWeight: '800' },
  rowText: { flex: 1, minWidth: 0 },
  name: { color: socialTokens.colors.text, fontSize: 14, fontWeight: '700' },
  meta: { color: socialTokens.colors.muted, fontSize: 12, marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 8 },
  pill: { minHeight: 36, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center', borderWidth: 1, borderColor: socialTokens.colors.markBorder },
  pillPrimary: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  pillQuiet: { backgroundColor: 'transparent' },
  pillText: { color: socialTokens.colors.white, fontSize: 13, fontWeight: '700' },
  pillTextOn: { color: '#050608', fontSize: 13, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  error: { color: socialTokens.colors.text, fontSize: 14, textAlign: 'center' },
  empty: { color: socialTokens.colors.muted, fontSize: 13, textAlign: 'center', paddingTop: 40 },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: socialTokens.colors.markBorder, borderRadius: 14 },
  retryText: { color: socialTokens.colors.white, fontWeight: '700', fontSize: 13 },
});


