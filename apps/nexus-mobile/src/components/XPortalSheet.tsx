import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { blackSilver } from '../theme/blackSilver';
import { AppState, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { API_ORIGIN } from '../lib/apiOrigin';
import { signInWithXPortalToken, type LoginResult } from '../lib/session';
import { clearXPortalAttempt, readXPortalAttempt, writeXPortalAttempt } from '../lib/xportalAttemptFile';
import {
  describeInterruptedAttempt, isXPortalAttemptFinished, logXPortal, parseXPortalBridgeMessage,
  xPortalAttemptRecord, xPortalBridgeUrl, xPortalFailureSentence, xPortalPairingTopic,
  xPortalRedirectScheme, xPortalWalletLinks,
} from '../lib/xportalLogin';
import { jungle } from '../theme/jungle';
import { XPORTAL_INITIAL_STATE, XPORTAL_WAIT_SECONDS, xPortalIsWaiting, xPortalReduce, xPortalWaitLabel } from '../lib/xportalState';
import { JungleBackdrop } from './JungleBackdrop';


/**
 * The xPortal login, on the phone, with the wallet's own signature.
 *
 * The pairing runs in `apps/nexus-web/public/xportal-bridge.html`, which the API serves on its own
 * origin: that page holds the WalletConnect session and asks xPortal to sign the server's NativeAuth
 * challenge. This sheet only (a) opens xPortal with the universal link the page produced, (b) prints
 * what the page says it is doing, and (c) delivers the finished token to `signInWithXPortalToken`,
 * which is the one call that turns a signature into a `nexus_session`.
 *
 * Nothing here can claim a login: a session exists only when the server accepted the signature.
 */
export type XPortalSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Called with the server's answer once the signature has opened a session. */
  onAuthenticated: (result: LoginResult) => void | Promise<void>;
};

/** What the page last said about the relay; kept so a reconnect can be shown, not guessed. */
type RelayState = { connected: boolean; restarted: boolean; error: string } | null;

