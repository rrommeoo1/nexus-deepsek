// Every setting of a profile now opens from one button: the three bars in the header. The drawer
// below is the single index of those doors, so the screen no longer carries a second navigation that
// hides the hero, and closing the drawer always leaves the person on the profile they were reading.
//
// The order in `PROFILE_MENU_ITEMS` is the order the menu renders in, and `logout` is the one entry
// that is an action instead of a panel.

// A view id is what `renderProfiles` switches to; the menu id is what the person pressed. Only
// appearance differs, because the panel keeps the app's own name for the device settings.
const VIEW_OVERRIDES = Object.freeze({ appearance: "settings" });

export const PROFILE_MENU_ITEMS = Object.freeze([
  Object.freeze({ id: "profile", glyph: "◉", label: "profile.tabProfile" }),
  Object.freeze({ id: "wallet", glyph: "◈", label: "profile.tabWallet" }),
  Object.freeze({ id: "access", glyph: "◍", label: "profile.tabAccess" }),
  Object.freeze({ id: "privacy", glyph: "◎", label: "profileMenu.privacy" }),
  Object.freeze({ id: "notifications", glyph: "◌", label: "profileMenu.notifications" }),
  Object.freeze({ id: "appearance", glyph: "◐", label: "profileMenu.appearance" }),
  Object.freeze({ id: "logout", glyph: "→", label: "x.profile.logout", detail: "profile.logoutDetail", action: true }),
]);

export function profileMenuView(id) {
  return VIEW_OVERRIDES[id] || id;
}

// The other direction: the screen knows which panel is open and needs the row to mark.
export function profileMenuId(view) {
  const match = PROFILE_MENU_ITEMS.find((item) => profileMenuView(item.id) === view);
  return match ? match.id : view;
}

export function profileMenuMarkup({ esc, t, active = "profile" } = {}) {
  const id = profileMenuId(active);
  return '<div class="profileMenuLayer" data-profile-menu hidden>'
    + '<div class="profileMenuBackdrop" aria-hidden="true"></div>'
    + '<section class="profileMenuDrawer" role="dialog" aria-modal="true" aria-labelledby="profileMenuTitle" tabindex="-1" data-profile-menu-drawer>'
    + '<header><span><small>' + escape(esc, t("profileMenu.eyebrow")) + '</small><b id="profileMenuTitle">' + escape(esc, t("profileMenu.title")) + '</b></span>'
    + '<button type="button" class="profileMenuClose" data-modal-close data-profile-menu-close aria-label="' + escape(esc, t("common.close")) + '">×</button></header>'
    + '<p class="profileMenuHint">' + escape(esc, t("profileMenu.hint")) + '</p>'
    + '<nav class="profileMenuItems" aria-label="' + escape(esc, t("profileMenu.title")) + '">'
    + PROFILE_MENU_ITEMS.map((item) => '<button type="button" data-profile-menu-item="' + item.id + '"'
      + (item.id === id ? ' class="on" aria-current="true"' : "")
      + '><i aria-hidden="true">' + item.glyph + "</i><span><b>" + escape(esc, t(item.label)) + "</b>"
      + (item.detail ? "<small>" + escape(esc, t(item.detail)) + "</small>" : "")
      + '</span><em aria-hidden="true">›</em></button>').join("")
    + "</nav></section></div>";
}

export function markProfileMenuActive(root, view) {
  const id = profileMenuId(view);
  root?.querySelectorAll?.("[data-profile-menu-item]").forEach((button) => {
    const on = button.dataset.profileMenuItem === id;
    button.classList.toggle("on", on);
    button.setAttribute("aria-current", on ? "true" : "false");
  });
  return id;
}


// The three bars and the drawer are one control: both bars carry `aria-expanded`, Escape and a press
// outside the drawer close it, and focus returns to the button that opened it - a person who walked
// into the menu with a keyboard walks out of it with the same keyboard.
export function bindProfileMenu(root, { onSelect, onLogout } = {}) {
  const layer = root?.querySelector?.("[data-profile-menu]");
  const drawer = layer?.querySelector?.("[data-profile-menu-drawer]");
  if (!layer || !drawer) return null;
  let opener = null;
  const triggers = () => root.querySelectorAll("[data-owner-menu]");
  const mark = (open) => triggers().forEach((button) => button.setAttribute("aria-expanded", String(open)));
  const close = () => {
    if (layer.hidden) return;
    layer.hidden = true;
    layer.classList.remove("profileMenuOpen");
    mark(false);
    const back = opener;
    opener = null;
    back?.focus?.({ preventScroll: true });
  };
  const open = () => {
    if (!layer.hidden) return;
    const active = root.ownerDocument?.activeElement;
    opener = active?.closest?.("[data-owner-menu]") ? active : null;
    layer.hidden = false;
    layer.classList.add("profileMenuOpen");
    mark(true);
    drawer.focus?.({ preventScroll: true });
  };
  triggers().forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault();
    // The bars toggle: pressing the one that opened the drawer closes it again.
    if (layer.hidden) open();
    else close();
  }));
  layer.querySelectorAll("[data-profile-menu-close]").forEach((button) => button.addEventListener("click", close));
  layer.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    close();
  });
  // A press on the backdrop is a press that says "not now"; it lands on the layer, never inside the
  // drawer, so the check is a containment test rather than a target match.
  layer.addEventListener("click", (event) => {
    if (!drawer.contains(event.target)) close();
  });
  layer.querySelectorAll("[data-profile-menu-item]").forEach((item) => item.addEventListener("click", () => {
    const id = item.dataset.profileMenuItem;
    close();
    const entry = PROFILE_MENU_ITEMS.find((candidate) => candidate.id === id);
    if (entry?.action) onLogout?.();
    else onSelect?.(id);
  }));
  return { open, close, layer };
}

function escape(esc, value) {
  if (typeof esc === "function") return esc(String(value ?? ""));
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[character]));
}
