/* global __dirname, process */
// The relation model, held against the server it reads. `src/lib/relations.ts` is the app's one answer for
// "what is between me and this account", and this contract asks it the questions the audit of
// `apps/nexus-web/lib/api.js` and `lib/repo.js` answered (§19.1 of MIGRATION.md): what each payload really
// says, what the module does with it, what it does when the server refuses, and what a button ends up
// printing on every screen for the same pair of accounts.
//
// Four oracles, all real:
//   * the module itself is imported (transpiled like the app's other scripts) and called, not grepped;
//   * `interface-locale.js` is the ro-RO bundle: every word the module exports is asserted against it;
//   * `api.js` and `repo.js` are read for the exact fields and status codes the module documents, so a
//     renamed field is a failing test rather than a silent guess;
//   * the screens are read (statically) for the relation button, which is how §19.4's inventory is kept.
//
// Usage: node scripts/test-relations.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');
const react = require('react');

const ROOT = resolve(__dirname, '..');
const REPO = resolve(ROOT, '..', '..');
const WEB = resolve(REPO, 'apps/nexus-web');
const LOCALE = resolve(WEB, 'public/interface-locale.js');
const API = resolve(WEB, 'lib/api.js');
const REPO_SOURCE = resolve(WEB, 'lib/repo.js');
const RELATIONS = resolve(ROOT, 'src/lib/relations.ts');
const BUTTON = resolve(ROOT, 'src/components/RelationButton.tsx');
const HEADER = resolve(ROOT, 'src/components/ProfileHeader.tsx');
const SCREEN = resolve(ROOT, 'src/screens/ProfileScreen.tsx');
const TICKER = resolve(ROOT, 'src/components/ProfileTicker.tsx');

/** Compiled the way the app's other scripts compile TS: transpile, then run against a shimmed require. */
function compile(file) {
  return ts.transpileModule(readFileSync(file, 'utf8'), {
    fileName: file,
    compilerOptions: {
      allowJs: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React, esModuleInterop: true,
    },
  }).outputText;
}

const noop = () => null;
const loose = new Proxy(function loose() {}, {
  get: (target, key) => (key === '__esModule' ? true : loose), apply: () => loose, construct: () => loose,
});

/** The API is a stub here: every call is recorded, and the answer is whatever the test set. */
const calls = [];
let responder = null;
class FakeNexusApiError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}
const apiStub = {
  __esModule: true,
  API_ORIGIN: 'https://api.test',
  NexusApiError: FakeNexusApiError,
  nexusApi: (path, options = {}) => {
    calls.push({ path, options, body: options.body ? JSON.parse(String(options.body)) : null });
    if (!responder) throw new Error(`no responder for ${path}`);
    const answer = responder(path, options);
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  },
};
const reactStub = { __esModule: true, ...react, useSyncExternalStore: () => undefined };

function loadModule(file, overrides = {}) {
  const moduleShim = { exports: {} };
  const shim = Object.prototype.hasOwnProperty.call(overrides, 'self')
    ? overrides.self
    : (id) => (Object.prototype.hasOwnProperty.call(overrides, id) ? overrides[id] : loose);
  new Function('exports', 'require', 'module', compile(file))(moduleShim.exports, shim, moduleShim);
  return moduleShim.exports;
}

const relations = loadModule(RELATIONS, { './nexusApi': apiStub, react: reactStub });
const tokens = loadModule(resolve(ROOT, 'src/theme/social.ts')).socialTokens;
const localeSource = readFileSync(LOCALE, 'utf8');
const apiSource = readFileSync(API, 'utf8');
const repoSource = readFileSync(REPO_SOURCE, 'utf8');

/** The bundle's own word for a key, so a label in the module cannot drift from the product's vocabulary. */
function romanian(key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`"${escaped}":\\s*"([^"]*)"`).exec(localeSource);
  assert.ok(match, `interface-locale.js has no ${key}`);
  return match[1];
}

