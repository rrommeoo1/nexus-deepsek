import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildAccessToken,
  createSingleFlight,
  explainRelayRefusal,
  finalizeXPortalLogin,
  clearNexusWalletConnectState,
  getSessionAccount,
  resumeXPortalTransport,
  selectReusableSession,
  selectWalletConnectProjectId,
  selectNativeAuthMethod,
  walletConnectMetadata,
  xPortalUniversalLink,
} from "../src/wc-client.js";
import { assertNativeAuthIdempotencyKey } from '../lib/native-auth-session.js';
import { runInNewContext } from 'node:vm';

test('progress comes from approval/signature/server result, not returning from the wallet', async () => {
  const original = globalThis.fetch, phases = [];
  const state = { init: 'test', approval: async () => ({ topic: 'test' }), provider: {
    login: async ({ approval }) => { assert.deepEqual(phases, ['pairing']); await approval(); assert.deepEqual(phases, ['pairing', 'signature']); },
    getAddress: () => 'erd1test', getSignature: () => 'abcdef',
  } };
  try {
    globalThis.fetch = async () => { assert.equal(state.phase, 'server'); return { json: async () => ({ ok: true }) }; };
    await finalizeXPortalLogin(state, { onPhase: (value) => phases.push(value) });
    assert.deepEqual(phases, ['pairing', 'signature', 'server', 'complete']);
  } finally { globalThis.fetch = original; }
});

test('server wait is bounded and cancelled signing never sends a session request', async () => {
  const original = globalThis.fetch, originalTimer = globalThis.setTimeout;
  const state = { init: 'test', provider: { login: async () => {}, getAddress: () => 'erd1test', getSignature: () => 'abcdef' } };
  try {
    globalThis.setTimeout = (fn, ms) => originalTimer(fn, ms === 25000 ? 1 : ms);
    globalThis.fetch = async (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
    await assert.rejects(finalizeXPortalLogin(state), /finalizarea sesiunii Jungle Book a expirat/);
    assert.equal(state.phase, 'failed'); assert.equal(state.sessionAbort, undefined);
    state.cancelled = true;
    globalThis.fetch = async () => { assert.fail('cancelled flow must not send'); };
    await assert.rejects(finalizeXPortalLogin(state), /anulat/);
  } finally { globalThis.fetch = original; globalThis.setTimeout = originalTimer; }
});

test('actual signature CTA cannot overwrite server/success/error or detached screens', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const source = app.slice(app.indexOf('  const showSignatureCta = () => {'), app.indexOf('  const resumeAfterWallet = async () => {'));
  for (const phase of ['pairing', 'signature', 'server', 'complete', 'failed']) {
    const updates = [], link = { classList: { add() {} } };
    const show = runInNewContext(source + '; showSignatureCta', {
      flowDone: false, isCurrent: () => true, wcState: { phase }, t: (key) => key,
      document: { getElementById: () => link, querySelector: () => ({}) },
      mod: { xPortalUniversalLink: () => 'https://xportal.app.link/' }, setStatus: (text) => updates.push(text),
    });
    show(); assert.equal(updates.length, phase === 'signature' ? 1 : 0);
    if (phase === 'signature') assert.equal(link.href, 'https://xportal.app.link/');
  }
  for (const done of [true, false]) {
    runInNewContext(source + '; showSignatureCta()', { flowDone: done, isCurrent: () => false, wcState: { phase: 'signature' }, document: { getElementById() { assert.fail('Detached UI update'); } } });
  }
});

