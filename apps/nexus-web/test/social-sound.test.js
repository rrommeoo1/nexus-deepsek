import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { renderSoundToggle } from '../public/social-sound.js';
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
function fixture(storage) {
  const listeners = {}, media = [{ muted: true }, { muted: true }], buttons = [];
  return { media, buttons, listeners, controls: runInNewContext(`const SOCIAL_SOUND_KEY='nexus-social-muted-v1'; let socialMutedMemory; ${app.slice(app.indexOf('function readSocialMuted()'), app.indexOf('function currentChatDevice()'))}; ({readSocialMuted,writeSocialMuted,applySocialMuted})`, {
    localStorage: storage, window: { addEventListener: (name, fn) => { listeners[name] = fn; } }, document: { querySelectorAll: (selector) => selector.includes('data-clip') ? buttons : media }, renderSoundToggle, t: (key) => key,
  }) };
}
test('blocked browser storage does not trap the mute toggle in one direction', () => {
  const f = fixture({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } });
  assert.equal(f.controls.readSocialMuted(), true);
  for (const expected of [false, true, false, true]) { f.controls.writeSocialMuted(!f.controls.readSocialMuted()); assert.equal(f.controls.readSocialMuted(), expected); }
});
test('saved preference persists on reload; invalid values default muted; storage changes sync media', () => {
  const values = new Map(), storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const first = fixture(storage); assert.equal(first.controls.readSocialMuted(), true); first.controls.writeSocialMuted(false);
  assert.equal(fixture(storage).controls.readSocialMuted(), false);
  values.set('nexus-social-muted-v1', 'invalid'); assert.equal(fixture(storage).controls.readSocialMuted(), true);
  first.listeners.storage({ key: 'nexus-social-muted-v1', newValue: 'false' }); assert.ok(first.media.every((m) => !m.muted));
  first.listeners.storage({ key: 'unrelated', newValue: 'true' }); assert.equal(first.controls.readSocialMuted(), false);
  first.listeners.storage({ key: 'nexus-social-muted-v1', newValue: 'true', storageArea: {} }); assert.equal(first.controls.readSocialMuted(), false);
  first.listeners.storage({ key: null, newValue: null }); assert.ok(first.media.every((m) => m.muted)); assert.equal(first.controls.readSocialMuted(), true);
});
test('sound icon, accessible state and available control agree on both surfaces', () => {
  const make = () => { const parts = { i: {}, small: {} }; return { parts, dataset: { audioLabel: 'Original audio' }, classList: { add() {}, toggle() {} }, querySelector: (name) => parts[name], setAttribute(key, value) { this[key] = value; } }; };
  const feed = make(), viewer = make();
  for (const muted of [true, false]) for (const button of [feed, viewer]) {
    renderSoundToggle(button, muted, (key) => key);
    assert.equal(button.hidden, false); assert.equal(button['aria-pressed'], String(!muted)); assert.equal(button['aria-label'], muted ? 'post.enableSound' : 'post.disableSound');
    assert.match(button.parts.i.innerHTML, /<svg/); assert.equal(button.parts.small.hidden, true);
    assert.match(button.parts.i.innerHTML, /fill="currentColor"/);
    assert.equal(button.parts.i.innerHTML.includes('L18 10.27'), muted);
  }
  renderSoundToggle(feed, true, (key) => key, false); assert.equal(feed.hidden, true);
});