function reset() {
  calls.length = 0;
  responder = null;
  relations.forgetRelations();
}

/** A record as the store holds it after one payload, for a target with no relation facts at all. */
function recordFor(userId, patch = {}) {
  relations.remember({ userId, ...patch });
  return relations.relationOf(userId);
}

const TARGET = { userId: 7, handle: 'selly', name: 'Selly', persona: 'social' };

test('the words the module prints are the bundle\'s own words', () => {
  assert.equal(relations.RELATION_WORDS.follow, romanian('x.menu.follow'));
  assert.equal(relations.RELATION_WORDS.following, romanian('publicProfile.following'));
  assert.equal(relations.RELATION_WORDS.unfollow, romanian('x.menu.unfollow'));
  assert.equal(relations.RELATION_WORDS.requested, romanian('publicProfile.requested'));
  assert.equal(relations.RELATION_WORDS.accept, romanian('thread.accept'));
  assert.equal(relations.RELATION_WORDS.decline, romanian('thread.decline'));
  assert.equal(relations.RELATION_WORDS.friends, romanian('feed.friends'));
  assert.equal(relations.RELATION_WORDS.edit, romanian('publicProfile.edit'));
  assert.equal(relations.RELATION_WORDS.message, romanian('publicProfile.message'));
  assert.equal(relations.RELATION_WORDS.block, romanian('x.menu.block'));
  assert.equal(relations.RELATION_WORDS.unblock, romanian('x.menu.unblock'));
  assert.equal(relations.RELATION_WORDS.mute, romanian('x.menu.mute'));
  assert.equal(relations.RELATION_WORDS.unmute, romanian('x.menu.unmute'));
  assert.equal(relations.RELATION_WORDS.options, romanian('x.menu.title'));
  assert.equal(relations.RELATION_WORDS.relationshipFailed, romanian('x.menu.relationshipFailed'));
  assert.equal(relations.RELATION_WORDS.requestCancelled, romanian('friends.requestCancelled'));
  assert.equal(relations.RELATION_WORDS.unavailable, romanian('publicProfile.unavailable'));
  // The header's own words are the owner's (§19.2) and are not in the bundle yet: they are asserted where they
  // live, so a later move to a bundle key is a failing test rather than a silent second copy.
  assert.equal(relations.HEADER_WORDS.following, 'Urmărești');
  assert.equal(relations.HEADER_WORDS.followers, 'Urmăritori');
  assert.equal(relations.HEADER_WORDS.posts, 'Postări');
  assert.equal(relations.HEADER_WORDS.followBack, 'Urmărește înapoi');
  assert.equal(relations.HEADER_WORDS.requestFollow, 'Cere să urmărești');
  assert.equal(relations.HEADER_WORDS.share, 'Distribuie profilul');
});

test('every endpoint the module documents is really in the server', () => {
  assert.match(apiSource, /path === "\/api\/follow"/);
  assert.match(apiSource, /path === "\/api\/follow\/requests"/);
  assert.match(apiSource, /path === "\/api\/social\/relations"/);
  assert.match(apiSource, /path === "\/api\/profile\/block"/);
  assert.match(apiSource, /path === "\/api\/profile\/mute"/);
  // And the three the module refuses to draw: no route removes a follower, none reports an account, and none
  // publishes another account's `message_policy` for reading (§19.1).
  assert.doesNotMatch(apiSource, /removeFollower|unfollow-me|follower\/remove/);
  assert.doesNotMatch(repoSource, /removeFollower/);
  assert.doesNotMatch(apiSource, /message_policy:\s*profile\.message_policy/);
});

