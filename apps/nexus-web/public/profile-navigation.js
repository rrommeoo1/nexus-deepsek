// A profile is a temporary destination, not the end of the underlying Reel.
// Keep the actual video element (and its exact playback position) until leaving.
let profileSequence = 0;
export function profileMediaPosts(result) {
  return result.posts.filter((post) => post.media).map((post) => ({ ...post,
    following_me: result.profile.is_following,
    follow_request_pending: result.profile.follow_request_pending,
  }));
}

export function syncAuthorFollow(collections, target, result) {
  for (const items of collections) for (const item of items || []) {
    if (Number(item.user_id || item.author?.id) !== target) continue;
    item.following_me = result.active;
    item.follow_request_pending = result.request_pending;
  }
}

export function attachProfileNavigation(backdrop, { context, viewerState, closeViewer, retireHistory, current }) {
  const initial = context();
  const viewer = document.getElementById('mediaViewer');
  const saved = viewerState(), viewerToken = saved?.historyToken;
  saved?.flushExposure?.();
  if (saved) { saved.touch = null; saved.pointer = null; }
  return bindProfileNavigation({
    backdrop, viewer, videos: [...document.querySelectorAll('video')],
    current: () => current() && context().every((value, i) => value === initial[i]),
    token: `profile-${Date.now()}-${++profileSequence}`, history, retireHistory,
    returnFocus: document.activeElement, visible: () => !document.hidden,
    leaveViewer: async () => {
      if (!viewer?.isConnected || viewerState()?.historyToken !== viewerToken) return;
      closeViewer({ fromHistory: true, restoreFeed: false });
      if (history.state?.nexusMediaViewer === viewerToken) await retireHistory();
    },
  });
}

export function bindProfileNavigation({ backdrop, viewer, videos, current, token,
  history, retireHistory, leaveViewer, returnFocus, visible = () => true }) {
  const playing = videos.filter((video) => !video.paused);
  for (const video of videos) video.pause();
  const previousDisplay = viewer?.style.getPropertyValue('display') || '';
  const previousPriority = viewer?.style.getPropertyPriority('display') || '';
  if (viewer) {
    // Modal accessibility owns `inert`. Setting it here would make its observer
    // save our temporary value and leave the returned viewer unclickable.
    viewer.style.setProperty('display', 'none', 'important');
  }
  let registered = false, closing = false;
  try {
    history.pushState({ ...history.state, nexusPublicProfile: token }, '');
    registered = true;
  } catch { /* X/Escape remain usable when history is unavailable. */ }
  const reveal = () => {
    if (!viewer?.isConnected) return;
    if (previousDisplay) viewer.style.setProperty('display', previousDisplay, previousPriority);
    else viewer.style.removeProperty('display');
  };
  const close = async ({ fromHistory = false, destination = null } = {}) => {
    if (closing) return;
    closing = true;
    backdrop.remove();
    const owned = !registered || fromHistory || history.state?.nexusPublicProfile === token;
    if (registered && !fromHistory && owned) await retireHistory();
    if (!owned || !current()) return;
    reveal();
    if (destination) {
      await leaveViewer();
      if (current()) return destination();
      return;
    }
    if (visible()) for (const video of playing) {
      if (video.isConnected) video.play().catch(() => {});
    }
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  };
  backdrop.dismissFromHistory = () => close({ fromHistory: true });
  // Route/account changes must never replay media from the previous context.
  backdrop.discard = () => { closing = true; backdrop.remove(); reveal(); };
  return close;
}

export function bindCreatorDestinations(root, { profile }) {
  // Preserve the existing visual wrapper and its two cells. They need separate
  // keyboard/touch targets, not nested buttons or a name that opens a story.
  root.querySelectorAll('button.viewerCreatorIdentity[data-creator-story]').forEach((identity) => {
    const handle = identity.dataset.creatorStory;
    const wrapper = identity.ownerDocument.createElement('div');
    wrapper.className = identity.className;
    while (identity.firstChild) wrapper.append(identity.firstChild);
    const avatar = wrapper.querySelector('i'), name = wrapper.querySelector('span');
    if (avatar) { avatar.dataset.creatorStory = handle; avatar.setAttribute('aria-label', identity.getAttribute('aria-label') || handle); }
    if (name) name.dataset.creatorProfile = handle;
    identity.replaceWith(wrapper);
  });
  // Author avatars open identity consistently, even if a Moment is active.
  // Moments remain available from the avatar inside the canonical profile.
  for (const [attribute, action] of [['creatorProfile', profile], ['creatorStory', profile]]) {
    const selector = attribute === 'creatorProfile' ? '[data-creator-profile]' : '[data-creator-story]';
    root.querySelectorAll(selector).forEach((control) => {
      if (attribute === 'creatorStory') control.setAttribute('aria-label', '@' + control.dataset[attribute]);
      const activate = (event) => { event.stopPropagation(); action(control.dataset[attribute]); };
      control.addEventListener('click', activate);
      if (control.tagName !== 'BUTTON' && control.tagName !== 'A') {
        control.setAttribute('role', 'button'); control.tabIndex = 0;
        // The viewer captures pointers for swipes. A name/avatar activation is
        // not a swipe: keep that capture from retargeting its subsequent click.
        control.addEventListener('pointerdown', (event) => event.stopPropagation());
        control.addEventListener('touchstart', (event) => event.stopPropagation(), { passive: true });
        control.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(event); }
        });
      }
    });
  }
}
