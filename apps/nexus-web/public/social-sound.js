// Presentation only; preference and playback remain owned by the Social surface.
export function renderSoundToggle(button, muted, t, available = true) {
  button.hidden = !available;
  button.classList.add('soundToggle');
  button.classList.toggle('muted', muted); button.classList.toggle('on', !muted);
  button.setAttribute('aria-pressed', String(!muted));
  button.setAttribute('aria-label', t(muted ? 'post.enableSound' : 'post.disableSound'));
  const icon = button.querySelector('i'), label = button.querySelector('small');
  if (icon) {
    const musicDisc = button.matches?.('.clipMusicDisc') || button.classList?.contains?.('clipMusicDisc') || String(button.className || '').split(/\s+/).includes('clipMusicDisc');
    if (musicDisc) {
      icon.textContent = '♫';
      if (label) label.hidden = true;
      button.title = button.dataset.audioLabel || '';
      return;
    }
    const soundPath = '<path d="M3 9h4l5-4v14l-5-4H3V9Zm12.1-.65a1.15 1.15 0 0 1 1.63 0 5.15 5.15 0 0 1 0 7.3 1.15 1.15 0 1 1-1.63-1.63 2.85 2.85 0 0 0 0-4.04 1.15 1.15 0 0 1 0-1.63Zm3-3a1.15 1.15 0 0 1 1.63 0 9.4 9.4 0 0 1 0 13.3 1.15 1.15 0 1 1-1.63-1.63 7.1 7.1 0 0 0 0-10.04 1.15 1.15 0 0 1 0-1.63Z"/>';
    const mutedPath = '<path d="M3 9h4l5-4v14l-5-4H3V9Zm12.05-.05a1.15 1.15 0 0 1 1.63 0L18 10.27l1.32-1.32a1.15 1.15 0 1 1 1.63 1.63L19.63 12l1.32 1.32a1.15 1.15 0 1 1-1.63 1.63L18 13.63l-1.32 1.32a1.15 1.15 0 1 1-1.63-1.63L16.37 12l-1.32-1.32a1.15 1.15 0 0 1 0-1.63Z"/>';
    icon.innerHTML = '<svg class="viewerSolidSvg" viewBox="0 0 24 24" width="32" height="32" fill="currentColor" aria-hidden="true">' + (muted ? mutedPath : soundPath) + '</svg>';
  }
  if (label) label.hidden = true;
  button.title = button.dataset.audioLabel || '';
}
