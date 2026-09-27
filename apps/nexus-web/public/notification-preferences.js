// One notification-preference form per type, shared by the inbox (where the notifications are read)
// and by the profile menu (where the settings live). The fields and the PATCH contract are a single
// implementation on purpose: two copies would drift, and a preference that means two different things
// depending on the screen it was opened from is worse than a preference that is missing.

export const NOTIFICATION_LABEL_KEYS = Object.freeze({
  reaction: "activity.reactions", comment: "activity.comments", follow: "activity.follows", mention: "activity.mentions",
  story: "activity.stories", message: "activity.messages", call: "activity.calls", live: "activity.live",
  moderation: "activity.moderation", security: "activity.security", payment: "activity.payments", system: "activity.system",
});
export const NOTIFICATION_TYPES = new Set(Object.keys(NOTIFICATION_LABEL_KEYS));
// Security and system are not a preference: they are how an account hears about itself.
const MANDATORY_TYPES = new Set(["security", "system"]);
const PREVIEWS = new Set(["generic", "sender", "content"]);
const QUIET_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function notificationLabel(type, t) {
  return t(NOTIFICATION_LABEL_KEYS[type] || "activity.unknown");
}

export function notificationPreferences(list) {
  return (Array.isArray(list) ? list : []).filter((pref) => pref && NOTIFICATION_TYPES.has(pref.type));
}

// The channel truth is written on the screen, not implied here: push and email are sent as false
// because this build has no channel that could honour them.
export function notificationPreferenceForms(preferences, { esc, t, persona, newKey }) {
  return notificationPreferences(preferences).map((pref) => {
    const mandatory = MANDATORY_TYPES.has(pref.type);
    const preview = PREVIEWS.has(pref.preview) ? pref.preview : "generic";
    return '<form data-notification-pref="' + esc(pref.type) + '" data-notification-key="' + esc(newKey("notification-preference")) + '">'
      + '<span><b>' + esc(notificationLabel(pref.type, t)) + '</b><small>' + esc(mandatory ? t("activity.mandatory") : t("activity.profileScoped")) + " " + esc(persona) + "</small></span>"
      + '<label><input name="in_app" type="checkbox"' + (Number(pref.in_app) === 1 ? " checked" : "") + (mandatory ? " disabled" : "") + " /> " + esc(t("activity.inApp")) + "</label>"
      + "<label>" + esc(t("activity.preview")) + '<select name="preview">'
      + ["generic", "sender", "content"].map((value) => '<option value="' + value + '"'
        + (preview === value ? " selected" : "") + (value === "content" && persona === "dating" ? " disabled" : "") + ">"
        + esc(t("activity.preview" + value[0].toUpperCase() + value.slice(1))) + "</option>").join("")
      + "</select></label>"
      + "<label>" + esc(t("activity.quiet"))
      + '<input name="quiet_start" type="time" aria-label="' + esc(t("activity.quietStart")) + '" value="' + esc(pref.quiet_start || "") + '" />'
      + '<input name="quiet_end" type="time" aria-label="' + esc(t("activity.quietEnd")) + '" value="' + esc(pref.quiet_end || "") + '" /></label>'
      + '<button type="submit">' + esc(t("activity.save")) + "</button>"
      + '<small class="notificationPreferenceResult" aria-live="polite"></small></form>';
  }).join("");
}

// The form is the write path: it validates the two quiet fields as a pair, sends the persona it was
// rendered for, and accepts the answer only when the record that comes back is the record it asked
// for. A screen that navigated away while the request was in flight writes nothing.
export function bindNotificationPreferenceForms(host, { persona, ownerId, isCurrent, save, newKey, t }) {
  host?.querySelectorAll?.("[data-notification-pref]").forEach((form) => {
    form.addEventListener("input", () => { form.dataset.notificationKey = newKey("notification-preference"); });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const submit = form.querySelector('button[type="submit"]');
      const output = form.querySelector(".notificationPreferenceResult");
      if (submit.disabled) return;
      const quietStart = String(data.get("quiet_start") || "");
      const quietEnd = String(data.get("quiet_end") || "");
      const validTime = (value) => !value || QUIET_PATTERN.test(value);
      // An end without a start is not a quiet window, it is half of a form.
      if (!validTime(quietStart) || !validTime(quietEnd) || Boolean(quietStart) !== Boolean(quietEnd)) return output.textContent = t("activity.invalidQuiet");
      const preview = persona === "dating" ? "generic" : String(data.get("preview") || "generic");
      if (!PREVIEWS.has(preview)) return output.textContent = t("activity.invalidPreview");
      submit.disabled = true;
      output.textContent = t("activity.saving");
      const saved = await save({
        persona, type: form.dataset.notificationPref, in_app: form.elements.in_app.checked,
        preview, quiet_start: quietStart, quiet_end: quietEnd, push: false, email: false,
      }, form.dataset.notificationKey);
      if (!form.isConnected || !isCurrent()) return;
      submit.disabled = false;
      const valid = saved?.ok === true && Number(saved.owner_id) === Number(ownerId)
        && saved.persona === persona && saved.type === form.dataset.notificationPref
        && saved.preference?.persona === persona && saved.preference?.type === form.dataset.notificationPref
        && PREVIEWS.has(saved.preference?.preview)
        && [saved.preference?.in_app, saved.preference?.push, saved.preference?.email].every((value) => Number(value) === 0 || Number(value) === 1);
      if (!valid) return output.textContent = t("activity.saveFailed");
      output.textContent = t("activity.saved");
    });
  });
}
