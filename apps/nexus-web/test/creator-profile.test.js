import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCreatorProfile } from '../public/creator-profile.js';
import { renderOwnerProfileExperience } from '../public/profile-experience.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function host() {
  const events = {};
  const root = { innerHTML: '', actions: '', removed: [], querySelectorAll: () => [],
    querySelector(selector) {
      if (selector === '.ownerHero') return { insertAdjacentHTML: (where, html) => { root.actions = html; } };
      if (['[data-follow]', '[data-creator-message]', '[data-creator-access]'].includes(selector)) {
        return { addEventListener: (type, fn) => { events[selector] = fn; } };
      }
      return null;
    },
  };
  return { root, events };
}
const profile = { user_id: 21, handle: 'test_author', name: 'Actual author', persona: 'social',
  avatar: '/media/avatar.jpg', cover: '/media/cover.jpg', cover_focus: 72, visibility: 'public',
  tabs_order: ['reels', 'flow', 'whispers', 'shots', 'moments'], counts: { posts: 0 } };
const options = { esc, t: (key) => key, locale: 'ro', safeUrl: (url) => url || '', tickerSpeed: 'off' };

test('visitor uses the canonical profile renderer, owner crop and tab order, without edit controls', () => {
  const visitor = host(), canonical = host();
  const result = { profile, posts: [], stories: [] };
  renderOwnerProfileExperience(canonical.root, result, options);
  renderCreatorProfile(visitor.root, result, options);
  assert.equal(visitor.root.innerHTML, canonical.root.innerHTML);
  assert.match(visitor.root.innerHTML, /object-position:center 72%/);
  assert.match(visitor.root.innerHTML, /data-owner-content="reels"[^>]*aria-selected="true"/);
  assert.doesNotMatch(visitor.root.innerHTML, /data-hero-edit=|data-hero-photo=|data-owner-menu/);
  assert.match(visitor.root.actions, /data-follow="21"/);
  assert.match(visitor.root.actions, /data-creator-message/);
});

test('visitor actions call the real supplied handlers and target the same author', () => {
  const h = host(), calls = [];
  renderCreatorProfile(h.root, { profile, posts: [] }, { ...options,
    onFollow: (button) => calls.push(button.dataset.follow), onMessage: () => calls.push('message') });
  h.events['[data-follow]']({ currentTarget: { dataset: { follow: '21' } } });
  h.events['[data-creator-message]']();
  assert.deepEqual(calls, ['21', 'message']);
});

test('locked profile ignores even erroneously supplied media, presence, posts and biography', () => {
  const h = host();
  renderCreatorProfile(h.root, { locked: true, profile: { ...profile, visibility: 'private',
    bio: 'SECRET BIO', presence: { visible: true, online: true }, follow_request_pending: true },
    posts: [{ id: 99, caption: 'SECRET POST' }], stories: [{ caption: 'SECRET STORY' }] }, options);
  assert.doesNotMatch(h.root.innerHTML, /SECRET|avatar.jpg|cover.jpg|isOnline/);
  assert.match(h.root.actions, /data-pending="1"/);
  assert.match(h.root.actions, /publicProfile.requested/);
  assert.doesNotMatch(h.root.actions, /data-creator-message|data-creator-access/);
});
