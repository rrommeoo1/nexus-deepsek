// Nexus identity onboarding — the first-run flow for an account that never chose an identity.
//
// What it does is deliberately small and true: claim a handle that is actually free, give the persona
// a name, choose who may see it, write a bio if the person wants one. Nothing is pre-filled from the
// account's email, nothing is decided on the person's behalf, and the flow is shown once.
//
// The pure helpers are exported so the rules can be tested in Node without a DOM.

export const NEXUS_HANDLE_PATTERN = /^[a-z0-9_]{2,30}$/;

export const PERSONA_CHOICES = Object.freeze(["social", "work", "dating", "travel", "market"]);
export const VISIBILITY_CHOICES = Object.freeze(["public", "friends", "private"]);

export function handleValidation(value) {
  const normalized = String(value ?? "").trim().replace(/^@/, "").toLowerCase();
  if (normalized.length < 2) return { value: normalized, valid: false, reason: "x.onboard.handleTooShort" };
  if (!NEXUS_HANDLE_PATTERN.test(normalized)) return { value: normalized, valid: false, reason: "x.onboard.handleInvalid" };
  return { value: normalized, valid: true, reason: null };
}

// The server owns "is this account still unknown": it says `required` from the record. The client
// keeps a fallback for an older payload, based on the same generated-handle shape the server uses.
export function onboardingRequired(user, onboarding = null) {
  if (onboarding && typeof onboarding.required === "boolean") return onboarding.required;
  const handle = String(user?.handle ?? "").toLowerCase();
  return /^u[a-z0-9_]{0,20}[0-9a-f]{4}$/.test(handle) || /^wallet[0-9a-f]{4,}$/.test(handle);
}

export function personaLabelKey(persona) {
  return "x.onboard.persona." + String(persona ?? "social").toLowerCase();
}

export function visibilityLabelKey(visibility) {
  return "x.onboard.visibility." + (VISIBILITY_CHOICES.includes(visibility) ? visibility : "public");
}

