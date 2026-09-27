import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { json } from "../lib/transport.js";

const root = new URL("..", import.meta.url);

test("authenticated JSON is never cacheable", () => {
  const response = {
    headers: {}, body: "", status: 0,
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(body) { this.body = body; },
  };
  json(response, 200, { ok: true, private_marker: "must-not-cache" });
  assert.equal(response.status, 200);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(JSON.parse(response.body).private_marker, "must-not-cache");
});

test("the browser has no service worker or response-cache path for protected Social data", () => {
  const publicDir = join(root.pathname.replace(/^\/(.:)/, "$1"), "public");
  const publicFiles = readdirSync(publicDir).filter((name) => /\.(?:js|html)$/i.test(name) && name !== "wc-bundle.js");
  const source = publicFiles.map((name) => readFileSync(join(publicDir, name), "utf8")).join("\n");
  assert.doesNotMatch(source, /navigator\.serviceWorker\.register|caches\.open\s*\(|CacheStorage/);
  assert.doesNotMatch(source, /localStorage\.setItem\([^\n]*(?:feed|profile-response|private-content|messages)/i);
});

test("logout clears user-scoped drafts and volatile Social state only after server success", () => {
  const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(app, /async function clearCurrentUserDeviceCache\(\)/);
  assert.match(app, /`nexus-sigil:\$\{ownerId\}:`/);
  assert.match(app, /`nexus-social-favorites:\$\{ownerId\}:`/);
  assert.match(app, /`nexus-curiosity-ledger:\$\{ownerId\}`/);
  assert.match(app, /`nexus:story-publish:v1:\$\{ownerId\}:`/);
  assert.match(app, /`nexus:upload:v1:\$\{ownerId\}:`/);
  assert.match(app, /Number\(cursor\.value\?\.owner\) === ownerId/);
  assert.match(app, /if \(!result\?\.ok\) return toast[\s\S]{0,180}await clearCurrentUserDeviceCache\(\)/);
  assert.match(app, /revokeDecryptedAttachmentUrls\(\)/);
});

test("protected media responses stay private, uncacheable and cookie-varying", () => {
  const api = readFileSync(new URL("../lib/api.js", import.meta.url), "utf8");
  assert.match(api, /"cache-control": "private, no-store, max-age=0"/);
  assert.match(api, /"vary": "Cookie"/);
  assert.match(api, /if \(!repo\.canReadMedia\(m\.id, auth\.user\.id, auth\.persona\)\) return send\(res, 404/);
});