test('the normalizer reads each payload for the fields that payload really carries', () => {
  reset();
  // `GET /api/profiles/:handle` (api.js:2989-3030): `is_following`, `follow_request_pending`, `counts`.
  const profile = relations.patchFromProfile({
    user_id: 7, is_self: false, is_following: true, follow_request_pending: false,
    visibility: 'public', counts: { followers: 601, following: 2, posts: 6 },
  });
  assert.deepEqual(profile.counts, { followers: 601, following: 2, posts: 6 });
  assert.equal(profile.following, true);
  assert.equal(profile.followingKnown, true);
  relations.remember(profile);
  assert.equal(relations.relationOf(7).following, true);

  // `GET /api/social/relations` (repo.js:1903-1932): `relation` names the list, `following_me` is my side.
  const follower = relations.patchFromPerson({ user_id: 9, relation: 'followers', following_me: false });
  assert.equal(follower.followsMe, true, 'a followers row says that account follows me');
  assert.equal(follower.following, false);
  assert.equal(follower.followingKnown, true, 'following_me is my side of the relation (repo.js:1929)');
  const mutual = relations.patchFromPerson({ user_id: 10, relation: 'followers', following_me: true });
  assert.equal(mutual.followsMe, true);
  assert.equal(mutual.following, true);

  // A post (`api.js:742-746`): the mute, the block and the waiting request — never the follow side.
  const post = relations.patchFromPost({ author: { id: 11 }, muted_by_me: true, blocked_by_me: false, follow_request_pending: true });
  assert.equal(post.mutedByMe, true);
  assert.equal(post.blockedByMe, false);
  assert.equal(post.requested, true);
  assert.equal(post.following, undefined, 'the post payload has no follow field: the module leaves it alone');
  assert.equal(post.followingKnown, undefined);

  // A live session: `is_following`, which is my side again.
  const live = relations.patchFromLive({ host_id: 12, is_following: true });
  assert.equal(live.following, true);
  assert.equal(live.followingKnown, true);

  // Nothing is invented for a payload that names nobody.
  assert.equal(relations.patchFromProfile(null), null);
  assert.equal(relations.patchFromPost({}), null);
  assert.equal(relations.patchFromLive({}), null);
  assert.equal(relations.patchFromPerson({ id: 0 }), null);
});

test('a partial payload never wipes a fact another payload knew', () => {
  reset();
  relations.remember({ userId: 7, following: true, followingKnown: true, followsMe: true, counts: { followers: 10 } });
  relations.remember({ userId: 7, mutedByMe: true });
  const record = relations.relationOf(7);
  assert.equal(record.following, true);
  assert.equal(record.followsMe, true);
  assert.equal(record.mutedByMe, true);
  assert.deepEqual(record.counts, { followers: 10 });

  relations.remember({ userId: 7, counts: { following: 4 } });
  assert.deepEqual(relations.relationOf(7).counts, { followers: 10, following: 4 }, 'counters merge, they do not replace');
});

test('rememberPayload reads a whole envelope, whichever shape it is', () => {
  reset();
  relations.rememberPayload({
    profile: { user_id: 20, is_following: true, visibility: 'private', counts: { followers: 3, posts: 1 } },
    posts: [{ author: { id: 21 }, muted_by_me: true }],
    people: [{ user_id: 22, relation: 'followers', following_me: true }],
    live: [{ host_id: 23, is_following: true }],
  });
  assert.equal(relations.relationOf(20).following, true);
  assert.equal(relations.relationOf(20).visibility, 'private');
  assert.equal(relations.relationOf(21).mutedByMe, true);
  assert.equal(relations.relationOf(22).followsMe, true);
  assert.equal(relations.relationOf(22).following, true);
  assert.equal(relations.relationOf(23).following, true);
  // A payload that names nobody writes nothing.
  relations.rememberPayload(null);
  relations.rememberPayload({ ok: true });
  assert.equal(relations.relationsSnapshot().length, 4);
});

/** One cell of the matrix: the record, and what `deriveRelationUi` answers for it, on a clean store. */
function uiFor(patch, target = TARGET, viewer = {}) {
  reset();
  const record = recordFor(patch.userId ?? 7, patch);
  return relations.deriveRelationUi(record, target, viewer);
}

