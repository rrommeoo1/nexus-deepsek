import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppNav } from '../components/AppNav';
import { FeedHeader } from '../components/FeedHeader';
import { FeedDrawer } from '../components/FeedDrawer';
import { NexusLandingBrand } from '../components/NexusLandingBrand';
import { NexusLogin } from '../components/NexusLogin';
import type { NavSlot } from '../components/NexusMark';
import { API_ORIGIN } from '../lib/apiOrigin';
import { nexusApi, NexusApiError } from '../lib/nexusApi';
import { clearSession, readSession, signInWithEmail, signOut } from '../lib/session';
import type { MeResponse } from '../lib/socialTypes';
import { FeedScreen, nextMode, type FeedModeId } from '../screens/FeedScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
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
  const [me, setMe] = useState<MeResponse | null>(null);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [backendVersion, setBackendVersion] = useState('');
  const [slot, setSlot] = useState<NavSlot>('primary');
  const [feedMode, setFeedMode] = useState<FeedModeId>('reels');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileKey, setProfileKey] = useState(0);
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

  const avatarUri = useMemo(() => {
    const raw = me?.user?.avatar;
    return raw && /^\/media\/[a-f0-9]{64}\.[a-z0-9]{2,8}$/.test(raw) ? `${API_ORIGIN}${raw}` : null;
  }, [me?.user?.avatar]);

  const onSelectSlot = useCallback((next: NavSlot) => {
    if (next === 'create') { router.push('/camera'); return; }
    if (next === 'account') setProfileKey((value) => value + 1);
    setSlot(next);
  }, []);

  const onCycleFeedMode = useCallback(() => setFeedMode((current) => nextMode(current)), []);

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
  const screen = (() => {
    if (slot === 'account') return <ProfileScreen handle={me.user.handle} reloadKey={profileKey} />;
    if (slot === 'inbox') return <PendingScreen title="Mesaje" detail="Conversațiile nu sunt încă portate în aplicația Android. Ecranul web rămâne referința; aici nu se afișează date inventate." />;
    if (slot === 'friends') return <PendingScreen title="Prieteni" detail="Relațiile (urmăritori, cereri, blocări) nu sunt încă portate în aplicația Android." />;
    if (slot === 'utility') return <PendingScreen title="Live" detail="Transmisiunile live nu sunt încă portate în aplicația Android." />;
    if (slot === 'search') return <PendingScreen title="Găsește oameni și conținut" detail="Căutarea nu este încă portată în aplicația Android." />;
    if (me.persona !== 'social') return <PendingScreen title={moduleTitle} detail="Acest modul nu este încă portat. Comută înapoi pe Social din sertarul de profil." />;
    return (
      <>
        <FeedHeader modeId={feedMode} onCycleMode={onCycleFeedMode} onOpenDrawer={() => setDrawerOpen(true)} />
        <FeedScreen mode={feedMode} onModeChange={setFeedMode} />
      </>
    );
  })();

  return (
    <SafeAreaView edges={['top']} style={styles.shell}>
      <View style={styles.body}>{screen}</View>
      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void loadMe()}>
            <Text style={styles.errorRetry}>Reîncearcă</Text>
          </Pressable>
        </View>
      ) : null}
      <AppNav
        active={slot}
        onSelect={onSelectSlot}
        onOpenDrawer={() => setDrawerOpen(true)}
        onOpenCreate={() => router.push('/camera')}
        avatarUri={avatarUri}
      />
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



