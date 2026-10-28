import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../lib/db.js';
import { createRepo } from '../lib/repo.js';
import { issueSession } from '../lib/security.js';
import { handleRequest } from '../lib/api.js';
import { CONTENT_PROVENANCE } from '../lib/moderation.js';

/**
 * The declaration an author makes about how a post was made, from the request to both surfaces.
 *
 * The composer has offered the four declarations since the first release (`provenance`, the same
 * `select[name="provenance"]` the site prints), but the phone only ever *sent* them: the field was
 * stored and returned, and no reading surface ever drew it, so the owner could declare „Asistat de AI"
 * and the post looked identical to an undeclared one. The app now reads `provenance` off the post it
 * already receives and prints a small label — which is only honest if the value it prints is the value
 * that was saved. These tests hold that: the four categories survive publication, the row, the post
 * read and the feed; an absent declaration stays absent (`NOT_DECLARED`, never „created by a human");
 * and a value the server does not know is refused instead of being stored as something it is not.
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
    socket: { remoteAddress: '127.0.0.243' },
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
  const user = repo.createUser({ handle: 'origin-owner', displayName: 'origin-owner' });
  repo.ensurePersona(user.id, 'social', { visibility: 'public' });
  const session = issueSession(user.id, 'social');
  repo.insertSession({ tokenHash: session.tokenHash, userId: user.id, persona: 'social', expiresAt: session.expiresAt });
  let counter = 0;
  async function call(method, url, body = {}, key) {
    const res = response();
    await handleRequest(
      request(method, url, `nexus_session=${session.token}`, body, key || `origin-test-${++counter}-unique`),
      res,
      { db, repo, sse: { broadcast() {} } },
    );
    return { status: res.statusCode, ...JSON.parse(res.body || '{}') };
  }
  return { db, repo, user, call };
}

test('all four declarations survive publication, the row, the post read and the feed', async () => {
  const f = fixture();
  try {
    // The set, not the order: the server's `CONTENT_PROVENANCE` lists the four categories in its own
    // order, and the app maps each id to its own words. A new category on either side must fail here.
    assert.deepEqual(
      [...CONTENT_PROVENANCE].sort(),
      ['NOT_DECLARED', 'CAMERA_CAPTURED_DECLARED', 'AI_ASSISTED', 'AI_GENERATED'].sort(),
    );
    for (const provenance of CONTENT_PROVENANCE) {
      const caption = `Declarația ${provenance}.`;
      const created = await f.call('POST', '/api/posts', { kind: 'text', caption, provenance });
      assert.equal(created.status, 201, `${provenance}: ${JSON.stringify(created)}`);
      // …the answer, the row, the single post and the feed must all say the same word.
      assert.equal(created.post.provenance, provenance, `${provenance} does not come back`);
      assert.equal(f.repo.getPostById(created.post.id).provenance, provenance, `${provenance} is not in the row`);
      const read = await f.call('GET', `/api/posts/${created.post.id}`);
      assert.equal(read.status, 200, JSON.stringify(read));
      assert.equal(read.post.provenance, provenance, `${provenance} is lost in the read`);
      const feed = await f.call('GET', '/api/posts?limit=50');
      assert.equal(feed.status, 200, JSON.stringify(feed));
      const mine = feed.posts.find((entry) => entry.id === created.post.id);
      assert.ok(mine, `${provenance} is missing from the feed`);
      assert.equal(mine.provenance, provenance, `${provenance} is lost in the feed`);
    }
  } finally {
    f.db.close();
  }
});

test('a post that declares nothing stays undeclared, and is never called human-made', async () => {
  const f = fixture();
  try {
    // The composer starts on «Nu declar» (`emptyTextDraft`), and a client that sends no field at all
    // gets the same answer: `normalizeProvenance(undefined)` is `NOT_DECLARED`. The app draws no label
    // for it — a neutral omission, because „creat de autor" is a claim nobody made.
    const silent = await f.call('POST', '/api/posts', { kind: 'text', caption: 'Fără declarație.' });
    assert.equal(silent.status, 201, JSON.stringify(silent));
    assert.equal(silent.post.provenance, 'NOT_DECLARED');
    const declared = await f.call('POST', '/api/posts', { kind: 'text', caption: 'Declarat neutru.', provenance: 'NOT_DECLARED' });
    assert.equal(declared.post.provenance, 'NOT_DECLARED');
    // The two legacy spellings the web sent once are the same neutral value, not a new category.
    for (const legacy of ['USER', 'UNKNOWN', 'user']) {
      const post = await f.call('POST', '/api/posts', { kind: 'text', caption: `Vechi ${legacy}.`, provenance: legacy });
      assert.equal(post.status, 201, JSON.stringify(post));
      assert.equal(post.post.provenance, 'NOT_DECLARED', `${legacy} should read as undeclared`);
    }
  } finally {
    f.db.close();
  }
});

test('a declaration the server does not know is refused, not stored as another one', async () => {
  const f = fixture();
  try {
    for (const provenance of ['HUMAN_VERIFIED', 'HUMAN_CREATED', 'ai_assisted ', 'AI']) {
      const refused = await f.call('POST', '/api/posts', { kind: 'text', caption: 'Declarație inventată.', provenance });
      // `AI_ASSISTED ` with a trailing space is trimmed by `normalizeProvenance`, so it is accepted — that
      // is the one legitimate case below, and it must land as the canonical id.
      if (provenance.trim().toUpperCase() === 'AI_ASSISTED') {
        assert.equal(refused.status, 201, JSON.stringify(refused));
        assert.equal(refused.post.provenance, 'AI_ASSISTED');
        continue;
      }
      assert.equal(refused.status, 400, `${provenance} was accepted: ${JSON.stringify(refused)}`);
      assert.equal(refused.error, 'provenance invalid');
    }
    // A refusal writes nothing: only the accepted spelling above is in the feed.
    const feed = await f.call('GET', '/api/posts?limit=50');
    assert.equal(feed.posts.length, 1, JSON.stringify(feed.posts.map((entry) => entry.provenance)));
  } finally {
    f.db.close();
  }
});

test('the declaration rides every kind of post, without changing what the post is', async () => {
  const f = fixture();
  try {
    // The rule is not about text: a photograph, a clip and a page of words all carry the author's own
    // words about how they were made, and the kind, the caption and the look are untouched by it.
    const media = f.repo.insertMedia({
      hash: 'b'.repeat(64), ext: 'jpg', mime: 'image/jpeg', kind: 'image', size: 40960,
      uploadedBy: f.user.id, purpose: 'social_post', actorPersona: 'social',
      scanStatus: 'ready_local_validation', scanReason: '',
    });
    assert.ok(media, 'the fixture media row is written');
    const withPhoto = await f.call('POST', '/api/posts', {
      kind: 'image', caption: 'O fotografie.', provenance: 'AI_ASSISTED',
      media_items: [{ hash: media.hash, ext: media.ext }],
    });
    assert.equal(withPhoto.status, 201, JSON.stringify(withPhoto));
    assert.equal(withPhoto.post.kind, 'image');
    assert.equal(withPhoto.post.provenance, 'AI_ASSISTED');
    const page = await f.call('POST', '/api/posts', {
      kind: 'text', caption: 'O pagină scrisă cu ajutor.', provenance: 'AI_ASSISTED', text_style: { theme: 'paper', font: 'slab' },
    });
    assert.equal(page.status, 201, JSON.stringify(page));
    assert.equal(page.post.provenance, 'AI_ASSISTED');
    assert.equal(page.post.text_style.font, 'slab');
  } finally {
    f.db.close();
  }
});