test('deriveRelationUi answers one state for every relation the server can hold', () => {
  reset();
  const bundle = relations.RELATION_WORDS;
  const words = relations.HEADER_WORDS;

  const self = uiFor({ userId: 7, self: true, followingKnown: true });
  assert.equal(self.kind, 'self');
  assert.equal(self.primary.label, bundle.edit);
  assert.equal(self.menu.length, 0, 'my own record has no relations menu');
  assert.equal(self.message.enabled, false);

  const unavailable = uiFor({ userId: 7, unavailable: true, followingKnown: false });
  assert.equal(unavailable.kind, 'unavailable');
  assert.equal(unavailable.primary.action, 'none');
  assert.equal(unavailable.contentVisible, false);
  assert.deepEqual(unavailable.menu, []);

  const blocked = uiFor({ userId: 7, blockedByMe: true, followingKnown: true, following: false });
  assert.equal(blocked.kind, 'blocked');
  assert.equal(blocked.primary.action, 'unblock');
  assert.equal(blocked.primary.label, bundle.unblock);
  assert.equal(blocked.contentVisible, false);
  assert.deepEqual(blocked.menu.map((entry) => entry.id), ['unblock']);

  const requested = uiFor({ userId: 7, requested: true, followingKnown: false, visibility: 'private' });
  assert.equal(requested.kind, 'requested');
  assert.equal(requested.primary.label, bundle.requested);
  assert.equal(requested.primary.action, 'cancel_request');
  assert.equal(requested.primary.confirm, bundle.requestCancelled);
  assert.equal(requested.contentVisible, false);

  const following = uiFor({ userId: 7, following: true, followingKnown: true });
  assert.equal(following.kind, 'following');
  assert.equal(following.primary.label, bundle.following);
  assert.equal(following.primary.action, 'unfollow');
  assert.equal(following.primary.confirm, bundle.unfollow);

  const friends = uiFor({ userId: 7, following: true, followingKnown: true, followsMe: true });
  assert.equal(friends.kind, 'friends');
  assert.equal(friends.primary.label, bundle.friends);
  assert.equal(friends.primary.action, 'unfollow', 'pressing a friendship is the unfollow, with its confirmation');

  const back = uiFor({ userId: 7, following: false, followingKnown: true, followsMe: true });
  assert.equal(back.kind, 'follow_back');
  assert.equal(back.primary.label, words.followBack);
  assert.equal(back.primary.action, 'follow');

  const requestable = uiFor({ userId: 7, following: false, followingKnown: true, visibility: 'private' });
  assert.equal(requestable.kind, 'requestable');
  assert.equal(requestable.primary.label, words.requestFollow);
  assert.equal(requestable.primary.action, 'request');
  assert.equal(requestable.contentVisible, false);

  const followable = uiFor({ userId: 7, following: false, followingKnown: true, visibility: 'public' });
  assert.equal(followable.kind, 'followable');
  assert.equal(followable.primary.label, bundle.follow);
  assert.equal(followable.primary.tone, 'accent');
  assert.equal(followable.message.enabled, true);

  // The web's own post payload never says whether the reader follows the author, so the module reads the record
  // instead of printing a guess (the `followingKnown` flag).
  const unresolved = uiFor({ userId: 7, blockedByMe: false });
  assert.equal(unresolved.kind, 'unresolved');
  assert.equal(unresolved.primary.action, 'none');
  assert.deepEqual(unresolved.menu, []);

  // A record the reader's own message was refused for (403, api.js:5116-5118).
  const refused = uiFor({ userId: 7, following: true, followingKnown: true, messageRefused: true });
  assert.equal(refused.message.enabled, false);
  assert.ok(refused.message.reason);

  // The reader's own record is recognisable without `is_self`, from the viewer's id alone.
  reset();
  const mine = relations.deriveRelationUi(relations.remember({ userId: 7, followingKnown: true }), TARGET, { userId: 7 });
  assert.equal(mine.kind, 'self');
});