test('xPortal finalization supplies the backend-required stable request key even after a lost response', async () => {
  const original = globalThis.fetch, calls = [];
  const state = { init: 'SYSTEM_TEST_INIT', approval: async () => ({}), provider: {
    login: async () => {}, getAddress: async () => 'erd1test', getSignature: async () => 'abcdef',
  } };
  try {
    globalThis.fetch = async (path, options) => {
      calls.push({ path, ...options });
      assertNativeAuthIdempotencyKey(options.headers['Idempotency-Key']);
      if (calls.length === 1) throw new Error('SYSTEM_TEST_LOST_RESPONSE');
      return { json: async () => ({ ok: true }) };
    };
    await assert.rejects(finalizeXPortalLogin(state), /SYSTEM_TEST_LOST_RESPONSE/);
    assert.deepEqual(await finalizeXPortalLogin(state), { ok: true });
    assert.equal(calls[0].headers['Idempotency-Key'], calls[1].headers['Idempotency-Key']);
    assert.equal(calls[0].body, calls[1].body);
    assert.equal(calls[0].path, '/auth/mvx/native');
    await finalizeXPortalLogin({ ...state, mutationKey: undefined });
    assert.notEqual(calls[1].headers['Idempotency-Key'], calls[2].headers['Idempotency-Key']);
  } finally { globalThis.fetch = original; }
});

test('rejected wallet approval cannot create a Nexus session request', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => { assert.fail('Must not contact session endpoint without signature'); };
    await assert.rejects(finalizeXPortalLogin({ provider: { login: async () => { throw new Error('4001 rejected'); } } }), /anulat/);
  } finally { globalThis.fetch = original; }
});

const walletConnectSource = await readFile(new URL("../src/wc-client.js", import.meta.url), "utf8");

test("WalletConnect accepts only the explicitly configured Jungle Book project ID", () => {
  const projectId = "0123456789abcdef0123456789abcdef";
  assert.equal(selectWalletConnectProjectId(projectId), projectId);
  assert.throws(() => selectWalletConnectProjectId(""), /nu este configurat/);
  assert.throws(() => selectWalletConnectProjectId("template-public-id"), /nu este configurat/);
});

test("WalletConnect pairing fails quickly and explains the external project/origin gate", () => {
  assert.match(walletConnectSource, /CONNECT_TIMEOUT_MS = 15_000/);
  assert.match(walletConnectSource, /Project ID-ul Jungle Book este emis de WalletConnect Dashboard/);
  assert.match(walletConnectSource, /este permisă în Allowlist/);
  assert.match(walletConnectSource, /numai după generarea URI-ului de pairing/);
});

test("xPortal universal link retains the complete WalletConnect URI", () => {
  const uri = "wc:topic@2?relay-protocol=irn&symKey=abc+123";
  const link = new URL(xPortalUniversalLink(uri));
  assert.equal(link.origin, "https://xportal.app.link");
  assert.equal(link.pathname, "/wc");
  assert.equal(link.searchParams.get("uri"), uri);
  assert.equal(xPortalUniversalLink(null), "https://xportal.app.link/");
});

test("approved session binds the mainnet account and NativeAuth method", () => {
  const session = {
    namespaces: {
      mvx: {
        accounts: ["mvx:1:erd1nexus", "mvx:D:erd1devnet"],
        methods: ["mvx_signMessage", "mvx_signNativeAuthToken"],
      },
    },
  };
  assert.equal(getSessionAccount(session, "1"), "erd1nexus");
  assert.equal(getSessionAccount(session, "D"), "erd1devnet");
  assert.equal(selectNativeAuthMethod(session), "mvx_signNativeAuthToken");
  assert.equal(selectNativeAuthMethod({ namespaces: { mvx: { methods: ["mvx_signLoginToken"] } } }), "mvx_signLoginToken");
  assert.equal(selectNativeAuthMethod({ namespaces: { mvx: { methods: [] } } }), "");
});

test("NativeAuth access token has address, init and signature segments", () => {
  const token = buildAccessToken("erd1example", "init-token", "0xabcdef");
  const parts = token.split(".");
  assert.equal(parts.length, 3);
  assert.equal(parts[2], "abcdef");
});

