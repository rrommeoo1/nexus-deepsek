/* global __dirname */
// The cell's door: the words a cell says and the page it opens are the same post.
//
// A wall can hold the same `post.id` twice — the owner's own post (`post-8`) and a repost of it
// (`repost-4`) — and both cells say the same sentence to a screen reader, because the sentence names the
// post, not the cell. What keeps a tap honest is the key that travels beside the id: the reader finds the
// page it opens on by `archiveKey` (`walkAnchor`), so the second cell opens the second page, and a cell the
// archive no longer holds opens its own post alone instead of the neighbour that took its place.
//
// This suite holds the two halves of that promise together: the label the tile speaks, the parameters the
// tile pushes, and the page the route resolves from them.
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
const content = load('src/lib/profileContent.ts', (id) => {
  if (id === './socialTypes') return social;
  if (id === './postPresentation') return load('src/lib/postPresentation.ts', () => ({}));
  if (id === './profileGrid') return grid;
  throw new Error(`profileContent.ts asked for ${id}`);
});

const read = (file) => readFileSync(resolve(ROOT, file), 'utf8');
/** Source without comments: a sentence inside a note is not a label. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const tileCode = code(read('src/components/ProfileTile.tsx'));
const screenCode = code(read('src/screens/ProfileScreen.tsx'));
const routeCode = code(read('src/app/post/[id].tsx'));

/**
 * One cell of the wall as the screen hands it to the tile, and the two things the tile then says: the words
 * (`label`) and the route it pushes (`params`). Read from the component's own two statements above, so this
 * fixture cannot drift from what the phone draws.
 */
const labelOf = (post) => `Deschide postarea ${post.id}`;
const paramsOf = (post, door) => ({ id: String(post.id), key: door.key, profile: door.handle, tab: door.tab, reading: door.reading });

/** The reported wall: two different cells, one post. `post-8` is the owner's, `repost-4` carries it. */
const payload = {
  posts: [
    { id: 12, caption: 'a', created_at: 300, grid_position: 0 },
    { id: 8, caption: 'the same words', created_at: 250, grid_position: 1 },
  ],
  reposts: [{ share_id: 4, reposted_at: 400, grid_position: 2, post: { id: 8, caption: 'the same words', created_at: 50 } }],
};
const archive = content.profileArchive(payload);
const arrangement = grid.arrangementMap(archive.posts);
const cells = content.wallPosts(content.wallBands(archive, 'flow', 'newest', { arrangement }));
/** Every cell as the screen mounts it: the door is the cell's key and the order it was opened from. */
const doors = cells.map((post) => ({
  post,
  door: { handle: 'wallet4e8gv6', key: content.archiveKey(post), tab: 'flow', reading: 'newest' },
}));

