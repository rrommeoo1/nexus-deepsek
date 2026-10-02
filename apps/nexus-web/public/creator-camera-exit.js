export function openCameraExitDialog({ save, discard }) {
  const existing = document.querySelector('.cameraExitDialog');
  if (existing) { existing.focus(); return existing; }
  const dialog = document.createElement('dialog');
  dialog.className = 'cameraExitDialog';
  dialog.setAttribute('aria-label', 'Închide camera');
  dialog.innerHTML = '<h2>Închizi camera?</h2><p>Alege ce se întâmplă cu modificările din această sesiune.</p><div><button type="button" data-camera-exit="keep">Continuă editarea</button><button type="button" data-camera-exit="save">Salvează draft</button><button type="button" data-camera-exit="discard">Ieși fără salvare</button></div><small role="status"></small>';
  const status = dialog.querySelector('[role="status"]');
  const buttons = [...dialog.querySelectorAll('button')];
  const close = () => { dialog.close(); dialog.remove(); };
  const run = async (action) => {
    buttons.forEach((button) => { button.disabled = true; });
    status.textContent = action === save ? 'Se salvează draftul…' : 'Se elimină modificările…';
    try { await action(); close(); }
    catch (error) { status.textContent = error?.message || 'Acțiunea nu a reușit. Încearcă din nou.'; }
    finally { buttons.forEach((button) => { button.disabled = false; }); }
  };
  dialog.querySelector('[data-camera-exit="keep"]').onclick = close;
  dialog.querySelector('[data-camera-exit="save"]').onclick = () => run(save);
  dialog.querySelector('[data-camera-exit="discard"]').onclick = () => run(discard);
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelector('[data-camera-exit="keep"]').focus();
  return dialog;
}
