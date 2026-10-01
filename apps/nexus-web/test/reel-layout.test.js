import test from 'node:test';
import assert from 'node:assert/strict';
import { REEL_LAYOUTS, composeReelLayout, coverSourceRect, reelLayoutCells } from '../public/reel-layout.js';

test('reel layouts expose six bounded capture templates', () => {
  assert.deepEqual(Object.keys(REEL_LAYOUTS), ['off', 'split-horizontal', 'split-vertical', 'three-horizontal', 'grid-four', 'grid-six']);
  assert.deepEqual(Object.values(REEL_LAYOUTS).map((cells) => cells.length), [1, 2, 2, 3, 4, 6]);
  for (const cells of Object.values(REEL_LAYOUTS)) for (const cell of cells) {
    assert.ok(cell.x >= 0 && cell.y >= 0 && cell.width > 0 && cell.height > 0);
    assert.ok(cell.x + cell.width <= 1 && cell.y + cell.height <= 1);
  }
  assert.equal(reelLayoutCells('unknown'), REEL_LAYOUTS.off);
});

test('cover crop centers landscape and portrait sources without distortion', () => {
  assert.deepEqual(coverSourceRect(1920, 1080, 500, 500), { sx: 420, sy: 0, sw: 1080, sh: 1080 });
  assert.deepEqual(coverSourceRect(1080, 1920, 500, 500), { sx: 0, sy: 420, sw: 1080, sh: 1080 });
});

test('multi-frame composition paints each frame into its final cell', () => {
  const calls = [];
  const canvas = { width: 0, height: 0, getContext: () => ({ fillStyle: '', fillRect: (...args) => calls.push(['fill', ...args]), drawImage: (...args) => calls.push(['draw', ...args]) }) };
  const frames = Array.from({ length: 4 }, (_, index) => ({ id: index, width: 1080, height: 1920 }));
  const output = composeReelLayout('grid-four', frames, { width: 1080, height: 1920, createCanvas: () => canvas });
  assert.equal(output, canvas);
  assert.deepEqual([output.width, output.height], [1080, 1920]);
  assert.equal(calls.filter(([type]) => type === 'draw').length, 4);
  assert.throws(() => composeReelLayout('grid-six', frames, { createCanvas: () => canvas }), /LAYOUT_INCOMPLETE/);
});
