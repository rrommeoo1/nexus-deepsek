export function showDoubleTapHeart(host) {
  if (!host) return;
  host.querySelector?.(".doubleTapHeart")?.remove();
  const heart = document.createElement("span");
  heart.className = "doubleTapHeart";
  heart.setAttribute("aria-hidden", "true");
  heart.textContent = "♥";
  host.appendChild(heart);
  heart.addEventListener("animationend", () => heart.remove(), { once: true });
}

export function bindDoubleTapHeart(target, { onSingle, onHeart, delay = 230 } = {}) {
  if (!target) return;
  let timer = null;
  let lastTap = 0;
  let heartAt = 0;
  target.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const now = performance.now();
    if (now - lastTap <= delay) {
      clearTimeout(timer);
      timer = null;
      lastTap = 0;
      heartAt = now;
      onHeart?.(event);
      return;
    }
    lastTap = now;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      lastTap = 0;
      onSingle?.(event);
    }, delay);
  });
  target.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearTimeout(timer);
    timer = null;
    lastTap = 0;
    if (performance.now() - heartAt > delay) onHeart?.(event);
  });
}
