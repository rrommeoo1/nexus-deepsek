import test from 'node:test';
import assert from 'node:assert/strict';
import { bindProfileNavigation, bindCreatorDestinations, profileMediaPosts, syncAuthorFollow } from '../public/profile-navigation.js';

function fixture({ paused = false, historyAvailable = true } = {}) {
  const events = [], values = new Map();
  const viewer = { isConnected: true, inert: false, style: {
    getPropertyValue: (key) => values.get(key)?.value || '',
    getPropertyPriority: (key) => values.get(key)?.priority || '',
    setProperty: (key, value, priority) => values.set(key, { value, priority }),
    removeProperty: (key) => values.delete(key),
  } };
  const video = { paused, isConnected: true, currentTime: 18.75,
    pause() { this.paused = true; events.push('pause'); },
    async play() { this.paused = false; events.push('play'); },
  };
  const backdrop = { remove: () => events.push('remove') };
  const history = { state: { nexusMediaViewer: 'reel-3' },
    pushState(next) { if (!historyAvailable) throw new Error('history unavailable'); this.state = next; },
  };
  let authorized = true, visible = true, resolveRetirement;
  const close = bindProfileNavigation({ backdrop, viewer, videos: [video], history,
    current: () => authorized, token: 'profile-1', visible: () => visible,
    retireHistory: () => { events.push('back'); return new Promise((resolve) => { resolveRetirement = resolve; }); },
    leaveViewer: async () => { viewer.isConnected = false; events.push('leave'); },
    returnFocus: { isConnected: true, focus: () => events.push('focus') },
  });
  return { viewer, video, backdrop, close, history, events,
    retire: () => { history.state = { nexusMediaViewer: 'reel-3' }; resolveRetirement(); },
    revoke: () => { authorized = false; }, hide: () => { visible = false; },
  };
}

test('profile X waits for history then resumes the same Reel without seeking or replacing it', async () => {
  const f = fixture();
  assert.equal(f.viewer.inert, false, 'shared modal isolation alone owns inert');
  assert.equal(f.viewer.style.getPropertyValue('display'), 'none');
  assert.equal(f.video.paused, true);
  const closing = f.close();
  assert.deepEqual(f.events, ['pause', 'remove', 'back']);
  f.retire(); await closing;
  assert.equal(f.viewer.inert, false);
  assert.equal(f.viewer.style.getPropertyValue('display'), '');
  assert.equal(f.video.currentTime, 18.75);
  assert.deepEqual(f.events, ['pause', 'remove', 'back', 'play', 'focus']);
});

test('phone Back dismisses only the profile; a paused Reel stays paused', async () => {
  const f = fixture({ paused: true });
  f.history.state = { nexusMediaViewer: 'reel-3' };
  await f.backdrop.dismissFromHistory();
  assert.equal(f.viewer.inert, false);
  assert.equal(f.video.paused, true);
  assert.deepEqual(f.events, ['pause', 'remove', 'focus']);
});

test('destination is single-flight, after history retirement, without hidden video playback', async () => {
  const f = fixture();
  const pending = f.close({ destination: () => f.events.push('destination') });
  await f.close({ destination: () => f.events.push('duplicate') });
  assert.equal(f.events.includes('destination'), false);
  f.retire(); await pending;
  assert.deepEqual(f.events, ['pause', 'remove', 'back', 'leave', 'destination']);
});

test('account/persona change while closing cannot resume media or open a stale destination', async () => {
  for (const destination of [null, () => assert.fail('stale destination')]) {
    const f = fixture();
    const pending = f.close({ destination });
    f.revoke(); f.retire(); await pending;
    assert.equal(f.events.includes('play'), false);
    assert.equal(f.events.includes('focus'), false);
    assert.equal(f.events.includes('leave'), false);
  }
});

test('background and stale overlays never resume playback or traverse a newer entry', async () => {
  const f = fixture(); f.hide();
  await f.backdrop.dismissFromHistory();
  assert.equal(f.events.includes('play'), false);
  const g = fixture(); g.history.state = { nexusPublicProfile: 'newer' };
  await g.close();
  assert.equal(g.events.includes('back'), false);
  assert.equal(g.events.includes('play'), false);
});

test('unavailable history still permits explicit close and route discard never resumes media', async () => {
  const f = fixture({ historyAvailable: false }); await f.close();
  assert.equal(f.viewer.inert, false);
  assert.equal(f.events.includes('back'), false);
  const g = fixture(); g.backdrop.discard();
  await g.close();
  assert.deepEqual(g.events, ['pause', 'remove']);
});

test('author name and avatar open the same profile for click and keyboard without bubbling', () => {
  const events = [];
  const control = (key) => ({ tagName: 'SPAN', dataset: { [key]: 'author_a' }, listeners: {},
    setAttribute(key, value) { this[key] = value; }, addEventListener(key, fn) { this.listeners[key] = fn; },
  });
  const name = control('creatorProfile'), avatar = control('creatorStory');
  const root = { querySelectorAll(selector) {
    return selector === '[data-creator-profile]' ? [name] : selector === '[data-creator-story]' ? [avatar] : [];
  } };
  bindCreatorDestinations(root, { profile: (handle) => events.push('profile:' + handle), story: (handle) => events.push('story:' + handle) });
  let stopped = 0, prevented = 0;
  const event = (key) => ({ key, stopPropagation: () => stopped++, preventDefault: () => prevented++ });
  name.listeners.click(event()); avatar.listeners.click(event());
  name.listeners.keydown(event('Enter')); avatar.listeners.keydown(event(' '));
  name.listeners.keydown(event('ArrowDown'));
  assert.deepEqual(events, ['profile:author_a', 'profile:author_a', 'profile:author_a', 'profile:author_a']);
  assert.equal(stopped, 4); assert.equal(prevented, 2);
  assert.equal(name.role, 'button'); assert.equal(name.tabIndex, 0);
  name.listeners.pointerdown(event()); avatar.listeners.touchstart(event());
  assert.equal(stopped, 6, 'identity press must not reach the viewer swipe pointer capture');
});

test('profile media inherits real follow state and later steps retain successful relation changes', () => {
  const result = { profile: { is_following: true, follow_request_pending: false },
    posts: [{ id: 1, user_id: 4, media: { kind: 'image' } }, { id: 2, user_id: 4, media: null }] };
  const media = profileMediaPosts(result);
  assert.equal(media.length, 1);
  assert.equal(media[0].following_me, true);
  assert.equal(result.posts[0].following_me, undefined, 'do not mutate API response');
  const other = { user_id: 9, following_me: true };
  syncAuthorFollow([media, [other], undefined], 4, { active: false, request_pending: true });
  assert.equal(media[0].following_me, false);
  assert.equal(media[0].follow_request_pending, true);
  assert.equal(other.following_me, true);
});