test('the relations menu holds only what the server can perform', () => {
  reset();
  const stranger = relations.relationMenu(recordFor(7, { followingKnown: true }));
  assert.deepEqual(stranger.map((entry) => entry.id), ['mute', 'block']);
  assert.equal(stranger[1].destructive, true);

  const muted = relations.relationMenu(recordFor(8, { mutedByMe: true }));
  assert.deepEqual(muted.map((entry) => entry.id), ['unmute', 'block']);

  const blocked = relations.relationMenu(recordFor(9, { blockedByMe: true }));
  assert.deepEqual(blocked.map((entry) => entry.id), ['unblock'], 'a blocked account keeps only the way back');

  assert.deepEqual(relations.relationMenu(recordFor(10, { self: true })), []);
  assert.deepEqual(relations.relationMenu(recordFor(11, { unavailable: true })), []);
  assert.deepEqual(relations.relationMenu(undefined), []);
});

test('a follow writes the record first, then the server\'s answer replaces it', async () => {
  reset();
  relations.remember({ userId: 7, followingKnown: true, following: false, counts: { followers: 600 } });
  responder = () => ({ ok: true, active: true, request_pending: false, counts: { followers: 601, following: 2 } });
  const pending = relations.setFollowing({ userId: 7, persona: 'social' }, true);
  // The optimistic half is already in the store, with the action in flight on the same record.
  assert.equal(relations.relationOf(7).following, true);
  assert.equal(relations.relationOf(7).busy, 'follow');
  const after = await pending;
  assert.equal(after.following, true);
  assert.equal(after.followingKnown, true);
  assert.equal(after.busy, null);
  assert.deepEqual(after.counts, { followers: 601, following: 2 });
  // The body is the one the server documents (`api.js:4489`): `user_id`, `persona`, `active`.
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/follow');
  assert.deepEqual(calls[0].body, { user_id: 7, persona: 'social', active: true });
  // `nexusApi` mints the replay key; this module adds the web's own `Origin` to every mutation.
  assert.equal(calls[0].options.headers.Origin, 'https://api.test');
});

test('a private target turns the follow into a waiting request (202)', async () => {
  reset();
  relations.remember({ userId: 7, followingKnown: true, following: false, visibility: 'private' });
  responder = () => ({ ok: true, active: false, request_pending: true, request_id: 33 });
  const after = await relations.setFollowing({ userId: 7, persona: 'social' }, true);
  assert.equal(after.following, false);
  assert.equal(after.requested, true);
  assert.equal(relations.deriveRelationUi(after, TARGET).kind, 'requested');
});

test('cancelling a waiting request is the same call with active:false', async () => {
  reset();
  relations.remember({ userId: 7, followingKnown: false, requested: true, visibility: 'private' });
  responder = () => ({ ok: true, active: false, request_pending: false, counts: { followers: 600 } });
  const after = await relations.cancelFollowRequest({ userId: 7, persona: 'social' });
  assert.deepEqual(calls[0].body, { user_id: 7, persona: 'social', active: false });
  assert.equal(after.requested, false);
  assert.equal(relations.deriveRelationUi(after, TARGET).kind, 'requestable');
});

test('a refusal puts the record back exactly where it was, and says what happened', async () => {
  reset();
  relations.remember({
    userId: 7, following: true, followingKnown: true, followsMe: true, mutedByMe: false,
    counts: { followers: 12, following: 5 }, visibility: 'public',
  });
  const before = { ...relations.relationOf(7) };
  responder = () => new FakeNexusApiError('Cererea nu a putut fi trimisă.', 429);
  await assert.rejects(() => relations.setFollowing({ userId: 7, persona: 'social' }, false));
  const after = relations.relationOf(7);
  assert.equal(after.following, before.following, 'the optimistic unfollow is rolled back');
  assert.equal(after.followingKnown, true);
  assert.equal(after.followsMe, true);
  assert.equal(after.busy, null, 'nothing is left in flight');
  assert.deepEqual(after.counts, before.counts);
  assert.match(relations.relationErrorMessage(new FakeNexusApiError('x', 429)), /Reîncearcă/);
  assert.equal(relations.relationErrorMessage(new FakeNexusApiError('x', 404)), relations.RELATION_WORDS.unavailable);
  assert.equal(relations.relationErrorMessage(new FakeNexusApiError('x', 409)), 'Relația s-a schimbat între timp. Reîncarcă și încearcă din nou.');
  assert.equal(relations.relationErrorMessage(new FakeNexusApiError('x', 500)), 'Serverul nu a confirmat schimbarea. Reîncearcă.');
  assert.equal(relations.relationErrorMessage(new Error('boom')), relations.RELATION_WORDS.relationshipFailed);
});

