export function initializeModalAccessibility(options = {}) {
  const documentRef = options.documentRef || document;
  const windowRef = options.windowRef || window;
  const HTMLElementRef = options.HTMLElementRef || HTMLElement;
  const NodeRef = options.NodeRef || Node;
  const MutationObserverRef = options.MutationObserverRef || MutationObserver;
  const queueTask = options.queueTask || queueMicrotask;
  const modalSelector = '[role="dialog"][aria-modal="true"]';
  const focusableSelector = [
    'button:not([disabled])', 'a[href]', 'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])', 'textarea:not([disabled])',
    'summary', '[tabindex]:not([tabindex="-1"])', '[contenteditable="true"]',
  ].join(',');
  const registered = new Map();
  const isolated = new Map();
  let lastFocus = null;
  let lastInteractionTarget = null;

  const isUsable = (element) => {
    if (!(element instanceof HTMLElementRef) || !element.isConnected || element.hidden) return false;
    if (element.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
    const style = windowRef.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return typeof element.getClientRects !== 'function' || element.getClientRects().length > 0;
  };
  const focusableElements = (dialog) => [...dialog.querySelectorAll(focusableSelector)].filter(isUsable);
  const activeDialogs = () => [...documentRef.querySelectorAll(modalSelector)].filter(isUsable);
  const topDialog = () => activeDialogs().at(-1) || null;
  const focusDialog = (dialog, preferControl = false) => {
    if (!dialog?.isConnected) return;
    const target = preferControl ? focusableElements(dialog)[0] : dialog;
    (target || dialog).focus({ preventScroll: true });
  };
  const restoreIsolation = () => {
    for (const [element, previous] of isolated) {
      if (!element.isConnected) continue;
      if (previous.inert === null) element.removeAttribute('inert');
      else element.setAttribute('inert', previous.inert);
      if (previous.ariaHidden === null) element.removeAttribute('aria-hidden');
      else element.setAttribute('aria-hidden', previous.ariaHidden);
    }
    isolated.clear();
  };
  const isolateBackground = (dialog) => {
    if (!dialog) return;
    let branch = dialog;
    while (branch?.parentElement && branch.parentElement !== documentRef.documentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling === branch || !(sibling instanceof HTMLElementRef) || sibling.matches('.toast,[aria-live]')) continue;
        isolated.set(sibling, {
          inert: sibling.getAttribute('inert'),
          ariaHidden: sibling.getAttribute('aria-hidden'),
        });
        sibling.setAttribute('inert', '');
        sibling.setAttribute('aria-hidden', 'true');
      }
      branch = branch.parentElement;
    }
  };
  const refresh = () => {
    // Discovery must run against the original tree, not isolation left by the
    // previous top dialog. This keeps a parent dialog alive after a child closes.
    restoreIsolation();
    const dialogs = activeDialogs();
    const visible = new Set(dialogs);
    let restoreTarget = null;
    for (const [dialog, metadata] of registered) {
      if (visible.has(dialog)) continue;
      restoreTarget = metadata.opener || restoreTarget;
      registered.delete(dialog);
    }
    for (const dialog of dialogs) {
      if (registered.has(dialog)) continue;
      const active = documentRef.activeElement instanceof HTMLElementRef && !dialog.contains(documentRef.activeElement)
        ? documentRef.activeElement
        : null;
      const interaction = lastInteractionTarget?.isConnected && !dialog.contains(lastInteractionTarget)
        ? lastInteractionTarget
        : null;
      registered.set(dialog, { opener: active || interaction || lastFocus });
      if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
    }
    const top = dialogs.at(-1) || null;
    isolateBackground(top);
    queueTask(() => {
      if (restoreTarget?.isConnected && isUsable(restoreTarget) && (!top || top.contains(restoreTarget))) {
        restoreTarget.focus({ preventScroll: true });
      } else if (top?.isConnected && !top.contains(documentRef.activeElement)) {
        focusDialog(top);
      } else if (!top && restoreTarget?.isConnected && isUsable(restoreTarget)) {
        restoreTarget.focus({ preventScroll: true });
      }
    });
  };

  const onPointerDown = (event) => {
    if (event.target instanceof HTMLElementRef) lastInteractionTarget = event.target;
  };
  const onFocusIn = (event) => {
    const top = topDialog();
    // A feature may synchronously focus a just-inserted dialog before the
    // observer registers it. Preserve the previous control in that window.
    if (event.target instanceof HTMLElementRef && (!top || registered.has(top))) lastFocus = event.target;
    if (top && event.target instanceof NodeRef && !top.contains(event.target)) queueTask(() => focusDialog(top, true));
  };
  const onKeyDown = (event) => {
    const dialog = topDialog();
    if (!dialog) return;
    if (event.key === 'Escape') {
      const closeControl = dialog.querySelector('[data-modal-close],.sheet-close');
      if (closeControl instanceof HTMLElementRef && !closeControl.hasAttribute('disabled')) {
        event.preventDefault();
        closeControl.click();
      }
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = focusableElements(dialog);
    if (!controls.length) {
      event.preventDefault();
      focusDialog(dialog);
      return;
    }
    const first = controls[0];
    const last = controls.at(-1);
    const current = documentRef.activeElement;
    if (!dialog.contains(current) || (event.shiftKey && current === first)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus({ preventScroll: true });
    } else if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  };

  documentRef.addEventListener('pointerdown', onPointerDown, true);
  documentRef.addEventListener('click', onPointerDown, true);
  documentRef.addEventListener('focusin', onFocusIn, true);
  documentRef.addEventListener('keydown', onKeyDown, true);
  const observer = new MutationObserverRef(refresh);
  observer.observe(documentRef.body, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'],
  });
  refresh();
  return {
    refresh,
    destroy() {
      observer.disconnect();
      restoreIsolation();
      documentRef.removeEventListener('pointerdown', onPointerDown, true);
      documentRef.removeEventListener('click', onPointerDown, true);
      documentRef.removeEventListener('focusin', onFocusIn, true);
      documentRef.removeEventListener('keydown', onKeyDown, true);
    },
  };
}