test("mobile resume forcibly restarts a stale relay even when marked connected", async () => {
  let restarts = 0;
  const relayer = {
    connected: true,
    async restartTransport() { restarts += 1; },
  };
  const provider = { walletConnector: { core: { relayer } } };

  const resumed = await resumeXPortalTransport({ provider, waitMs: 0 });
  assert.deepEqual(resumed, { supported: true, connected: true, restarted: true, wasConnected: true, error: "" });
  assert.equal(restarts, 1);
  // A provider that was never created is reported, not thrown: the page still shows a sentence.
  assert.deepEqual(await resumeXPortalTransport({}), { supported: false, connected: false, restarted: false });
  assert.deepEqual(await resumeXPortalTransport(), { supported: false, connected: false, restarted: false });
});

test("a resume that cannot reopen the transport reports the failure instead of throwing", async () => {
  const relayer = { connected: false, async restartTransport() { throw new Error("relay down"); } };
  const resumed = await resumeXPortalTransport({ provider: { walletConnector: { core: { relayer } } }, waitMs: 0 });
  assert.equal(resumed.supported, true);
  assert.equal(resumed.connected, false);
  assert.equal(resumed.restarted, false);
  assert.equal(resumed.error, "relay down");
});

test("wallet metadata carries the app redirect so xPortal can hand the reader back", () => {
  const plain = walletConnectMetadata({ origin: "https://nexus.example" });
  assert.deepEqual(plain.redirect, undefined);
  const redirected = walletConnectMetadata({
    origin: "https://nexus.example",
    redirectNative: "nexus://",
    redirectUniversal: "https://nexus.example/xportal-bridge.html",
  });
  assert.deepEqual(redirected.redirect, {
    native: "nexus://",
    universal: "https://nexus.example/xportal-bridge.html",
  });
  assert.equal(walletConnectMetadata({ redirectNative: "  " }).redirect, undefined);
});

