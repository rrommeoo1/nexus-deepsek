import { mountEmojiPicker } from './composer-emoji.js?v=20260914-lab1';
import { openComposerCamera } from './composer-camera.js?v=20260914-camera1';
export function insertComposerEmoji(input, emoji) {
  const start = input.selectionStart ?? input.value.length, end = input.selectionEnd ?? start;
  if (input.maxLength > 0 && input.value.length - (end - start) + emoji.length > input.maxLength) return false;
  input.setRangeText(emoji, start, end, 'end'); input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); return true;
}

export function audioBufferWav(buffer) {
  const { sampleRate, length, numberOfChannels, duration } = buffer;
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000 || !Number.isInteger(length) || length < 1 || length > sampleRate * 61 || !Number.isFinite(duration) || duration <= 0 || duration > 61 || !Number.isInteger(numberOfChannels) || numberOfChannels < 1 || numberOfChannels > 2) throw new Error('audio_limit');
  const out = new ArrayBuffer(44 + length * 2), view = new DataView(out);
  const ascii = (at, text) => [...text].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  ascii(0, 'RIFF'); view.setUint32(4, 36 + length * 2, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ascii(36, 'data'); view.setUint32(40, length * 2, true);
  const channels = Array.from({ length: numberOfChannels }, (_, i) => buffer.getChannelData(i));
  for (let i = 0; i < length; i++) { const sample = Math.max(-1, Math.min(1, channels.reduce((v, c) => v + (Number.isFinite(c[i]) ? c[i] : 0), 0) / numberOfChannels)); view.setInt16(44 + i * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true); }
  return out;
}

