// The bridge the Android client loads in a WebView (`apps/nexus-mobile/src/lib/xportalLogin.ts`).
//
// Why this file exists: WalletConnect v2 and the MultiversX provider are browser libraries. The
// native app runs them here, on the API's own origin, and hands the finished NativeAuth token to
// React Native, which performs the one server call that opens the session. Nothing is invented here:
// the pairing URI comes from the relay, the signature from xPortal, and the token is assembled with
// the provider's own `buildAccessToken`.
//
// It is a separate file because the server sends `script-src 'self'` (server.js line 82): an inline
// script is blocked by that policy, an external same-origin module is not.
//
// Query parameter, set by the app (`lib/xportalLogin.ts`):
//   redirect - the app's own scheme, so xPortal can send the reader back after approval.
const SOURCE = 'nexus-xportal';
const stateEl = document.getElementById('state');
const detailEl = document.getElementById('detail');
const qrEl = document.getElementById('qr');
const params = new URLSearchParams(window.location.search);
const redirectNative = (params.get('redirect') || '').trim().slice(0, 120);
// Only a bare scheme is accepted (`nexusdev://`); a path or query would be somewhere else to go.
const redirectSafe = /^[a-z][a-z0-9+.-]{1,30}:\/\/$/i.test(redirectNative) ? redirectNative : '';
const redirectUniversal = (params.get('universal') || '').trim().slice(0, 300);

function post(payload) {
  const message = { source: SOURCE, ...payload };
  try { window.ReactNativeWebView?.postMessage(JSON.stringify(message)); } catch { /* no host */ }
  return message;
}

function show(text, { error = false } = {}) {
  // After a relay refusal the attempt is over; a later status would overwrite the one sentence
  // that says what to fix.
  if (aborted) return;
  if (stateEl) {
    stateEl.textContent = text;
    stateEl.className = error ? 'error' : '';
  }
  post({ type: error ? 'error' : 'status', message: text });
}

function detail(text) {
  if (detailEl) detailEl.textContent = text || '';
}

/** Diagnostics: an event name and small fields, never the pairing URI (it carries the symKey). */
function logEvent(event, fields = {}) {
  post({ type: 'log', event, fields });
}

function phase(name) {
  if (aborted) return;
  post({ type: 'phase', phase: name });
}

/**
 * The relay's own refusal, caught where it happens.
 *
 * WalletConnect Cloud answers a socket from a page whose origin is not in the project's Allowed
 * Origins with a close frame that says `Origin not allowed: <origin>`, and then retries forever. The
 * provider's `connect()` therefore only ends in its own 15 s timeout, and the screen never named the
 * origin. The SDK reports that frame through `console`, which the web client listens to
 * (`explainRelayRefusal`, apps/nexus-web/src/wc-client.js), but a WebView has no console to read.
 * `WebSocket` is wrapped here, before the bundle is imported: the first frame that carries the
 * refusal becomes one sentence naming the exact value to allowlist, and the attempt stops instead of
 * waiting out a timeout it can never pass.
 */
const bridgeOrigin = window.location.origin;
let aborted = false;
let refusalSeen = false;
let closeSeen = false;

function relayFrameText(data) {
  if (typeof data !== 'string' || !data) return '';
  try {
    const frame = JSON.parse(data);
    const message = frame?.message || frame?.error?.message || frame?.payload?.message || '';
    return String(message || '').slice(0, 180);
  } catch {
    return data.slice(0, 180);
  }
}

function noteRelayFrame(data) {
  const text = relayFrameText(data);
  if (refusalSeen || !/origin not allowed|origin is not allowed/i.test(text)) return;
  refusalSeen = true;
  const sentence = `xPortal nu poate porni: WalletConnect refuză originea ${bridgeOrigin}. Adaugă exact ${bridgeOrigin} în WalletConnect Cloud → Settings → Allowed Origins (relay-ul acceptă din oficiu doar localhost și 127.0.0.1).`;
  logEvent('relay-refused', { relay: text, origin: bridgeOrigin.slice(0, 80) });
  detail(text);
  show(sentence, { error: true });
  aborted = true;
}

try {
  const NativeWebSocket = window.WebSocket;
  window.WebSocket = class RelayWatcher extends NativeWebSocket {
    constructor(url, protocols) {
      super(url, protocols);
      if (!/relay\.walletconnect\.com/i.test(String(url))) return;
      this.addEventListener('message', (event) => noteRelayFrame(event?.data));
      this.addEventListener('close', (event) => {
        if (closeSeen) return;
        closeSeen = true;
        logEvent('relay-close', { code: Number(event?.code) || 0 });
      });
    }
  };
} catch { /* the page still works when the socket cannot be wrapped */ }

let loginState = null;
let finished = false;
let startedAt = Date.now();

/**
 * The relay websocket is suspended while xPortal is in the foreground. On return the transport has
 * to be restarted before the provider sees the signature response, exactly as the web client does
 * (`resumeXPortalTransport`, apps/nexus-web/src/wc-client.js). The answer is posted to the app so
 * its log can say whether the relay came back or the approval is still waiting on the wallet.
 */
