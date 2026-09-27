export function createExitController({ snapshot, isCurrent, save, ask, busy, onBusy }) {
  let saved = snapshot(), allowing = false, pending = false, saving = false;
  const dirty = () => isCurrent() && snapshot() !== saved;
  const saveOnly = async () => {
    if (saving || !isCurrent()) return false;
    saving = true;
    const intent = snapshot();
    try {
      await save();
      if (!isCurrent()) return false;
      saved = intent;
      return !dirty();
    } finally { saving = false; }
  };
  return Object.freeze({
    dirty,
    saveOnly,
    request(navigate) {
      if (allowing || !isCurrent()) return false;
      if (busy()) { onBusy(); return true; }
      if (!dirty()) return false;
      if (pending) return true;
      pending = true;
      const proceed = () => {
        if (!isCurrent()) return;
        allowing = true;
        try { navigate(); } finally { allowing = false; pending = false; }
      };
      ask({
        save: async () => { if (!await saveOnly()) return false; proceed(); return true; },
        discard: proceed,
        cancel: () => { pending = false; },
      });
      return true;
    },
  });
}

export function bindComposerExit(form, { save, busy, onBusy, translate, isCurrent = () => form.isConnected }) {
  const fileIds = new WeakMap();
  let nextId = 0;
  const snapshot = () => JSON.stringify([...form.elements].filter((control) => control.name).map((control) => {
    if (control.type === 'file') return [control.name, [...(control.files || [])].map((file) => {
      if (!fileIds.has(file)) fileIds.set(file, ++nextId);
      return fileIds.get(file);
    })];
    return [control.name, control.type === 'checkbox' ? control.checked : control.value];
  }));
  return createExitController({
    snapshot, isCurrent, save, busy, onBusy,
    ask(actions) {
      const dialog = document.createElement('dialog');
      dialog.className = 'account-modal composerExit';
      dialog.setAttribute('aria-label', translate('exit.title'));
      const title = document.createElement('h3'); title.textContent = translate('exit.title');
      const detail = document.createElement('p'); detail.textContent = translate('exit.detail');
      const status = document.createElement('p'); status.setAttribute('role', 'status');
      const buttons = document.createElement('div'); buttons.className = 'funding-options';
      const make = (key) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = translate(key); buttons.append(button); return button; };
      const saveButton = make('exit.save'), keepButton = make('exit.keep'), discardButton = make('exit.discard');
      dialog.append(title, detail, buttons, status);
      // Removing the composer also removes its prompt, including after logout.
      form.append(dialog);
      const close = () => { dialog.close(); dialog.remove(); actions.cancel(); };
      keepButton.onclick = close;
      discardButton.onclick = () => { close(); actions.discard(); };
      saveButton.onclick = async () => {
        [...buttons.children].forEach((button) => { button.disabled = true; });
        status.textContent = translate('exit.saving');
        try {
          if (await actions.save()) close();
          else status.textContent = translate('exit.changed');
        } catch { status.textContent = translate('draft.saveError'); }
        finally { [...buttons.children].forEach((button) => { button.disabled = false; }); }
      };
      dialog.addEventListener('cancel', (event) => { event.preventDefault(); if (!saveButton.disabled) close(); });
      dialog.showModal();
      keepButton.focus();
    },
  });
}
