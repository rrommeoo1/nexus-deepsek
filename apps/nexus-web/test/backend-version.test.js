/**
 * Which server is answering: the route an app uses to find out before it publishes.
 *
 * The defect this covers was not a missing feature but a missing question. On 26 October 2026 the
 * phone sent an authored page to a Railway deployment from 6 October; the deployment kept the caption
 * and the photographs, discarded `text_style`, and answered `ok: true` (`JUNGLE_BOOK_PROGRESS.md`
 * §15.3). Nothing in the app could learn, before sending, that the server in front of it had never
 * heard of a page.
 *
 * These tests hold four properties of the answer: it is reachable without a session, it needs no
 * database read, it never invents an identity it does not have, and every capability it claims is one
 * the editorial client actually requires — a map that promises more than the build can do would be
 * worse than no map at all.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleRequest } from '../lib/api.js';
import {
  API_CONTRACT, BACKEND_CAPABILITIES, deploymentFingerprint, readBuildIdentity, sourceFingerprint, versionView,
} from '../lib/build-info.js';

function response() {
  return {
    statusCode: 200, headers: {}, body: '',
    writeHead(status, headers = {}) { this.statusCode = status; Object.assign(this.headers, headers); },
    setHeader(name, value) { this.headers[name] = value; },
    getHeader(name) { return this.headers[name]; },
    end(value) { this.body = String(value || ''); },
  };
}

/**
 * A request with no cookie and no Authorization header: the app that has not signed in yet. The context
 * has no `db` on purpose — the version answer must not depend on one. The repo is a tripwire rather than
 * a database: the only member a request may read is the cached author flag that `handleRequest` resolves
 * for every response before routing (`repo.monetizedAuthorIds`), and anything else throws. A route that
 * quietly started reading posts would fail here instead of passing by accident.
 */
function version(path = '/api/version') {
  const req = {
    method: 'GET', url: path, headers: {}, socket: { remoteAddress: '127.0.0.251' },
    on(event, callback) {
      if (event === 'data') process.nextTick(() => callback(Buffer.alloc(0)));
      if (event === 'end') process.nextTick(callback);
      return this;
    },
    destroy() {},
  };
  const res = response();
  const repo = new Proxy({}, {
    get(_target, property) {
      if (property === 'monetizedAuthorIds') return () => null;
      throw new Error(`the version answer read repo.${String(property)}, which it must not need`);
    },
  });
  return handleRequest(req, res, { repo, sse: { broadcast() {} } })
    .then(() => ({ status: res.statusCode, headers: res.headers, body: res.body ? JSON.parse(res.body) : null }));
}

test('a signed-out app can ask which server it is talking to, without touching the database', async () => {
  const answer = await version();
  assert.equal(answer.status, 200, answer.body?.error);
  assert.equal(answer.headers['cache-control'], 'no-store', 'un răspuns despre build nu se păstrează în cache');
  assert.equal(answer.body.ok, true);
  assert.equal(answer.body.service, 'nexus-web');
  assert.equal(answer.body.api_contract, API_CONTRACT);
  assert.match(String(answer.body.source_fingerprint), /^[0-9a-f]{64}$/);
});

test('the capability map is what the editor needs, and nothing is claimed without a version', () => {
  const advertised = versionView({}).capabilities;
  for (const [name, version] of Object.entries(advertised)) {
    assert.ok(Number.isInteger(version) && version >= 1, `${name} trebuie să aibă o versiune întreagă`);
  }
  // The two the TEXT composer cannot publish without: an authored look, and the blocks of a page.
  assert.ok(advertised.text_style >= 1);
  assert.ok(advertised.editorial_document >= 1);
  // Named here as well, so deleting one from the map is a failing test and not a quiet regression.
  for (const name of ['post_read', 'post_gallery', 'post_tags', 'impressions', 'profile_view_stats']) {
    assert.ok(advertised[name] >= 1, `capacitatea ${name} lipsește din hartă`);
  }
  assert.deepEqual(Object.keys(advertised).sort(), Object.keys(BACKEND_CAPABILITIES).sort());
});

