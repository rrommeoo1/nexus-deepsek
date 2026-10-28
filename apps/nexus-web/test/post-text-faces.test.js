import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../lib/db.js';
import { createRepo } from '../lib/repo.js';
import { issueSession } from '../lib/security.js';
import { handleRequest } from '../lib/api.js';
import { TEXT_FONTS, TEXT_SIZES, TEXT_THEMES, TEXT_THEME_PALETTE, normalizeTextStyle } from '../lib/post-text-style.js';
import { BACKEND_CAPABILITIES } from '../lib/build-info.js';

/**
 * Every face and every measure the composer offers, through the real route.
 *
 * The owner wrote a page in „Mașină" (`slab`) and the server answered *„Stilul textului nu este
 * acceptat de server"* on 28 October 2026. The cause was not a typo in a list: the allowlist had grown
 * to six faces in the phone's contract (and in `lib/post-text-style.js`) while the build in front of
 * the phone still knew three, and nothing in the protocol could say so. `text_style: 2` in
 * `lib/build-info.js` is that sentence; these tests are the other half of it — the claim that a build
 * saying `2` really does store every one of the six faces, at every measure, in every theme, from the
 * request to the row and back out of `GET /api/posts/:id`.
 *
 * The matrix runs against `handleRequest` and an in-memory database: the same code, the same
 * validation and the same SQL the deployment runs, with no credential, no network and no row anywhere
 * that survives the process.
 */

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    writeHead(status, headers = {}) { this.statusCode = status; Object.assign(this.headers, headers); },
    setHeader(name, value) { this.headers[name] = value; },
    getHeader(name) { return this.headers[name]; },
    end(value) { this.body = String(value || ''); },
  };
}

function request(method, url, cookie, body, key) {
  const raw = Buffer.from(JSON.stringify(body || {}));
  return {
    method, url, headers: { 'content-type': 'application/json', cookie, 'idempotency-key': key },
    socket: { remoteAddress: '127.0.0.242' },
    on(event, callback) {
      if (event === 'data') process.nextTick(() => callback(raw));
      if (event === 'end') process.nextTick(callback);
      return this;
    },
    destroy() {},
  };
}

function fixture() {
  const db = openDb(':memory:');
  const repo = createRepo(db);
  const user = repo.createUser({ handle: 'face-owner', displayName: 'face-owner' });
  repo.ensurePersona(user.id, 'social', { visibility: 'public' });
  const session = issueSession(user.id, 'social');
  repo.insertSession({ tokenHash: session.tokenHash, userId: user.id, persona: 'social', expiresAt: session.expiresAt });
  let counter = 0;
  async function call(method, url, body = {}, key) {
    const res = response();
    await handleRequest(
      request(method, url, `nexus_session=${session.token}`, body, key || `face-test-${++counter}-unique`),
      res,
      { db, repo, sse: { broadcast() {} } },
    );
    return { status: res.statusCode, ...JSON.parse(res.body || '{}') };
  }
  return { db, repo, user, call };
}

test('the version answer claims the second text-style contract, and nothing weaker', () => {
  // The number the phone asks for (`requireTextStyleContract`) has to be the number this build earns:
  // the matrix below is what makes `2` true, so a build that loses a face fails here and there.
  assert.equal(BACKEND_CAPABILITIES.text_style, 2);
  assert.equal(TEXT_FONTS.length, 6);
  assert.equal(TEXT_SIZES.length, 4);
});


test('every face, measure and theme publishes, persists and comes back through the post read', async () => {
  const f = fixture();
  const checked = [];
  try {
    for (const theme of TEXT_THEMES) {
      for (const font of TEXT_FONTS) {
        for (const size of TEXT_SIZES) {
          const caption = `Pagina în ${font}/${size}, tema ${theme}.`;
          const created = await f.call('POST', '/api/posts', {
            kind: 'text',
            caption,
            text_style: { theme, font, size, align: 'left' },
          });
          assert.equal(created.status, 201, `${font}/${size}/${theme}: ${JSON.stringify(created)}`);
          const palette = TEXT_THEME_PALETTE[theme];
          const stored = {
            theme, font, size, align: 'left',
            background: palette.background.toLowerCase(),
            text: palette.text.toLowerCase(),
            media: { scale: 1, x: 0, y: 0 },
          };
          assert.deepEqual(created.post.text_style, stored, `${font}/${size}/${theme} does not come back`);
          assert.deepEqual(f.repo.getPostById(created.post.id).text_style, stored, `${font}/${size}/${theme} is not in the row`);
          const read = await f.call('GET', `/api/posts/${created.post.id}`);
          assert.equal(read.status, 200, JSON.stringify(read));
          assert.deepEqual(read.post.text_style, stored, `${font}/${size}/${theme} does not survive the read`);
          assert.equal(read.post.caption, caption);
          checked.push(`${font}/${size}/${theme}`);
        }
      }
    }
    // The matrix is complete, not a sample: six faces × four measures × six themes.
    assert.equal(checked.length, 144);
  } finally {
    f.db.close();
  }
});

