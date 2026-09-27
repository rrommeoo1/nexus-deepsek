import { setInputFile } from './composer-picker.js?v=20260912-camera3';

// Local preview only: capture never uploads or submits the conversation form.
export function openComposerCamera({ form, picker, trigger, allowed, t, notify }) {
  if (!allowed()) return () => {};
  if (!globalThis.isSecureContext || !navigator.mediaDevices?.getUserMedia || typeof HTMLDialogElement === 'undefined' || !globalThis.DataTransfer) {
    notify(t(!globalThis.isSecureContext ? 'camera.nativeFallback' : 'camera.unavailable'));
    picker.accept = 'image/*'; picker.setAttribute('capture', 'user'); picker.click();
    return () => {};
  }
  const dialog = document.createElement('dialog'); dialog.className = 'composerCamera';
  dialog.setAttribute('aria-label', t('composer.camera'));
  const stage = document.createElement('div'); stage.className = 'composerCameraStage';
  const video = document.createElement('video'); video.muted = true; video.autoplay = true; video.playsInline = true;
  const image = document.createElement('img'); image.alt = t('thread.attachment'); image.hidden = true;
  const status = document.createElement('output'); status.setAttribute('aria-live', 'polite');
  const controls = document.createElement('div'); controls.className = 'composerCameraControls';
  const button = (key, glyph) => {
    const item = document.createElement('button'); item.type = 'button'; item.textContent = glyph || t(key);
    item.setAttribute('aria-label', t(key)); controls.append(item); return item;
  };
  const cancel = button('common.close', '×'), flip = button('camera.switch', '↻');
  const shutter = button('camera.photo', '◉'), retry = button('camera.retry');
  const accept = button('thread.attach'), gallery = button('camera.gallery');
  retry.hidden = accept.hidden = true;
  stage.append(video, image); dialog.append(stage, status, controls); document.body.append(dialog);
  let stream = null, blob = null, previewUrl = null, facing = 'user', epoch = 0, closed = false, busy = false;
  const current = (token) => !closed && token === epoch && allowed() && !document.hidden;
  const stop = () => { stream?.getTracks().forEach((track) => track.stop()); stream = null; video.srcObject = null; };
  const release = () => { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = null; blob = null; image.removeAttribute('src'); };
  const close = () => {
    if (closed) return;
    closed = true; epoch++; clearTimeout(deadline); stop(); release(); observer.disconnect();
    document.removeEventListener('visibilitychange', background); globalThis.removeEventListener('popstate', close);
    form.removeEventListener('submit', close); form.removeEventListener('reset', close);
    dialog.close(); dialog.remove(); if (trigger.isConnected) trigger.focus();
  };
  const background = () => { if (document.hidden) close(); };
  const observer = new MutationObserver(() => { if (!allowed()) close(); });
  const deadline = setTimeout(close, 120000);
  const start = async () => {
    if (closed || busy || !allowed()) return;
    const token = ++epoch; busy = true; stop(); release();
    image.hidden = true; video.hidden = false; retry.hidden = accept.hidden = true;
    shutter.hidden = flip.hidden = false; shutter.disabled = flip.disabled = true;
    status.textContent = t('camera.instruction');
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
      if (!current(token)) { acquired.getTracks().forEach((track) => track.stop()); return; }
      stream = acquired; video.srcObject = stream;
      video.style.transform = facing === 'user' ? 'scaleX(-1)' : '';
      await video.play();
      if (!current(token)) return;
      status.textContent = t('camera.active'); shutter.disabled = flip.disabled = false;
      stream.getTracks().forEach((track) => track.addEventListener('ended', () => { if (current(token) && !blob) { stop(); shutter.disabled = flip.disabled = true; retry.hidden = false; status.textContent = t('camera.unavailable'); } }, { once: true }));
    } catch (error) {
      if (current(token)) { stop(); status.textContent = t(error?.name === 'NotAllowedError' ? 'camera.deniedDetail' : 'camera.unavailable'); retry.hidden = false; }
    } finally { if (token === epoch) busy = false; }
  };
  flip.onclick = () => { if (!busy) { facing = facing === 'user' ? 'environment' : 'user'; void start(); } };
  retry.onclick = () => void start();
  shutter.onclick = async () => {
    if (busy || !current(epoch) || !stream) return;
    if (!video.videoWidth || !video.videoHeight) { status.textContent = t('camera.notReady'); return; }
    const token = epoch; busy = true; shutter.disabled = flip.disabled = true;
    try {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1920 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale)); canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      const captured = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!current(token)) return;
      if (!captured || !captured.size || captured.size > 10 * 1024 * 1024) throw new Error('capture_limit');
      blob = captured; stop(); previewUrl = URL.createObjectURL(blob); image.src = previewUrl;
      image.hidden = false; video.hidden = true; shutter.hidden = flip.hidden = true;
      retry.hidden = accept.hidden = false; status.textContent = t('thread.attach'); accept.focus();
    } catch { if (current(token)) status.textContent = t('camera.captureError'); }
    finally { if (current(token)) { busy = false; shutter.disabled = flip.disabled = false; } }
  };
  accept.onclick = () => {
    if (!current(epoch) || !blob || busy) return;
    const file = new File([blob], 'nexus-photo.jpg', { type: 'image/jpeg' });
    if (setInputFile(picker, file)) { notify(''); close(); }
    else status.textContent = t('camera.attachError');
  };
  gallery.onclick = () => { close(); if (allowed()) { picker.accept = 'image/*'; picker.removeAttribute('capture'); picker.click(); } };
  cancel.onclick = close;
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) close(); });
  document.addEventListener('visibilitychange', background); globalThis.addEventListener('popstate', close);
  form.addEventListener('submit', close); form.addEventListener('reset', close);
  observer.observe(document.body, { childList: true, subtree: true });
  observer.observe(form, { attributes: true, subtree: true, attributeFilter: ['disabled', 'data-can-send'] });
  dialog.showModal(); cancel.focus(); void start();
  return close;
}
