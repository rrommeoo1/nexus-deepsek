/* global __dirname */
// Profile thumbnails are previews, not a second Post.
//
// The archive is a wall of 9:16 cells: a photo/video preview, a miniature reading page for words, and the
// real view count. Captions, author rows, reactions and comment controls must stay in the Post. This
// suite checks the source contract and the field it reads; the page itself is planned and tested in
// `test-profile-text-tile.cjs`, because its type sizes are arithmetic rather than a look.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const source = readFileSync(resolve(ROOT, 'src/components/ProfileTile.tsx'), 'utf8');
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

function load(file, requireShim) {
  const code = ts.transpileModule(readFileSync(resolve(ROOT, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleShim = { exports: {} };
  new Function('module', 'exports', 'require', code)(moduleShim, moduleShim.exports, requireShim);
  return moduleShim.exports;
}

const social = load('src/lib/socialTypes.ts', () => ({}));
const grid = load('src/lib/profileGrid.ts', () => ({}));
const content = load('src/lib/profileContent.ts', (id) => {
  if (id === './socialTypes') return social;
  if (id === './postPresentation') return load('src/lib/postPresentation.ts', () => ({}));
  if (id === './profileGrid') return grid;
  throw new Error(`profileContent.ts asked for ${id}`);
});

const image = (position = 0) => ({ hash: `${position}`.padStart(64, 'a'), ext: 'jpg', kind: 'image', position });
const clip = (position = 0) => ({ hash: `${position}`.padStart(64, 'b'), ext: 'mp4', kind: 'video', position });

test('celula este 9:16 și își ține colțurile din tokenii arhivei', () => {
  assert.match(source, /aspectRatio: socialTokens\.archive\.tileAspect/);
  assert.match(source, /borderRadius: socialTokens\.archive\.tilePlayRadius/);
  assert.match(source, /styles\.fill/);
});

test('celula nu mai randă postarea întreagă', () => {
  assert.doesNotMatch(code, /PostCanvas|PostReading|PostCard|ArticleMediaBlock/);
  assert.doesNotMatch(code, /caption|reactions|comment|author/i, 'no description, reaction bar or author row in a tile');
  assert.doesNotMatch(code, /numberOfLines=\{?[3-9]\}?/, 'a tile is not a three-line caption');
});

test('fotografia și clipul își arată propriul cadru; cuvintele primesc o pagină de citit', () => {
  assert.match(source, /<RemoteImage item=\{cover\} fit="cover"/);
  assert.match(source, /styles\.videoPlate/);
  // A post whose identity is words is drawn by `ProfileTextTile`, not by a coloured cover: the moss-green
  // rectangle with a leaf on it was the owner's complaint of 26 October 2026.
  assert.match(source, /<ProfileTextTile post=\{post\} media=\{plate\}/);
  assert.doesNotMatch(source, /LeafMotif|themeOf|palette\.background|styles\.accent|styles\.veil/);
  // The cell no longer renders the post itself: the page is a miniature, not the reader.
  assert.doesNotMatch(source, /PostCanvas|EditorialArticle|textPages\(/);
  /**
   * Which cells are pages is the classifier the reader already uses, and an article with photographs keeps
   * its identity as a page (`stageFor(post) === 'article'`) instead of becoming a photo thumbnail.
   */
  assert.match(source, /const article = Boolean\(cover\) && stageFor\(post\) === 'article';/);
  assert.match(source, /const words = !cover \|\| article;/);
  // A soundtrack is not a picture: a post whose only attachment is audio still reads as words.
  assert.match(source, /find\(\(item\) => mediaKindOf\(item\) !== 'audio'\)/);
});

test('numărul de vizualizări vine din câmpul serverului și dispare când lipsește', () => {
  assert.match(source, /profileCompactCount\(post\.view_stats\?\.viewers\)/);
  assert.match(source, /cover && viewers \? \(/);
  assert.match(source, /<SolidViewerIcon kind="views" size=\{socialTokens\.archive\.tileViewsGlyph\}/);
  assert.match(source, /\{viewers\}<\/Text>/);
  assert.doesNotMatch(source, /Math\.random|views\s*=\s*[1-9]|fabricat/i, 'no invented number');
});

test('numărul stă în colțul din stânga jos, la măsura arhivei', () => {
  assert.match(source, /left: socialTokens\.archive\.tileChipInset, bottom: socialTokens\.archive\.tileChipInset/);
  assert.match(source, /height: socialTokens\.archive\.tilePlayHeight/);
  assert.match(source, /backgroundColor: socialTokens\.archive\.tileChipSurface/);
  assert.match(source, /fontSize: socialTokens\.archive\.tileViewsSize/);
  assert.doesNotMatch(source, /right: 5, bottom: 5/, 'the count is not parked in the right corner any more');
});

test('un rând de arhivă ține toate tipurile suportate', () => {
  const posts = [
    { id: 1, kind: 'text', caption: 'doar text' },
    { id: 2, kind: 'image', caption: 'o poză', media: image() },
    { id: 3, kind: 'video', media: clip() },
    { id: 4, kind: 'text', caption: 'citează', quoted_post: { id: 1, caption: 'original' } },
  ];
  const archive = content.profileArchive({ profile: {}, posts, reposts: [] });
  assert.deepEqual(archive.posts.map((post) => post.id).sort((a, b) => a - b), [1, 2, 3, 4]);
  assert.deepEqual(
    [1, 2, 3, 4].map((id) => content.profilePostKind(archive.posts.find((post) => post.id === id))),
    ['text', 'image', 'video', 'text'],
  );
});
