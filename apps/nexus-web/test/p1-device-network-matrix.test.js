import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { api, apiErrorMessage, normalizeApiResult } from "../public/client.js";
import { callCapability } from "../public/call-client.js";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
const foundation = await readFile(new URL("../public/p3-visual-foundation.css", import.meta.url), "utf8");

function override(name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  return () => descriptor ? Object.defineProperty(globalThis, name, descriptor) : delete globalThis[name];
}

test("offline mutations fail closed before fetch and GET network failure retries only twice", async () => {
  let calls = 0;
  const restoreNavigator = override("navigator", { onLine: false });
  const restoreFetch = override("fetch", async () => { calls++; throw new Error("must not mutate offline"); });
  try {
    const mutation = await api("/api/posts", { method: "POST", body: { caption: "draft" } });
    assert.equal(mutation.code, "OFFLINE");
    assert.equal(mutation.retryable, true);
    assert.equal(calls, 0);

    globalThis.navigator.onLine = true;
    const read = await api("/api/feed");
    assert.equal(read.code, "OFFLINE");
    assert.equal(calls, 3);
  } finally {
    restoreFetch();
    restoreNavigator();
  }
});

test("client error contract keeps domain status, bounds retry metadata and supports localization", async () => {
  const response = {
    ok: false,
    status: 429,
    headers: new Headers({ "retry-after": "12", "x-request-id": "req:social-117" }),
  };
  const normalized = normalizeApiResult(response, { ok: false, error: "too many" });
  assert.deepEqual(normalized, {
    ok: false,
    error: "too many",
    code: "RATE_LIMITED",
    errorKey: "errors.rateLimited",
    httpStatus: 429,
    retryable: true,
    retryAfter: 12,
    requestId: "req:social-117",
  });
  assert.equal(apiErrorMessage(normalized, (key) => key === "errors.rateLimited" ? "Încearcă mai târziu" : key), "Încearcă mai târziu");
  const domainStatus = normalizeApiResult({ ok: true, status: 200, headers: new Headers() }, { ok: true, status: "withdrawn" });
  assert.equal(domainStatus.status, "withdrawn");
  assert.equal(domainStatus.httpStatus, 200);

  const unsafe = normalizeApiResult({ ok: false, status: 503, headers: new Headers({ "retry-after": "99999", "x-request-id": "<script>" }) }, null);
  assert.equal(unsafe.code, "SERVICE_UNAVAILABLE");
  assert.equal(unsafe.retryable, true);
  assert.equal(unsafe.retryAfter, null);
  assert.equal(unsafe.requestId, null);
});

test("camera/call capability denies insecure and missing-device contexts truthfully", () => {
  const restoreSecure = override("isSecureContext", false);
  const restoreNavigator = override("navigator", { mediaDevices: { getUserMedia() {} } });
  const restorePeer = override("RTCPeerConnection", function Peer() {});
  try {
    assert.deepEqual(callCapability(), { ready: false, reason: "Apelurile necesită HTTPS sau localhost" });
    globalThis.isSecureContext = true;
    globalThis.navigator = {};
    assert.deepEqual(callCapability(), { ready: false, reason: "WebRTC nu este disponibil în acest browser" });
  } finally {
    restorePeer();
    restoreNavigator();
    restoreSecure();
  }
});

test("responsive shell has phone, narrow-phone, landscape, safe-area and reduced-motion gates", () => {
  assert.match(index, /viewport-fit=cover/);
  assert.match(index, /id="network-state"/);
  assert.match(app, /window\.addEventListener\("offline"/);
  assert.match(app, /window\.addEventListener\("online"/);
  assert.match(app, /navigator\.onLine === false/);
  assert.match(styles, /@media\(max-width:760px\)/);
  assert.match(styles, /@media\(max-width:360px\)/);
  assert.match(styles, /@media\(max-width:760px\) and \(orientation:landscape\)/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(foundation, /@media \(max-width: 380px\)/);
  assert.match(foundation, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(foundation, /\.networkState\[hidden\]/);
});