test("the bridge page forwards the app redirect and reports the relay when the app returns", async () => {
  const page = await readFile(new URL("../public/xportal-bridge.js", import.meta.url), "utf8");
  // The sheet passes `?redirect=<scheme>`; only a bare scheme reaches the metadata.
  assert.match(page, /const redirectSafe = \/\^\[a-z\]\[a-z0-9\+\.-\]\{1,30\}:\\\/\\\/\$\//);
  assert.match(page, /redirect: \{ native: redirectSafe, universal: redirectUniversal \}/);
  // Android suspends the socket while xPortal is in front; the app asks the page to restart it.
  assert.match(page, /window\.__nexusResume = async \(\) => \{/);
  assert.match(page, /post\(\{ type: 'relay', \.\.\.status \}\)/);
  // Diagnostics name the topic, never the pairing URI (it carries the symmetric key).
  assert.match(page, /logEvent\('relay-resume'/);
  assert.doesNotMatch(page, /logEvent\([^)]*\.uri\b/);
});

test("the bridge page gives a slow wallet five minutes to sign", async () => {
  const page = await readFile(new URL("../public/xportal-bridge.js", import.meta.url), "utf8");
  // xPortal needed 192s to show its sign screen in the field: a three-minute window cancelled the
  // attempt a couple of seconds before the fingerprint prompt appeared.
  assert.match(page, /300_000,\s*\n\s*'xPortal nu a răspuns în 5 minute'/);
  assert.doesNotMatch(page, /180_000/);
});

test("mobile login rejects one-sided persisted sessions unless reuse is explicitly enabled", () => {
  const session = {
    topic: "stale-browser-only-topic",
    acknowledged: true,
    expiry: Math.floor(Date.now() / 1000) + 300,
    namespaces: { mvx: { accounts: ["mvx:1:erd1nexus"] } },
  };
  const connector = {
    session: {
      keys: [session.topic],
      get(topic) { return topic === session.topic ? session : null; },
    },
  };

  assert.equal(selectReusableSession(connector, "1"), null);
  assert.equal(selectReusableSession(connector, "1", { freshPairing: true }), null);
  assert.equal(selectReusableSession(connector, "1", { freshPairing: false }), session);
});

test("NativeAuth uses the official provider login coordinator without pre-consuming approval", () => {
  assert.match(walletConnectSource, /provider\.login\(\{ approval, token: init \}\)/);
  assert.doesNotMatch(walletConnectSource, /session\s*=\s*await withTimeout\(approval\(\)/);
  assert.match(walletConnectSource, /provider\.getAddress\(\)/);
  assert.match(walletConnectSource, /provider\.getSignature\(\)/);
  assert.doesNotMatch(walletConnectSource, /onClientLogin:\s*\(\)\s*=>\s*report/);
});

test("fresh login clears only WalletConnect state and preserves Nexus device-wallet data", () => {
  const values = new Map([
    ["wc@2:client:0.3//session", "session"],
    ["walletconnect", "legacy"],
    ["nexus.device-wallet.active", "erd1local"],
    ["unrelated.preference", "dark"],
  ]);
  const storage = {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    removeItem(key) { values.delete(key); },
  };

  assert.equal(clearNexusWalletConnectState(storage), 2);
  assert.equal(values.has("wc@2:client:0.3//session"), false);
  assert.equal(values.has("walletconnect"), false);
  assert.equal(values.get("nexus.device-wallet.active"), "erd1local");
  assert.equal(values.get("unrelated.preference"), "dark");
});

test("a refused relay origin is named exactly, instead of becoming a generic 15 s timeout", () => {
  const origin = "https://nexus-deepsek-production.up.railway.app";
  // The line the WalletConnect SDK logs and then retries forever.
  const sdk = "Fatal socket error: WebSocket connection closed abnormally with code: 3000 (Unauthorized: origin not allowed)";
  const sentence = explainRelayRefusal([sdk], origin);
  assert.match(sentence, new RegExp("refuză originea " + origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(sentence, /Allowed origins/);
  assert.match(sentence, /localhost/);
  // The relay's own JSON-RPC frame, as caught inside the WebView, is read the same way.
  const frame = '{"id":0,"jsonrpc":"2.0","error":{"code":3000,"message":"Unauthorized: origin not allowed"}}';
  assert.match(explainRelayRefusal(frame, "http://127.0.0.1:5000"), /http:\/\/127\.0\.0\.1:5000/);
  // Unrelated failures keep the generic path: no invented allowlist advice.
  assert.equal(explainRelayRefusal(["Socket closed 1006"], origin), "");
  assert.equal(explainRelayRefusal([], origin), "");
  assert.equal(explainRelayRefusal(undefined, origin), "");
  assert.match(explainRelayRefusal(['{"code":-32600,"message":"Project not found"}'], origin), /Project ID/);
});

test("one page runs one pairing at a time and frees the slot when the attempt ends", async () => {
  let calls = 0;
  const start = createSingleFlight(async (value) => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { value, calls };
  });
  const [first, second] = await Promise.all([start("a"), start("b")]);
  assert.equal(calls, 1, "a second tap must join the running attempt, not init Core twice");
  assert.equal(first, second);
  assert.deepEqual(first, { value: "a", calls: 1 });
  assert.deepEqual(await start("c"), { value: "c", calls: 2 }, "a finished attempt frees the slot");

  const failing = createSingleFlight(async () => { throw new Error("relay offline"); });
  await assert.rejects(failing(), /relay offline/);
  await assert.rejects(failing(), /relay offline/, "a failed attempt must not lock the next one");
});

test("a relay refusal ends the connect wait as soon as it is logged", () => {
  const source = walletConnectSource;
  // The refusal has to reject the race around `connect()`, not only decorate the catch block.
  assert.match(source, /Promise\.race\(\[connectWithDiagnostics\(provider, chainId\), refusal\]\)/);
  assert.match(source, /rejectRefusal\(new Error\(refusalError\)\)/);
  assert.match(source, /export const startXPortalLogin = createSingleFlight\(runXPortalLogin\)/);
});
