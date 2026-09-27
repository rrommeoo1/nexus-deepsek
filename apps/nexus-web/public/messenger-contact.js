import { personaBadge } from './messenger-shell.js?v=20260914-lab1';
import { loadContactStories } from './contact-stories.js?v=20260913-spaces1';

// UI history identity only, never an authentication or mutation token. Works on LAN HTTP.
let overlaySequence = 0;
export const nextOverlayToken = () => 'messenger-ui-' + Date.now() + '-' + (++overlaySequence);

// A dialog's native close event and history.back() are asynchronous. Never open
// its destination until both have completed, or Back can dismiss the new screen.
export function bindDialogNavigation(dialog, { key, token = nextOverlayToken(), current, onHistoryBack, restoreFocus = () => {} }) {
  history.pushState({ ...history.state, [key]: token }, '');
  let fromHistory = false, transitioning = false;
  let finish;
  const closed = new Promise((resolve) => { finish = resolve; });
  dialog.dismissFromHistory = () => { fromHistory = true; dialog.close(); };
  dialog.addEventListener('close', async () => {
    dialog.remove();
    try {
      if (!fromHistory && history.state?.[key] !== token) { finish(false); return; }
      if (!fromHistory && history.state?.[key] === token) await onHistoryBack();
      if (!transitioning && current()) restoreFocus();
      finish(true);
    } catch { finish(false); }
  }, { once: true });
  return async (action) => {
    if (transitioning || !current()) return;
    transitioning = true; dialog.close();
    if (await closed && current()) return action();
  };
}

export function createContactOptions({ root, getState, t, esc, safeInternalMediaUrl, api, openThread, activeConversation, openProfile, showStories, onHistoryBack, toast }) {
  const viewerId = getState().user.id, persona = getState().persona;
  const current = () => root.isConnected && getState().user.id === viewerId && getState().persona === persona;
  return {
    viewerId, t, esc, safeInternalMediaUrl, current, onHistoryBack,
    getStories: (peer) => persona === 'social' && current() ? loadContactStories({ api, viewerId, peerId: peer.id, safeUrl: safeInternalMediaUrl }) : Promise.resolve([]),
    onStories: (stories) => { if (current()) showStories(stories); },
    onAction: async (action, conversation, peer) => {
      if (!current()) return;
      if (action !== 'message' && conversation.context_persona !== persona) return toast(t('messenger.identityRequired') + ' ' + conversation.context_persona);
      if (action === 'profile') return openProfile(peer.handle);
      // Retain an already-open historical window when calling from its card.
      if (activeConversation() !== Number(conversation.id)) await openThread(Number(conversation.id));
      if (!current() || activeConversation() !== Number(conversation.id)) return;
      if (action === 'audio' || action === 'video') {
        const control = root.querySelector('#' + action + '-call');
        if (!control || control.disabled) return toast(control?.title || t('thread.callUnavailable'));
        control.click();
      }
    },
  };
}

const icons = {
  message: '<path d="M21 11a9 9 0 0 1-9 9H4l-2 2V11a9 9 0 0 1 19 0Z"/>',
  audio: '<path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a15 15 0 0 1-7-7l2-2-2-5Z"/>',
  video: '<rect x="3" y="5" width="12" height="14" rx="3"/><path d="m15 9 6-3v12l-6-3Z"/>',
  profile: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2Z"/>',
};

export function contactIdentity(conversation, viewerId) {
  if (conversation.kind !== 'direct' || !personaBadge(conversation.context_persona)) return null;
  const peer = conversation.participants?.filter((p) => Number(p.id) !== Number(viewerId));
  return peer?.length === 1 ? { ...peer[0], persona: conversation.context_persona } : null;
}

export function openContactCard(root, conversation, trigger, options) {
  const { viewerId, t, esc, safeInternalMediaUrl, current, onAction, onHistoryBack } = options;
  if (!current()) return;
  const existing = root.querySelector('#messengerContact');
  if (existing?.open) { existing.focus(); return; }
  const peer = contactIdentity(conversation, viewerId);
  // A group is not represented as a single person's photo or call target.
  if (!peer) { onAction('message', conversation); return; }
  const title = peer.display_name || peer.handle;
  const avatar = safeInternalMediaUrl(peer.avatar);
  const dialog = document.createElement('dialog');
  dialog.id = 'messengerContact'; dialog.className = 'messengerContact';
  dialog.setAttribute('aria-labelledby', 'contact-name');
  dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('role', 'dialog');
  dialog.innerHTML = '<button type="button" data-contact-close aria-label="' + esc(t('common.close')) + '">×</button><div class="contactPhoto">' + (avatar ? '<img src="' + esc(avatar) + '" alt=""/>' : '<span>' + esc(String(title).slice(0, 2)) + '</span>') + '</div><h2 id="contact-name">' + esc(title) + '</h2>' + personaBadge(peer.persona) + '<div class="contactQuickActions">' + [
    ['message', 'publicProfile.message'], ['audio', 'messenger.audio'], ['video', 'messenger.video'], ['profile', 'sessions.profile'],
  ].map(([action, key]) => '<button type="button" data-contact-action="' + action + '"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">' + icons[action] + '</svg><span>' + esc(t(key)) + '</span></button>').join('') + '</div><p role="status" hidden></p>';
  root.append(dialog);
  if (options.demoOnly) {
    const status = dialog.querySelector('[role="status"]'); status.hidden = false; status.textContent = t('messenger.demoOnly');
  }
  const transition = bindDialogNavigation(dialog, { key: 'nexusContact', current, onHistoryBack,
    restoreFocus: () => { if (trigger?.isConnected) trigger.focus({ preventScroll: true }); } });
  dialog.querySelector('[data-contact-close]').onclick = () => dialog.close();
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    }
  });
  dialog.querySelectorAll('[data-contact-action]').forEach((button) => {
    button.onclick = async () => {
      if (!current()) { dialog.close(); return; }
      const action = button.dataset.contactAction;
      if (options.demoOnly && ['audio', 'video'].includes(action)) {
        const status = dialog.querySelector('[role="status"]'); status.hidden = false; status.textContent = t('messenger.demoCalls'); return;
      }
      await transition(() => onAction(action, conversation, peer));
    };
  });
  dialog.showModal();
  if (peer.persona === 'social' && options.getStories) {
    options.getStories(peer).then((stories) => {
      if (!dialog.isConnected || !current() || !stories?.length) return;
      const photo = dialog.querySelector('.contactPhoto');
      const story = document.createElement('button'); story.type = 'button';
      story.className = 'contactStory'; story.textContent = 'Story';
      story.setAttribute('aria-label', 'Story · ' + title);
      story.onclick = async () => {
        story.disabled = true;
        const fresh = await options.getStories(peer);
        if (!dialog.isConnected || !current()) return;
        if (!fresh?.length) {
          story.disabled = false;
          const status = dialog.querySelector('[role="status"]'); status.hidden = false; status.textContent = t('publicProfile.unavailable');
          return;
        }
        await transition(() => options.onStories(fresh));
      };
      photo.append(story);
    }).catch(() => {});
  }
}

export function bindContactAvatars(list, conversations, options) {
  for (const conversation of conversations) {
    const button = list.querySelector('[data-contact="' + Number(conversation.id) + '"]');
    if (!button || button.dataset.contactWired) continue;
    button.dataset.contactWired = 'true';
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      openContactCard(list.closest('.inboxScreen'), conversation, button, options);
    });
  }
}
