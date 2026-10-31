import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { blackSilver } from '../theme/blackSilver';
import { AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { API_ORIGIN } from '../lib/apiOrigin';
import { bridgeUnreachableSentence, resolveWalletOrigin } from '../lib/bridgeOrigin';
import { signInWithXPortalToken, type LoginResult } from '../lib/session';
import { clearXPortalAttempt, readXPortalAttempt, writeXPortalAttempt } from '../lib/xportalAttemptFile';
import {
  describeInterruptedAttempt, isXPortalAttemptFinished, logXPortal, parseXPortalBridgeMessage,
  xPortalAttemptRecord, xPortalBridgeUrl, xPortalFailureSentence, xPortalPairingTopic,
  xPortalRedirectScheme, xPortalWalletLinks,
} from '../lib/xportalLogin';
import {
  SIGNATURE_REOPEN_DELAY_MS, UNSTUCK_DELAY_MS, XPORTAL_OPEN_ACTION, xPortalLaunchDecision,
  xPortalReturnHint, xPortalStageSentence, type XPortalLaunchReason,
} from '../lib/xportalNavigation';
import { openWalletRequest } from '../lib/xportalIntents';
import { jungle } from '../theme/jungle';
import {
  XPORTAL_INITIAL_STATE, XPORTAL_WAIT_SECONDS, xPortalIsWaiting, xPortalReduce, xPortalWaitLabel,
  type XPortalStage,
} from '../lib/xportalState';
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
  /**
   * The stage the timers must reason about, read from a ref: a `setTimeout` armed while the page was
   * at `approved` has to see `signature` when it fires 1.2 s later, without being re-created (a
   * re-created timer is a second intent). `attempt.stage` is still the only source of truth; this is
   * the same value seen from inside a callback.
   */
  const stageRef = useRef<XPortalStage>(XPORTAL_INITIAL_STATE.stage);
  /** Remounting the page is the only way to ask WalletConnect for a fresh pairing after a failure. */
  const [bridgeKey, setBridgeKey] = useState(0);

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

  /** The ref follows the reducer in the same commit that renders the new stage. */
  useEffect(() => {
    stageRef.current = attempt.stage;
  }, [attempt.stage]);

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

  /**
   * Where the wallet page runs. It is **not** necessarily the API origin any more: a build can point
   * `EXPO_PUBLIC_NEXUS_WALLET_URL` at a stable public https address, so moving the backend to another
   * PC does not change the origin xPortal sees (and does not silently require a new Reown allowlist).
   * Without that variable the old rule applies: https as given, loopback as given, LAN swapped for the
   * phone's own loopback through `adb reverse`.
   */
  const walletOrigin = useMemo(
    () => resolveWalletOrigin({ configured: process.env.EXPO_PUBLIC_NEXUS_WALLET_URL, apiOrigin: API_ORIGIN }),
    [],
  );

  const bridgeUrl = useMemo(() => {
    try {
      // The wallet page runs from the secure origin (`lib/bridgeOrigin.ts`); every other request keeps
      // using API_ORIGIN, so the LAN address still serves the app.
      return xPortalBridgeUrl(walletOrigin.origin, { native: redirectNative });
    } catch {
      return '';
    }
  }, [redirectNative, walletOrigin]);

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
    // The origin the wallet page will run from is part of the attempt's identity: a build that moved
    // servers says so in the trace, instead of leaving a changed origin to be guessed from a failure.
    logXPortal('sheet-open', { redirectNative: redirectNative || 'none', wallet: walletOrigin.source, origin: walletOrigin.origin });
    if (walletOrigin.note) logXPortal('wallet-origin', { source: walletOrigin.source, note: walletOrigin.note.slice(0, 120) });
  }, [visible, redirectNative, walletOrigin, cancelReopen, cancelUnstuck]);

  /** One tick per second while the attempt is waiting; the reducer decides when it expired. */
  useEffect(() => {
    if (!visible || !xPortalIsWaiting(attempt)) return;
    const timer = setTimeout(() => dispatch({ type: 'tick' }), 1000);
    return () => clearTimeout(timer);
  }, [visible, attempt]);

  /**
   * Hands the pairing to xPortal. Android resolves the first link the wallet declares — `wc:` is the
   * one xPortal registers for WalletConnect, and the universal link is the last resort. The link
   * leaves through `openWalletRequest` (Intent flags, not plain `Linking`) because a second window
   * opened while xPortal is already running would otherwise get a black activity: see
   * `WALLET_INTENT_FLAGS`.
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
        const transport = await openWalletRequest(link);
        setError('');
        setNotice('');
        openedAt.current = Date.now();
        logXPortal('xportal-opened', {
          topic: xPortalPairingTopic(uri),
          via: link.slice(0, 12),
          transport,
        });
        return;
      } catch (cause) {
        lastError = cause instanceof Error ? cause.message : String(cause);
      }
    }
    logXPortal('xportal-open-failed');
    // The only recovery left when no link resolves: an explicit button, not a silent dead end.
    setError(`Nu am putut deschide xPortal (${lastError || 'niciun link acceptat'}). Apasă „${XPORTAL_OPEN_ACTION}”.`);
  }, []);

  /**
   * Puts xPortal in front **only when the authentication state says it is useful**, and records why
   * when it is not (`lib/xportalNavigation.ts` holds the rule). Three things this protects:
   *
   *   · `signature` is the only stage where a second window exists — opening earlier shows an empty
   *     wallet screen, which is what made the reader think the login had failed;
   *   · a wallet that is already in front is not re-opened (Android would flash the app switcher);
   *   · the attempt that asked for the launch must still be the live one (`uri` check), so a stale
   *     timer from a closed sheet cannot steal the screen from the next attempt.
   */
  const launchWallet = useCallback(async (
    uri: string,
    reason: XPortalLaunchReason,
    options: { scheduled?: boolean } = {},
  ): Promise<boolean> => {
    if (!uri || pairingRef.current?.uri !== uri) {
      logXPortal('xportal-open-skipped', { reason, skip: 'stale-attempt' });
      return false;
    }
    const decision = xPortalLaunchDecision({
      reason,
      stage: stageRef.current,
      hasPairing: Boolean(uri),
      now: Date.now(),
      openedAt: openedAt.current,
      // A timer that was already armed *is* the decision; the flags only stop a second timer.
      autoReopened: options.scheduled ? false : autoReopened.current,
      unstuckUsed: options.scheduled ? false : unstuckReopened.current,
    });
    if (!decision.launch) {
      logXPortal('xportal-open-skipped', { reason, skip: decision.skip });
      return false;
    }
    await openXPortal(uri);
    return true;
  }, [openXPortal]);

  /**
   * xPortal approves the session on its own screen and stays there; the login-signature request
   * reaches it only when it is in front again. So every approval re-opens the wallet once, by
   * itself: the second window ("Connection established. Proceed to log in?") is then on screen in
   * about a second, instead of leaving the reader to guess whether to stay in xPortal or switch back
   * to Jungle Book. `autoReopened` keeps it to one re-open per attempt, so an approval loop cannot
   * bounce the reader between the two apps.
   */
  const scheduleReopen = useCallback(() => {
    if (autoReopened.current || reopenTimer.current) return;
    autoReopened.current = true;
    // The approval makes the unstuck path pointless: this re-open is the one that shows the second
    // window, and two timers would send xPortal two intents a second apart.
    cancelUnstuck();
    cancelReopen();
    reopenTimer.current = setTimeout(() => {
      reopenTimer.current = null;
      const current = pairingRef.current;
      if (!current) return;
      // The request never reached the relay (the page is still preparing it): nothing to show in the
      // wallet, and the flag goes back so the real `signature` can still bring xPortal forward.
      if (stageRef.current !== 'signature') {
        autoReopened.current = false;
        logXPortal('auto-reopen-deferred', { stage: stageRef.current });
        return;
      }
      dispatch({ type: 'reopen' });
      setNotice('xPortal e din nou în față.');
      logXPortal('auto-reopen');
      void launchWallet(current.uri, 'signature', { scheduled: true });
    }, SIGNATURE_REOPEN_DELAY_MS);
  }, [cancelReopen, cancelUnstuck, launchWallet]);

  /**
   * A frozen xPortal never sends `signature`: the reader comes back to a sheet that can only count
   * down, and the only recovery the app owns is putting xPortal in front again with the same request.
   * It fires only if the reader *stays* here — going back to xPortal cancels it, because then the
   * wallet is doing its job and another intent would steal the screen. One shot per attempt; the
   * "Deschide xPortal" link stays available for the case where xPortal has to be closed first.
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
      setNotice('xPortal nu a răspuns: îl redeschid o dată cu aceeași cerere. Dacă ecranul lui rămâne înghețat, închide-l din Recents și apasă „Deschide xPortal”.');
      logXPortal('unstuck-reopen');
      void launchWallet(current.uri, 'unstuck', { scheduled: true });
    }, UNSTUCK_DELAY_MS);
  }, [cancelReopen, launchWallet]);

  /**
   * One tap to start over after a failure or an expired pairing: WalletConnect needs a fresh page for
   * a fresh URI, so `bridgeKey` remounts the WebView (which clears the old session and posts a new
   * `pairing`). Everything the dead attempt owned is reset first, so one of its timers can never
   * touch the new attempt.
   */
  const retry = useCallback(() => {
    cancelReopen();
    cancelUnstuck();
    opened.current = '';
    pairingRef.current = null;
    setPairing(null);
    autoReopened.current = false;
    unstuckReopened.current = false;
    handed.current = false;
    openedAt.current = 0;
    setBusy(false);
    setError('');
    setNotice('');
    setStatus('');
    dispatch({ type: 'open' });
    setBridgeKey((value) => value + 1);
    logXPortal('retry');
  }, [cancelReopen, cancelUnstuck]);

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
      // Logged with the phone's own clock, so the page's `t`/`dt` trace and the logcat can be lined
      // up: the page says when it *posted* a phase, this says when the sheet received it.
      logXPortal('phase', { phase: parsed.phase });
      dispatch({ type: 'phase', phase: parsed.phase });
      if (parsed.phase === 'failed') setBusy(false);
      // The attempt is over: a later open must not report it as interrupted.
      if (isXPortalAttemptFinished(parsed.phase)) clearXPortalAttempt();
      // `signature` is the page's word for "the request is on the wire": only then is bringing xPortal
      // back in front useful. `approved` means the wallet said yes and the page is still preparing the
      // request, so a re-open there would show the reader an empty wallet screen.
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
      setStatus('');
      // Remember that a pairing is live, so a process kill is reported instead of swallowed. Only the
      // topic is written: the URI carries the symmetric key and never leaves the page.
      writeXPortalAttempt(xPortalAttemptRecord(xPortalPairingTopic(parsed.uri), 'pairing'));
      logXPortal('pairing', { topic: xPortalPairingTopic(parsed.uri) });
      if (opened.current !== parsed.uri) {
        opened.current = parsed.uri;
        // First window: the sheet is already saying "Confirmă conectarea în xPortal" above.
        void launchWallet(parsed.uri, 'first-open');
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
      .then((result) => {
        // Success is announced only here: the server has accepted the signature and opened the
        // session. Nothing before this point may read as "reușit" — not the pairing, not the phase.
        dispatch({ type: 'authenticated' });
        logXPortal('authenticated');
        return onAuthenticated(result);
      })
      .catch((cause) => {
        handed.current = false;
        setBusy(false);
        setError(cause instanceof Error ? cause.message : 'Sesiunea nu a putut fi deschisă.');
      });
  }, [onAuthenticated, launchWallet, scheduleReopen, cancelReopen, cancelUnstuck]);

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
        // One line per transition, so a real-device report can say which way the app moved and when
        // (`app-background` / `app-active` with the stage in between — the only honest evidence that
        // the return was automatic rather than a manual switch).
        logXPortal('app-background', { stage: attempt.stage });
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
  /**
   * One sentence, the stage's own: "Se deschide xPortal…", "Confirmă conectarea în xPortal",
   * "Pregătim autentificarea…", "Confirmă semnătura în xPortal", "Autentificare reușită". The page's
   * `status` text is only a fallback for the moments between stages — it never replaces the sentence
   * of a stage the reducer already knows.
   */
  const headline = xPortalStageSentence(attempt.stage);
  /** The fallback for a wallet that does not come back by itself (empty outside `signature`). */
  const returnHint = xPortalReturnHint(attempt.stage);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <JungleBackdrop opacity={0.07} anchor="bottom" />
          <View style={styles.grabber} />
          <Text style={styles.title}>Conectare cu xPortal</Text>
          <View style={styles.body}>
            <Text style={headline ? styles.headline : styles.muted}>{headline || status}</Text>
            {returnHint ? <Text style={styles.notice}>{returnHint}</Text> : null}
            {resumed ? <Text style={styles.notice}>{resumed}</Text> : null}
            {waitLabel ? (
              <Text style={attempt.stage === 'expired' ? styles.expired : styles.waiting}>{waitLabel}</Text>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {walletOrigin.problem ? <Text style={styles.error}>{walletOrigin.problem}</Text> : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            {pairing && waitLabel ? (
              <View style={styles.links}>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Deschide aplicația xPortal"
                  onPress={() => { cancelUnstuck(); dispatch({ type: 'reopen' }); void launchWallet(pairing.uri, 'reader'); }}
                >
                  <Text style={styles.link}>{XPORTAL_OPEN_ACTION}</Text>
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
            {attempt.stage === 'failed' || attempt.stage === 'expired' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Încearcă din nou conectarea cu xPortal"
                onPress={retry}
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryLabel}>Încearcă din nou</Text>
              </Pressable>
            ) : null}
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
                key={bridgeKey}
                source={{ uri: bridgeUrl }}
                originWhitelist={['*']}
                javaScriptEnabled
                domStorageEnabled
                sharedCookiesEnabled
                thirdPartyCookiesEnabled
                mixedContentMode="always"
                setSupportMultipleWindows={false}
                onMessage={onMessage}
                onError={(event) => setError(`${bridgeUnreachableSentence(walletOrigin.origin)} (${event.nativeEvent.description})`)}
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
  /** The stage's own sentence: the one line a beginner is meant to read. */
  headline: { color: '#eaf6ff', fontSize: 14, lineHeight: 20, fontWeight: '700' },
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

