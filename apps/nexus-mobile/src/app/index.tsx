import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader, headerFloats, type AppHeaderSwitch } from '../components/AppHeader';
import { AppNav } from '../components/AppNav';
import { FeedDrawer } from '../components/FeedDrawer';
import { NexusLandingBrand } from '../components/NexusLandingBrand';
import { NexusLogin } from '../components/NexusLogin';
import type { NavSlot } from '../components/NexusMark';
import { API_ORIGIN } from '../lib/apiOrigin';
import { nexusApi, NexusApiError } from '../lib/nexusApi';
import { clearSession, readSession, signInWithEmail, signOut } from '../lib/session';
import type { MeResponse } from '../lib/socialTypes';
import { mediaSourceForPath } from '../lib/socialTypes';
import { readUnreadTotal } from '../lib/unread';
import { FeedScreen, nextMode, type FeedModeId } from '../screens/FeedScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { LiveScreen } from '../screens/LiveScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { socialTokens, profileModules as socialModules } from '../theme/social';
import { nexusTokens } from '../theme/tokens';

/** The Android app version, read from app.json so the two numbers can never drift apart. */
const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

/**
 * The version of the release actually serving this account. The web client prints its own
 * `NEXUS_BUILD_VERSION` from the bundle on the same origin, so the app reads that number from that
 * origin instead of holding a copy that would go stale. When it cannot be read, nothing is shown:
 * a version is never invented.
 */
async function fetchBackendVersion(): Promise<string> {
  try {
    const response = await fetch(`${API_ORIGIN}/app.js`, { headers: { Accept: 'text/javascript' } });
    if (!response.ok) return '';
    const source = await response.text();
    return /NEXUS_BUILD_VERSION\s*=\s*"([0-9]+\.[0-9]+)"/.exec(source)?.[1] ?? '';
  } catch { return ''; }
}

/** A place one of the seven marks can name but that is not ported yet. It says so; it imitates nothing. */
function PendingScreen({ title, detail }: { title: string; detail: string }) {
  return (
    <ScrollView style={styles.pendingScreen} contentContainerStyle={styles.pendingContent}>
      <Text style={styles.pendingTitle}>{title}</Text>
      <Text style={styles.pendingDetail}>{detail}</Text>
    </ScrollView>
  );
}

