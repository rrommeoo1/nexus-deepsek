/* global __dirname */
// Redistribuiri: al cincilea tab al profilului, care ia locul Momentelor (owner, 27 octombrie 2026).
//
// Ce trebuie sa fie adevarat, si se citeste aici pe date, nu pe text:
//
//   identitatea  un tab de redistribuiri listeaza *nodurile* partajate (`__repost`), nu un tip de
//                postare: o repostare de reel, una de fotografie si una de pagina de cuvinte sunt toate
//                redistribuiri, iar originalul care sta langa ele pe perete nu este — chiar cand e scris
//                de proprietar;
//   fara dubluri  o postare care nu a fost redistribuita nu apare in tab, si o postare care a fost apare
//                exact o data, cu cheia ei de share (`repost-<id>`), nu cu a originalului (`post-<id>`);
//   atribuirea   fiecare celula spune a cui este distribuirea ("Ai redistribuit", "Redistribuit de
//                @handle"), iar autorul original ramane in cuvintele postarii, pe care celula le tipareste;
//   mersul       un walk pornit din tab merge exact peste celulele lui, iar un tap pe o repostare isi
//                gaseste pagina dupa cheie, nu dupa id-ul pe care il are in comun cu originalul.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');

function load(file, requireShim) {
  const out = ts.transpileModule(readFileSync(resolve(ROOT, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleShim = { exports: {} };
  new Function('module', 'exports', 'require', out)(moduleShim, moduleShim.exports, requireShim);
  return moduleShim.exports;
}

const grid = load('src/lib/profileGrid.ts', () => ({}));
const social = load('src/lib/socialTypes.ts', () => ({}));
const presentation = load('src/lib/postPresentation.ts', () => ({}));
const content = load('src/lib/profileContent.ts', (id) => {
  if (id === './socialTypes') return social;
  if (id === './postPresentation') return presentation;
  if (id === './profileGrid') return grid;
  throw new Error(`profileContent.ts asked for ${id}`);
});

const read = (file) => readFileSync(resolve(ROOT, file), 'utf8');
/** Source without comments: a sentence inside a note is not a control. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');


/**
 * The real shape the payload has (`GET /api/profiles/:handle`): the owner's own posts, then the shares
 * the same profile made, newest share first, each carrying the post it carries.
 *
 * Post 8 is both: the owner wrote it (post-8) *and* redistributed it (repost-4). Post 13 is a reel
 * nobody shared, post 12 is a page of words nobody shared, and 21/22 are other people's posts this
 * profile shared.
 */
const payload = {
  posts: [
    { id: 8, caption: 'the same words', created_at: 250, grid_position: 0 },
    { id: 12, caption: 'a page of words', created_at: 200, grid_position: 1 },
    { id: 13, caption: 'a reel', created_at: 150, grid_position: 2, media: { kind: 'video', hash: 'c'.repeat(64), ext: 'mp4' } },
  ],
  reposts: [
    {
      share_id: 4, reposted_at: 400, grid_position: 3,
      repost: { id: 4, reposted_at: 400, mine: true, reposter: { id: 12, handle: 'wallet4e8gv6' } },
      post: { id: 8, caption: 'the same words', created_at: 250 },
    },
    {
      share_id: 7, reposted_at: 300, grid_position: 4,
      repost: { id: 7, reposted_at: 300, mine: true, reposter: { id: 12, handle: 'wallet4e8gv6' } },
      post: { id: 21, caption: 'someone else wrote this', created_at: 100, media: { kind: 'image', hash: 'd'.repeat(64), ext: 'jpg' } },
    },
    {
      share_id: 9, reposted_at: 100, grid_position: 5,
      repost: { id: 9, reposted_at: 100, mine: true, reposter: { id: 12, handle: 'wallet4e8gv6' } },
      post: { id: 22, caption: 'and this', created_at: 90 },
    },
  ],
  shared_replies: [],
};

const archive = content.profileArchive(payload);
const arrangement = grid.arrangementMap(archive.posts);
const redistributed = content.wallPosts(content.wallBands(archive, 'redistribuiri', 'newest', { arrangement }));

test('the fifth tab is Redistribuiri: a node kind of its own, not a kind of post', () => {
  assert.deepEqual([...content.CONTENT_TAB_ORDER], ['flow', 'reels', 'shots', 'whispers', 'redistribuiri']);
  assert.equal(content.CONTENT_TAB_LABELS.redistribuiri, 'Redistribuiri');
  assert.equal(content.CONTENT_TAB_GLYPHS.redistribuiri, '⟳');
  assert.equal(content.CONTENT_KINDS.redistribuiri, 'repost');
  // No post is of the kind "repost": the tab reads the share, and `profilePostKind` never answers it.
  for (const post of archive.posts) {
    assert.notEqual(content.profilePostKind(post), 'repost');
  }
  assert.deepEqual(content.PROFILE_EMPTY_STATES.redistribuiri, {
    title: 'Nicio redistribuire încă.',
    detail: 'Postările pe care le redistribui din feed apar aici, cu autorul lor.',
  });
});

test('the tab lists exactly the shares, once each, with the cell key of the share', () => {
  assert.deepEqual(redistributed.map(content.archiveKey), ['repost-4', 'repost-7', 'repost-9']);
  // Post 8 stands on the wall as itself, but the tab is not the wall: only its share belongs here.
  assert.equal(redistributed.some((post) => content.archiveKey(post) === 'post-8'), false);
  // Nothing unshared is in the list — the reel and the page of words nobody redistributed.
  const ids = redistributed.map((post) => Number(post.id));
  assert.equal(ids.includes(13), false, 'a reel nobody shared is not a redistribution');
  assert.equal(ids.includes(12), false, 'a page of words nobody shared is not a redistribution');
  assert.equal(redistributed.length, payload.reposts.length);
  // The wall holds the post and its share as two cells, and the two keys are what tell them apart.
  const wall = content.wallPosts(content.wallBands(archive, 'flow', 'newest', { arrangement }));
  const keys = wall.map(content.archiveKey);
  assert.ok(keys.includes('post-8') && keys.includes('repost-4'), 'the wall holds both cells of post 8');
  assert.notEqual(
    content.archiveKey(archive.posts.find((post) => Number(post.id) === 8 && !post.__repost)),
    content.archiveKey(archive.posts.find((post) => Number(post.id) === 8 && post.__repost)),
    'the same id is two cells because the keys differ',
  );
});

test('every cell names whose share it is, and the original author stays in the words', () => {
  for (const post of redistributed) {
    assert.equal(content.repostAttribution(post), 'Ai redistribuit');
  }
  assert.equal(content.repostAttribution({ id: 8, __repost: { id: 5, reposter: { handle: 'ana' } } }),
    'Redistribuit de @ana');
  assert.equal(content.repostAttribution({ id: 8, __repost: { id: 5 } }), 'Redistribuit');
  assert.equal(content.repostAttribution({ id: 8 }), '', 'an ordinary post says nothing about a share');
  // The words of a shared post are still its author's; the share only says who carried it here.
  const shared = redistributed.find((post) => Number(post.id) === 21);
  assert.equal(shared.caption, 'someone else wrote this');
  assert.equal(shared.__repost.reposter.handle, 'wallet4e8gv6');
});

test('a tap in the tab opens the share it names, not the post that shares its id', () => {
  const list = redistributed;
  // The route resolves the pressed cell by `walkAnchor`, and the share's own key is what it asks for.
  assert.equal(content.walkAnchor(list, { key: 'repost-4', id: 8 }), 0);
  assert.equal(content.walkAnchor(list, { key: 'repost-9', id: 22 }), 2);
  /**
   * The key decides first; the post's id is only the second chance, for a payload that stamped a share
   * differently from the wall that was pressed. In this tab only one node carries id 8 — the share — so a
   * stale key still lands on the share and never on a post the tab does not hold.
   */
  assert.equal(content.walkAnchor(list, { key: 'post-8', id: 8 }), 0);
  // In the Flow both nodes exist, and there the key is what keeps them apart.
  const wall = content.wallPosts(content.wallBands(archive, 'flow', 'newest', { arrangement }));
  const original = wall.findIndex((post) => content.archiveKey(post) === 'post-8');
  const share = wall.findIndex((post) => content.archiveKey(post) === 'repost-4');
  assert.ok(original >= 0 && share >= 0 && original !== share, 'the wall holds the post and its share');
  assert.equal(content.walkAnchor(wall, { key: 'post-8', id: 8 }), original);
  assert.equal(content.walkAnchor(wall, { key: 'repost-4', id: 8 }), share);
  // An unknown cell still opens the post that was pressed, alone (`-1` at the route).
  assert.equal(content.walkAnchor(list, { key: 'repost-99', id: 99 }), -1);
});

test('the wall and the reader draw the share, and the tab has a sentence when it is empty', () => {
  const empty = content.profileArchive({ posts: [], reposts: [], shared_replies: [] });
  assert.deepEqual(content.wallPosts(content.wallBands(empty, 'redistribuiri', 'newest', {})), []);
  // The screen draws the empty state from the tab it is on, so the sentence above is really reached.
  assert.match(code(read('src/screens/ProfileScreen.tsx')), /<ProfileEmptyState tab=\{tab\} \/>/);
  // A cell says the share once: a picture wears the chip, a page of words carries the line itself.
  const tile = code(read('src/components/ProfileTile.tsx'));
  assert.match(tile, /const attribution = repostAttribution\(post\);/);
  assert.match(tile, /\{attribution && !words \? \(/, 'o pagina de cuvinte nu primeste si chipul, si randul');
  const text = code(read('src/components/ProfileTextTile.tsx'));
  assert.match(text, /const attribution = repostAttribution\(post\);/);
  assert.match(text, /`⟳ \$\{attribution\}`/, 'pagina de hartie isi scrie distribuirea pe ea');
});

