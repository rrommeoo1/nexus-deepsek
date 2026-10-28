/* global __dirname */
// The profile grid's door, checked against the real route chain.
//
// The archive cell used to open nothing because the full-screen reader had been deleted. The owner
// asked for the door back: PROFILE GRID TILE -> PRESS -> POST ID -> `/post/[id]` -> the established
// reader. This suite proves there is still exactly one reader (no second `MediaViewer`), that the
// tile carries the tapped id, and that the route mounts `PostCard` / `ReelPage`, not a copy of them.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8');
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const tile = read('src/components/ProfileTile.tsx');
const route = read('src/app/post/[id].tsx');
const card = read('src/components/PostCard.tsx');

test('vizualizatorul vechi nu s-a întors și nu există al doilea cititor', () => {
  assert.equal(existsSync(resolve(ROOT, 'src/components/MediaViewer.tsx')), false, 'MediaViewer.tsx stays deleted');
  for (const file of [
    'src/components/PostCard.tsx', 'src/components/PostCanvas.tsx', 'src/components/PostReading.tsx',
    'src/components/ProfileTile.tsx', 'src/app/post/[id].tsx',
  ]) {
    assert.doesNotMatch(read(file), /import[^;]*MediaViewer/, `${file} must not import the removed viewer`);
  }
});

test('celula din arhivă deschide exact postarea atinsă', () => {
  /**
   * The cell is still the door to `/post/[id]`, and it still carries *this* id — plus, when the grid can be
   * walked, the cell's own `archiveKey` and the order it was opened from (`door`). The identity is what lets
   * the reader open *that* cell; the order is what lets it follow the grid instead of the feed.
   */
  assert.match(tile, /import \{ router \} from 'expo-router'/);
  assert.match(tile, /\? \{ id: String\(post\.id\), key: door\.key, profile: door\.handle, tab: door\.tab, reading: door\.reading \}/);
  assert.match(tile, /: \{ id: String\(post\.id\) \}/);
  assert.match(tile, /<Pressable/);
  assert.match(tile, /accessibilityRole="button"/);
});

test('ruta montează cititorul existent, nu o a doua compoziție', () => {
  assert.match(route, /nexusApi<\{ ok: true; post: SocialPost \}>\(`\/api\/posts\/\$\{id\}`\)/);
  assert.match(route, /import \{ PostCard \} from '\.\.\/\.\.\/components\/PostCard'/);
  assert.match(route, /import \{ ReelPage \} from '\.\.\/\.\.\/components\/ReelsReader'/);
  assert.match(route, /<ReelPage[\s\S]*?height=\{height\}/);
  assert.match(route, /<PostCard[\s\S]*?height=\{height\}/);
  assert.doesNotMatch(route, /PostCanvas|PostTextReading|ArticleMediaBlock/, 'the route reuses the surfaces, it does not rebuild them');
});

test('cardul din feed nu își deschide o copie; comentariile rămân foaia existentă', () => {
  assert.match(card, /import \{ CommentsSheet \} from '\.\/CommentsSheet'/);
  assert.match(card, /onOpenComments=\{\(\) => setCommentsOpen\(true\)\}/);
  assert.match(card, /<CommentsSheet\s+post=\{post\}/);
  assert.doesNotMatch(card, /onPressMedia=/, 'a card has no larger reading to hand a media tap to');
});

test('înapoi păstrează profilul din stivă', () => {
  assert.match(route, /if \(router\.canGoBack\(\)\) \{ router\.back\(\); return; \}/);
  // Un drum deschis dintr-un link nu are stivă: se întoarce la profilul de origine, apoi la feed (runda 30).
  assert.match(route, /if \(handle\) \{ router\.replace\(\{ pathname: '\/profile\/\[handle\]', params: \{ handle \} \}\); return; \}/);
  assert.match(route, /router\.replace\('\/'\)/);
});

test('pagina de comentarii este un fir, nu o a doua randare a postării', () => {
  const thread = read('src/screens/CommentConversationScreen.tsx');
  assert.doesNotMatch(thread, /PostStage|PostCanvas/, 'no media stage on the thread page');
  assert.match(thread, /presentation="page"/, 'the one comment surface, in its page presentation');
  assert.match(thread, /numberOfLines=\{3\}/, 'the post is a three-line context, not the post again');
});
