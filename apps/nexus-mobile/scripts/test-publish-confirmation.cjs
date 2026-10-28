/* global __dirname */
/**
 * What the editor is allowed to call "publicat".
 *
 * `publishPost` verifies the answer of `POST /api/posts` field by field (`readPublishedPost`). This suite
 * covers the case that produced a live defect on 26 October 2026: the body carried an authored page
 * (`text_style` with a `document`), the deployment that received it was a build from before the
 * editorial rounds, so it stored the caption and the photographs, ignored `text_style`, and answered
 * `ok: true` anyway. The editor reported a publication; the feed could only draw a photograph with a
 * caption, because nothing in the record said it was a page.
 *
 * The rule these tests hold: a page that was sent and not returned is never confirmed, the words the
 * author wrote still travel (the caption is the page's text), and a post without an authored page keeps
 * confirming exactly as before — a photograph never needs a `text_style` to be a publication.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

function load(file, requireShim) {
  const source = readFileSync(resolve(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleShim = { exports: {} };
  new Function('module', 'exports', 'require', code)(moduleShim, moduleShim.exports, requireShim);
  return moduleShim.exports;
}

const publishClient = load('src/lib/publishClient.ts', (id) => {
  if (id === './apiOrigin') return { API_ORIGIN: 'https://api.test' };
  if (id === './idempotency') {
    return { idempotencyKeyIsValid: (key) => typeof key === 'string' && key.length > 0, newMutationKey: (scope) => `${scope}-test` };
  }
  if (id === './publishing') {
    return { PublishingError: class PublishingError extends Error {}, normalizePublishing: (value) => value };
  }
  if (id === './session') return { authHeaders: () => ({ Origin: 'https://api.test' }) };
  if (id === './textStyle') {
    return { normalizeTextStyle: (value) => value, TextStyleError: class TextStyleError extends Error {} };
  }
  throw new Error(`publishClient.ts a cerut un modul neașteptat: ${id}`);
});

const { publishPost, publishBody, publishIntentKey } = publishClient;

const HASH = 'a'.repeat(64);
const COMMITMENT = 'b'.repeat(64);

const DOCUMENT = Object.freeze({
  version: 1,
  blocks: [
    { id: 'p-1', type: 'paragraph', text: 'Dimineața începe cu roua pe frunze.' },
    { id: 'm-2', type: 'media', mediaIndex: 0, placement: 'left', widthFraction: 0.5, wrapText: true },
    { id: 'p-3', type: 'paragraph', text: 'Aerul miroase a pământ ud.' },
  ],
});

const PAGE_STYLE = Object.freeze({ theme: 'paper', face: 'serif', size: 'small', align: 'left', document: DOCUMENT });


/** The authored page with one photograph: the case the defect was reported for. */
function pageIntent(overrides = {}) {
  return {
    persona: 'social',
    caption: 'Dimineața începe cu roua pe frunze.\n\nAerul miroase a pământ ud.',
    visibility: 'public',
    provenance: 'NOT_DECLARED',
    kind: 'image',
    mediaItems: [{ hash: HASH, ext: 'png' }],
    textStyle: PAGE_STYLE,
    ...overrides,
  };
}

/** A photograph without an authored page: the case that must keep working untouched. */
function photoIntent(overrides = {}) {
  const intent = pageIntent(overrides);
  delete intent.textStyle;
  return intent;
}

function answerBody(post) {
  return {
    ok: true,
    action: 'post_published',
    owner_persona: 'social',
    owner_id: 7,
    chain: { status: 'not_submitted', value: 0 },
    post: {
      id: 41,
      user_id: 7,
      persona: 'social',
      kind: 'image',
      content_commitment: COMMITMENT,
      created_at: 1792998043,
      media: [{ hash: HASH, ext: 'png' }],
      ...post,
    },
  };
}

/**
 * One canned `POST /api/posts`. The request body is kept, so a test can prove what was sent as well as
 * what came back: the layout travels in `text_style.document`, always.
 */
function stubFetch(body) {
  const sent = [];
  globalThis.fetch = async (url, options) => {
    sent.push({ url: String(url), body: JSON.parse(String(options?.body ?? '{}')) });
    return { ok: true, status: 200, json: async () => body };
  };
  return sent;
}

async function rejection(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('publicarea a fost confirmată, deși nu trebuia');
}

test('an authored page is sent in text_style.document, not as a caption alone', () => {
  const body = publishBody(pageIntent());
  assert.equal(body.kind, 'image');
  assert.deepEqual(body.text_style.document, DOCUMENT);
  assert.equal(body.media_items.length, 1, 'fotografia călătorește în galerie, în ordinea ei');
  assert.match(String(body.caption), /roua pe frunze/, 'textul paginii este descrierea trimisă');
});

test('a page that comes back with its layout is a publication', async () => {
  const sent = stubFetch(answerBody({ text_style: PAGE_STYLE }));
  const post = await publishPost({ intent: pageIntent(), key: publishIntentKey(), userId: 7 });
  assert.equal(post.id, 41);
  assert.equal(post.kind, 'image');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, 'https://api.test/api/posts');
  assert.deepEqual(sent[0].body.text_style.document, DOCUMENT);
});

test('a page that comes back without its layout is not confirmed, and the words are explained', async () => {
  // The exact answer of a deployment older than the editorial rounds: the post is real, the page is gone.
  stubFetch(answerBody({}));
  const error = await rejection(publishPost({ intent: pageIntent(), key: publishIntentKey(), userId: 7 }));
  assert.equal(error.name, 'PublishError');
  assert.equal(error.code, 'PUBLISH_TEXT_STYLE_LOST');
  assert.match(error.message, /nu a păstrat pagina/);
  assert.match(error.message, /Ciorna rămâne pe telefon/);
  assert.doesNotMatch(error.message, /^[A-Z_]+$/, 'mesajul este o propoziție, nu un cod');
});

test('a null text_style in the answer is the same loss as a missing one', async () => {
  stubFetch(answerBody({ text_style: null }));
  const error = await rejection(publishPost({ intent: pageIntent(), key: publishIntentKey(), userId: 7 }));
  assert.equal(error.code, 'PUBLISH_TEXT_STYLE_LOST');
});

test('the layout is expected only when it was sent: a photograph still publishes without one', async () => {
  stubFetch(answerBody({}));
  const post = await publishPost({ intent: photoIntent(), key: publishIntentKey(), userId: 7 });
  assert.equal(post.id, 41);
  assert.equal(post.kind, 'image');
});

test('a page of words only keeps the same expectation', async () => {
  const intent = pageIntent({ kind: null, mediaItems: [], caption: 'Doar cuvinte, așezate pe pagină.' });
  const sent = stubFetch(answerBody({ kind: 'text', text_style: PAGE_STYLE, media: [] }));
  const post = await publishPost({ intent, key: publishIntentKey(), userId: 7 });
  assert.equal(post.kind, 'text');
  assert.equal(sent[0].body.kind, 'text');
  assert.deepEqual(sent[0].body.text_style.document, DOCUMENT);
});

test('an answer that names another account is still a plain verification failure', async () => {
  stubFetch(answerBody({ text_style: PAGE_STYLE, user_id: 8 }));
  const error = await rejection(publishPost({ intent: pageIntent(), key: publishIntentKey(), userId: 7 }));
  assert.equal(error.code, 'PUBLISH_VERIFY_FAILED');
});

