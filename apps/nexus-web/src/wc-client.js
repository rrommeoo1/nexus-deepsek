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
//   5. assemble NativeAuth accessToken, POST /auth/mvx/native -> Nexus session

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
  if (!/^[a-f0-9]{32}$/i.test(projectId)) throw new Error("WalletConnect Nexus nu este configurat");
  return projectId;
}

export async function startXPortalLogin({ onStatus, freshPairing = true } = {}) {
  const report = (msg) => typeof onStatus === "function" && onStatus(msg);
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
  catch { throw new Error("WalletConnect Nexus nu este configurat pentru această origine"); }
  const diagnostics = [];
  const originalConsole = {};
  for (const level of ["error", "warn", "debug"]) {
    originalConsole[level] = console[level];
    console[level] = (...args) => {
      diagnostics.push(args.map((value) => value?.message || (typeof value === "string" ? value : JSON.stringify(value))).join(" "));
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
        metadata: {
          name: "Nexus",
          description: "Nexus — one wallet, every side of you",
          url: typeof window !== "undefined" ? window.location.origin : "https://localhost",
          icons: [],
        },
        logger: "error",
      }
    );
    await withTimeout(candidate.init(), "inițializarea WalletConnect", INIT_TIMEOUT_MS);
    return candidate;
  };

  if (freshPairing && typeof window !== "undefined") {
    report("resetez conexiunea xPortal anterioară…");
    for (const storageName of ["localStorage", "sessionStorage"]) {
      try { clearNexusWalletConnectState(window[storageName]); } catch { /* storage can be disabled by the browser */ }
    }
  }
  report("inițializez conexiunea securizată…");
  let provider;
  let connect;
  try {
    provider = await createProvider(selectedProjectId);
    report("conectez Nexus la WalletConnect Relay…");
    // A session can remain acknowledged in the browser after xPortal has
    // forgotten or removed it. Reusing that one-sided state opens xPortal
    // without a WalletConnect URI and no approval sheet is displayed. Mobile
    // login therefore defaults to a fresh, explicit pairing. Reuse remains an
    // opt-in for a future flow that first proves liveness with the wallet.
    const persistedSession = selectReusableSession(provider.walletConnector, chainId, { freshPairing });
    connect = persistedSession
      ? { uri: null, approval: async () => persistedSession, reusedSession: true }
      : await withTimeout(connectWithDiagnostics(provider, chainId), "crearea pairing-ului WalletConnect", CONNECT_TIMEOUT_MS);
  } catch (err) {
    restoreConsole();
    const detail = diagnostics.filter(Boolean).slice(-3).join(" · ");
    const origin = typeof window !== "undefined" ? window.location.origin : "originea Nexus";
    throw new Error(
      "WalletConnect nu a creat sesiunea. Verifică dacă Project ID-ul Nexus este emis de WalletConnect Dashboard și dacă originea " +
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

  return { provider, init, chainId, uri, approval, reusedSession };
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
  report("Semnătură primită ✓ · finalizez loginul în Nexus…");
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
    if (controller.signal.aborted) throw new Error('finalizarea sesiunii Nexus a expirat');
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

export async function resumeXPortalTransport({ provider } = {}) {
  const relayer = provider?.walletConnector?.core?.relayer;
  if (!relayer) return false;
  // Mobile browsers can keep `connected=true` while their websocket has been
  // suspended in the background. A forced restart also replays messages that
  // arrived while xPortal was in the foreground (including the NativeAuth
  // signature response).
  if (typeof relayer.restartTransport === "function") {
    await relayer.restartTransport();
  }
  return Boolean(relayer.connected);
}
