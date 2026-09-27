export function decideSocialGesture({ dx, dy, scrollTop, pullThreshold = 64, swipeThreshold = 72 } = {}) {
  const horizontal = Number(dx);
  const vertical = Number(dy);
  const top = Number(scrollTop);
  if (![horizontal, vertical, top, pullThreshold, swipeThreshold].every(Number.isFinite)) return { action: "none" };
  if (top <= 1 && vertical >= pullThreshold && Math.abs(vertical) > Math.abs(horizontal) * 1.15) {
    return { action: "refresh" };
  }
  if (Math.abs(horizontal) >= swipeThreshold && Math.abs(horizontal) > Math.abs(vertical) * 1.2) {
    return { action: "channel", offset: horizontal < 0 ? 1 : -1 };
  }
  return { action: "none" };
}

export function decideViewerGesture({ dx, dy, swipeThreshold = 48 } = {}) {
  const horizontal = Number(dx);
  const vertical = Number(dy);
  const threshold = Number(swipeThreshold);
  if (![horizontal, vertical, threshold].every(Number.isFinite) || threshold <= 0) return { action: "none" };
  if (Math.max(Math.abs(horizontal), Math.abs(vertical)) < threshold) return { action: "none" };
  const axis = Math.abs(horizontal) > Math.abs(vertical) ? "horizontal" : "vertical";
  const delta = axis === "horizontal" ? horizontal : vertical;
  return { action: "step", axis, offset: delta < 0 ? 1 : -1 };
}