export function XPortalSheet({ visible, onClose, onAuthenticated }: XPortalSheetProps) {
  const [status, setStatus] = useState('Pregătesc conexiunea cu xPortal…');
  const [error, setError] = useState('');
  const [pairing, setPairing] = useState<{ uri: string; deepLink: string } | null>(null);
  const [busy, setBusy] = useState(false);
  /** Where the attempt is, in one value (`lib/xportalState.ts`): stage, countdown, returns. */
  const [attempt, dispatch] = useReducer(xPortalReduce, XPORTAL_INITIAL_STATE);
  const [relay, setRelay] = useState<RelayState>(null);
  const [notice, setNotice] = useState('');
  /** What the previous, interrupted attempt left behind; printed once per sheet open. */
  const [resumed, setResumed] = useState('');
  const webview = useRef<WebView | null>(null);
  const handed = useRef(false);
  const opened = useRef('');
  const pairingRef = useRef<{ uri: string; deepLink: string } | null>(null);
  /** The approval already brought xPortal back once; a second window cannot re-open it again. */
  const autoReopened = useRef(false);
  /**
   * The reader came back while xPortal was still the only one that could act — the shape of a frozen
   * xPortal (its splash never finishes, so the approval never arrives and the sheet can only count
   * down). One re-open is the recovery this app owns; a second one is the reader's explicit tap.
   */
  const unstuckReopened = useRef(false);
  const reopenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unstuckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** When xPortal was last put in front, so a re-open never fires at a wallet that is already up. */
  const openedAt = useRef(0);

  /** A pending auto-reopen belongs to one attempt only: closing the sheet must cancel it. */
  const cancelReopen = useCallback(() => {
    if (reopenTimer.current) {
      clearTimeout(reopenTimer.current);
      reopenTimer.current = null;
    }
  }, []);

  /** The unstuck re-open is cancelled the moment the reader goes back to xPortal on their own. */
  const cancelUnstuck = useCallback(() => {
    if (unstuckTimer.current) {
      clearTimeout(unstuckTimer.current);
      unstuckTimer.current = null;
    }
  }, []);

  useEffect(() => () => {
    cancelReopen();
    cancelUnstuck();
  }, [cancelReopen, cancelUnstuck]);

  /**
   * `nexusdev://` (from `app.json`'s `scheme`) is the address xPortal is given so an approval can
   * bring the reader straight back to the running app instead of leaving them on xPortal's home
   * screen. Without it every login needs a manual app switch — the symptom this fixes.
   *
   * No `redirect.universal` is sent: the pairing lives in this sheet's WebView, so a browser opened
   * at the bridge page would be a second, empty login. The scheme is the only address that returns
   * the reader to the pairing that is actually waiting.
   */
  const redirectNative = useMemo(
    () => xPortalRedirectScheme(Constants.expoConfig?.scheme),
    [],
  );

  const bridgeUrl = useMemo(() => {
    try {
      return xPortalBridgeUrl(API_ORIGIN, { native: redirectNative });
    } catch {
      return '';
    }
  }, [redirectNative]);

  useEffect(() => {
    if (!visible) {
      // Nothing from a closed sheet may be rendered as a live attempt.
      cancelReopen();
      cancelUnstuck();
      dispatch({ type: 'close' });
      return;
    }
    handed.current = false;
    opened.current = '';
    autoReopened.current = false;
    unstuckReopened.current = false;
    openedAt.current = 0;
    cancelReopen();
    cancelUnstuck();
    setError('');
    setNotice('');
    setStatus('Pregătesc conexiunea cu xPortal…');
    setResumed('');
    pairingRef.current = null;
    setPairing(null);
    setBusy(false);
    setRelay(null);
    dispatch({ type: 'open' });
    // The pairing cannot come back after a process kill, but the fact that one was running can: say
    // it, then start clean. A stale or finished record is dropped instead of being announced.
    const interrupted = readXPortalAttempt();
    const sentence = describeInterruptedAttempt(interrupted);
    if (sentence) {
      setResumed(sentence);
      logXPortal('attempt-interrupted', { phase: interrupted?.phase || '' });
    } else if (interrupted) {
      clearXPortalAttempt();
    }
    logXPortal('sheet-open', { redirectNative: redirectNative || 'none' });
  }, [visible, redirectNative, cancelReopen, cancelUnstuck]);

  /** One tick per second while the attempt is waiting; the reducer decides when it expired. */
  useEffect(() => {
    if (!visible || !xPortalIsWaiting(attempt)) return;
    const timer = setTimeout(() => dispatch({ type: 'tick' }), 1000);
    return () => clearTimeout(timer);
  }, [visible, attempt]);

  /**
   * Hands the pairing to xPortal. Android resolves the first link the wallet declares — `wc:` is the
   * one xPortal registers for WalletConnect, and the universal link is the last resort.
   */
  const openXPortal = useCallback(async (uri: string) => {
    if (!uri) return;
    let lastError = '';
    let candidates: string[] = [];
    try {
      candidates = xPortalWalletLinks(uri);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'WalletConnect nu a dat un URI de pairing.');
      return;
    }
    for (const link of candidates) {
      try {
        await Linking.openURL(link);
        setError('');
        setNotice('');
        openedAt.current = Date.now();
        logXPortal('xportal-opened', { topic: xPortalPairingTopic(uri), via: link.slice(0, 8) });
        return;
      } catch (cause) {
        lastError = cause instanceof Error ? cause.message : String(cause);
      }
    }
    logXPortal('xportal-open-failed');
    setError(`Nu am putut deschide xPortal. ${lastError}`.trim());
  }, []);

  /**
   * xPortal approves the session on its own screen and stays there; the login-signature request
   * reaches it only when it is in front again. So every approval re-opens the wallet once, by
   * itself: the second window ("Connection established. Proceed to log in?") is then on screen in
   * about a second, instead of leaving the reader to guess whether to stay in xPortal or switch back
   * to Jungle Book. `autoReopened` keeps it to one re-open per attempt, so an approval loop cannot
   * bounce the reader between the two apps.
   */
  const scheduleReopen = useCallback(() => {
    if (autoReopened.current) return;
    autoReopened.current = true;
    // The approval makes the unstuck path pointless: this re-open is the one that shows the second
    // window, and two timers would send xPortal two intents a second apart.
    cancelUnstuck();
    cancelReopen();
    reopenTimer.current = setTimeout(() => {
      reopenTimer.current = null;
      const current = pairingRef.current;
      if (!current) return;
      // xPortal is already the screen in front (it was put there a moment ago): the second window
      // appears on its own, and a second intent would only flash the app switcher.
      if (Date.now() - openedAt.current < 4000) {
        logXPortal('auto-reopen-skipped');
        return;
      }
      dispatch({ type: 'reopen' });
      setNotice('xPortal e din nou în față: Connect, amprenta, apoi revii în Jungle Book.');
      logXPortal('auto-reopen');
      void openXPortal(current.uri);
    }, 1200);
  }, [cancelReopen, cancelUnstuck, openXPortal]);

  /**
   * A frozen xPortal never sends `signature`: the reader comes back to a sheet that can only count
   * down, and the only recovery the app owns is putting xPortal in front again with the same request.
   * It fires only if the reader *stays* here — going back to xPortal cancels it, because then the
   * wallet is doing its job and another intent would steal the screen. One shot per attempt; the
   * "Deschide xPortal din nou" link stays available for the case where xPortal has to be closed first.
   */
  const scheduleUnstuck = useCallback(() => {
    if (unstuckReopened.current || unstuckTimer.current) return;
    if (!pairingRef.current) return;
    unstuckTimer.current = setTimeout(() => {
      unstuckTimer.current = null;
      const current = pairingRef.current;
      // An approval that landed meanwhile owns the re-open: this one would race it.
      if (!current || autoReopened.current) return;
      unstuckReopened.current = true;
      cancelReopen();
      dispatch({ type: 'reopen' });
      setNotice('xPortal nu a răspuns: îl redeschid cu aceeași cerere. Dacă ecranul lui rămâne înghețat, închide-l din Recents și apasă „Deschide xPortal din nou”.');
      logXPortal('unstuck-reopen');
      void openXPortal(current.uri);
    }, 10000);
  }, [cancelReopen, openXPortal]);

  /** The page owns the clipboard context; the app only asks it to copy the pairing it holds. */
  const copyPairing = useCallback((uri: string) => {
    if (!uri) return;
    webview.current?.injectJavaScript(`window.__nexusCopy && window.__nexusCopy(${JSON.stringify(uri)}); true;`);
  }, []);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    const parsed = parseXPortalBridgeMessage(event.nativeEvent.data);
    if (!parsed) return;
    if (parsed.kind === 'status') { setStatus(parsed.message); return; }
    if (parsed.kind === 'log') { logXPortal(parsed.event, parsed.fields); return; }
    if (parsed.kind === 'phase') {
      dispatch({ type: 'phase', phase: parsed.phase });
      if (parsed.phase === 'failed') setBusy(false);
      // The attempt is over: a later open must not report it as interrupted.
      if (isXPortalAttemptFinished(parsed.phase)) clearXPortalAttempt();
      // `signature` is the bridge's own word for "xPortal approved; the login message is next".
      if (parsed.phase === 'signature') scheduleReopen();
      return;
    }
    if (parsed.kind === 'relay') {
      if (!pairingRef.current) return;
      setRelay({ connected: parsed.connected, restarted: parsed.restarted, error: parsed.error });
      logXPortal('relay', { connected: parsed.connected, restarted: parsed.restarted });
      setNotice(parsed.connected ? '' : 'Relay-ul WalletConnect nu a răspuns încă; încerc din nou la fiecare revenire în aplicație.');
      return;
    }
    if (parsed.kind === 'copied') {
      setNotice(parsed.ok ? 'Linkul de conectare a fost copiat.' : 'Nu am putut copia linkul. Deschide xPortal din buton.');
      return;
    }
    if (parsed.kind === 'error') {
      setBusy(false);
      cancelReopen();
      cancelUnstuck();
      dispatch({ type: 'error' });
      setError(xPortalFailureSentence(parsed.message));
      clearXPortalAttempt();
      logXPortal('page-error');
      return;
    }
    if (parsed.kind === 'pairing') {
      pairingRef.current = { uri: parsed.uri, deepLink: parsed.deepLink };
      setPairing(pairingRef.current);
      dispatch({ type: 'pairing' });
      setStatus('În xPortal: Connect, apoi revii în Jungle Book. xPortal se redeschide singur: Connect + amprenta, apoi revii în Jungle Book.');
      // Remember that a pairing is live, so a process kill is reported instead of swallowed. Only the
      // topic is written: the URI carries the symmetric key and never leaves the page.
      writeXPortalAttempt(xPortalAttemptRecord(xPortalPairingTopic(parsed.uri), 'pairing'));
      logXPortal('pairing', { topic: xPortalPairingTopic(parsed.uri) });
      if (opened.current !== parsed.uri) {
        opened.current = parsed.uri;
        void openXPortal(parsed.uri);
      }
      return;
    }
    if (handed.current) return;
    handed.current = true;
    setBusy(true);
    cancelReopen();
    cancelUnstuck();
    dispatch({ type: 'token' });
    setStatus('Semnătură primită. Deschid sesiunea Jungle Book…');
    logXPortal('token-received');
    clearXPortalAttempt();
    signInWithXPortalToken(parsed.token)
      .then((result) => onAuthenticated(result))
      .catch((cause) => {
        handed.current = false;
        setBusy(false);
        setError(cause instanceof Error ? cause.message : 'Sesiunea nu a putut fi deschisă.');
      });
  }, [onAuthenticated, openXPortal, scheduleReopen, cancelReopen, cancelUnstuck]);

  /**
   * The relay websocket sleeps while xPortal is in front. Every return to this app asks the bridge
   * page to restart the transport (`resumeXPortalTransport`), so a signature that arrived in the
   * background is still delivered into the waiting `login()` call. The page answers with a `relay`
   * event, which the sheet turns into a sentence instead of leaving the reader on "se așteaptă".
   */
  useEffect(() => {
    if (!visible) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        // The reader went back to xPortal: a pending unstuck re-open must not steal the screen.
        cancelUnstuck();
        return;
      }
      logXPortal('app-active', { stage: attempt.stage, waitedSeconds: XPORTAL_WAIT_SECONDS - attempt.seconds });
      dispatch({ type: 'active' });
      webview.current?.injectJavaScript('window.__nexusResume && window.__nexusResume(); true;');
      // Coming back after an approval means xPortal is one tap away from the login signature. The
      // page confirms the approval with `phase: signature`; if that arrived while the app was in
      // the background, this is the moment the second window can be put in front of the reader.
      if (attempt.stage === 'signature') {
        scheduleReopen();
        return;
      }
      // Still `pairing`: xPortal has not been approved at all. Either the reader is early, or its screen
      // froze and no approval is coming — so give it time to be interacted with in the background, then
      // put it back in front once (`scheduleUnstuck` cancels on a switch back). The 5 s floor keeps a
      // cold start (xPortal's splash can take ~10 s on this phone) from being interrupted.
      if (attempt.stage === 'pairing' && openedAt.current && Date.now() - openedAt.current >= 5000) {
        scheduleUnstuck();
      }
    });
    return () => subscription.remove();
  }, [visible, attempt.stage, attempt.seconds, scheduleReopen, scheduleUnstuck, cancelUnstuck]);

  const waitLabel = xPortalWaitLabel(attempt);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <JungleBackdrop opacity={0.07} anchor="bottom" />
          <View style={styles.grabber} />
          <Text style={styles.title}>Conectare cu xPortal</Text>
          <View style={styles.body}>
            <Text style={styles.muted}>{status}</Text>
            {resumed ? <Text style={styles.notice}>{resumed}</Text> : null}
            {waitLabel ? (
              <Text style={attempt.stage === 'expired' ? styles.expired : styles.waiting}>{waitLabel}</Text>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            {pairing && waitLabel ? (
              <View style={styles.links}>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Deschide aplicația xPortal din nou"
                  onPress={() => { cancelUnstuck(); dispatch({ type: 'reopen' }); void openXPortal(pairing.uri); }}
                >
                  <Text style={styles.link}>Deschide xPortal din nou</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Copiază linkul de conectare WalletConnect"
                  onPress={() => copyPairing(pairing.uri)}
                >
                  <Text style={styles.link}>Copiază linkul de conectare</Text>
                </Pressable>
              </View>
            ) : null}
            {relay && !relay.connected ? (
              <Text style={styles.muted}>Relay WalletConnect: reconectare…</Text>
            ) : null}
            <Text style={styles.muted}>
              xPortal semnează un mesaj de login, nu o tranzacție: conectarea nu costă nimic.
            </Text>
          </View>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Renunță la conectarea xPortal"
              accessibilityState={{ busy, disabled: busy }}
              disabled={busy}
              onPress={onClose}
              style={({ pressed }) => [styles.secondary, busy && styles.disabled, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryLabel}>{busy ? 'Se deschide…' : 'Renunță'}</Text>
            </Pressable>
          </View>
          <View style={styles.frame}>
            {visible && bridgeUrl ? (
              <WebView
                ref={webview}
                source={{ uri: bridgeUrl }}
                originWhitelist={['*']}
                javaScriptEnabled
                domStorageEnabled
                sharedCookiesEnabled
                thirdPartyCookiesEnabled
                mixedContentMode="always"
                setSupportMultipleWindows={false}
                onMessage={onMessage}
                onError={(event) => setError(`Pagina de conectare nu s-a putut încărca (${event.nativeEvent.description}).`)}
                onHttpError={(event) => setError(`Serverul a refuzat pagina de conectare (${event.nativeEvent.statusCode}).`)}
                // The page never navigates; a wallet link that escapes the page is opened by the
                // system, and every other scheme stays inside the sheet instead of leaving the app.
                onShouldStartLoadWithRequest={(request) => request.url.startsWith('http://') || request.url.startsWith('https://')}
              />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: jungle.sheet, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 26 },
  grabber: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#26343f', marginTop: 10, marginBottom: 8 },
  title: { color: '#eaf6ff', fontSize: 17, fontWeight: '800', paddingHorizontal: 18, paddingBottom: 6 },
  body: { paddingHorizontal: 18, paddingBottom: 8, gap: 8 },
  muted: { color: '#8fa3b4', fontSize: 12, lineHeight: 17 },
  error: { color: '#ff9a9a', fontSize: 12, lineHeight: 17 },
  /** The wait itself: the one sentence that says the app is still listening to xPortal. */
  waiting: { color: '#d8f3c2', fontSize: 12, lineHeight: 17 },
  expired: { color: '#ffd79a', fontSize: 12, lineHeight: 17 },
  notice: { color: '#9fd0ff', fontSize: 12, lineHeight: 17 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  link: { color: jungle.primary, fontSize: 13, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingTop: 12 },
  secondary: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: '#243441' },
  secondaryLabel: { color: '#cfe0ee', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  /** The bridge page, visible: it prints the pairing steps and the QR the reader is waiting on. */
  frame: { marginHorizontal: 18, marginTop: 4, height: 210, borderRadius: 14, overflow: 'hidden', backgroundColor: blackSilver.deepBlack },
});