test('a 404 is the server saying the record is not available to this reader', async () => {
  reset();
  relations.remember({ userId: 7, followingKnown: true, following: false });
  responder = () => new FakeNexusApiError('profile not found', 404, 'SOCIAL_FOLLOW_BLOCKED');
  await assert.rejects(() => relations.setFollowing({ userId: 7, persona: 'social' }, true));
  const record = relations.relationOf(7);
  assert.equal(record.unavailable, true);
  const ui = relations.deriveRelationUi(record, TARGET);
  assert.equal(ui.kind, 'unavailable');
  assert.equal(ui.primary.action, 'none', 'nothing is offered for a record the server hides');
});

test('a double tap cannot become two requests', async () => {
  reset();
  relations.remember({ userId: 7, followingKnown: true, following: false });
  let release = null;
  responder = () => new Promise((resolve) => { release = () => resolve({ ok: true, active: true, request_pending: false }); });
  const first = relations.setFollowing({ userId: 7, persona: 'social' }, true);
  const second = await relations.setFollowing({ userId: 7, persona: 'social' }, true);
  assert.equal(calls.length, 1, 'the second press saw the action in flight');
  assert.equal(second.busy, 'follow');
  release();
  await first;
  assert.equal(calls.length, 1);
});

test('blocking clears what the server clears, and unblocking restores only itself', async () => {
  reset();
  relations.remember({ userId: 7, following: true, followingKnown: true, followsMe: true, requested: true });
  responder = () => ({ ok: true, active: true });
  const blocked = await relations.setBlocked({ userId: 7, persona: 'social' }, true);
  assert.deepEqual(calls[0].body, { user_id: 7, persona: 'social', active: true });
  assert.equal(blocked.blockedByMe, true);
  assert.equal(blocked.following, false, 'the server deletes both follows (repo.js:997-998)');
  assert.equal(blocked.followsMe, false);
  assert.equal(blocked.requested, false, 'and cancels both requests (repo.js:999-1001)');

  responder = () => ({ ok: true, active: false });
  const free = await relations.setBlocked({ userId: 7, persona: 'social' }, false);
  assert.equal(free.blockedByMe, false);
  assert.equal(free.following, false, 'an unblock does not invent a follow back');
});

test('a mute changes nothing but the mute, and its topic scope is never invented', async () => {
  reset();
  relations.remember({ userId: 7, following: true, followingKnown: true });
  responder = () => ({ ok: true, muted: true, scope: 'account', topic: '' });
  const muted = await relations.setMuted({ userId: 7, persona: 'social' }, true);
  assert.deepEqual(calls[0].body, { user_id: 7, persona: 'social', active: true, scope: 'account', topic: '' });
  assert.equal(muted.mutedByMe, true);
  assert.equal(muted.following, true, 'a mute revokes nothing (repo.js:1530-1537)');
});

