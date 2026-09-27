import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveStaticRequest } from "../lib/static-policy.js";

const server = readFileSync(new URL("../server.js", import.meta.url), "utf8");

test("static routing denies hidden and traversal-shaped files before filesystem access", () => {
  for (const path of ["/.env", "/.git/config", "/%2eenv", "/assets/.secret", "/%2e%2e/server.js", "/..%2fserver.js", "/%5cserver.js"]) {
    assert.equal(resolveStaticRequest(path).ok, false, path);
  }
  assert.equal(resolveStaticRequest("/styles.css").ok, true);
});

test("the static server allow-lists MIME types and revalidates mutable assets", () => {
  assert.match(server, /Object\.prototype\.hasOwnProperty\.call\(MIME, ext\)/);
  assert.match(server, /"no-cache, max-age=0, must-revalidate"/);
  assert.match(server, /"vary": "Accept-Encoding"/);
  assert.doesNotMatch(server, /MIME\[ext\] \?\? "application\/octet-stream"/);
});

test("browser policy blocks inline script attributes, workers, frames and legacy cross-domain policy", () => {
  assert.match(server, /script-src-attr 'none'/);
  assert.match(server, /worker-src 'none'/);
  assert.match(server, /frame-src 'none'/);
  assert.match(server, /frame-ancestors 'none'/);
  assert.match(server, /Origin-Agent-Cluster/);
  assert.match(server, /X-Permitted-Cross-Domain-Policies/);
});
