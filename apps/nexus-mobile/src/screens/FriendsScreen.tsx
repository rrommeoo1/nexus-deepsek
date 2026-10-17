import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { nexusApi } from '../lib/nexusApi';
import { RemoteImageSource } from '../components/PostMedia';
import {
  decideFollowRequest, relationErrorMessage, relationsSnapshot, remember, rememberPayload,
  subscribeRelations, useRelation,
} from '../lib/relations';
import { RelationButton } from '../components/RelationButton';
import {
  initialsFor, mediaSourceForPath, relativeTime,
  type FollowRequest, type FollowRequestsPage, type RelationPerson, type RelationsPage,
} from '../lib/socialTypes';
import { socialTokens } from '../theme/social';
import { openSocialProfile } from '../lib/profileNavigation';

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
/**
 * `initialTab` is the tab the screen opens on. The profile band's counters are doors and the sheet they
 * open opens on the count that was pressed (`openProfileTickerDoor` sets `socialFriendView = action`
 * before it shows the sheet), so the host hands the screen the reading instead of the screen guessing one.
 */
export function FriendsScreen({ initialTab = 'requests' }: { initialTab?: TabId } = {}) {
  const [tab, setTab] = useState<TabId>(initialTab);
  const [requests, setRequests] = useState<FollowRequest[] | null>(null);
  const [people, setPeople] = useState<RelationPerson[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [loadedTab, setLoadedTab] = useState<TabId | null>(null);
  const [nonce, setNonce] = useState(0);
  /** Whether this screen is the one reading right now, so its own payload cannot trigger another read. */
  const reading = useRef(false);

  // The read starts in the effect but every setState runs inside a promise callback, so nothing is
  // written to state synchronously while React runs the effect (the pattern the profile and the feed
  // already use). A tab change or a retry bumps `nonce` to run the same read again.
  useEffect(() => {
    let alive = true;
    reading.current = true;
    const request = tab === 'requests'
      ? nexusApi<FollowRequestsPage>('/api/follow/requests?direction=incoming')
        .then((page) => {
          if (!alive) return;
          /**
           * Both panes feed the one relation store (`lib/relations.ts`). A request row is not a person row:
           * its `id` is the request's, and the person who asked is `requester_id`, who is not a follower yet —
           * that is exactly what the accepted row means (`repo.js:1884`). So the record learns the person, and
           * the request itself stays this screen's own queue.
           */
          for (const row of page.requests ?? []) {
            remember({ userId: Number(row.requester_id), followsMe: false, requested: false });
          }
          setRequests(page.requests ?? []);
          setError('');
          setNotice('');
          setLoadedTab(tab);
        })
      : nexusApi<RelationsPage>(`/api/social/relations?kind=${tab}`)
        .then((page) => {
          if (!alive) return;
          rememberPayload(page);
          setPeople(page.people ?? []);
          setError('');
          setNotice('');
          setLoadedTab(tab);
        });
    request
      .catch((cause) => { if (alive) { setError(describe(cause)); setLoadedTab(tab); } })
      .finally(() => { reading.current = false; if (alive) { setLoading(false); setRefreshing(false); } });
    return () => { alive = false; };
  }, [tab, nonce]);

  const reloadTab = () => { setError(''); setNotice(''); setLoading(true); setNonce((value) => value + 1); };
  const refreshTab = () => { setRefreshing(true); setNonce((value) => value + 1); };
  const showLoading = loading || loadedTab !== tab;

  /**
   * The two answers to a request that came in, through the store (`lib/relations.ts`): the same call the
   * notifications list and every other screen uses, with the record written under the finger and the server's
   * answer replacing it. Accepting is what makes them a follower of mine (`repo.js:1884`).
   */
  const decide = useCallback(async (request: FollowRequest, decision: 'accept' | 'decline') => {
    setBusyId(request.id);
    setNotice('');
    try {
      await decideFollowRequest({ requestId: request.id, userId: Number(request.requester_id), persona: 'social' }, decision);
      setRequests((previous) => (previous ?? []).filter((row) => row.id !== request.id));
      setNotice(decision === 'accept' ? 'Cererea a fost acceptată.' : 'Cererea a fost refuzată.');
    } catch (cause) {
      setNotice(relationErrorMessage(cause));
    } finally {
      setBusyId(null);
    }
  }, []);

  /**
   * The server is the authority on who belongs to a relation list, so a change that lands anywhere reloads the
   * pane the reader is on. Two guards keep this honest and cheap: a read of this screen's own does not trigger
   * another read (the store is written by the payload that just arrived), and a record that still carries its
   * action in flight waits for the reconciled write.
   */
  useEffect(() => subscribeRelations(() => {
    if (reading.current || tab === 'requests') return;
    if (relationsSnapshot().some((record) => record.busy)) return;
    setNonce((value) => value + 1);
  }), [tab]);
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
            : <PersonRow person={item as RelationPerson} />)}
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
  const name = request.name || request.handle || 'Jungle Book';
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Profilul lui @${request.handle}`} onPress={() => openSocialProfile(request.handle)} style={styles.avatar}>
        <RemoteImageSource source={avatar} fit="cover" style={styles.avatarImage} />
        {!avatar ? <Text style={styles.avatarInitials}>{initialsFor(name, request.handle)}</Text> : null}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Profilul lui @${request.handle}`} onPress={() => openSocialProfile(request.handle)} style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.meta} numberOfLines={1}>{`@${request.handle ?? 'junglebook'}${relativeTime(request.created_at) ? ` · ${relativeTime(request.created_at)}` : ''}`}</Text>
      </Pressable>
      <View style={styles.rowActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Acceptă cererea de la @${request.handle ?? 'junglebook'}`} disabled={busy} onPress={() => onDecide(request, 'accept')} style={[styles.pill, styles.pillPrimary]}>
          <Text style={styles.pillTextOn}>Acceptă</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Refuză cererea de la @${request.handle ?? 'junglebook'}`} disabled={busy} onPress={() => onDecide(request, 'decline')} style={styles.pill}>
          <Text style={styles.pillText}>Refuză</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** One person of a relation list, with the app's one relation button in its compact shape. */
function PersonRow({ person }: { person: RelationPerson }) {
  /** The record the store holds for this account — the same one the profile and the feed print. */
  const relation = useRelation(person.user_id);
  const avatar = mediaSourceForPath(person.avatar);
  const name = person.name || person.handle;
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Profilul lui @${person.handle}`} onPress={() => openSocialProfile(person.handle)} style={styles.avatar}>
        <RemoteImageSource source={avatar} fit="cover" style={styles.avatarImage} />
        {!avatar ? <Text style={styles.avatarInitials}>{initialsFor(name, person.handle)}</Text> : null}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Profilul lui @${person.handle}`} onPress={() => openSocialProfile(person.handle)} style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.meta} numberOfLines={1}>{`@${person.handle}${person.following_me ? ' · te urmărește' : ''}`}</Text>
      </Pressable>
      <RelationButton
        variant="compact"
        target={{ userId: person.user_id, handle: person.handle, name, persona: 'social' }}
        relation={relation}
      />
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