test('the two answers to a request that came in go through the same store', async () => {
  reset();
  relations.remember({ userId: 7, followsMe: false, followingKnown: true, following: false });
  responder = (path) => { assert.equal(path, '/api/follow/requests/44/decision'); return { ok: true, decision: 'accept', request_id: 44 }; };
  const accepted = await relations.decideFollowRequest({ requestId: 44, userId: 7, persona: 'social' }, 'accept');
  assert.deepEqual(calls[0].body, { decision: 'accept' });
  assert.equal(accepted.followsMe, true, 'an accepted request is what makes them a follower (repo.js:1884)');
  assert.equal(calls[0].options.headers.Origin, 'https://api.test');
  assert.equal(relations.decideFollowRequest({ requestId: 0, userId: 0 }, 'decline') instanceof Promise, true);
});

test('one pair of accounts, one answer — whichever payload asked first', () => {
  /**
   * The same fact arrives from four different reads (a profile, a relation list, a live session, this app's own
   * mutation), and every one of them has to leave the reader seeing the same button. This is the invariant the
   * owner's matrix asks for ("zero celule contradictorii").
   */
  const fromProfile = () => relations.patchFromProfile({ user_id: 7, is_following: true, visibility: 'public', counts: { followers: 4, following: 5, posts: 6 } });
  const fromList = () => relations.patchFromPerson({ user_id: 7, relation: 'following', following_me: true, counts: { followers: 4, following: 5 } });
  const fromLive = () => relations.patchFromLive({ host_id: 7, is_following: true });
  for (const build of [fromProfile, fromList, fromLive]) {
    reset();
    relations.remember(build());
    const ui = relations.deriveRelationUi(relations.relationOf(7), TARGET, { userId: 1 });
    assert.equal(ui.kind, 'following', `every read of the same pair answers the same way (${ui.kind})`);
    assert.equal(ui.primary.label, relations.RELATION_WORDS.following);
    assert.equal(ui.message.enabled, true);
  }

  // A payload that says nothing about the follow side never becomes a confident "Urmărește".
  reset();
  relations.remember(relations.patchFromPost({ author: { id: 7 }, follow_request_pending: false }));
  const unknown = relations.deriveRelationUi(relations.relationOf(7), TARGET, { userId: 1 });
  assert.equal(unknown.kind, 'unresolved');
  assert.equal(unknown.primary.action, 'none');
});

test('reading one unknown record is one request, and it fills the store', async () => {
  reset();
  responder = (path) => {
    assert.equal(path, '/api/profiles/selly?persona=social');
    return { ok: true, profile: { user_id: 7, handle: 'selly', is_following: true, visibility: 'public', counts: { followers: 4, following: 5, posts: 6 } } };
  };
  const first = relations.resolveRelation('selly', 'social');
  const second = relations.resolveRelation('@selly', 'social');
  const [record] = await Promise.all([first, second]);
  assert.equal(calls.length, 1, 'the second read of the same handle while the first is in flight is not made');
  assert.equal(record.following, true);
  assert.equal(relations.deriveRelationUi(relations.relationOf(7), TARGET).kind, 'following');
  assert.equal(relations.useRelationResolving('selly'), false);

  // A record that cannot be read stays unknown, and that is said instead of guessed.
  reset();
  responder = () => new FakeNexusApiError('profil indisponibil', 404);
  assert.equal(await relations.resolveRelation('ghost'), null);
  assert.equal(relations.relationsSnapshot().length, 0);
});