export default function NativeHomeScreen() {
  const insets = useSafeAreaInsets();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [backendVersion, setBackendVersion] = useState('');
  const [slot, setSlot] = useState<NavSlot>('primary');
  const [feedMode, setFeedMode] = useState<FeedModeId>('reels');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileKey, setProfileKey] = useState(0);
  /** The count the bottom bar prints over the inbox mark; the two reads behind it live in lib/unread.ts. */
  const [unreadCount, setUnreadCount] = useState(0);
  const booted = useRef(false);

  const loadMe = useCallback(async (): Promise<MeResponse | null> => {
    try {
      const result = await nexusApi<MeResponse>('/api/me');
      setMe(result);
      setError('');
      return result;
    } catch (cause) {
      if (cause instanceof NexusApiError && cause.status === 401) {
        clearSession();
        setMe(null);
        setError('');
        return null;
      }
      setError(cause instanceof Error ? cause.message : 'Conexiunea nu este disponibilă.');
      return null;
    }
  }, []);

  /** The Social feed needs the Social profile active; this is the same switch the web performs. */
  const ensureSocialPersona = useCallback(async (current: MeResponse | null) => {
    if (!current || current.persona === 'social') return current;
    try {
      await nexusApi('/api/persona/switch', { method: 'POST', body: JSON.stringify({ persona: 'social' }) });
      return await loadMe();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Profilul nu a putut fi schimbat.');
      return current;
    }
  }, [loadMe]);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void (async () => {
      if (readSession()) await ensureSocialPersona(await loadMe());
      setBooting(false);
      void fetchBackendVersion().then(setBackendVersion);
    })();
  }, [ensureSocialPersona, loadMe]);

  // The two counters of the bar are read again whenever the account changes hands or a mark moves the
  // reader - the inbox empties while the reader is on it, so the bar has to be able to say so when they
  // come back. The web runs the same two reads on boot and after every persona switch (app.js:2416-2454),
  // and a read that fails keeps the last number the server gave instead of claiming an empty inbox.
  useEffect(() => {
    if (!me) return;
    let alive = true;
    void readUnreadTotal().then((total) => { if (alive && total !== null) setUnreadCount(total); });
    return () => { alive = false; };
  }, [me, slot]);

  const onSignIn = useCallback(async (email: string, password: string) => {
    setBusy(true); setError('');
    try {
      const result = await signInWithEmail(email.trim(), password);
      const current = await loadMe();
      if (!current) throw new Error(`Sesiunea pentru @${result.user.handle} nu a putut fi confirmată.`);
      await ensureSocialPersona(current);
    } catch (cause) {
      clearSession();
      setError(cause instanceof Error ? cause.message : 'Autentificarea a eșuat.');
    } finally { setBusy(false); }
  }, [ensureSocialPersona, loadMe]);

  const onLogout = useCallback(async () => {
    setDrawerOpen(false);
    setBusy(true);
    try { await signOut(); } finally {
      setMe(null);
      setSlot('primary');
      setBusy(false);
    }
  }, []);

  const onSelectModule = useCallback(async (persona: string) => {
    setDrawerOpen(false);
    if (persona === me?.persona) return;
    setBusy(true);
    try {
      await nexusApi('/api/persona/switch', { method: 'POST', body: JSON.stringify({ persona }) });
      await loadMe();
      if (persona === 'social') setSlot('primary');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Profilul nu a putut fi schimbat.');
    } finally { setBusy(false); }
  }, [loadMe, me?.persona]);

  // The nav avatar is the same `/media/…` path the feed pictures use, so it needs the same session
  // headers - without them the account disc stayed empty on the phone.
  const avatarSource = useMemo(() => mediaSourceForPath(me?.user?.avatar), [me?.user?.avatar]);

  const onSelectSlot = useCallback((next: NavSlot) => {
    if (next === 'create') { router.push('/camera'); return; }
    if (next === 'account') setProfileKey((value) => value + 1);
    setSlot(next);
  }, []);

  const onCycleFeedMode = useCallback(() => setFeedMode((current) => nextMode(current)), []);

  /**
   * `goHome()` - the wordmark, and the feed switch off it, land on the feed at its first reading. It sits
   * with the other callbacks, above the early returns, because a hook may not be reached on only some of
   * the renders: the boot line and the login line leave before the header is ever built.
   */
  const goHome = useCallback(() => { setSlot('primary'); setFeedMode('reels'); }, []);

  if (booting) {
    return (
      <View style={styles.boot}>
        <Text style={styles.bootText}>Se încarcă Nexus…</Text>
      </View>
    );
  }

  if (!me) {
    return (
      <SafeAreaView style={styles.loginScreen}>
        <NexusLogin
          brand={<NexusLandingBrand />}
          version={`Android ${APP_VERSION}${backendVersion ? ` · Backend ${backendVersion}` : ''}`}
          locale="ro"
          googleReady={false}
          facebookReady={false}
          walletNetwork="mainnet"
          busy={busy}
          error={error}
          onSignIn={(email, password) => void onSignIn(email, password)}
          onSignUp={() => setError('Crearea contului se face momentan în versiunea web; serverul închide înscrierea directă.')}
          onForgotPassword={() => setError('Recuperarea se face prin xPortal, conform serverului.')}
          onXPortal={() => setError('Conectarea xPortal nu este încă portată în aplicația Android.')}
          onProvider={() => setError('Google și Facebook nu sunt configurate pe server.')}
        />
      </SafeAreaView>
    );
  }

  const moduleTitle = socialModules.find((entry) => entry.id === me.persona)?.title ?? me.persona;
  /** The name the account gave the profile being read, which the first switch reads out (app.js:1436). */
  const profileName = me.profiles?.find((entry) => entry.persona === me.persona)?.name || moduleTitle;
  /** The reading the feed is on: the second switch of an off-feed bar names it (app.js:1404, 1418-1421). */
  const readingTitle = socialTokens.feedModes.find((entry) => entry.id === feedMode)?.title ?? feedMode;
  /** Only the feed wears `.appHeader.feedHeader`; the profile and the inbox wear no bar at all
   * (app.js:1397, 1416; profile-experience.css:1, social-human-ux.css:161). */
  const onFeed = me.persona === 'social' && slot === 'primary';
  /**
   * The switches of the off-feed bar, in the order the web prints them (app.js:1418-1421): the profile,
   * then the plate that names the feed and the plate that names the relations. Where the web opens a
   * sheet from a plate, this bar opens the one screen the app has for it - so the feed plate names the
   * reading the feed is on and lands on that feed, and the relations plate lands on the relations screen
   * rather than on a sheet of views the app does not have. The two plates are printed for the Social
   * shell only: behind the first mark of every other persona this app has the PendingScreen, and a plate
   * that offered a door to it would be offering nothing.
   */
  const offFeedSwitches: AppHeaderSwitch[] = [
    {
      key: 'mode',
      label: moduleTitle,
      accessibilityLabel: `Schimbă Nexus ${moduleTitle} · profil activ ${profileName}`,
      onPress: () => setDrawerOpen(true),
    },
    ...(me.persona === 'social' ? [
      {
        key: 'feed' as const,
        label: readingTitle,
        accessibilityLabel: `Schimbă feedul Social · ${readingTitle}`,
        onPress: goHome,
      },
      {
        key: 'friends' as const,
        label: 'Prieteni',
        accessibilityLabel: 'Deschide relațiile Social · Prieteni',
        onPress: () => setSlot('friends'),
      },
    ] : []),
  ];
  /**
   * The profile and the inbox wear no bar of this shell: `profile-experience.css:1` and
   * `social-human-ux.css:161` both hide `#phoneHeader` (`:has(.accountScreen)` / `:has(.inboxScreen)`),
   * and the inbox prints its own `.messengerTopbar` in the scroller instead.
   */
  const header = slot === 'account' || slot === 'inbox' ? null : onFeed ? (
    <AppHeader
      variant="feed"
      modeId={feedMode}
      topInset={headerFloats('feed', feedMode) ? insets.top : 0}
      build={backendVersion}
      onPressWordmark={goHome}
      onOpenDrawer={() => setDrawerOpen(true)}
      onCycleMode={onCycleFeedMode}
    />
  ) : (
    <AppHeader
      variant="screen"
      build={backendVersion}
      onPressWordmark={goHome}
      onOpenDrawer={() => setDrawerOpen(true)}
      switches={offFeedSwitches}
    />
  );
  /** Reels floats that bar over the clip, so it leaves the flow and the feed keeps the whole column. */
  const floatingHeader = onFeed && headerFloats('feed', feedMode);
  const screen = (() => {
    if (slot === 'account') return <ProfileScreen handle={me.user.handle} reloadKey={profileKey} />;
    if (slot === 'inbox') {
      /** `activePersonaRecord()` of the web: the shelf's first card is the reader's own record. */
      const shelfOwner = me.profiles?.find((entry) => entry.persona === me.persona) ?? me.profiles?.find((entry) => entry.persona === 'social');
      return (
        <MessagesScreen
          onHome={goHome}
          activePersona={me.persona}
          onSelectModule={(persona) => void onSelectModule(persona)}
          owner={{
            id: me.user.id,
            display_name: shelfOwner?.name || me.user.display_name || me.user.handle,
            handle: me.user.handle,
            avatar: shelfOwner?.avatar || me.user.avatar,
          }}
        />
      );
    }

    if (slot === 'friends') return <FriendsScreen />;
    if (slot === 'utility') return <LiveScreen />;
    if (slot === 'search') return <SearchScreen />;
    if (me.persona !== 'social') return <PendingScreen title={moduleTitle} detail="Acest modul nu este încă portat. Comută înapoi pe Social din sertarul de profil." />;
    return <FeedScreen mode={feedMode} onModeChange={setFeedMode} />;
  })();

  return (
    <SafeAreaView edges={floatingHeader ? [] : ['top']} style={styles.shell}>
      {floatingHeader ? (
        <View pointerEvents="box-none" style={styles.floatingHeader}>{header}</View>
      ) : header}
      <View style={styles.body}>{screen}</View>
      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void loadMe()}>
            <Text style={styles.errorRetry}>Reîncearcă</Text>
          </Pressable>
        </View>
      ) : null}
      <View pointerEvents="box-none" style={floatingHeader ? styles.immersiveNav : undefined}>
        <AppNav
          active={slot}
          onSelect={onSelectSlot}
          onOpenCreate={() => router.push('/camera')}
          avatarSource={avatarSource}
          unreadCount={unreadCount}
          immersive={floatingHeader}
        />
      </View>
      <FeedDrawer
        open={drawerOpen}
        activeModule={me.persona}
        onClose={() => setDrawerOpen(false)}
        onModule={(id) => void onSelectModule(id)}
        onLogout={() => void onLogout()}
        onNewPost={() => router.push('/camera')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /** `.phoneScreen:has(.appNav.social){background:#000}` */
  shell: { flex: 1, backgroundColor: '#000000' },
  /** `#phoneHeader` over a Reels feed: out of the flow, over the clip (feed-surface.css:96-98). */
  floatingHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40 },
  /** The 9:16 reel remains underneath the seven controls, all the way to the screen edge. */
  immersiveNav: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 40 },
  body: { flex: 1 },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000' },
  bootText: { color: socialTokens.colors.muted, fontSize: 14 },
  loginScreen: { flex: 1, backgroundColor: nexusTokens.colors.canvas },
  pendingScreen: { flex: 1, backgroundColor: '#000000' },
  pendingContent: { padding: 20, gap: 10 },
  pendingTitle: { color: socialTokens.colors.text, fontSize: 19, fontWeight: '800' },
  pendingDetail: { color: socialTokens.colors.muted, fontSize: 14, lineHeight: 21 },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#2a1119',
  },
  errorText: { flex: 1, color: '#ffd9de', fontSize: 12, lineHeight: 17 },
  errorRetry: { color: socialTokens.colors.white, fontWeight: '800', fontSize: 13 },
});