const paths = {
  emoji: '<circle cx="12" cy="12" r="9"/><path d="M8 14q4 5 8 0M8 9h.01M16 9h.01"/>',
  camera: '<path d="M3 6h4l2-3h6l2 3h4v14H3Z"/><circle cx="12" cy="12" r="4"/>',
  mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
};
export function mountComposerTools(form, { input, picker, send, t, demo = false }) {
  const make = (kind) => { const button = document.createElement('button'); button.type = 'button'; button.className = 'composer' + kind;
    button.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${paths[kind]}</svg>`;
    button.setAttribute('aria-label', t('composer.' + kind)); form.append(button); return button; };
  const emoji = make('emoji'), camera = make('camera'), mic = make('mic');
  const status = document.createElement('output'); status.className = 'composerStatus'; status.setAttribute('aria-live', 'polite'); form.append(status);
  const palette = document.createElement('div'); palette.className = 'composerEmoji'; palette.hidden = true; form.append(palette);
  const preview = document.createElement('audio'); preview.controls = true; preview.className = 'composerAudio'; preview.hidden = true; form.append(preview);
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'composerCancel'; cancel.textContent = '×'; cancel.setAttribute('aria-label', t('common.cancel')); cancel.hidden = true; form.append(cancel);
  let stream, recorder, timer, previewUrl, generation = 0, disposed = false, recording = false, assigning = false, busy = false;
  const allowed = () => !disposed && form.isConnected && !input.disabled && form.dataset.canSend === 'true';
  const sync = () => { const content = Boolean(input.value.trim() || picker.files?.length); send.hidden = !content || recording; mic.hidden = content && !recording; cancel.hidden = !recording; };
  const releasePreview = () => { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = null; preview.removeAttribute('src'); preview.hidden = true; };
  const end = (discard = false) => { if (discard) generation++; clearTimeout(timer); if (recorder?.state === 'recording') recorder.stop(); stream?.getTracks().forEach((track) => track.stop()); stream = null; recording = false; mic.setAttribute('aria-pressed', 'false'); sync(); };
  cancel.onclick = () => { end(true); status.textContent = ''; };
  emoji.setAttribute('aria-expanded', 'false');
  emoji.onclick = () => { if (!allowed()) return; palette.hidden = !palette.hidden; emoji.setAttribute('aria-expanded', String(!palette.hidden)); };
  mountEmojiPicker(palette, { t, choose: (value) => { if (allowed()) insertComposerEmoji(input, value); palette.hidden = true; emoji.setAttribute('aria-expanded', 'false'); } });
  let closeCamera = () => {};
  camera.onclick = () => {
    if (!allowed() || recording || busy) return;
    if (demo) { status.textContent = t('composer.demo'); return; }
    closeCamera();
    closeCamera = openComposerCamera({ form, picker, trigger: camera, allowed, t, notify: (text) => { status.textContent = text; } });
  };
  mic.onclick = async () => {
    if (!allowed()) return;
    if (recording) { end(); return; }
    if (busy) return;
    if (demo) { status.textContent = t('composer.demo'); return; }
    if (!globalThis.isSecureContext) { status.textContent = t('messenger.httpsCalls'); return; }
    const Decoder = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder || !Decoder || !globalThis.DataTransfer) { status.textContent = t('composer.unsupported'); return; }
    const token = ++generation; busy = true; mic.disabled = true; status.textContent = t('composer.permission');
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!allowed() || token !== generation) { acquired.getTracks().forEach((track) => track.stop()); return; }
      stream = acquired;
      const mimeType = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find((mime) => MediaRecorder.isTypeSupported(mime));
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks = []; let size = 0;
      recorder.ondataavailable = (event) => { if (event.data.size) { size += event.data.size; chunks.push(event.data); if (size > 10 * 1024 * 1024) end(true); } };
      recorder.onerror = () => { end(true); status.textContent = t('composer.failed'); };
      recorder.onstop = async () => {
        if (!allowed() || token !== generation) return;
        busy = true; mic.disabled = true; status.textContent = t('composer.processing');
        try {
          const bytes = await new Blob(chunks, { type: recorder.mimeType }).arrayBuffer();
          const decoded = await new Decoder(1, 1, 48000).decodeAudioData(bytes);
          const wav = audioBufferWav(decoded);
          if (!allowed() || token !== generation) return;
          const transfer = new DataTransfer(); transfer.items.add(new File([wav], 'voice-note.wav', { type: 'audio/wav' }));
          assigning = true;
          try { picker.files = transfer.files; picker.dispatchEvent(new Event('input', { bubbles: true })); picker.dispatchEvent(new Event('change', { bubbles: true })); }
          finally { assigning = false; }
          status.textContent = t('composer.preview');
        } catch { if (token === generation) status.textContent = t('composer.failed'); }
        finally { busy = false; if (form.isConnected) mic.disabled = input.disabled; }
      };
      recorder.start(250); recording = true; mic.setAttribute('aria-pressed', 'true'); status.textContent = t('composer.recording');
      sync(); timer = setTimeout(() => end(), 60000);
    } catch { end(true); if (form.isConnected) status.textContent = t('composer.failed'); }
    finally { busy = false; if (form.isConnected) mic.disabled = input.disabled; }
  };
  input.addEventListener('input', sync);
  const changed = () => { if (!assigning) end(true); releasePreview(); const file = picker.files?.[0]; if (file?.type?.startsWith('audio/')) { previewUrl = URL.createObjectURL(file); preview.src = previewUrl; preview.hidden = false; } sync(); };
  picker.addEventListener('change', changed); picker.addEventListener('input', changed);
  form.addEventListener('submit', () => end(true));
  form.addEventListener('reset', () => { end(true); releasePreview(); status.textContent = ''; queueMicrotask(sync); });
  form.addEventListener('keydown', (event) => { if (event.key === 'Escape') { palette.hidden = true; emoji.setAttribute('aria-expanded', 'false'); if (recording) { end(true); status.textContent = ''; } } });
  const background = () => { if (document.hidden) end(true); };
  document.addEventListener?.('visibilitychange', background);
  if (globalThis.MutationObserver) { const observer = new MutationObserver(() => { if (!form.isConnected) { disposed = true; end(true); releasePreview(); document.removeEventListener('visibilitychange', background); observer.disconnect(); } else if (stream && !allowed()) { end(true); status.textContent = ''; } }); observer.observe(document.body, { childList: true, subtree: true }); observer.observe(form, { attributes: true, subtree: true, attributeFilter: ['disabled', 'data-can-send'] }); }
  sync();
}