export function onboardingDefaults(user, onboarding = null) {
  return {
    handle: onboarding?.handle_source === "generated" ? "" : String(onboarding?.handle ?? user?.handle ?? ""),
    displayName: String(user?.display_name ?? "").trim(),
    persona: "social",
    visibility: "public",
    bio: "",
  };
}
export function onboardingMarkup(context) {
  const { esc, t, defaults = { handle: "", displayName: "", persona: "social", visibility: "public", bio: "" } } = context;
  const tr = (key) => (typeof t === "function" ? t(key) : key);
  const personaButtons = PERSONA_CHOICES.map((persona) => '<button type="button" class="onboardingChoice" data-onboard-persona="' + persona + '" aria-pressed="' + (defaults.persona === persona) + '">' + esc(tr(personaLabelKey(persona))) + '</button>').join("");
  const visibilityButtons = VISIBILITY_CHOICES.map((visibility) => '<button type="button" class="onboardingChoice" data-onboard-visibility="' + visibility + '" aria-pressed="' + (defaults.visibility === visibility) + '">' + esc(tr(visibilityLabelKey(visibility))) + '</button>').join("");
  return [
    '<section class="onboardingLayer" id="onboarding" role="dialog" aria-modal="true" aria-label="' + esc(tr("x.onboard.title")) + '" tabindex="-1">',
    '<form class="onboardingCard" data-onboard-form>',
    '<header><b>' + esc(tr("x.onboard.title")) + '</b><small>' + esc(tr("x.onboard.subtitle")) + '</small></header>',
    '<label class="onboardField"><span>@' + esc(tr("x.onboard.handle")) + '</span>',
    '<input name="handle" value="' + esc(defaults.handle) + '" maxlength="30" autocapitalize="none" autocomplete="off" spellcheck="false" dir="ltr" placeholder="' + esc(tr("x.onboard.handlePlaceholder")) + '" />',
    '<em data-onboard-handle-state></em></label>',
    '<label class="onboardField"><span>' + esc(tr("x.onboard.name")) + '</span>',
    '<input name="display_name" value="' + esc(defaults.displayName) + '" maxlength="50" dir="auto" placeholder="' + esc(tr("x.onboard.namePlaceholder")) + '" /></label>',
    '<div class="onboardRow"><span>' + esc(tr("x.onboard.persona")) + '</span><div class="onboardingChoices" role="group">' + personaButtons + '</div></div>',
    '<p class="sheet-note">' + esc(tr("x.onboard.personaHint")) + '</p>',
    '<div class="onboardRow"><span>' + esc(tr("x.onboard.visibility")) + '</span><div class="onboardingChoices" role="group">' + visibilityButtons + '</div></div>',
    '<p class="sheet-note">' + esc(tr("x.onboard.visibilityHint")) + '</p>',
    '<label class="onboardField"><span>' + esc(tr("x.onboard.bio")) + '</span>',
    '<textarea name="bio" rows="3" maxlength="300" dir="auto" placeholder="' + esc(tr("x.onboard.bioPlaceholder")) + '"></textarea></label>',
    '<p class="sheet-note">' + esc(tr("x.onboard.identityNote")) + '</p>',
    '<div class="onboardActions"><button class="btn small" type="submit">' + esc(tr("x.onboard.start")) + '</button></div>',
    '<p class="sheet-note">' + esc(tr("x.onboard.later")) + '</p>',
    '</form>',
    '</section>',
  ].join("");
}
// The flow is bound to the sheet, not to a route: it validates on the device, asks the server whether
// the handle is really free, and only then submits. A dismissal is allowed (Escape) because the
// account already works with its generated handle — the flow simply comes back next time.
export function bindOnboarding(root, context) {
  const layer = root.querySelector("#onboarding") ?? root;
  const form = layer.querySelector("[data-onboard-form]");
  if (!form) return null;
  const handleInput = form.querySelector('input[name="handle"]');
  const nameInput = form.querySelector('input[name="display_name"]');
  const bioInput = form.querySelector('textarea[name="bio"]');
  const state = layer.querySelector("[data-onboard-handle-state]");
  const submit = form.querySelector('button[type="submit"]');
  const tr = (key) => (typeof context.t === "function" ? context.t(key) : key);
  let persona = context.defaults?.persona ?? "social";
  let visibility = context.defaults?.visibility ?? "public";
  let checkToken = 0;
  let timer = null;

  const setHandleState = (text, tone = "") => {
    if (!state) return;
    state.textContent = text;
    state.dataset.tone = tone;
  };

  const checkHandle = async () => {
    const check = handleValidation(handleInput?.value);
    if (!check.valid) { setHandleState(tr(check.reason), "bad"); return false; }
    const token = ++checkToken;
    setHandleState(tr("x.onboard.handleChecking"), "busy");
    const result = await context.checkHandle(check.value);
    if (token !== checkToken) return false;
    if (!result || result.ok !== true || result.handle !== check.value) { setHandleState(tr("x.onboard.handleFailed"), "bad"); return false; }
    if (result.available === true) { setHandleState("@" + check.value + " · " + tr("x.onboard.handleFree"), "good"); return true; }
    setHandleState(tr(result.reason === "handle_invalid" ? "x.onboard.handleInvalid" : "x.onboard.handleTaken"), "bad");
    return false;
  };

  handleInput?.addEventListener("input", () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { void checkHandle(); }, 350);
  });
  form.querySelectorAll("[data-onboard-persona]").forEach((button) => button.addEventListener("click", () => {
    persona = button.dataset.onboardPersona;
    form.querySelectorAll("[data-onboard-persona]").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
  }));
  form.querySelectorAll("[data-onboard-visibility]").forEach((button) => button.addEventListener("click", () => {
    visibility = button.dataset.onboardVisibility;
    form.querySelectorAll("[data-onboard-visibility]").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
  }));
  form.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.preventDefault(); context.onDismiss?.(); } });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const check = handleValidation(handleInput?.value);
    const displayName = String(nameInput?.value ?? "").trim();
    if (!check.valid) { setHandleState(tr(check.reason), "bad"); return; }
    if (!displayName) { context.toast?.(tr("x.onboard.nameRequired")); return; }
    if (submit?.disabled) return;
    if (submit) submit.disabled = true;
    const result = await context.submit({
      handle: check.value,
      display_name: displayName,
      persona,
      visibility,
      bio: String(bioInput?.value ?? "").trim(),
    });
    if (submit) submit.disabled = false;
    if (!result?.ok) {
      if (result?.code === "HANDLE_TAKEN") { setHandleState(tr("x.onboard.handleTaken"), "bad"); return; }
      if (result?.code === "HANDLE_INVALID") { setHandleState(tr("x.onboard.handleInvalid"), "bad"); return; }
      if (result?.statement_of_reasons) { context.toast?.(tr("x.onboard.blocked")); return; }
      context.toast?.(tr("x.onboard.failed"));
      return;
    }
    context.onCompleted?.(result);
  });
  return { checkHandle, values: () => ({ handle: handleValidation(handleInput?.value).value, persona, visibility }) };
}