let resumeInFlight = false;
window.__nexusResume = async () => {
  if (resumeInFlight || aborted) return false;
  resumeInFlight = true;
  try {
    const mod = await import('/wc-bundle.js');
    if (!loginState?.provider) {
      post({ type: 'relay', connected: false, restarted: false, error: 'fără sesiune' });
      return false;
    }
    const status = await mod.resumeXPortalTransport({ provider: loginState.provider });
    post({ type: 'relay', ...status });
    logEvent('relay-resume', {
      connected: Boolean(status.connected),
      restarted: Boolean(status.restarted),
      wasConnected: Boolean(status.wasConnected),
      error: status.error ? String(status.error).slice(0, 80) : '',
    });
    return Boolean(status.connected);
  } catch (cause) {
    const text = String(cause?.message || cause).slice(0, 120);
    post({ type: 'relay', connected: false, restarted: false, error: text });
    logEvent('relay-resume-failed', { error: text });
    return false;
  } finally {
    resumeInFlight = false;
  }
};

/** Copying without a new native dependency: the page already has a clipboard context. */
function legacyCopy(value) {
  try {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch { return false; }
}

window.__nexusCopy = async (value) => {
  const text = typeof value === 'string' ? value.slice(0, 4096) : '';
  if (!text) { post({ type: 'copied', ok: false }); return false; }
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch { ok = legacyCopy(text); }
  post({ type: 'copied', ok });
  logEvent('copied', { ok, length: text.length });
  return ok;
};

document.addEventListener('visibilitychange', () => { if (!document.hidden) void window.__nexusResume(); });

async function renderQr(mod, uri) {
  if (!qrEl || typeof mod.renderWcQr !== 'function') return;
  try {
    qrEl.innerHTML = await mod.renderWcQr(uri);
    qrEl.hidden = false;
  } catch { /* a QR that cannot be drawn must not stop the deep link */ }
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function run() {
  let mod;
  try {
    mod = await import('/wc-bundle.js');
  } catch (cause) {
    show('Serverul nu servește clientul WalletConnect (/wc-bundle.js).', { error: true });
    detail(String(cause?.message || cause));
    logEvent('bundle-missing', { error: String(cause?.message || cause).slice(0, 100) });
    return;
  }

  try {
    startedAt = Date.now();
    logEvent('bridge-start', { redirectNative: Boolean(redirectSafe) });
    phase('preparing');
    show('Obțin challenge-ul NativeAuth…');
    loginState = await mod.startXPortalLogin({
      freshPairing: true,
      redirect: { native: redirectSafe, universal: redirectUniversal },
      onStatus: (message) => show(String(message || '')),
      onLog: (entry) => {
        if (!entry || typeof entry.event !== 'string') return;
        const fields = entry.fields && typeof entry.fields === 'object' ? entry.fields : entry;
        logEvent(entry.event.slice(0, 40), {
          topic: typeof fields.topic === 'string' ? fields.topic.slice(0, 64) : '',
          keys: Number.isFinite(fields.keys) ? fields.keys : undefined,
          reused: typeof fields.reused === 'boolean' ? fields.reused : undefined,
          ms: Number.isFinite(fields.ms) ? fields.ms : undefined,
        });
      },
    });
    if (!loginState?.uri) throw new Error('WalletConnect nu a returnat un URI de pairing');
    show('Deschide xPortal, aprobă conectarea, apoi semnează loginul.');
    phase('pairing');
    post({ type: 'pairing', uri: loginState.uri, deepLink: mod.xPortalUniversalLink(loginState.uri) });
    await renderQr(mod, loginState.uri);

    const approval = async () => {
      const session = await loginState.approval();
      show('Aprobat. Semnează loginul NativeAuth în xPortal…');
      phase('signature');
      logEvent('approved', { ms: Date.now() - startedAt });
      return session;
    };

    await withTimeout(
      loginState.provider.login({ approval, token: loginState.init }),
      // xPortal cold-starts its bundle and only then shows the NativeAuth sheet, so approval and the
      // fingerprint can be minutes apart. Three minutes cancelled attempts the wallet was still
      // working on (a sign screen that appeared at 192s was dropped); five minutes leaves room for
      // the wallet to be reopened without losing the request.
      300_000,
      'xPortal nu a răspuns în 5 minute',
    );
    if (aborted) return;
    logEvent('signature-received', { ms: Date.now() - startedAt });

    const address = await loginState.provider.getAddress();
    const signature = await loginState.provider.getSignature();
    if (!address) throw new Error('sesiunea xPortal nu conține o adresă MultiversX validă');
    if (!signature) throw new Error('xPortal nu a returnat semnătura NativeAuth');

    const raw = String(signature);
    const token = raw.includes('.') && !raw.startsWith('0x')
      ? raw
      : mod.buildAccessToken(address, loginState.init, raw);
    if (finished) return;
    finished = true;
    phase('token');
    show('Semnătură primită. Deschid sesiunea Jungle Book…');
    post({ type: 'token', token, address });
    detail(address);
    logEvent('token-posted', { ms: Date.now() - startedAt });
  } catch (cause) {
    // The refusal already printed the one sentence that matters; a timeout on top of it would only
    // bury it.
    if (aborted) return;
    const text = String(cause?.message || cause || 'conectarea xPortal a eșuat');
    phase('failed');
    show(text, { error: true });
    detail(text);
    logEvent('login-failed', { error: text.slice(0, 120), ms: Date.now() - startedAt });
  }
}

void run();
