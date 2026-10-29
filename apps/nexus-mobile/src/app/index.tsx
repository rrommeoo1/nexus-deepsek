import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader, type AppHeaderSwitch } from '../components/AppHeader';
import { AppNav } from '../components/AppNav';
import { JungleBackdrop } from '../components/JungleBackdrop';
import { NexusLandingBrand } from '../components/NexusLandingBrand';
import { NexusLogin } from '../components/NexusLogin';
import { XPortalSheet } from '../components/XPortalSheet';
import type { NavSlot } from '../components/NexusMark';
import type { TickerDoor } from '../components/ProfileTicker';
import type { InboxBox } from '../lib/messageSearch';
import { API_ORIGIN, apiOriginLabel } from '../lib/apiOrigin';
import { nexusApi, NexusApiError } from '../lib/nexusApi';
import { openSocialProfile } from '../lib/profileNavigation';
import {
  clearSession, readAuthCapabilities, readSession, registerEmailAccount, registerWithLocalAccount,
  requestEmailPasswordReset, resetLocalPassword,
  signInWithEmail, signOut, type AuthCapabilities, type LoginResult,
} from '../lib/session';
import { validateLocalAccountDraft, type LocalAccountDraft } from '../lib/loginFields';
import { validateEmailRegistrationDraft } from '../lib/emailAuth';
import { PasswordRecoverySheet } from '../components/PasswordRecoverySheet';
import type { MeResponse } from '../lib/socialTypes';
import { mediaSourceForPath } from '../lib/socialTypes';
import { readUnreadTotal } from '../lib/unread';
import { FeedScreen } from '../screens/FeedScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { LiveScreen } from '../screens/LiveScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { MonetizationScreen } from '../screens/MonetizationScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { WalletScreen } from '../screens/WalletScreen';
import { buildLine } from '../lib/buildStamp';
import { socialTokens, profileModules as socialModules } from '../theme/social';
import { editorial } from '../theme/editorial';
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
  const [me, setMe] = useState<MeResponse | null>(null);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /** The xPortal login sheet: the only surface that can turn a wallet signature into a session. */
  const [xportalOpen, setXportalOpen] = useState(false);
  const [backendVersion, setBackendVersion] = useState('');
  const [slot, setSlot] = useState<NavSlot>('primary');
  /**
   * The screens the profile menu opens (`lib/profileMenu.ts`): the wallet on one of its two halves, the
   * monetisation and the settings. `null` means the shell is showing its own slot.
   */
  const [ownerPanel, setOwnerPanel] = useState<'monetize' | 'wallet' | 'income' | 'spending' | 'settings' | null>(null);
  const [profileKey, setProfileKey] = useState(0);
  /**
   * What the band's doors carry into the screens they open. The web keeps both of these as its own last
   * reading (`socialFriendView`, the search box), so the phone hands them over the same way: the tab the
   * counters open on, and the question the place opens with.
   */
  const [friendsTab, setFriendsTab] = useState<'requests' | 'followers' | 'following'>('requests');
  const [searchQuery, setSearchQuery] = useState('');
  /**
   * Which box the inbox opens on. The drawer's bell is a door to the account's activity, and the inbox
   * owns that surface (`ActivityCenter`, `GET /api/notifications`), so the shell carries the box the
   * reader asked for and the ordinary inbox marks reset it to the conversations.
   */
  const [inboxBox, setInboxBox] = useState<InboxBox>('inbox');
  /** The count the bottom bar prints over the inbox mark; the two reads behind it live in lib/unread.ts. */
  const [unreadCount, setUnreadCount] = useState(0);
  /**
   * What this backend can do for a login (`lib/session.ts` `readAuthCapabilities`): `null` until the
   * question is answered, so the screen never offers a flow the server would refuse.
   */
  const [authCapabilities, setAuthCapabilities] = useState<AuthCapabilities | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryDone, setRecoveryDone] = useState('');
  const [recoveryMode, setRecoveryMode] = useState<'local' | 'email'>('local');
  const [signupError, setSignupError] = useState('');
  const [signupStatus, setSignupStatus] = useState('');
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
      // Asked on every boot, session or not: the answer is what decides whether the login screen offers
      // "Creează cont" and "Ai uitat parola?" as working flows or says plainly that it cannot.
      void readAuthCapabilities().then(setAuthCapabilities);
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

  /**
   * "Creează cont" — the flow this server says it has (`/api/auth-capabilities`).
   *
   * A local development server creates the account with a handle and no mail (`/auth/local/register`,
   * round 36). A server with a mail provider creates it with an address and sends the confirmation
   * (`/auth/email/register`, round 37) — and in that case the app deliberately does **not** pretend the
   * person is signed in: production refuses to sign in an address it has never confirmed, so the screen
   * says what to do next instead of dropping into a session that cannot exist.
   */
  const onSignUp = useCallback(async (draft: LocalAccountDraft) => {
    setSignupError(''); setError(''); setSignupStatus('');
    const emailFlow = authCapabilities?.registration === 'email' && Boolean(authCapabilities?.email?.configured);
    if (emailFlow) {
      const complaint = validateEmailRegistrationDraft('ro', draft);
      if (complaint) { setSignupError(complaint); return; }
      setBusy(true);
      try {
        const result = await registerEmailAccount(draft);
        const name = result.user?.handle ? `@${result.user.handle}` : 'contul';
        setSignupStatus(result.verification?.sent
          ? `${name} a fost creat. Verifică emailul, confirmă adresa, apoi intră în cont.`
          : `${name} a fost creat, dar mesajul de confirmare nu a plecat. Cere-l din nou.`);
      } catch (cause) {
        setSignupError(cause instanceof Error ? cause.message : 'Contul nu a putut fi creat.');
      } finally { setBusy(false); }
      return;
    }
    const complaint = validateLocalAccountDraft('ro', draft);
    if (complaint) { setSignupError(complaint); return; }
    setBusy(true);
    try {
      const result = await registerWithLocalAccount(draft);
      const current = await loadMe();
      if (!current) throw new Error(`Contul @${result.user.handle} a fost creat, dar sesiunea nu a putut fi confirmată.`);
      await ensureSocialPersona(current);
    } catch (cause) {
      clearSession();
      setSignupError(cause instanceof Error ? cause.message : 'Contul nu a putut fi creat.');
    } finally { setBusy(false); }
  }, [authCapabilities, ensureSocialPersona, loadMe]);

  /**
   * The recovery sheet's email submit (round 37): the server mails a single-use link and answers the
   * same for any address, so the sheet repeats that sentence instead of claiming more than the server
   * knows. The password is not touched here at all.
   */
  const onSubmitRecoveryEmail = useCallback(async (email: string) => {
    setRecoveryBusy(true); setRecoveryError(''); setRecoveryDone('');
    try {
      await requestEmailPasswordReset(email);
      setRecoveryDone('Dacă adresa are un cont cu parolă, linkul de resetare a plecat. Verifică inboxul; linkul expiră în 30 de minute.');
    } catch (cause) {
      setRecoveryError(cause instanceof Error ? cause.message : 'Linkul nu a putut fi cerut.');
    } finally { setRecoveryBusy(false); }
  }, []);

  /**
   * The recovery sheet's submit. The server is the only authority: it names the handle it changed, or
   * says why it refused (unknown account, account without a password). Its sentence is printed verbatim.
   */
  const onSubmitRecovery = useCallback(async (identifier: string, password: string) => {
    setRecoveryBusy(true); setRecoveryError(''); setRecoveryDone('');
    try {
      const changed = await resetLocalPassword(identifier, password);
      setMe(null);
      setError('');
      setRecoveryDone(changed.handle
        ? `Parola pentru @${changed.handle} a fost schimbată. Intră cu parola nouă.`
        : 'Parola a fost schimbată. Intră cu parola nouă.');
    } catch (cause) {
      setRecoveryError(cause instanceof Error ? cause.message : 'Parola nu a putut fi schimbată.');
    } finally { setRecoveryBusy(false); }
  }, []);

  /**
   * A finished xPortal signature: the token is already a session by the time this runs, so all that
   * is left is reading the account (`/api/me`) and landing on the Social profile, exactly like the
   * email form does. A session the server refuses to confirm is not kept.
   */
  const onXPortalSession = useCallback(async (result: LoginResult) => {
    setXportalOpen(false);
    setBusy(true);
    try {
      const current = await loadMe();
      if (!current) throw new Error(`Sesiunea pentru @${result.user.handle} nu a putut fi confirmată.`);
      await ensureSocialPersona(current);
    } catch (cause) {
      clearSession();
      setMe(null);
      setError(cause instanceof Error ? cause.message : 'Conectarea xPortal nu a putut fi confirmată.');
    } finally { setBusy(false); }
  }, [ensureSocialPersona, loadMe]);

  const onLogout = useCallback(async () => {
    setBusy(true);
    try { await signOut(); } finally {
      setMe(null);
      setSlot('primary');
      setBusy(false);
    }
  }, []);

  const onSelectModule = useCallback(async (persona: string) => {
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
    /** The inbox mark is the conversations; the bell in the drawer is the activity (`inboxBox`). */
    if (next === 'inbox') setInboxBox('inbox');
    /** A tab press leaves the owner's own screens: they are doors from the profile, not a fifth tab. */
    setOwnerPanel(null);
    setSlot(next);
  }, []);

  /**
   * `Mesaj Nexus` on my own record has no recipient, so the only thing that header's inbox door can do is open
   * the inbox this shell owns (`slot = 'inbox'`). A visitor's profile lives on another route, which cannot
   * reach this slot yet — said out loud in `MIGRATION.md` §19.4 rather than wired with a fake screen.
   */
  const openInbox = useCallback(() => { setInboxBox('inbox'); setSlot('inbox'); }, []);

  /**
   * The drawer's bell: the account's activity, which is the inbox's own activity box. It is the one
   * surface the app has for `GET /api/notifications` — five endpoints, all of them read by
   * `ActivityCenter` — so the door opens the box rather than a second copy of the panel.
   */
  const openNotifications = useCallback(() => { setInboxBox('activity'); setSlot('inbox'); }, []);

  /**
   * After a relation changes, the screen that shows the record re-reads it: the counters of the header and the
   * lists that depend on a relation come from the server, while the buttons themselves need no reload at all,
   * because every screen reads the same store (`lib/relations.ts`) — the reader's place is never thrown away.
   */
  const onRelationChanged = useCallback(() => setProfileKey((value) => value + 1), []);

  /**
   * `goHome()` — the wordmark lands on the feed at its default reading (all content). Nothing has to be
   * restored any more: the tab bar never leaves the foot of the screen (round 10), so the only thing this
   * does is choose the slot. It sits with the other callbacks, above the early returns, because a hook
   * may not be reached on only some of the renders.
   */
  const goHome = useCallback(() => setSlot('primary'), []);

  /**
   * The profile ticker contains real doors. This callback must remain above the two early render
   * returns below: hooks have to be called in the same order while the session is booting, absent,
   * or loaded.
   */
  const openProfileTickerDoor = useCallback((door: TickerDoor, arg: string) => {
    if (me?.persona !== 'social') { setSlot('utility'); return; }
    if (door === 'followers' || door === 'following') { setFriendsTab(door); setSlot('friends'); return; }
    if (door === 'location') {
      const question = arg.trim().slice(0, 80);
      if (question.length < 2) return;
      setSearchQuery(question);
      setSlot('search');
      return;
    }
    if (door === 'handle') openSocialProfile(arg);
  }, [me?.persona]);

  if (booting) {
    return (
      <View style={styles.boot}>
        <Text style={styles.bootText}>Se încarcă Jungle Book…</Text>
      </View>
    );
  }

  if (!me) {
    return (
      <SafeAreaView style={styles.loginScreen}>
        <JungleBackdrop opacity={0.12} anchor="bottom" />
        <NexusLogin
          brand={<NexusLandingBrand />}
          locale="ro"
          googleReady={false}
          facebookReady={false}
          walletNetwork="mainnet"
          busy={busy}
          error={error}
          signupError={signupError}
          signupStatus={signupStatus}
          registrationMode={authCapabilities?.registration}
          recoveryMode={authCapabilities?.passwordRecovery}
          onSignIn={(email, password) => void onSignIn(email, password)}
          onSignUp={(draft) => void onSignUp(draft)}
          onForgotPassword={() => {
            setRecoveryError(''); setRecoveryDone('');
            // The sheet shows the mail form only when the server actually has a mail provider; a local
            // development server without one keeps the flow that sets the password on the spot.
            setRecoveryMode(authCapabilities?.passwordRecovery === 'email' && authCapabilities?.email?.configured ? 'email' : 'local');
            setRecoveryOpen(true);
          }}
          onXPortal={() => { setError(''); setXportalOpen(true); }}
          onProvider={() => setError('Google și Facebook nu sunt configurate pe server.')}
        />
        <XPortalSheet
          visible={xportalOpen}
          onClose={() => setXportalOpen(false)}
          onAuthenticated={(result) => onXPortalSession(result)}
        />
        <PasswordRecoverySheet
          visible={recoveryOpen}
          locale="ro"
          busy={recoveryBusy}
          mode={recoveryMode}
          error={recoveryError}
          done={recoveryDone}
          onClose={() => setRecoveryOpen(false)}
          onSubmit={(identifier, password) => void onSubmitRecovery(identifier, password)}
          onSubmitEmail={(email) => void onSubmitRecoveryEmail(email)}
        />
      </SafeAreaView>
    );
  }

  const moduleTitle = socialModules.find((entry) => entry.id === me.persona)?.title ?? me.persona;
  /** The name the account gave the profile being read, which the first switch reads out (app.js:1436). */
  const profileName = me.profiles?.find((entry) => entry.persona === me.persona)?.name || moduleTitle;
  /** Only the feed wears the feed bar; the profile and the inbox wear no bar at all
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
      accessibilityLabel: `Schimbă Jungle Book ${moduleTitle} · profil activ ${profileName}`,
      onPress: () => setSlot('account'),
    },
    ...(me.persona === 'social' ? [
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
   *
   * The feed wears none either (round 8). Its old bar carried one control — the Toate · Postări ·
   * Reel-uri toggle — and the owner removed the filter with the request that the post itself fill the
   * screen. A bar left without a control is a black strip above the picture; the wordmark already sits
   * in the tab bar and on every other screen, so the feed now begins at the notch. `FeedHeader` and
   * `FeedFilter` were deleted with the band they painted.
   */
  const header = slot === 'account' || slot === 'inbox' || onFeed ? null : (
    <AppHeader
      variant="screen"
      onPressWordmark={goHome}
      switches={offFeedSwitches}
    />
  );
  /** No bar floats any more: the feed's chrome is one solid strip, so no post slides under it. */
  const screen = (() => {
    /**
     * The owner's own doors. The profile's three bars open its own menu (`ProfileMenuSheet`) and never the
     * drawer, and each row of that menu lands on a screen the shell owns:
     *
     *   Portofel / Venituri / Cheltuieli → the wallet, on its own half of the ledger;
     *   Notificări → the inbox's activity box, the one surface for `GET /api/notifications`;
     *   Monetizează profilul → the monetisation screen;
     *   Setări → the settings screen, which is where the band switch and the build marker live.
     */
    if (ownerPanel === 'monetize') {
      return <MonetizationScreen handle={me.user.handle} onClose={() => setOwnerPanel(null)} />;
    }
    if (ownerPanel === 'wallet' || ownerPanel === 'income' || ownerPanel === 'spending') {
      return (
        <WalletScreen
          key={ownerPanel}
          initialSheet={ownerPanel === 'spending' ? 'spending' : 'income'}
          onClose={() => setOwnerPanel(null)}
        />
      );
    }
    if (ownerPanel === 'settings') {
      return (
        <SettingsScreen
          onClose={() => setOwnerPanel(null)}
          version={`Android ${APP_VERSION} · ${apiOriginLabel()}`}
          server={backendVersion}
        />
      );
    }
    if (slot === 'account') return (
      <ProfileScreen
        handle={me.user.handle}
        reloadKey={profileKey}
        onDoor={openProfileTickerDoor}
        onMonetize={() => setOwnerPanel('monetize')}
        onWallet={() => setOwnerPanel('wallet')}
        onIncome={() => setOwnerPanel('income')}
        onSpending={() => setOwnerPanel('spending')}
        onNewPost={() => router.push('/camera')}
        onNotifications={openNotifications}
        onSettings={() => setOwnerPanel('settings')}
        onLogout={() => void onLogout()}
        profiles={socialModules.map((entry) => ({ persona: entry.id, label: entry.title }))}
        onSwitchProfile={(persona) => void onSelectModule(persona)}
        version={`Android ${APP_VERSION} · ${apiOriginLabel()}`}
        build={buildLine()}
        viewerUserId={me.user.id}
        onMessage={openInbox}
        onRelationChanged={onRelationChanged}
      />
    );
    if (slot === 'inbox') {
      /** `activePersonaRecord()` of the web: the shelf's first card is the reader's own record. */
      const shelfOwner = me.profiles?.find((entry) => entry.persona === me.persona) ?? me.profiles?.find((entry) => entry.persona === 'social');
      return (
        <MessagesScreen
          onHome={goHome}
          activePersona={me.persona}
          initialBox={inboxBox}
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

    if (slot === 'friends') return <FriendsScreen key={`friends-${friendsTab}`} initialTab={friendsTab} />;
    if (slot === 'utility') return <LiveScreen />;
    if (slot === 'search') return <SearchScreen key={`search-${searchQuery}`} initialQuery={searchQuery} />;
    if (me.persona !== 'social') return <PendingScreen title={moduleTitle} detail="Acest modul nu este încă portat. Comută înapoi pe Social din sertarul de profil." />;
    return <FeedScreen />;
  })();

  return (
    <SafeAreaView edges={onFeed ? [] : ['top']} style={styles.shell}>
      {header}
      <View style={styles.body}>{screen}</View>
      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void loadMe()}>
            <Text style={styles.errorRetry}>Reîncearcă</Text>
          </Pressable>
        </View>
      ) : null}
      {/**
       * The tab bar floats above the shell instead of occupying a band inside it, and every page reserves
       * its height at the foot, so a word, a caption or the rail is never hidden behind the glass.
       *
       * It is permanent (round 10). The owner asked for it to stop sliding away on a scroll — "vreau sa
       * faci footer ul sa nu mia dispara la scroll..va ramane permananet" — so the transform, the hidden
       * state and the clock that carried it are gone, and the pages that keep clear of its band have
       * nothing left to follow. The reply is written in the reader's own composer (`CommentsSheet`), so
       * no second plate is drawn here.
       */}
      <View style={styles.navOverlay}>
        <AppNav
          active={slot}
          onSelect={onSelectSlot}
          onOpenCreate={() => router.push('/camera')}
          avatarSource={avatarSource}
          unreadCount={unreadCount}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /** `.phoneScreen:has(.appNav.social){background:#000}` — now the Jungle Book field, not pure black. */
  shell: { flex: 1, backgroundColor: editorial.field },
  /** The body is the whole shell: the tab bar floats over it, and the feed reserves its own foot. */
  body: { flex: 1 },
  /** The tab bar: pinned to the foot for good, laid out over the shell and never inside it. */
  navOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0 },
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



