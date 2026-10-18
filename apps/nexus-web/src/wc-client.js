// Browser client for "log in with xPortal" via WalletConnect v2 + NativeAuth.
//
// Bundled by esbuild into public/wc-bundle.js (see ../scripts/build-wc.mjs).
// Loaded only when the user taps the xPortal button.
//
// Flow:
//   1. GET /auth/mvx/init -> { init, chainId, wcProjectId }
//   2. init WalletConnectV2Provider on the matching chain
//   3. provider.connect() -> { uri, approval }; render uri as QR + deep-link
//   4. provider.login({ approval, token: init }) -> xPortal notifies & signs
//   5. assemble NativeAuth accessToken, POST /auth/mvx/native -> Jungle Book session

import { EventEmitter } from "events";
import QRCode from "qrcode";

// The browser events polyfill bundled for WalletConnect exposes
// removeListener() but not Node's modern off() alias. WalletConnect 2.23 uses
// off() during subscription setup, so install the compatibility alias before
// the provider module is initialized.
if (typeof EventEmitter.prototype.off !== "function") {
  EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
}

const RELAY_URL = "wss://relay.walletconnect.com";
const PROVIDER_TIMEOUT_MS = 120_000;
const INIT_TIMEOUT_MS = 20_000;
const CONNECT_TIMEOUT_MS = 15_000;
const SESSION_TIMEOUT_MS = 25_000;