test('a face the phone offers is accepted whatever theme, measure and alignment it is paired with', async () => {
  const f = fixture();
  try {
    // A page may pair any face with any theme — that is the author's choice, not a mismatch — and
    // `xlarge` is the fourth measure the first contract did not have.
    const created = await f.call('POST', '/api/posts', {
      kind: 'text',
      caption: 'Mașină pe cerneală, foarte mare, centrat.',
      text_style: { theme: 'ink', font: 'slab', size: 'xlarge', align: 'center' },
    });
    assert.equal(created.status, 201, JSON.stringify(created));
    assert.equal(created.post.text_style.font, 'slab');
    assert.equal(created.post.text_style.size, 'xlarge');
    assert.equal(created.post.text_style.align, 'center');
    // …and a page that names only the face keeps the default measure and alignment of the contract.
    const bare = await f.call('POST', '/api/posts', {
      kind: 'text', caption: 'Doar litera.', text_style: { theme: 'paper', font: 'condensed' },
    });
    assert.deepEqual(bare.post.text_style, normalizeTextStyle({ theme: 'paper', font: 'condensed' }));
  } finally {
    f.db.close();
  }
});

test('the first contract still publishes unchanged, so older pages and clients keep working', async () => {
  const f = fixture();
  try {
    // The three original faces at the three original measures are the compatibility promise: a phone
    // that only knows `text_style: 1` sends them, and this build must read them exactly as before.
    for (const font of ['serif', 'sans', 'mono']) {
      for (const size of ['small', 'medium', 'large']) {
        const created = await f.call('POST', '/api/posts', {
          kind: 'text', caption: `${font} ${size}`, text_style: { theme: 'paper', font, size },
        });
        assert.equal(created.status, 201, `${font}/${size}: ${JSON.stringify(created)}`);
        assert.equal(created.post.text_style.font, font);
        assert.equal(created.post.text_style.size, size);
      }
    }
    // A row written before the column existed carries no style, and still publishes and reads back null.
    const legacy = await f.call('POST', '/api/posts', { kind: 'text', caption: 'Fără stil.' });
    assert.equal(legacy.status, 201);
    assert.equal(legacy.post.text_style, null);
    const read = await f.call('GET', `/api/posts/${legacy.post.id}`);
    assert.equal(read.post.text_style, null);
  } finally {
    f.db.close();
  }
});

test('the refusals still refuse: an unknown face, an unknown measure, and a hand-painted page', async () => {
  const f = fixture();
  try {
    // The route answers a style refusal as `{ ok: false, error: 'TEXT_STYLE_INVALID' }` (api.js:3839),
    // which `publishClient.ts` maps to `PUBLISH_TEXT_STYLE`.
    for (const text_style of [
      { theme: 'paper', font: 'comic' },
      { theme: 'paper', font: 'Slab' },
      { theme: 'paper', size: 'enormous' },
      { theme: 'neon', font: 'slab' },
      { theme: 'paper', font: 'slab', background: '#000000', text: '#ffffff' },
      { theme: 'paper', font: 'slab', shadow: true },
    ]) {
      const refused = await f.call('POST', '/api/posts', { kind: 'text', caption: 'Refuzată.', text_style });
      assert.equal(refused.status, 400, `${JSON.stringify(text_style)} was accepted`);
      assert.equal(refused.error, 'TEXT_STYLE_INVALID', JSON.stringify(refused));
    }
    // A style on a post with no words has no page to paint. The route refuses the empty page before it
    // ever looks at the style (`api.js`: `text post cannot be empty`), so the author never reaches
    // `TEXT_STYLE_REQUIRES_TEXT` from the phone — the composer refuses an empty page on its own too.
    const empty = await f.call('POST', '/api/posts', { kind: 'text', caption: '', text_style: { theme: 'paper', font: 'slab' } });
    assert.equal(empty.status, 400);
    assert.match(String(empty.error), /empty|TEXT_STYLE_REQUIRES_TEXT/);
    // Nothing above wrote a row: a refusal happens before the transaction.
    assert.equal(f.repo.listPosts({ limit: 50 }).length, 0);
  } finally {
    f.db.close();
  }
});
