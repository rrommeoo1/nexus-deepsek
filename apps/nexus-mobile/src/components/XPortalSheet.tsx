import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
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
      dispatch({ type: 'close' });
      return;
    }
    handed.current = false;
    opened.current = '';
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
  }, [visible, redirectNative]);

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
        logXPortal('xportal-opened', { topic: xPortalPairingTopic(uri), via: link.slice(0, 8) });
        return;
      } catch (cause) {
        lastError = cause instanceof Error ? cause.message : String(cause);
      }
    }
    logXPortal('xportal-open-failed');
    setError(`Nu am putut deschide xPortal. ${lastError}`.trim());
  }, []);

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
      setStatus('Deschide xPortal, aprobă conectarea, apoi semnează loginul.');
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
  }, [onAuthenticated, openXPortal]);

  /**
   * The relay websocket sleeps while xPortal is in front. Every return to this app asks the bridge
   * page to restart the transport (`resumeXPortalTransport`), so a signature that arrived in the
   * background is still delivered into the waiting `login()` call. The page answers with a `relay`
   * event, which the sheet turns into a sentence instead of leaving the reader on "se așteaptă".
   */
  useEffect(() => {
    if (!visible) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      logXPortal('app-active', { stage: attempt.stage, waitedSeconds: XPORTAL_WAIT_SECONDS - attempt.seconds });
      dispatch({ type: 'active' });
      webview.current?.injectJavaScript('window.__nexusResume && window.__nexusResume(); true;');
    });
    return () => subscription.remove();
  }, [visible, attempt.stage, attempt.seconds]);

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
                  onPress={() => { dispatch({ type: 'reopen' }); void openXPortal(pairing.uri); }}
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
  frame: { marginHorizontal: 18, marginTop: 4, height: 210, borderRadius: 14, overflow: 'hidden', backgroundColor: '#04120b' },
});