function withTimeout(promise, label, timeoutMs = PROVIDER_TIMEOUT_MS) {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} a expirat`)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

function base64urlEncode(value) {
  const utf8 = new TextEncoder().encode(String(value));
  let bin = "";
  for (const byte of utf8) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function errMessage(err) {
  if (!err) return "eroare necunoscută";
  const base = err?.message || err?.reason || String(err);
  const cause = err?.cause?.message || err?.cause?.reason;
  return cause ? `${base} (${cause})` : base;
}

/**
 * Turns the relay's own refusal into a sentence a reader can act on.
 *
 * WalletConnect Cloud answers a project's socket only when the page's origin is listed under
 * "Allowed origins". `localhost` and `127.0.0.1` are accepted without being listed, so a flow that
 * works on the developer machine can still be dead on the deployed origin. The relay says it as code
 * 3000 ("Unauthorized: origin not allowed"), the SDK logs it and then retries forever, which is what
 * the generic 15 s timeout used to hide. The origin stays in the sentence: it is exactly the value
 * that has to be added in the dashboard.
 */
export function explainRelayRefusal(diagnostics, origin = "") {
  const text = (Array.isArray(diagnostics) ? diagnostics.join(" ") : String(diagnostics ?? ""))
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  const target = String(origin || "").trim() || "originea aplicației";
  if (/origin not allowed/i.test(text)) {
    return (
      `xPortal nu poate porni: WalletConnect refuză originea ${target}. ` +
      `Adaugă exact ${target} (fără cale și fără bară la final) în WalletConnect Cloud → proiectul Jungle Book → ` +
      `Settings → Allowed origins, apoi încearcă din nou. Relay-ul acceptă din oficiu doar localhost și 127.0.0.1.`
    );
  }
  if (/project not found|invalid project|project id is not valid/i.test(text)) {
    return (
      "xPortal nu poate porni: WalletConnect nu recunoaște Project ID-ul acestui server. " +
      "Verifică WALLETCONNECT_PROJECT_ID în configurația serverului (trebuie să fie ID-ul din WalletConnect Cloud)."
    );
  }
  return "";
}

/**
 * Runs `run` at most once at a time and hands every concurrent caller the same attempt.
 *
 * A second `init()` on one page logs "WalletConnect Core is already initialized" and opens a second
 * relay socket; the two then fight over the same storage and the same pairing. The sheet can be
 * reopened while an attempt is still running, so the second tap joins the first. A finished attempt
 * (failed or not) frees the slot for the next try.
 */
export function createSingleFlight(run) {
  let active = null;
  return (options) => {
    if (active) return active;
    const attempt = Promise.resolve().then(() => run(options));
    active = attempt;
    const release = () => { if (active === attempt) active = null; };
    attempt.then(release, release);
    return attempt;
  };
}

async function connectWithDiagnostics(provider, chainId) {
  void chainId;
  // Let the official MultiversX provider build the namespace. Besides the
  // three required signing methods it adds the legacy login method and the
  // NativeAuth method requested here.
  return provider.connect({ methods: ["mvx_signNativeAuthToken"] });
}

export function getSessionAccount(session, chainId) {
  const accounts = session?.namespaces?.mvx?.accounts;
  if (!Array.isArray(accounts)) return "";
  const prefix = `mvx:${chainId}:`;
  const account = accounts.find((value) => String(value).startsWith(prefix));
  return account ? String(account).slice(prefix.length) : "";
}

function getPersistedSession(connector, chainId) {
  const keys = connector?.session?.keys;
  if (!Array.isArray(keys)) return null;
  for (const topic of [...keys].reverse()) {
    try {
      const session = connector.session.get(topic);
      if (session?.acknowledged && Number(session.expiry ?? 0) * 1000 > Date.now() && getSessionAccount(session, chainId)) return session;
    } catch { /* ignore an incomplete local WalletConnect record */ }
  }
  return null;
}

export function clearNexusWalletConnectState(storage) {
  if (!storage || typeof storage.length !== "number" || typeof storage.key !== "function" || typeof storage.removeItem !== "function") return 0;
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (typeof key === "string" && (/^wc@2:/i.test(key) || /walletconnect/i.test(key))) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
  return keys.length;
}

export function selectReusableSession(connector, chainId, { freshPairing = true } = {}) {
  return freshPairing ? null : getPersistedSession(connector, chainId);
}

export function selectNativeAuthMethod(session) {
  const methods = session?.namespaces?.mvx?.methods;
  if (!Array.isArray(methods)) return "";
  if (methods.includes("mvx_signNativeAuthToken")) return "mvx_signNativeAuthToken";
  if (methods.includes("mvx_signLoginToken")) return "mvx_signLoginToken";
  return "";
}

// Assemble a NativeAuth access token (mirrors NativeAuthClient.getToken).
export function buildAccessToken(address, init, signature) {
  const sig = String(signature ?? "").replace(/^0x/i, "");
  return `${base64urlEncode(address)}.${base64urlEncode(init)}.${sig}`;
}

export function selectWalletConnectProjectId(value) {
  const projectId = String(value ?? "").trim();
  if (!/^[a-f0-9]{32}$/i.test(projectId)) throw new Error("WalletConnect Jungle Book nu este configurat");
  return projectId;
}

/**
 * The dapp metadata xPortal receives in the pairing proposal.
 *
 * `redirect` is the one field that tells the wallet where to send the reader after approval. Without
 * it xPortal stays in front (or goes to its home), and the reader has to find Jungle Book again by
 * hand. `native` is the app's own scheme (a deep link, `singleTask`, so the running task is reused and
 * the WebView keeps its WalletConnect session); `universal` is the page that started the login, which
 * is what a wallet without the scheme can open instead.
 */
export function walletConnectMetadata({ origin = "", redirectNative = "", redirectUniversal = "" } = {}) {
  // The wallet shows the name, the description and the icon exactly as they arrive here, so all
  // three carry the product name a reader knows. The icon is served by the same origin as the
  // bridge page (`apps/nexus-web/public/jungle-book-mark-512.png`, 512×512); an empty list left
  // xPortal with a blank tile and nothing to recognise the request by.
  const metadata = {
    name: "Jungle Book",
    description: "Jungle Book — un portofel, fiecare latură a ta",
    url: origin || "https://localhost",
    icons: origin ? [`${origin}/jungle-book-mark-512.png`] : [],
  };
  const redirect = {};
  const nativeScheme = String(redirectNative ?? "").trim();
  const universalLink = String(redirectUniversal ?? "").trim();
  if (nativeScheme) redirect.native = nativeScheme;
  if (universalLink) redirect.universal = universalLink;
  if (redirect.native || redirect.universal) metadata.redirect = redirect;
  return metadata;
}

async function runXPortalLogin({ onStatus, onLog, freshPairing = true, redirect = {} } = {}) {
  const report = (msg) => typeof onStatus === "function" && onStatus(msg);
  // Diagnostics only: events and counts, never a pairing URI (it carries the symmetric key).
  const log = (event, fields = {}) => {
    try { if (typeof onLog === "function") onLog({ event, ...fields }); } catch { /* a log never breaks a login */ }
  };
  const startedAt = Date.now();
  const redirectNative = String(redirect?.native ?? "").trim();
  const redirectUniversal = String(redirect?.universal ?? "").trim();
  report("obțin challenge NativeAuth…");
  let initData;
  try {
    const initRes = await fetch("/auth/mvx/init");
    initData = await initRes.json();
  } catch (err) {
    throw new Error("nu am putut obține /auth/mvx/init: " + errMessage(err));
  }
  if (!initData?.ok) {
    throw new Error(initData?.error || "nu s-a putut obține challenge-ul NativeAuth");
  }
  const { init, chainId, wcProjectId } = initData;
  let selectedProjectId;
  try { selectedProjectId = selectWalletConnectProjectId(wcProjectId); }
  catch { throw new Error("WalletConnect Jungle Book nu este configurat pentru această origine"); }
  const origin = typeof window !== "undefined" ? window.location.origin : "https://localhost";
  const diagnostics = [];
  let refusalError = "";
  let rejectRefusal = () => {};
  // The relay answers a refused origin within a second and then retries forever. Waiting for the
  // 15 s connect timeout would report "no session" and hide the actual cause.
  const refusal = new Promise((_, reject) => { rejectRefusal = reject; });
  refusal.catch(() => {});
  const originalConsole = {};
  for (const level of ["error", "warn", "debug"]) {
    originalConsole[level] = console[level];
    console[level] = (...args) => {
      diagnostics.push(args.map((value) => value?.message || (typeof value === "string" ? value : JSON.stringify(value))).join(" "));
      if (diagnostics.length > 20) diagnostics.shift();
      if (!refusalError) {
        refusalError = explainRelayRefusal(diagnostics.slice(-4), origin);
        if (refusalError) rejectRefusal(new Error(refusalError));
      }
      originalConsole[level](...args);
    };
  }
  const restoreConsole = () => {
    for (const level of ["error", "warn", "debug"]) console[level] = originalConsole[level];
  };

  const createProvider = async (projectId) => {
    const { WalletConnectV2Provider } = await import("@multiversx/sdk-wallet-connect-provider");
    const candidate = new WalletConnectV2Provider(
      {
        // Persisted WalletConnect state can call onClientLogin during init,
        // before the new login has produced a signature. Do not expose that
        // lifecycle callback as proof of a completed user action.
        onClientLogin: () => {},
        onClientLogout: () => report("deconectat"),
        onClientEvent: () => {},
      },
      chainId,
      RELAY_URL,
      projectId,
      {
        metadata: walletConnectMetadata({
          origin,
          redirectNative,
          redirectUniversal,
        }),
        logger: "error",
      }
    );
    await withTimeout(candidate.init(), "inițializarea WalletConnect", INIT_TIMEOUT_MS);
    log("provider-ready", { ms: Date.now() - startedAt, chainId, redirectNative: Boolean(redirectNative) });
    return candidate;
  };

  if (freshPairing && typeof window !== "undefined") {
    report("resetez conexiunea xPortal anterioară…");
    let cleared = 0;
    for (const storageName of ["localStorage", "sessionStorage"]) {
      try { cleared += clearNexusWalletConnectState(window[storageName]); } catch { /* storage can be disabled by the browser */ }
    }
    // A pairing left in the WebView belongs to a session xPortal may already have forgotten; the next
    // attempt always starts from zero so a stale topic cannot shadow the fresh one.
    log("storage-cleared", { keys: cleared, freshPairing: true });
  }
  report("inițializez conexiunea securizată…");
  let provider;
  let connect;
  try {
    provider = await createProvider(selectedProjectId);
    report("conectez Jungle Book la WalletConnect Relay…");
    // A session can remain acknowledged in the browser after xPortal has
    // forgotten or removed it. Reusing that one-sided state opens xPortal
    // without a WalletConnect URI and no approval sheet is displayed. Mobile
    // login therefore defaults to a fresh, explicit pairing. Reuse remains an
    // opt-in for a future flow that first proves liveness with the wallet.
    const persistedSession = selectReusableSession(provider.walletConnector, chainId, { freshPairing });
    connect = persistedSession
      ? { uri: null, approval: async () => persistedSession, reusedSession: true }
      : await withTimeout(
        Promise.race([connectWithDiagnostics(provider, chainId), refusal]),
        "crearea pairing-ului WalletConnect",
        CONNECT_TIMEOUT_MS
      );
  } catch (err) {
    restoreConsole();
    // A relay refusal is the whole story: it already names the origin to allowlist. Anything else
    // keeps the generic sentence plus the last SDK lines, which is all a browser can report.
    const refusalSentence = refusalError || explainRelayRefusal(diagnostics, origin);
    if (refusalSentence) throw new Error(refusalSentence);
    const detail = diagnostics.filter(Boolean).slice(-3).join(" · ");
    throw new Error(
      "WalletConnect nu a creat sesiunea. Verifică dacă Project ID-ul Jungle Book este emis de WalletConnect Dashboard și dacă originea " +
      origin +
      " este permisă în Allowlist. xPortal se poate deschide numai după generarea URI-ului de pairing. " +
      (detail || errMessage(err))
    );
  }
  restoreConsole();

  const { uri, approval, reusedSession = false } = connect;
  if (!uri && !reusedSession) {
    throw new Error("WalletConnect nu a returnat un URI de pairing");
  }
  log("pairing", {
    topic: pairingTopic(uri),
    reused: Boolean(reusedSession),
    ms: Date.now() - startedAt,
  });
  return { provider, init, chainId, uri, approval, reusedSession, redirectNative };
}

/**
 * Starts the pairing, or joins the one already running on this page.
 *
 * One page owns one WalletConnect client; a second concurrent start would initialize Core twice and
 * open a second relay socket against the same storage. See `createSingleFlight`.
 */
export const startXPortalLogin = createSingleFlight(runXPortalLogin);

/** `wc:<topic>@2?…` → `<topic>`; the rest of the URI carries the symmetric key and never leaves. */
export function pairingTopic(uri) {
  const value = String(uri ?? "");
  const match = /^wc:([^@?]{8,128})@2/.exec(value);
  return match ? match[1] : "";
}

export async function finalizeXPortalLogin(
  loginState,
  { onStatus, onPhase, endpoint = "/auth/mvx/native", extra = {} } = {}
) {
  const { provider, init } = loginState;
  const generation = (loginState.generation || 0) + 1;
  loginState.generation = generation;
  const phase = (value) => {
    if (loginState.generation !== generation || loginState.cancelled) return;
    if (['failed', 'complete'].includes(loginState.phase) && value !== 'pairing') return;
    loginState.phase = value; onPhase?.(value);
  };
  const approval = async () => {
    const session = await loginState.approval();
    phase('signature');
    return session;
  };
  const report = (msg) => typeof onStatus === "function" && onStatus(msg);
  phase('pairing');
  report("În xPortal: aprobă conectarea, apoi semnează loginul NativeAuth…");

  try {
    // Official MultiversX flow: provider.login owns both approval and the
    // NativeAuth request. Calling approval() first lets xPortal return to the
    // browser before the signing request exists, leaving mobile users paired
    // but without a signature sheet.
    await withTimeout(provider.login({ approval, token: init }), "confirmarea și semnătura xPortal");
  } catch (err) {
    phase('failed');
    const detail = errMessage(err);
    if (/reject|declin|cancel|4001/i.test(detail)) throw new Error("loginul NativeAuth a fost anulat în xPortal");
    throw new Error("xPortal nu a finalizat loginul: " + detail);
  }

  const address = await provider.getAddress();
  const signature = await provider.getSignature();
  if (loginState.cancelled || loginState.generation !== generation) throw new Error('loginul NativeAuth a fost anulat');
  if (!address) throw new Error("sesiunea xPortal nu conține o adresă MultiversX validă");
  if (!signature) throw new Error("xPortal nu a returnat semnătura NativeAuth");

  const accessToken =
    String(signature).includes(".") && !String(signature).startsWith("0x")
      ? signature
      : buildAccessToken(address, init, signature);

  phase('server');
  report("Semnătură primită ✓ · finalizez loginul în Jungle Book…");
  // Keep one request identity for this pairing, including a lost HTTP response.
  // getRandomValues also works on local HTTP, unlike crypto.randomUUID/subtle.
  if (!loginState.mutationKey) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    loginState.mutationKey = 'xportal:' + Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  let data;
  const controller = new AbortController();
  loginState.sessionAbort = controller;
  const timer = setTimeout(() => controller.abort(), SESSION_TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", "Idempotency-Key": loginState.mutationKey },
      body: JSON.stringify({ token: accessToken, ...extra }),
    });
    data = await res.json();
  } catch (err) {
    phase('failed');
    if (controller.signal.aborted) throw new Error('finalizarea sesiunii Jungle Book a expirat');
    throw new Error("nu am putut apela " + endpoint + ": " + errMessage(err));
  } finally { clearTimeout(timer); if (loginState.sessionAbort === controller) delete loginState.sessionAbort; }
  if (!data?.ok) {
    phase('failed');
    throw new Error(data?.error || "token NativeAuth invalid");
  }
  phase('complete');
  return data;
}

export async function renderWcQr(uri) {
  return QRCode.toString(uri, { type: "svg", margin: 1, width: 220 });
}

// WalletConnect registry advertises xPortal's universal link. On mobile this
// opens the installed app; otherwise it lands on xPortal's install page.
export function xPortalUniversalLink(uri) {
  return uri
    ? `https://xportal.app.link/wc?uri=${encodeURIComponent(uri)}`
    : "https://xportal.app.link/";
}