test('the header prints the owner\'s measurements, from tokens, with no cover left', () => {
  const identity = tokens.identity;
  assert.equal(identity.avatarSize, 92, 'the big circle of the reference');
  assert.equal(identity.nameSize, 28);
  assert.equal(identity.handleSize, 15);
  assert.equal(identity.statCountSize, 20);
  assert.equal(identity.statLabelSize, 14);
  assert.equal(identity.minTarget, 44, 'every mark in the top row is a real aim');
  const buttons = tokens.relations;
  assert.equal(buttons.buttonHeight, 38);
  assert.equal(buttons.buttonRadius, 19, 'fully round');
  assert.equal(buttons.buttonGap, 8);
  assert.equal(buttons.roundSize, 38);
  assert.equal(buttons.minTarget, 44);

  const header = readFileSync(HEADER, 'utf8');
  assert.match(header, /socialTokens\.identity\.avatarSize/);
  assert.match(header, /socialTokens\.identity\.nameSize/);
  assert.match(header, /socialTokens\.identity\.statCountSize/);
  assert.match(header, /socialTokens\.relations\.buttonGap/);
  assert.match(header, /RelationButton/);
  assert.match(header, /RelationMenuButton/);
  assert.match(header, /MessageButton/);
  // The three things the audit found missing on the server are not drawn: no bell, no verified badge, no link row.
  assert.doesNotMatch(header, /🔔|clopoțel|BELL/);
  assert.match(header, /no verification field/, 'the missing field is written down instead of filled with a badge');
  assert.match(header, /hasUnseenStory/);

  const screen = readFileSync(SCREEN, 'utf8');
  assert.doesNotMatch(screen, /ProfileCoverPhoto/, 'the cover band is gone from the native profile');
  assert.match(screen, /<ProfileHeader/);
  assert.match(screen, /rememberPayload\(result\)/);
  assert.match(screen, /useRelation\(data\?\.profile\?\.user_id\)/);
  // The header prints the counters and the identity, so the band that repeated them is not drawn at all:
  // one reading per column (`MIGRATION.md` §19.2).
  assert.doesNotMatch(screen, /<ProfileTicker/, 'the band no longer repeats what the header prints');

  const ticker = readFileSync(TICKER, 'utf8');
  assert.match(ticker, /export function tickerItems\(profile: ProfileView \| null, counters = true, identity = true\)/);
  assert.match(ticker, /if \(counters\) \{/);
  assert.match(ticker, /if \(identity\) \{/);

  const edit = readFileSync(resolve(ROOT, 'src/components/ProfileEditSheet.tsx'), 'utf8');
  assert.doesNotMatch(edit, /ProfileCoverPhoto|coverFrame|coverBadge|pickPhoto\('cover'\)/, 'the editor no longer arranges a cover');
  assert.match(edit, /The cover field\s*\n?\s*\*\s*that used to stand above it is gone/);
  assert.match(edit, /profileEditBody\(profile, draft, \{ avatar \}\)/, 'and it writes only the portrait');

  const button = readFileSync(BUTTON, 'utf8');
  assert.match(button, /deriveRelationUi\(relation, target, \{ userId: viewerUserId \}\)/);
  assert.match(button, /resolveRelation\(target\.handle, persona\)/);
  assert.match(button, /relationErrorMessage\(cause\)/);
});

test('every screen that prints a face prints the same relation button (§19.4)', () => {
  const inventory = {
    'src/components/PostCard.tsx': ['RelationButton', 'useRelation'],
    'src/screens/FriendsScreen.tsx': ['RelationButton', 'decideFollowRequest', 'rememberPayload'],
    'src/screens/SearchScreen.tsx': ['RelationButton', 'rememberPayload'],
    'src/screens/LiveScreen.tsx': ['RelationButton', 'rememberPayload'],
    'src/screens/FeedScreen.tsx': ['rememberPayload'],
    'src/screens/ProfileScreen.tsx': ['ProfileHeader', 'rememberPayload'],
  };
  for (const [file, needles] of Object.entries(inventory)) {
    const source = readFileSync(resolve(ROOT, file), 'utf8');
    for (const needle of needles) {
      assert.match(source, new RegExp(needle), `${file} should use ${needle}`);
    }
    // No screen keeps a relation rule of its own: the words and the call come from the one module.
    assert.doesNotMatch(source, /'\/api\/follow'/, `${file} must not call the follow route itself`);
  }
  // The route that hosts somebody else's profile hands the header its own arrow back.
  const route = readFileSync(resolve(ROOT, 'src/app/profile/[handle].tsx'), 'utf8');
  assert.match(route, /onBack=\{\(\) => router\.back\(\)\}/);
  assert.doesNotMatch(route, /styles\.back\b/, 'the floating back button is gone: the header draws one header');
});