test('an explicit build identity wins, then the platform variable, then the local checkout', () => {
  const sha = 'A1B2C3D4E5F60718293A4B5C6D7E8F9012345678';
  const explicit = readBuildIdentity({ env: { NEXUS_BUILD_COMMIT: sha, RAILWAY_GIT_COMMIT_SHA: 'f'.repeat(40) } });
  assert.equal(explicit.commit, sha.toLowerCase(), 'hash-ul se publică în litere mici');
  assert.equal(explicit.commit_short, 'a1b2c3d');
  assert.equal(explicit.commit_source, 'NEXUS_BUILD_COMMIT');

  const platform = readBuildIdentity({ env: { NEXUS_BUILD_COMMIT: '  ', RAILWAY_GIT_COMMIT_SHA: 'f'.repeat(40) } });
  assert.equal(platform.commit, 'f'.repeat(40));
  assert.equal(platform.commit_source, 'RAILWAY_GIT_COMMIT_SHA');

  // An empty identity is `null`, never a guess and never the string "unknown".
  const directory = mkdtempSync(join(tmpdir(), 'nexus-build-'));
  try {
    const none = readBuildIdentity({ env: {}, rootDir: directory });
    assert.equal(none.commit, null);
    assert.equal(none.commit_short, null);
    assert.equal(none.commit_source, 'unavailable');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a value that is not a hash is refused instead of being echoed on a public route', () => {
  for (const value of ['not-a-commit', '<script>', 'nexus-deepsek-production', 'abc']) {
    const identity = readBuildIdentity({ env: { NEXUS_BUILD_COMMIT: value }, rootDir: join(tmpdir(), 'nexus-nothing-here') });
    assert.equal(identity.commit, null, `${value} nu este un commit`);
    assert.equal(identity.commit_source, 'unavailable');
  }
  // A commit without a time is still a commit; a malformed time is no time at all.
  assert.equal(readBuildIdentity({ env: { NEXUS_BUILD_COMMIT: 'a'.repeat(40), NEXUS_BUILD_TIME: 'yesterday' } }).built_at, null);
  assert.equal(
    readBuildIdentity({ env: { NEXUS_BUILD_COMMIT: 'a'.repeat(40), NEXUS_BUILD_TIME: '2026-10-26T21:53:06Z' } }).built_at,
    '2026-10-26T21:53:06.000Z',
  );
});

test('the fingerprint follows the source it describes', () => {
  const directory = mkdtempSync(join(tmpdir(), 'nexus-fingerprint-'));
  try {
    mkdirSync(join(directory, 'lib'));
    writeFileSync(join(directory, 'server.js'), 'const a = 1;\n');
    writeFileSync(join(directory, 'lib', 'api.js'), 'export const answer = 1;\n');
    const first = sourceFingerprint({ rootDir: directory });
    assert.match(first, /^[0-9a-f]{64}$/);
    assert.equal(sourceFingerprint({ rootDir: directory }), first, 'aceleași fișiere, aceeași amprentă');

    writeFileSync(join(directory, 'lib', 'api.js'), 'export const answer = 2;\n');
    assert.notEqual(sourceFingerprint({ rootDir: directory }), first, 'o linie schimbată schimbă amprenta');

    // A file the digest does not cover must not move it: the fingerprint names the server, not the docs.
    writeFileSync(join(directory, 'lib', 'NOTES.md'), 'not code\n');
    const second = sourceFingerprint({ rootDir: directory });
    writeFileSync(join(directory, 'lib', 'NOTES.md'), 'still not code\n');
    assert.equal(sourceFingerprint({ rootDir: directory }), second);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the deployment fingerprint is this tree, computed once', () => {
  assert.equal(deploymentFingerprint(), deploymentFingerprint());
  assert.match(deploymentFingerprint(), /^[0-9a-f]{64}$/);
  // The tree the tests run in has its own files, so the digest is not the digest of a missing tree.
  assert.notEqual(deploymentFingerprint(), sourceFingerprint({ rootDir: join(tmpdir(), 'nexus-absent-tree') }));
});

test('a checkout one level up still names the commit', () => {
  // This is the shape of the repository: `.git` at the root, the server three levels down.
  const root = mkdtempSync(join(tmpdir(), 'nexus-checkout-'));
  const sha = 'd144ebeb4aacbe85aad9df6bf6cc543d2fd78ff9';
  try {
    mkdirSync(join(root, '.git', 'refs', 'heads'), { recursive: true });
    writeFileSync(join(root, '.git', 'HEAD'), 'ref: refs/heads/main\n');
    writeFileSync(join(root, '.git', 'refs', 'heads', 'main'), `${sha}\n`);
    mkdirSync(join(root, 'apps', 'nexus-web'), { recursive: true });
    const identity = readBuildIdentity({ env: {}, rootDir: join(root, 'apps', 'nexus-web') });
    assert.equal(identity.commit, sha);
    assert.equal(identity.commit_short, 'd144ebe');
    assert.equal(identity.commit_source, 'git-head');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a route that is not the version route is still refused, so this is not a hole in auth', async () => {
  const answer = await version('/api/definitely-not-a-route');
  assert.equal(answer.status, 401);
  assert.equal(answer.body.ok, false);
});