test('the words a cell says name the post the door opens', () => {
  assert.deepEqual(cells.map(content.archiveKey), ['post-12', 'post-8', 'repost-4'], 'the wall holds both cells');
  for (const { post, door } of doors) {
    const params = paramsOf(post, door);
    // The route asks the server for exactly the number the label speaks (`GET /api/posts/:id`).
    assert.equal(labelOf(post), `Deschide postarea ${params.id}`, 'the label and the route name one post');
    assert.match(params.id, /^[1-9][0-9]*$/, 'a cell opens a real post id');
  }
  // The label names the *post*, so a repost and its post are one sentence — the key is what differs.
  assert.equal(labelOf(doors[1].post), labelOf(doors[2].post), 'one post, one sentence');
  assert.notEqual(doors[1].door.key, doors[2].door.key, 'two cells, two keys');
  // Source: the label reads `post.id` and the door carries `door.key` beside it, never one instead of the other.
  assert.match(tileCode, /accessibilityLabel=\{`Deschide postarea \$\{post\.id\}`\}/);
  assert.doesNotMatch(tileCode, /accessibilityLabel=\{`Deschide postarea \$\{post\.__repost/, 'a share id is not the post the page reads');
  assert.match(tileCode, /id: String\(post\.id\), key: door\.key, profile: door\.handle, tab: door\.tab, reading: door\.reading/);
});


test('the page a cell opens is that cell, not the post it shares', () => {
  for (const { post, door } of doors) {
    const params = paramsOf(post, door);
    const at = content.walkAnchor(cells, { key: params.key, id: Number(params.id) });
    assert.ok(at >= 0, `${door.key} is a cell of the archive the reader fetches`);
    assert.equal(content.archiveKey(cells[at]), door.key, 'the page opened is the cell pressed');
    assert.equal(Number(cells[at].id), Number(params.id), 'and it reads the post the label spoke');
  }
  /**
   * The case that made the key necessary: anchored by id alone, the repost's cell opens the *other* cell —
   * the same words, one page earlier, and a swipe from there walks a list the reader never tapped.
   */
  assert.equal(content.walkAnchor(cells, { id: 8 }), 1, 'the id alone finds the post');
  assert.equal(content.walkAnchor(cells, { key: 'repost-4', id: 8 }), 2, 'the key finds the share');
  assert.equal(content.walkAnchor(cells, { key: 'post-8', id: 8 }), 1, 'and the post stays where it is');
  // Source: the route resolves by `walkAnchor` over the pressed key, never by a place the wall computed.
  assert.match(routeCode, /const anchor = walkAnchor\(list, \{ key: cellKey, id \}\)/);
  assert.match(routeCode, /const cellKey = pick\(params\.key\)\.trim\(\)/);
  assert.doesNotMatch(routeCode, /startIndex: Number\(params\./, 'no place travels in the door');
});

test('a cell the archive no longer holds opens its own post alone, never its neighbour', () => {
  assert.equal(content.walkAnchor(cells, { key: 'post-99', id: 99 }), -1, 'a deleted cell has no place');
  // Source: no place means no pager — the pressed post is then the page, fetched by its own id.
  assert.match(routeCode, /setWalk\(anchor >= 0 \? list : null\)/);
  assert.match(routeCode, /if \(list\.length\) void load\(\);/);
  assert.match(routeCode, /nexusApi<\{ ok: true; post: SocialPost \}>\(`\/api\/posts\/\$\{id\}`\)/);
});

test('the screen hands every cell its own key, in both branches of the wall', () => {
  assert.match(screenCode, /key=\{archiveKey\(post\)\}\s*\n\s*post=\{post\}/);
  assert.match(screenCode, /door=\{\{ handle: String\(profile\?\.handle \|\| handle\), key: archiveKey\(post\), tab, reading: readings\[tab\] \}\}/);
  assert.match(screenCode, /door=\{\{ handle: String\(profile\?\.handle \|\| handle\), key: archiveKey\(band\.post\), tab, reading: readings\[tab\] \}\}/);
  // Every door the screen hands a cell carries the cell's own key — and a wall has two kinds of cell
  // (a tile of the grid, a whisper that reached the row): `key: archiveKey` appears in both, and the third
  // `archiveKey(post)` of the screen belongs to the drag probe's payload, which is not a door.
  const doorsInScreen = screenCode.match(/door=\{\{[^}]*\}\}/g) || [];
  assert.equal(doorsInScreen.length, 2, 'the grid and the whisper row are the two doors of a wall');
  for (const door of doorsInScreen) assert.match(door, /key: archiveKey\((?:post|band\.post)\), tab, reading: readings\[tab\]/);
  const keyed = screenCode.match(/key: archiveKey\((?:post|band\.post)\)/g) || [];
  assert.equal(keyed.length, 3, 'two doors and the probe: every cell identity is the archive key');
});

test('the walk the reader draws is the wall the grid drew', () => {
  // The reader rebuilds the list with the same two calls the screen makes, over the archive it fetched.
  assert.match(routeCode, /wallBands\(archive, tab, reading, \{ arrangement: arrangementMap\(archive\.posts\) \}\)/);
  assert.match(routeCode, /const list: ArchivePost\[\] = wallPosts\(\s*\n\s*wallBands\(/);
  // A repost is a cell of the wall and a page of the walk, in the order the owner dragged it.
  const walked = content.wallPosts(content.wallBands(archive, 'flow', 'newest', { arrangement }));
  assert.deepEqual(walked.map(content.archiveKey), cells.map(content.archiveKey));
  assert.deepEqual(walked.map((post) => post.id), [12, 8, 8], 'the share is its own page, not a copy of the post');
});
