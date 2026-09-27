export function messageTarget(value) {
  return Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
}

export function messageWindowQuery(deviceId, target) {
  const query = new URLSearchParams();
  if (deviceId) query.set('device_id', deviceId);
  if (messageTarget(target)) query.set('around_message_id', String(messageTarget(target)));
  return query.size ? '?' + query : '';
}

export function createThreadNavigation() {
  let target = null, origin = null, revealed = false, latestRequested = false;
  return {
    get target() { return target; },
    enter(value, viewport, opener) {
      if (!origin) origin = { viewport, top: viewport?.scrollTop || 0, opener };
      target = messageTarget(value); revealed = false; latestRequested = !target;
    },
    latest() { target = null; revealed = false; latestRequested = true; },
    restore() {
      const saved = origin; origin = null; target = null; revealed = false;
      if (saved?.viewport?.isConnected) saved.viewport.scrollTop = saved.top;
      if (saved?.opener?.isConnected) saved.opener.focus({ preventScroll: true });
    },
    position(box, previous) {
      if (latestRequested) { box.scrollTop = box.scrollHeight; latestRequested = false; return; }
      const node = target && box.querySelector('[data-message-id="' + target + '"]');
      if (node) {
        node.classList.add('searchMessageTarget'); node.setAttribute('tabindex', '-1');
        if (!revealed) { node.scrollIntoView({ block: 'center', behavior: 'instant' }); node.focus({ preventScroll: true }); revealed = true; return; }
      }
      box.scrollTop = target || !previous.atBottom ? previous.top : box.scrollHeight;
    },
  };
}

export function messageScrollPosition(box) {
  return { top: box?.scrollTop || 0, atBottom: !box || box.scrollHeight - box.clientHeight - box.scrollTop < 80 };
}

export function mountWindowReturn(thread, navigation, onLatest, label) {
  thread.querySelector('.threadWindowReturn')?.remove();
  if (!navigation.target) return;
  const button = document.createElement('button'); button.type = 'button'; button.className = 'threadWindowReturn'; button.textContent = label;
  button.onclick = () => { navigation.latest(); button.remove(); onLatest(); };
  thread.querySelector('#thread-header').after(button);
}
