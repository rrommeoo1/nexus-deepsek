import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCreatorStudio } from '../lib/creator-studio.js';

const manifest = (decorations) => ({
  version: 1, aspect: 'ORIGINAL', filter: 'NONE', intensity: 0,
  trimStartMs: 0, trimEndMs: 0, playbackRate: 1, muteOriginal: false,
  overlay: { text: '', position: 'BOTTOM', color: 'WHITE' }, decorations,
});

test('creator manifest preserves valid stickers and location overlays', () => {
  const decorations = [
    { id: 'sticker-1234', type: 'STICKER', text: '😂 LOL', x: 25, y: 40, scale: 1.2, rotation: 15, startMs: 0, endMs: 600000 },
    { id: 'location-1234', type: 'LOCATION', text: '📍 Warszawa', x: 50, y: 80, scale: 1, rotation: 0, startMs: 0, endMs: 600000 },
  ];
  const result = normalizeCreatorStudio(manifest(decorations), { mediaKind: 'image' });
  assert.deepEqual(result.decorations, decorations);
  assert.equal(Object.isFrozen(result.decorations), true);
});

test('creator manifest rejects excessive, malformed or unexpected decorations', () => {
  const valid = { id: 'sticker-1234', type: 'STICKER', text: '😂', x: 50, y: 50, scale: 1, rotation: 0, startMs: 0, endMs: 600000 };
  assert.throws(() => normalizeCreatorStudio(manifest(Array.from({ length: 13 }, () => valid)), { mediaKind: 'image' }), /DECORATIONS_INVALID/);
  assert.throws(() => normalizeCreatorStudio(manifest([{ ...valid, type: 'SCRIPT' }]), { mediaKind: 'image' }), /DECORATIONS_INVALID/);
  assert.throws(() => normalizeCreatorStudio(manifest([{ ...valid, html: '<script>' }]), { mediaKind: 'image' }), /DECORATIONS_INVALID/);
});