/**
 * Brings the relay websocket back after the phone left the page.
 *
 * Android suspends a WebView's socket while xPortal is in front, and the WalletConnect relayer can
 * still report `connected` while it is dead. The page therefore restarts the transport and waits for
 * the relayer to answer, so a signature that arrived in the background is replayed into the pending
 * `login()` promise instead of being lost until the next attempt.
 *
 * Returns a plain status object; it never throws, because a failed resume is a diagnostic, not a
 * reason to abandon an approval that may still arrive.
 */
export async function resumeXPortalTransport({ provider, waitMs = 4000 } = {}) {
  const relayer = provider?.walletConnector?.core?.relayer;
  if (!relayer) return { supported: false, connected: false, restarted: false };
  const before = Boolean(relayer.connected);
  let restarted = false;
  let error = "";
  try {
    if (typeof relayer.restartTransport === "function") {
      await relayer.restartTransport();
      restarted = true;
    } else if (!before && typeof relayer.transportOpen === "function") {
      await relayer.transportOpen();
      restarted = true;
    }
  } catch (cause) {
    error = errMessage(cause);
  }
  const deadline = Date.now() + Math.max(0, Number(waitMs) || 0);
  while (!relayer.connected && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return { supported: true, connected: Boolean(relayer.connected), restarted, wasConnected: before, error };
}
