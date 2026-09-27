import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveStaticRequest } from "../lib/static-policy.js";

const root = resolve(import.meta.dirname, "..");
const server = readFileSync(resolve(root, "server.js"), "utf8");
const html = readFileSync(resolve(root, "public/diagnostics/e2ee-device-lab.html"), "utf8");
const lab = readFileSync(resolve(root, "public/diagnostics/e2ee-device-lab.js"), "utf8");

test("device lab is explicit opt-in and unavailable in production", () => {
  assert.match(server, /resolveStaticRequest\(req\.url\)/);
  assert.equal(resolveStaticRequest("/diagnostics/e2ee-device-lab", { nodeEnv: "development", deviceLab: "false" }).ok, false);
  assert.equal(resolveStaticRequest("/diagnostics/e2ee-device-lab", { nodeEnv: "production", deviceLab: "true" }).ok, false);
  assert.equal(resolveStaticRequest("/diagnostics/e2ee-device-lab", { nodeEnv: "development", deviceLab: "true" }).relativePath, "/diagnostics/e2ee-device-lab.html");
  for (const bypass of [
    "/diagnostics/x/../e2ee-device-lab.html", "/diagnostics\\e2ee-device-lab.html",
    "/diagnostics/%2e%2e/diagnostics/e2ee-device-lab.html", "/diagnostics%2fe2ee-device-lab.html",
    "/DIAGNOSTICS/e2ee-device-lab.html", "/Diagnostics/e2ee-device-lab.js",
    "/diagnostics/other.html", "/diagnostics/e2ee-device-lab.css",
  ]) assert.equal(resolveStaticRequest(bypass, { nodeEnv: "development", deviceLab: "true" }).ok, false, bypass);
  assert.match(html, /NO PRODUCTION CLAIM/);
  assert.match(lab, /HTTPS de încredere/);
  assert.match(html, /noindex,nofollow,noarchive/);
});

test("device lab uses distinct keys, exact coverage and edge-device decryption", () => {
  assert.match(lab, /deviceCount > 500/);
  assert.match(lab, /crypto\.subtle\.generateKey/);
  assert.match(lab, /await crypto\.subtle\.exportKey\("jwk", keys\.publicKey\)/);
  assert.match(lab, /new Set\(presentedIds\)\.size === expectedIds\.length/);
  assert.match(lab, /JSON\.stringify\(presentedIds\) === JSON\.stringify\(expectedIds\)/);
  assert.match(lab, /recipients\[0\]/);
  assert.match(lab, /recipients\.at\(-1\)/);
  assert.match(lab, /exactCoverage && first\.ok && last\.ok/);
  assert.match(lab, /await yieldAndCheckCancellation\(\);/);
  assert.match(lab, /abortIfCancelled\(\);\s*lastReport = completedReport/);
});

test("downloadable device report is bounded and contains no key, ciphertext or fingerprint material", () => {
  assert.match(lab, /keys_exported: false/);
  assert.match(lab, /ciphertext_exported: false/);
  assert.match(lab, /network_requests_by_harness: 0/);
  assert.doesNotMatch(lab, /\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/);
  assert.doesNotMatch(lab, /navigator\.(?:userAgent|platform|language)/);
  assert.doesNotMatch(lab, /(?:localStorage|sessionStorage)\./);
  assert.doesNotMatch(lab, /content_key_b64\s*:/);
  assert.doesNotMatch(lab, /private_jwk\s*:/);
  assert.match(lab, /URL\.revokeObjectURL/);
});
