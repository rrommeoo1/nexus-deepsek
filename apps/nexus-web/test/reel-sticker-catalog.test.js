import test from 'node:test';
import assert from 'node:assert/strict';
import { STICKER_CATALOG_SIZE, STICKER_CATEGORIES, stickerCatalogPage } from '../public/reel-sticker-catalog.js';

test('local sticker catalogue provides thousands of categorized options without an API dependency', () => {
  assert.ok(STICKER_CATALOG_SIZE >= 3000);
  for (const category of ['Funny', 'Emoji', 'Reactions', 'Love', 'Animals', 'Food', 'Travel', 'Celebration', 'Memes', 'Weather', 'Time', 'Location']) {
    assert.ok(STICKER_CATEGORIES.includes(category));
    const result = stickerCatalogPage({ category, pageSize: 24 });
    assert.equal(result.items.length, 24);
    assert.ok(result.items.every((item) => item.category === category));
    assert.ok(result.items.every((item) => item.image.startsWith('data:image/svg+xml')));
  }
});

test('sticker search and pagination are deterministic and non-overlapping', () => {
  const first = stickerCatalogPage({ category: 'Funny', page: 0, pageSize: 48 });
  const second = stickerCatalogPage({ category: 'Funny', page: 1, pageSize: 48 });
  assert.equal(first.items.some((item) => second.items.some((candidate) => candidate.id === item.id)), false);
  assert.ok(stickerCatalogPage({ category: 'All', query: 'LOL', pageSize: 72 }).items.every((item) => item.label.includes('LOL')));
});
