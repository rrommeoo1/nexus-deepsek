// Nexus owner profile — the hero editor. The pencil on the name line opens the whole page: the name and
// the description in place, the location chip, the profile photo and the cover. One check saves whatever
// changed, and Escape leaves without saving anything.
//
// It lives in its own module because app.js is at its byte budget, and every dependency arrives through
// the factory: `getState()` is asked each time (the boot replaces the whole state object), `t` is
// wrapped (the interface language changes under a running app), and the upload, the media guard and the
// description linkifier belong to app.js — this module decides when they are used, not how they work.

const ACCEPTED_IMAGES = new Set(["image/jpeg", "image/png", "image/webp"]);
// What a phone hands over is not always what a server calls a jpeg. Some galleries report image/jpg or
// image/pjpeg, some report nothing at all, and the server checks the declared type against the file's own
// signature: a mismatch is stored as quarantined, which to the owner looks exactly like a save that failed.
const IMAGE_TYPE_ALIASES = new Map([
  ["image/jpg", "image/jpeg"], ["image/jpe", "image/jpeg"], ["image/pjpeg", "image/jpeg"], ["image/x-jpeg", "image/jpeg"],
  ["image/x-png", "image/png"], ["image/x-webp", "image/webp"],
]);
const IMAGE_TYPE_BY_NAME = [[/\.jpe?g$/i, "image/jpeg"], [/\.png$/i, "image/png"], [/\.webp$/i, "image/webp"]];

// A file that says it is a jpeg is re-labelled only when its name agrees: the bytes still have to pass the
// server's own signature check, so nothing is trusted here that the server would not confirm.
function canonicalPhotoFile(file) {
  const declared = String(file?.type ?? "").toLowerCase().trim();
  const canonical = IMAGE_TYPE_ALIASES.get(declared) || declared;
  if (ACCEPTED_IMAGES.has(canonical)) return file;
  const byName = IMAGE_TYPE_BY_NAME.find(([pattern]) => pattern.test(String(file?.name ?? "")))?.[1] ?? "";
  if (byName && (!canonical || canonical === "application/octet-stream" || !ACCEPTED_IMAGES.has(canonical))) {
    // The browser could not name the file, or named it something the server would quarantine: the name it
    // arrived with is the label the upload uses, and the server's signature check is still the judge.
    try {
      return new File([file], file.name || "photo", { type: byName, lastModified: Number(file.lastModified) || Date.now() });
    } catch { return file; }
  }
  return file;
}
const AVATAR_BYTES = 10 * 1024 * 1024;
const COVER_BYTES = 15 * 1024 * 1024;
// A file dialog that never answers must not hold the editor's save open forever.
const PICKER_GRACE_MS = 30000;

export function createProfileHeroEditor({ t, toast, api, newMutationKey, getState, bindLocationPicker, closeLocationPicker, bioMarkup, uploadMedia, safeMediaUrl, esc, visibilityLabel, openProfilePanel, reloadProfile }) {
  // Two clicks on the same check cannot become two saves: the second one waits.
  let saving = false;
  // What was chosen but not saved yet. It belongs to the profile, not to the DOM node that happens to be on
  // screen: a refresh - a presence pulse, a notification, coming back to the tab - replaces the whole hero,
  // and a chosen photo that left with the old node is a photo its owner can never save. A persona switch
  // starts a clean record, so one profile's photo can never be saved onto another.
  let pendingRecord = { persona: null, avatar: null, cover: null, avatarPreview: "", coverPreview: "", avatarSaved: "", coverSaved: "", coverFocus: 35, coverFocusSaved: 35 };
  // The two pickers belong to the binding (they know whether a dialog is in flight), and the crop
  // screen is built before that binding exists: it asks here instead of owning a second copy.
  let pickers = null;
  // The crop screen is one screen at a time, and a sheet that is replaced has to take its window listener
  // with it: a node that is only removed from the DOM keeps answering Escape and would undo the choice the
  // sheet above it is arranging.
  let activeCoverSheet = null;
  function disposeCoverSheet() {
    const sheet = activeCoverSheet;
    activeCoverSheet = null;
    if (!sheet) return;
    window.removeEventListener("keydown", sheet.onKey, true);
    document.querySelector("[data-cover-sheet]")?.remove();
  }

  // The edit page is the second dialog this module owns, and it takes the focus on purpose the same way
  // the crop screen does. While it is open the profile is not "left behind": the hero is behind a sheet
  // the owner opened from it, so a blur that lands on that sheet is not a reason to save anything.
  let activeEditSheet = null;
  function disposeEditSheet() {
    const sheet = activeEditSheet;
    activeEditSheet = null;
    if (!sheet) return;
    window.removeEventListener("keydown", sheet.onKey, true);
    document.querySelector("[data-hero-edit-sheet]")?.remove();
  }

  const safeText = (value) => (typeof esc === "function"
    ? esc(String(value ?? ""))
    : String(value ?? "").replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character])));

  // The age of a calendar day, counted the way a birthday is: the day has to have happened this year for the
  // year to count. The server is the judge of what is stored; this is what the field says before it is sent.
  function ageFromBirthDate(value, now = Date.now()) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const calendar = new Date(Date.UTC(year, month - 1, day));
    if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return null;
    const today = new Date(now);
    let age = today.getUTCFullYear() - year;
    const monthDelta = today.getUTCMonth() + 1 - month;
    if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < day)) age -= 1;
    return age;
  }

  // The persona row the sheet reads: what the profile holds is what the sheet offers, and the two
  // whole-word settings (who may read this profile, what the band above it shows) live in that row.
  function personaRecord() {
    const state = getState();
    const list = Array.isArray(state?.profiles) ? state.profiles : [];
    return list.find((entry) => entry?.persona === state?.persona) ?? null;
  }

  // A setting that is written on the press says what happened where it was pressed: one line, the same
  // contract the crop screen has, and it stays until the next press replaces it.
  function setSheetStatus(text, isError = false) {
    const status = document.querySelector("[data-hero-edit-status]");
    if (!status) return;
    status.textContent = String(text || "");
    status.hidden = !text;
    status.classList.toggle("isError", isError === true);
  }

  const bioOf = (value) => (typeof bioMarkup === "function" ? bioMarkup(value) : String(value ?? ""));
  const mediaUrl = (value) => (typeof safeMediaUrl === "function" ? safeMediaUrl(value) : String(value ?? ""));

  function pendingFor(host) {
    const persona = String(getState()?.persona ?? "");
    if (pendingRecord.persona !== persona) {
      pendingRecord = { persona, avatar: null, cover: null, avatarPreview: "", coverPreview: "", avatarSaved: "", coverSaved: "", coverFocus: 35, coverFocusSaved: 35 };
    }
    return pendingRecord;
  }

  function editorParts(host) {
    return {
      root: host?.querySelector(".nexusOwnerProfile") ?? host,
      nameText: host?.querySelector('[data-hero-edit="name"]') ?? null,
      nameInput: host?.querySelector('[data-hero-input="name"]') ?? null,
      bioText: host?.querySelector('[data-hero-edit="bio"]') ?? null,
      bioInput: host?.querySelector('[data-hero-input="bio"]') ?? null,
      birthInput: host?.querySelector('[data-hero-input="birth"]') ?? null,
      pencil: host?.querySelector("[data-owner-edit]") ?? null,
      confirm: host?.querySelector("[data-hero-confirm]") ?? null,
      avatarEdit: host?.querySelector('[data-hero-photo="avatar"]') ?? null,
      coverEdit: host?.querySelector('[data-hero-photo="cover"]') ?? null,
      avatarFile: host?.querySelector('[data-hero-file="avatar"]') ?? null,
      coverFile: host?.querySelector('[data-hero-file="cover"]') ?? null,
      avatarBox: host?.querySelector(".ownerAvatar") ?? null,
      coverBox: host?.querySelector(".ownerCover") ?? null,
      location: host?.querySelector("[data-owner-location]") ?? null,
      locationRow: host?.querySelector("[data-owner-location-row]") ?? null,
    };
  }

  // The editor is one editor: it is open when the name field is, and everything that needs to know
  // whether a save is still meaningful asks this instead of reading the DOM twice.
  function editorIsOpen(host) {
    const parts = editorParts(host);
    return Boolean(parts.nameInput && !parts.nameInput.hidden);
  }

  // Three lines are what a description gets: three links, one per line, are read without opening
  // anything. The field is the same height as the text it replaces and scrolls inside itself if
  // someone pastes more than it shows.
  function autoGrow(input) {
    if (input.tagName !== "TEXTAREA") return;
    const css = getComputedStyle(input);
    const line = Number.parseFloat(css.lineHeight) || 18;
    const padding = (Number.parseFloat(css.paddingTop) || 0) + (Number.parseFloat(css.paddingBottom) || 0);
    const three = Math.round(line * 3 + padding);
    input.style.maxHeight = three + "px";
    input.style.height = "auto";
    input.style.height = Math.max(three, input.scrollHeight) + "px";
  }  // The photo that was chosen is shown straight away: the owner sees the frame they are about to save,
  // and nothing leaves the device before the check is pressed.
  function showImage(box, url, alt) {
    if (!box || !url) return;
    let image = box.querySelector("img");
    if (!image) {
      image = document.createElement("img");
      image.alt = alt;
      box.insertBefore(image, box.firstChild);
    }
    image.src = url;
  }

  function releasePreview(state, kind) {
    if (state[kind + "Preview"]) URL.revokeObjectURL(state[kind + "Preview"]);
    state[kind + "Preview"] = "";
    state[kind] = null;
  }

  function dropPreviews(host) {
    const state = pendingFor(host);
    releasePreview(state, "avatar");
    releasePreview(state, "cover");
  }

  function acceptImage(host, kind, file) {
    const state = pendingFor(host);
    // The photo is named before it is judged: the canonical type is what travels, and a file the browser
    // could not name is named after its own extension instead of being refused for a missing label.
    const chosenFile = canonicalPhotoFile(file);
    const declared = String(chosenFile?.type ?? "").toLowerCase();
    if (!ACCEPTED_IMAGES.has(declared)) { toast(t("profileEdit.invalidImageType") + (declared ? " · " + declared : "")); return false; }
    if (chosenFile.size > (kind === "cover" ? COVER_BYTES : AVATAR_BYTES)) {
      toast(t(kind === "cover" ? "profileEdit.coverTooLarge" : "profileEdit.avatarTooLarge"));
      return false;
    }
    releasePreview(state, kind);
    const parts = editorParts(host);
    const preview = URL.createObjectURL(chosenFile);
    state[kind] = chosenFile;
    state[kind + "Preview"] = preview;
    showImage(kind === "cover" ? parts.coverBox : parts.avatarBox, preview, t(kind === "cover" ? "profile.coverAlt" : "profile.avatarAlt"));
    // A cover offsets the identity row: a fresh one has to pull it up the moment it is chosen, or the
    // owner would be looking at a layout that is not the one they are about to save.
    if (kind === "cover" && parts.root) parts.root.dataset.profileCover = "1";
    // A cover is not finished being chosen until its crop is: the photo opens on the crop screen, where
    // it is moved and saved in one press instead of being guessed at from a strip.
    if (kind === "cover") openCoverSheet(host, { source: preview, focus: state.coverFocus, file: chosenFile, previous: state.coverSaved });
    return true;
  }

  // A preview that is abandoned puts the saved photo back, and an image this module created for the
  // preview goes away with it.
  function restoreOne(state, kind, box) {
    if (!state[kind + "Preview"]) return;
    const saved = state[kind + "Saved"] || "";
    const image = box?.querySelector("img");
    if (image && !saved) image.remove();
    else if (image) image.src = saved;
  }

  function restoreImages(host) {
    const state = pendingFor(host);
    const parts = editorParts(host);
    restoreOne(state, "avatar", parts.avatarBox);
    restoreOne(state, "cover", parts.coverBox);
    if (parts.root && !state.coverSaved) parts.root.dataset.profileCover = "0";
    dropPreviews(host);
  }

  // The location is chosen while the editor is open and saved with everything else: picking a city is
  // part of the same decision as the name and the photo, so it no longer leaves on its own.
  function setHeroLocation(host, value) {
    const button = editorParts(host).location;
    if (!button) return;
    button.dataset.heroLocation = String(value ?? "").trim();
    const label = button.querySelector("span");
    if (label) label.textContent = button.dataset.heroLocation || t("profile.locationAdd");
    closeLocationPicker(host);
  }

  // A choice belongs to the profile, not to the moment the editor happens to be open: when a refresh
  // rebuilds the hero, the chosen photo is drawn again instead of looking lost.
  function showPendingPreviews(host) {
    const state = pendingFor(host);
    const parts = editorParts(host);
    if (state.avatarPreview) showImage(parts.avatarBox, state.avatarPreview, t("profile.avatarAlt"));
    if (state.coverPreview) {
      showImage(parts.coverBox, state.coverPreview, t("profile.coverAlt"));
      applyCoverFocus(parts.coverBox, state.coverFocus);
      if (parts.root) parts.root.dataset.profileCover = "1";
    }
  }
  const clampFocus = (value) => Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
  const coverFocusOf = (box, fallback = 35) => (box?.dataset?.coverFocus === undefined ? fallback : clampFocus(box.dataset.coverFocus));

  // The crop travels with the photo everywhere it is drawn: the hero band and the preview inside the
  // crop screen read the same number, so what the owner arranges is what a reader is shown.
  function applyCoverFocus(box, focus) {
    const value = clampFocus(focus);
    if (box) box.dataset.coverFocus = String(value);
    const image = box?.querySelector("img");
    if (image) image.style.objectPosition = "center " + value + "%";
    return value;
  }

  // The crop screen says which file it is working on and what happened to it: on a phone, those two lines
  // are the difference between "it did not save" and a sentence the owner can hand back to us.
  function setCoverStatus(text, isError = false) {
    const status = document.querySelector("[data-cover-status]");
    if (!status) return;
    status.textContent = String(text || "");
    status.classList.toggle("isError", isError === true);
    status.hidden = !text;
  }

  function describePhoto(file) {
    if (!file) return "";
    const megabytes = Number(file.size || 0) / (1024 * 1024);
    return String(file.name || "photo") + " · " + megabytes.toFixed(1) + " MB · " + String(file.type || "unknown");
  }

  // A band is short and a photo is wide, so choosing a cover is really choosing where the frame sits on
  // it. The photo opens on a screen big enough to judge, it can be dragged up and down (or moved with
  // the slider), and one button writes the cover together with the position that was chosen.
  function openCoverSheet(host, { source, focus, file = null, previous = "" }) {
    disposeCoverSheet();
    const parts = editorParts(host);
    const state = pendingFor(host);
    let current = clampFocus(focus);
    let dragging = null;
    let busy = false;
    const backdrop = document.createElement("div");
    backdrop.className = "coverSheetBackdrop";
    backdrop.dataset.coverSheet = "1";
    backdrop.innerHTML = [
      '<section class="coverSheet" role="dialog" aria-modal="true" aria-label="', t("profileEdit.coverTitle"), '">',
      '<header><b>', t("profileEdit.coverTitle"), '</b><button type="button" class="coverSheetClose" data-cover-cancel aria-label="', t("common.close"), '">×</button></header>',
      '<div class="coverSheetFrame" data-cover-frame><img alt="" /></div>',
      '<label class="coverSheetRange"><span>', t("profileEdit.coverPosition"), '</span>',
      '<input type="range" min="0" max="100" step="1" data-cover-range /></label>',
      '<p class="coverSheetHint">', t("profileEdit.coverMove"), '</p>',
      '<p class="coverSheetFile" data-cover-file></p>',
      '<p class="coverSheetStatus" data-cover-status hidden></p>',
      '<menu>',
      '<button type="button" data-cover-another>', t("profileEdit.changeCover"), '</button>',
      '<button type="button" data-cover-save>', t("profileEdit.coverSave"), '</button>',
      '<button type="button" data-cover-cancel>', t("common.cancel"), '</button>',
      '</menu></section>',
    ].join("");
    document.body.appendChild(backdrop);
    const frame = backdrop.querySelector("[data-cover-frame]");
    const image = frame.querySelector("img");
    const range = backdrop.querySelector("[data-cover-range]");
    const saveButton = backdrop.querySelector("[data-cover-save]");
    // The photo is the one that was chosen or the one the profile holds; the address is set as a
    // property, so neither a blob nor a stored path ever becomes markup.
    image.src = String(source || "");
    // The file line is text, never markup: a phone gallery can hand over a name with anything in it.
    const fileLine = backdrop.querySelector("[data-cover-file]");
    if (fileLine) fileLine.textContent = describePhoto(file);
    const paint = () => {
      image.style.objectPosition = "center " + current + "%";
      frame.dataset.coverFocus = String(current);
      range.value = String(current);
    };
    paint();
    const close = ({ keepChoice }) => {
      // This sheet closes itself and only itself: it clears the registry while it still owns it, so the
      // screen that replaced it is never disposed by the one underneath.
      if (activeCoverSheet?.onKey === onKey) activeCoverSheet = null;
      window.removeEventListener("keydown", onKey, true);
      backdrop.remove();
      // A choice that is not saved goes back to what the profile holds: the sheet is where a cover is
      // arranged, not where one is lost.
      if (!keepChoice && file) {
        releasePreview(state, "cover");
        state.cover = null;
        showImage(parts.coverBox, previous, t("profile.coverAlt"));
        if (parts.root) parts.root.dataset.profileCover = previous ? "1" : "0";
      }
    };
    const onKey = (event) => { if (event.key === "Escape") { event.preventDefault(); close({ keepChoice: false }); } };
    window.addEventListener("keydown", onKey, true);
    // The sheet that is on screen is the one that answers Escape, and the next one takes that place when
    // it opens.
    activeCoverSheet = { onKey };
    frame.addEventListener("pointerdown", (event) => {
      dragging = { y: event.clientY, start: current };
      // A pointer the browser no longer tracks (a synthetic one, or a finger that left) must not throw
      // out of the drag: the sheet keeps working and the next move simply has nothing to follow.
      try { frame.setPointerCapture?.(event.pointerId); } catch { dragging = null; }
      frame.classList.add("isDragging");
    });
    frame.addEventListener("pointermove", (event) => {
      if (!dragging || !frame.clientHeight) return;
      // Dragging the photo down shows a higher part of it: the frame moves the other way.
      current = clampFocus(dragging.start - ((event.clientY - dragging.y) / frame.clientHeight) * 100);
      paint();
    });
    const endDrag = () => { dragging = null; frame.classList.remove("isDragging"); };
    frame.addEventListener("pointerup", endDrag);
    frame.addEventListener("pointercancel", endDrag);
    range.addEventListener("input", () => { current = clampFocus(range.value); paint(); });
    backdrop.querySelectorAll("[data-cover-cancel]").forEach((button) => button.addEventListener("click", () => close({ keepChoice: false })));
    // Choosing another photo does not close this screen: the picker opens over the crop that is already
    // arranged, and a dismissed dialog, a refused file or a photo that is too large leaves the owner
    // exactly where they were instead of on a profile with no crop screen at all.
    backdrop.querySelector("[data-cover-another]")?.addEventListener("click", () => {
      setCoverStatus(t("profileEdit.choosingCover"));
      pickers?.cover?.();
    });
    saveButton.addEventListener("click", async () => {
      if (busy) return;
      busy = true;
      saveButton.disabled = true;
      const saved = await commitCover(host, { file, focus: current, previous });
      if (saved) close({ keepChoice: true });
      else { busy = false; saveButton.disabled = false; }
    });
  }



  // One write for a cover: the bytes go up first, then the address and the crop reach the profile in a
  // single request, and what the route echoes back is what the hero shows.
  async function commitCover(host, { file, focus, previous = "" }) {
    const parts = editorParts(host);
    const state = pendingFor(host);
    const persona = String(getState()?.persona ?? "");
    if (!persona) { toast(t("profile.inlineFailed")); return false; }
    const value = clampFocus(focus);
    let url = "";
    if (file) {
      setCoverStatus(t("profileEdit.uploadingCover"));
      const uploaded = await uploadPhoto(file, "profile_cover", "cover");
      if (uploaded === null) return false;
      url = uploaded.url;
    }
    const body = { cover_focus: value };
    if (url && url !== state.coverSaved) body.cover = url;
    if (!body.cover && !previous && !state.coverSaved) { toast(t("profileEdit.coverFailed")); return false; }
    const result = await api("/api/persona/" + encodeURIComponent(persona), {
      method: "PATCH",
      headers: { "Idempotency-Key": newMutationKey("hero-cover") },
      body,
    }).catch(() => null);
    const savedRow = result?.persona && typeof result.persona === "object" ? result.persona : null;
    const stored = String(savedRow?.cover ?? "");
    const savedOk = result?.ok === true && savedRow !== null
      && Number(savedRow.cover_focus ?? 35) === value
      && (!body.cover || stored === body.cover);
    if (!savedOk) { toast(t("profileEdit.coverFailed")); return false; }
    state.coverSaved = stored || state.coverSaved;
    state.coverFocus = value;
    state.coverFocusSaved = value;
    if (file) { releasePreview(state, "cover"); state.cover = null; }
    applyCoverFocus(parts.coverBox, value);
    if (state.coverSaved) showImage(parts.coverBox, state.coverSaved, t("profile.coverAlt"));
    if (parts.root) parts.root.dataset.profileCover = state.coverSaved ? "1" : "0";
    const profileInState = Array.isArray(getState()?.profiles) ? getState().profiles.find((entry) => entry?.persona === persona) : null;
    if (profileInState) { profileInState.cover = state.coverSaved; profileInState.cover_focus = value; }
    toast(t("profileEdit.coverSaved"));
    return true;
  }


  function openEditor(host, kind = "name") {
    const parts = editorParts(host);
    if (!parts.nameInput || !parts.bioInput) return;
    // What the saved photos are right now is what Escape goes back to.
    const state = pendingFor(host);
    state.avatarSaved = parts.avatarBox?.querySelector("img")?.getAttribute("src") || "";
    state.coverSaved = parts.coverBox?.querySelector("img")?.getAttribute("src") || "";
    // The crop the profile currently holds is the crop Escape goes back to.
    state.coverFocus = coverFocusOf(parts.coverBox);
    state.coverFocusSaved = state.coverFocus;
    parts.nameInput.value = String(parts.nameText?.dataset.heroValue ?? "");
    parts.bioInput.value = String(parts.bioText?.dataset.heroValue ?? "");
    // The date of birth is the fact that keeps the age true: the field opens on the day the record holds, and
    // Escape puts that same day back like every other field.
    if (parts.birthInput) parts.birthInput.value = String(parts.birthInput.dataset.heroValue ?? "");
    if (parts.nameText) parts.nameText.hidden = true;
    if (parts.bioText) parts.bioText.hidden = true;
    parts.nameInput.hidden = false;
    parts.bioInput.hidden = false;
    // The pencil is the way in, so it steps aside for the check while the fields are open.
    if (parts.pencil) parts.pencil.hidden = true;
    if (parts.confirm) { parts.confirm.hidden = false; parts.confirm.disabled = false; }
    if (parts.location) parts.location.dataset.heroLocation = String(parts.location.dataset.ownerLocation ?? "");
    // The whole identity is editable now, so the page says so: the photo badges and an empty cover slot
    // exist only while this class is on the profile.
    parts.root?.classList.add("heroEditing");
    // A photo that was chosen before this editor opened is still that photo.
    showPendingPreviews(host);
    autoGrow(parts.bioInput);
    const focus = kind === "bio" ? parts.bioInput : kind === "birth" ? parts.birthInput : parts.nameInput;
    focus?.focus({ preventScroll: true });
    // A number field has no selection range, and asking for one throws: the call is best-effort so opening
    // the row that holds the year cannot throw out of the editor that is opening.
    try { focus?.setSelectionRange?.(focus.value.length, focus.value.length); } catch { /* not a text field */ }
    // The city is edited in the row the band reads, so opening that row opens its suggestions with it:
    // "edit the location" is one press, not "find the chip and then press it".
    if (kind === "location") parts.location?.click();
  }

  function closeEditor(host, { keep = false } = {}) {
    const parts = editorParts(host);
    if (parts.nameInput) {
      parts.nameInput.hidden = true;
      parts.nameInput.value = String(parts.nameText?.dataset.heroValue ?? parts.nameInput.value);
    }
    if (parts.bioInput) {
      parts.bioInput.hidden = true;
      parts.bioInput.value = String(parts.bioText?.dataset.heroValue ?? parts.bioInput.value);
    }
    if (parts.birthInput) parts.birthInput.value = String(parts.birthInput.dataset.heroValue ?? "");
    if (parts.nameText) parts.nameText.hidden = false;
    if (parts.bioText) parts.bioText.hidden = false;
    // The check belongs to the act of writing the profile: once the editor is left behind, the pencil
    // that opens it comes back and the check disappears together with the fields.
    if (parts.pencil) parts.pencil.hidden = false;
    if (parts.confirm) { parts.confirm.hidden = true; parts.confirm.disabled = false; parts.confirm.classList.remove("heroConfirmBusy"); }
    if (parts.location) {
      delete parts.location.dataset.heroLocation;
      if (!keep) {
        const label = parts.location.querySelector("span");
        if (label) label.textContent = String(parts.location.dataset.ownerLocation || "") || t("profile.locationAdd");
      }
    }
    closeLocationPicker(host);
    parts.root?.classList.remove("heroEditing");
    // The crop screen cannot outlive the hero it edits: a refresh replaces the page under it and the
    // sheet would be arranging a photo that is no longer there.
    disposeCoverSheet();
    if (keep) dropPreviews(host);
    else restoreImages(host);
    if (parts.avatarFile) parts.avatarFile.value = "";
    if (parts.coverFile) parts.coverFile.value = "";
  }

  // The bytes go up first and the profile is written once: a save that carries the name, the description,
  // the location and both photos is one decision, so the route sees one request for it.
  async function uploadPhoto(file, purpose, kind) {
    if (typeof uploadMedia !== "function") { toast(t("profile.inlineFailed")); return null; }
    const before = getState()?.persona;
    const failed = t(kind === "cover" ? "profileEdit.coverFailed" : "profileEdit.avatarFailed");
    // A failure that says nothing is a failure nobody can act on: the step that refused is named, in the
    // toast and in the crop screen, together with the code the client used for it.
    const upload = await uploadMedia(file, purpose).catch((error) => ({ error }));
    // The profile changed while the bytes were moving: the save belongs to the screen that started it.
    if (before !== getState()?.persona) return null;
    if (upload?.error) { const text = failed + " · " + String(upload.error.code || upload.error.name || "unknown"); toast(text); setCoverStatus(text, true); return null; }
    if (!upload?.ok || !upload.media?.url) { toast(failed); setCoverStatus(failed, true); return null; }
    if (!upload.media.available) {
      const quarantined = t(kind === "cover" ? "profileEdit.coverQuarantined" : "profileEdit.avatarQuarantined");
      toast(quarantined); setCoverStatus(quarantined, true); return null;
    }
    const url = mediaUrl(upload.media.url);
    if (!url) { toast(failed); setCoverStatus(failed, true); return null; }
    return { url };
  }  // One request carries only the fields that actually changed, and the hero is updated from what the
  // route echoes back.
  async function saveEditor(host) {
    if (saving) return;
    const state = getState();
    const persona = state?.persona;
    const parts = editorParts(host);
    if (!parts.nameInput || !parts.bioInput) return;
    const chosen = pendingFor(host);
    const chosenPhoto = Boolean(chosen.avatar || chosen.cover);
    // A check that cannot save says so. The one case to recover rather than report is a refresh that
    // closed the editor while a photo was still chosen: the editor comes back with the choice and the
    // written words still in it.
    if (!editorIsOpen(host)) {
      if (!chosenPhoto) return;
      openEditor(host, "name");
      toast(t("profile.inlineReopened"));
      return;
    }
    if (!persona) { toast(t("profile.inlineFailed")); return; }
    const name = String(parts.nameInput.value ?? "").trim();
    const bio = String(parts.bioInput.value ?? "");
    const previousName = String(parts.nameText?.dataset.heroValue ?? "");
    const previousBio = String(parts.bioText?.dataset.heroValue ?? "");
    const location = String(parts.location?.dataset.heroLocation ?? parts.location?.dataset.ownerLocation ?? "");
    const previousLocation = String(parts.location?.dataset.ownerLocation ?? "");
    // The date of birth is a calendar day, so an empty field clears it instead of being an error, and a day
    // that would make the person younger than 13 or older than 120 is refused before a request is made. The
    // point of a date is the age it keeps true: next year the band prints the next year, with nothing to edit.
    const birthRaw = String(parts.birthInput?.value ?? "").trim();
    const birth = birthRaw === "" ? null : birthRaw;
    const previousBirth = String(parts.birthInput?.dataset.heroValue ?? "");
    const birthChanged = String(birth ?? "") !== previousBirth;
    if (birthChanged && birth !== null) {
      const derived = ageFromBirthDate(birth);
      if (!Number.isInteger(derived) || derived < 13 || derived > 120) {
        toast(t("profileEdit.birthOutOfRange"));
        parts.birthInput?.focus();
        return;
      }
    }
    // Nothing was touched and no photo was chosen: leaving the editor is the whole answer, and it is
    // said out loud, because a check that appears to do nothing is what erodes trust in a save.
    if (name === previousName && bio === previousBio && location === previousLocation && !birthChanged && !chosenPhoto) {
      toast(t("profile.inlineNothing"));
      closeEditor(host);
      return;
    }
    if (!name) { toast(t("profile.editName")); parts.nameInput.focus(); return; }
    saving = true;
    if (parts.confirm) { parts.confirm.disabled = true; parts.confirm.classList.add("heroConfirmBusy"); }
    let photoFailed = false;
    try {
      // The bytes go up first, and a photo that cannot be stored no longer takes the written words with
      // it: the words are saved and the photo failure is said afterwards.
      let avatar = { url: "" };
      if (chosen.avatar) {
        avatar = await uploadPhoto(chosen.avatar, "profile_avatar", "avatar");
        if (avatar === null) { avatar = { url: "" }; photoFailed = true; }
      }
      let cover = { url: "" };
      if (chosen.cover) {
        cover = await uploadPhoto(chosen.cover, "profile_cover", "cover");
        if (cover === null) { cover = { url: "" }; photoFailed = true; }
      }
      const body = {};
      if (name !== previousName) body.name = name;
      if (bio !== previousBio) body.bio = bio;
      if (location !== previousLocation) body.location = location;
      // The day and the number the old field wrote travel together: a write that touches the date clears the
      // declared number, so the age a profile shows is either the one the date stands for or nothing at all -
      // never a number left behind by an earlier version of the record.
      if (birthChanged) {
        body.birth_date = birth;
        body.age = null;
      }
      if (avatar.url && avatar.url !== chosen.avatarSaved) body.avatar = avatar.url;
      if (cover.url && cover.url !== chosen.coverSaved) body.cover = cover.url;
      // A cover carries its crop: a photo written without the position the owner arranged would drop the
      // frame back into the middle of the picture.
      if (("cover" in body || chosen.cover) && chosen.coverFocus !== chosen.coverFocusSaved) body.cover_focus = chosen.coverFocus;
      if (!Object.keys(body).length) {
        // There was nothing to write. If a photo was chosen and could not be stored, that is the news.
        toast(t(photoFailed ? "profile.inlinePhotoKept" : "profile.inlineNothing"));
        closeEditor(host);
        return;
      }
      const result = await api("/api/persona/" + encodeURIComponent(persona), {
        method: "PATCH",
        headers: { "Idempotency-Key": newMutationKey("hero-edit") },
        body,
      }).catch(() => null);
      // The route answers with `persona` (the updated row), not `profile`: reading the wrong field made
      // a successful save look like a failure and left the hero showing the old value.
      const savedRow = result?.persona && typeof result.persona === "object" ? result.persona : null;
      const savedOk = result?.ok === true && savedRow !== null
        && (!("name" in body) || savedRow.name === body.name)
        && (!("bio" in body) || String(savedRow.bio ?? "") === body.bio)
        && (!("location" in body) || String(savedRow.location ?? "") === body.location)
        && (!("birth_date" in body) || String(savedRow.birth_date ?? "") === String(body.birth_date ?? ""))
        && (!("age" in body) || savedRow.age === null)
        && (!("avatar" in body) || String(savedRow.avatar ?? "") === body.avatar)
        && (!("cover" in body) || String(savedRow.cover ?? "") === body.cover)
        && (!("cover_focus" in body) || Number(savedRow.cover_focus ?? 35) === body.cover_focus);
      if (!savedOk) {
        // The editor stays open with the words still in it: a failed save must not throw away what was
        // written, and a message must say what happened.
        if (result?.statement_of_reasons) return toast(t("profile.inlineBlocked"));
        return toast(t("profile.inlineFailed"));
      }
      if ("name" in body && parts.nameText) {
        parts.nameText.dataset.heroValue = body.name;
        parts.nameText.textContent = body.name;
      }
      if ("bio" in body && parts.bioText) {
        parts.bioText.dataset.heroValue = body.bio;
        // The description is text that keeps its links: what is stored is the text that was typed, and
        // what is rendered is that same text with the addresses turned into anchors.
        parts.bioText.innerHTML = body.bio ? bioOf(body.bio) : t("profile.bioPlaceholder");
        parts.bioText.closest(".ownerBio")?.classList.toggle("isEmpty", !body.bio);
      }
      if ("location" in body && parts.location) {
        parts.location.dataset.ownerLocation = body.location;
        const label = parts.location.querySelector("span");
        if (label) label.textContent = body.location || t("profile.locationAdd");
      }
      // The field the band reads keeps the day the record now holds, so the next Escape goes back to what was
      // saved and not to what was typed before it.
      if ("birth_date" in body && parts.birthInput) {
        parts.birthInput.dataset.heroValue = body.birth_date ?? "";
        parts.birthInput.value = body.birth_date ?? "";
      }
      // A chosen photo costs an upload but not a write: the media is content-addressed, so the same bytes
      // are the same address, and only a different address belongs in the route call. Either way the hero
      // stops showing the local preview and shows the stored address.
      if (chosen.avatar) {
        chosen.avatarSaved = avatar.url || chosen.avatarSaved;
        showImage(parts.avatarBox, chosen.avatarSaved, t("profile.avatarAlt"));
      }
      if (chosen.cover) {
        chosen.coverSaved = cover.url || chosen.coverSaved;
        if (chosen.coverSaved && parts.root) parts.root.dataset.profileCover = "1";
        showImage(parts.coverBox, chosen.coverSaved, t("profile.coverAlt"));
      }
      if ("cover_focus" in body) {
        applyCoverFocus(parts.coverBox, body.cover_focus);
        chosen.coverFocusSaved = body.cover_focus;
      }
      closeEditor(host, { keep: true });
      const profileInState = Array.isArray(state?.profiles) ? state.profiles.find((entry) => entry?.persona === persona) : null;
      if (profileInState) {
        if ("name" in body) profileInState.name = body.name;
        if ("bio" in body) profileInState.bio = body.bio;
        if ("location" in body) profileInState.location = body.location;
        if ("birth_date" in body) profileInState.birth_date = body.birth_date;
        if ("avatar" in body) profileInState.avatar = body.avatar;
        if ("cover" in body) profileInState.cover = body.cover;
      } else if (savedRow) state.profiles = [...(state?.profiles ?? []), savedRow];
      if (photoFailed) {
        // The words are saved and the photo is not: the editor stays open with the chosen photo still in
        // it, so pressing the same check again is the entire retry.
        return toast(t("profile.inlinePhotoKept"));
      }
      closeEditor(host, { keep: true });
      toast(t("profile.inlineSaved"));
      // The band is built from the record, and the name, the words, the city and the year are all in it: a
      // save that changed one of them asks the screen to draw the band again, so the profile never keeps
      // printing a fact the record no longer holds.
      if (["name", "bio", "location", "age", "birth_date"].some((key) => key in body)) reloadProfile?.();
    } finally {
      saving = false;
      if (parts.confirm) { parts.confirm.disabled = false; parts.confirm.classList.remove("heroConfirmBusy"); }
    }
  }

  // A private profile is read by friends and by whoever pays for it, so turning the private mode on also
  // opens the paid door: the prices are the ones the record already holds, never a number invented here,
  // and the owner tunes them in Confidentialitate. A profile that already sells access keeps its prices.
  function privateAccessFields() {
    const record = personaRecord() ?? {};
    if (Number(record.private_access_enabled) === 1) return {};
    const clamp = (value, min, max, fallback) => (Number.isInteger(Number(value)) ? Math.min(max, Math.max(min, Math.round(Number(value)))) : fallback);
    const priceCents = clamp(record.private_access_price_cents, 100, 1000000, 1500);
    const currency = String(record.private_access_currency || "").toUpperCase();
    return {
      private_access: {
        enabled: true,
        price_cents: priceCents,
        month_price_cents: clamp(record.private_access_month_price_cents, 100, 100000000, priceCents * 30),
        forever_price_cents: clamp(record.private_access_forever_price_cents, 100, 1000000000, priceCents * 365),
        currency: new Set(["USD", "EUR", "USDC", "USDT", "EGLD"]).has(currency) ? currency : "USD",
        duration_days: clamp(record.private_access_duration_days, 1, 365, 30),
      },
    };
  }

  // The pressed state of a choice is the state of the record, never the state of a button: after a write
  // the two are painted from what the route echoed back.
  function paintSheetChoice(layer, selector, key, value) {
    layer?.querySelectorAll(selector).forEach((button) => button.setAttribute("aria-pressed", String(button.dataset[key] === value)));
  }

  // The sign beside the name is the same fact as the switch in this sheet, so the two are painted together:
  // the owner always reads it - an open padlock while the profile is public, a closed one while it is not -
  // and a visitor reads it only when the profile is not public. The press opens the panel that edits it.
  function paintVisibilityChip(host, visibility) {
    const parts = editorParts(host);
    const heading = parts.nameText?.closest?.("h1") ?? parts.root?.querySelector("h1");
    if (!heading) return;
    heading.querySelector(".ownerVisibility")?.remove();
    const locked = Boolean(visibility) && visibility !== "public";
    const text = typeof visibilityLabel === "function" ? String(visibilityLabel(visibility)) : String(visibility);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "ownerVisibility " + (locked ? "isLocked" : "isOpen");
    chip.dataset.ownerVisibility = "";
    chip.setAttribute("aria-label", text);
    chip.title = text;
    const glyph = document.createElement("i");
    glyph.setAttribute("aria-hidden", "true");
    glyph.textContent = locked ? "🔒" : "🔓";
    chip.append(glyph);
    chip.addEventListener("click", () => { openProfilePanel?.("privacy"); });
    heading.append(chip);
  }

  // A crop is arranged in the crop screen that already exists: this only decides to open it, on the photo
  // the profile holds or the one that was chosen and not saved yet.
  function openCoverFor(host) {
    const parts = editorParts(host);
    const state = pendingFor(host);
    const source = state.coverPreview || state.coverSaved || String(parts.coverBox?.querySelector("img")?.getAttribute("src") || "");
    if (!source) { pickers?.cover?.(); return; }
    openCoverSheet(host, { source, focus: state.coverFocus, file: state.cover, previous: state.coverSaved });
  }

  // One whole-word setting at a time, written where it is pressed. The answer is checked against the
  // request before anything on the screen moves, so a failed write never leaves the hero claiming a
  // setting the record does not hold.
  async function writeSheetSetting(host, fields) {
    const state = getState();
    const persona = state?.persona;
    const ownerId = Number(state?.user?.id);
    const parts = editorParts(host);
    if (!persona) return;
    const layer = document.querySelector("[data-hero-edit-sheet]");
    if (!layer || layer.dataset.busy === "1") return;
    layer.dataset.busy = "1";
    setSheetStatus(t("profileEdit.saving"));
    const result = await api("/api/persona/" + encodeURIComponent(persona), {
      method: "PATCH",
      headers: { "Idempotency-Key": newMutationKey("hero-setting") },
      body: fields,
    }).catch(() => null);
    // The sheet may have been closed while the bytes were moving, or the persona may have moved on: the
    // answer to a write the record accepted is still applied to the hero, and the persona one is dropped.
    const sheet = document.querySelector("[data-hero-edit-sheet]");
    if (String(getState()?.persona ?? "") !== String(persona)) return;
    if (sheet) sheet.dataset.busy = "";
    const row = result?.persona && typeof result.persona === "object" ? result.persona : null;
    const wholeWords = Object.entries(fields).filter(([, value]) => value === null || typeof value !== "object");
    const accepted = result?.ok === true && row !== null && Number(row.user_id) === ownerId
      && row.persona === persona
      && wholeWords.every(([key, value]) => String(row[key] ?? "") === String(value));
    if (!accepted) { if (sheet) setSheetStatus(t("profileEdit.settingFailed"), true); return; }
    const record = personaRecord();
    if ("cover_mode" in fields) {
      const stored = row.cover_mode === "stories" ? "stories" : "cover";
      if (parts.root) parts.root.dataset.coverMode = stored;
      if (sheet) paintSheetChoice(sheet, "[data-cover-mode]", "coverMode", stored);
      if (record) record.cover_mode = stored;
    }
    if ("visibility" in fields) {
      paintVisibilityChip(host, row.visibility);
      if (record) {
        record.visibility = row.visibility;
        record.private_access_enabled = Number(row.private_access_enabled) === 1 ? 1 : 0;
      }
      if (sheet) {
        paintSheetChoice(sheet, "[data-edit-visibility]", "editVisibility", row.visibility);
        const hint = sheet.querySelector("[data-edit-visibility-hint]");
        if (hint) hint.textContent = t(row.visibility === "private" ? "profileEdit.privateHint" : row.visibility === "public" ? "profileEdit.publicHint" : "profileEdit.visibility");
      }
    }
    if (!sheet) return;
    setSheetStatus(t("profileEdit.settingSaved"));
    toast(t("profileEdit.settingSaved"));
  }

  // The page itself: one dialog on top of the profile, every way in as a row, and Escape or the close
  // control leaves without changing anything - the two choices inside it were already written.
  function openEditSheet(host) {
    const parts = editorParts(host);
    if (!parts.root) return;
    disposeEditSheet();
    document.body.insertAdjacentHTML("beforeend", editSheetMarkup(host));
    const layer = document.querySelector("[data-hero-edit-sheet]");
    if (!layer) return;
    const close = () => {
      disposeEditSheet();
      parts.pencil?.setAttribute("aria-expanded", "false");
    };
    const onKey = (event) => { if (event.key === "Escape") { event.preventDefault(); close(); } };
    window.addEventListener("keydown", onKey, true);
    activeEditSheet = { onKey };
    layer.addEventListener("click", (event) => { if (event.target === layer) close(); });
    layer.querySelector("[data-hero-edit-close]")?.addEventListener("click", close);
    parts.pencil?.setAttribute("aria-expanded", "true");
    // Every row opens the field it names and steps out of the way: the sheet is the index, the hero is
    // where the writing happens, and the check that appears there is still the only save of words.
    layer.querySelectorAll("[data-edit-row]").forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.editRow;
      close();
      if (id === "avatar") { openEditor(host, "name"); pickers?.avatar?.(); return; }
      if (id === "cover-photo") { openEditor(host, "name"); pickers?.cover?.(); return; }
      if (id === "cover-position") { openEditor(host, "name"); openCoverFor(host); return; }
      if (id === "privacy-prices") { openProfilePanel?.("privacy"); return; }
      openEditor(host, id);
      // The row that opened this field was removed by its own press, and a browser moves the focus to the
      // page when the control that holds it disappears: the field asks for it again once that is over, so
      // the year or the name the owner just asked for is the field their keyboard is on.
      if (id === "name" || id === "birth" || id === "bio") {
        const field = id === "birth" ? editorParts(host).birthInput : id === "bio" ? editorParts(host).bioInput : editorParts(host).nameInput;
        window.setTimeout(() => field?.focus?.({ preventScroll: true }), 0);
      }
    }));
    layer.querySelectorAll("[data-cover-mode]").forEach((button) => button.addEventListener("click", () => {
      void writeSheetSetting(host, { cover_mode: button.dataset.coverMode });
    }));
    layer.querySelectorAll("[data-edit-visibility]").forEach((button) => button.addEventListener("click", () => {
      const next = button.dataset.editVisibility;
      void writeSheetSetting(host, next === "private" ? { visibility: next, ...privateAccessFields() } : { visibility: next });
    }));
    layer.querySelector("[data-edit-row]")?.focus?.({ preventScroll: true });
  }

  // The rows are the record: what the profile holds is what the sheet offers, and each row opens only its
  // own field. The two groups are the two choices that have no text to type.
  function editSheetMarkup(host) {
    const parts = editorParts(host);
    const record = personaRecord() ?? {};
    const chip = parts.root?.querySelector(".ownerVisibility") ?? null;
    const visibility = String(record.visibility || (chip ? "private" : "public"));
    const coverMode = parts.root?.dataset?.coverMode === "stories" ? "stories" : "cover";
    const hasCoverImage = Boolean(parts.coverBox?.querySelector("img"));
    const row = (id, glyph, label, hint) => '<button type="button" class="heroEditRow" data-edit-row="' + id + '"><i aria-hidden="true">' + glyph + '</i><span><b>' + label + '</b>' + (hint ? '<small>' + hint + '</small>' : '') + '</span><em aria-hidden="true">›</em></button>';
    const choice = (attribute, value, current, label) => '<button type="button" ' + attribute + '="' + value + '" aria-pressed="' + String(value === current) + '">' + label + '</button>';
    // A policy set somewhere else (followers, friends) is not one of the two choices here, and the sheet
    // says which one is in force instead of pretending a switch is off.
    const policyRow = visibility !== "public" && visibility !== "private"
      ? '<p class="heroEditPolicy">' + safeText(t("profileEdit.visibility")) + ': <b>' + safeText(typeof visibilityLabel === "function" ? visibilityLabel(visibility) : visibility) + '</b></p>'
      : '';
    return [
      '<div class="heroEditBackdrop" data-hero-edit-sheet="1">',
      '<section class="heroEditSheet" role="dialog" aria-modal="true" aria-label="' + safeText(t("profileEdit.sheetTitle")) + '">',
      '<header><b>' + safeText(t("profileEdit.sheetTitle")) + '</b><button type="button" class="heroEditClose" data-hero-edit-close aria-label="' + safeText(t("common.close")) + '">×</button></header>',
      '<p class="heroEditHint">' + safeText(t("profileEdit.sheetHint")) + '</p>',
      '<div class="heroEditRows">',
      row("name", "✎", safeText(t("profileEdit.rowName"))),
      row("birth", "🎂", safeText(t("profileEdit.birth")), safeText(t("profileEdit.birthHint"))),
      row("location", "📍", safeText(t("profileEdit.city"))),
      row("bio", "▤", safeText(t("profileEdit.rowStatus")), safeText(t("profileEdit.bio"))),
      row("avatar", "＋", safeText(t("profileEdit.rowPhoto")), safeText(t("profileEdit.avatarHint"))),
      '</div>',
      '<section class="heroEditGroup" data-edit-group="cover">',
      '<header><b>' + safeText(t("profileEdit.rowCover")) + '</b><small>' + safeText(t("profileEdit.coverModeHint")) + '</small></header>',
      '<div class="heroEditChoices">',
      choice("data-cover-mode", "cover", coverMode, safeText(t("profileEdit.coverModePhoto"))),
      choice("data-cover-mode", "stories", coverMode, safeText(t("profileEdit.coverModeStories"))),
      '</div>',
      row("cover-photo", "▣", safeText(t("profileEdit.changeCover")), safeText(t("profileEdit.coverHint"))),
      hasCoverImage ? row("cover-position", "↕", safeText(t("profileEdit.coverPositionAction")), safeText(t("profileEdit.coverPosition"))) : '',
      '</section>',
      '<section class="heroEditGroup" data-edit-group="visibility">',
      '<header><b>' + safeText(t("profileEdit.rowVisibility")) + '</b><small data-edit-visibility-hint>' + safeText(t(visibility === "private" ? "profileEdit.privateHint" : visibility === "public" ? "profileEdit.publicHint" : "profileEdit.visibility")) + '</small></header>',
      policyRow,
      '<div class="heroEditChoices">',
      choice("data-edit-visibility", "public", visibility, safeText(t("profileEdit.public"))),
      choice("data-edit-visibility", "private", visibility, safeText(t("profileEdit.private"))),
      '</div>',
      row("privacy-prices", "🔒", safeText(t("profileEdit.privatePrices")), safeText(t("profileEdit.paywallMinimum"))),
      '</section>',
      '<p class="heroEditStatus" data-hero-edit-status aria-live="polite" hidden></p>',
      '</section></div>',
    ].join("");
  }

  function bindHeroInlineEdit(host) {
    // The hero this page edited has been replaced (a refresh, a presence pulse, coming back to the tab):
    // the page goes with the node it described instead of editing a profile that is no longer on screen.
    disposeEditSheet();
    const parts = editorParts(host);
    const texts = [[parts.nameText, "name"], [parts.bioText, "bio"]];
    const fields = [[parts.nameInput, "name"], [parts.bioInput, "bio"], [parts.birthInput, "birth"]];
    // A press inside the profile is not leaving it: the photo picker, the location panel and the check
    // are part of the same edit, so the save waits for a press that lands somewhere else.
    let pointerInside = false;
    let choosing = false;
    host.addEventListener("pointerdown", (event) => { if (host.contains(event.target)) pointerInside = true; }, true);
    host.addEventListener("pointerup", () => { window.setTimeout(() => { pointerInside = false; }, 0); }, true);
    const openPicker = (kind) => {
      const input = kind === "cover" ? parts.coverFile : parts.avatarFile;
      if (!input) return;
      choosing = true;
      window.setTimeout(() => { choosing = false; }, PICKER_GRACE_MS);
      // A dialog opened a second time over the same file reports nothing: the field is emptied first, so
      // choosing the photo that is already on the profile is a choice like any other.
      input.value = "";
      input.click();
    };
    pickers = { cover: () => openPicker("cover"), avatar: () => openPicker("avatar") };
    // The pencil is the door, and behind it is the page: one press shows every way into this identity -
    // the name, the age, the city, the status line and both photos - and the page decides which field
    // opens under it. A second press on the same pencil closes the page again.
    parts.pencil?.addEventListener("click", (event) => {
      event.preventDefault();
      if (activeEditSheet) {
        disposeEditSheet();
        parts.pencil?.setAttribute("aria-expanded", "false");
        return;
      }
      openEditSheet(host);
    });
    texts.forEach(([textElement, kind]) => {
      if (!textElement) return;
      const open = (event) => {
        // A link in a description is a link, not a door into the editor.
        if (event.target?.closest?.("a")) return;
        event.preventDefault();
        openEditor(host, kind);
      };
      textElement.addEventListener("click", open);
      textElement.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") open(event);
      });
    });
    // The photos and the location are edited by the pencil too, so a tap on them outside editing opens
    // the editor instead of acting on its own.
    const intoEditor = (event) => {
      if (editorIsOpen(host)) return false;
      event.preventDefault();
      event.stopImmediatePropagation();
      openEditor(host, "name");
      return true;
    };
    // Capture on the row, so the tap reaches the editor before the picker that opens on the chip.
    parts.locationRow?.addEventListener("click", intoEditor, true);
    // The photo buttons are the exception to "the pencil opens the editor": a press on a photo badge
    // already means "choose a photo", so the editor opens and the picker comes with it, in one press
    // instead of two.
    parts.avatarEdit?.addEventListener("click", (event) => {
      if (!editorIsOpen(host)) intoEditor(event);
      openPicker("avatar");
    });
    // A press on the cover badge means "work on the cover": a profile that already has one opens it on
    // the crop screen (move it, or choose another photo), and a profile without one opens the picker,
    // with the crop screen following the choice.
    parts.coverEdit?.addEventListener("click", (event) => {
      if (!editorIsOpen(host)) intoEditor(event);
      const state = pendingFor(host);
      const source = state.coverPreview || state.coverSaved;
      if (!source) { openPicker("cover"); return; }
      openCoverSheet(host, { source, focus: state.coverFocus, file: state.cover, previous: state.coverSaved });
    });
    [["avatar", parts.avatarFile], ["cover", parts.coverFile]].forEach(([kind, input]) => {
      if (!input) return;
      input.addEventListener("change", () => {
        choosing = false;
        const file = input.files?.[0];
        if (file && !acceptImage(host, kind, file)) input.value = "";
      });
      // Chrome reports a dismissed dialog; the flag is what keeps the editor from saving around it.
      input.addEventListener("cancel", () => { choosing = false; });
    });
    fields.forEach(([input, kind]) => {
      if (!input) return;
      input.addEventListener("input", () => autoGrow(input));
      input.addEventListener("blur", () => {
        // Moving between the fields, choosing a photo and picking a city are part of writing; leaving
        // the profile entirely is the end of it, and what was written is kept - nobody should lose a
        // line by tapping the page.
        window.setTimeout(() => {
          // The crop screen is part of this edit and it takes the focus on purpose, because it is a
          // dialog: opening it used to blur the name field, which read as "leaving the profile" and
          // closed the editor - and the crop screen with it. That is what made a second cover edit look
          // like a screen that had stopped working.
          if (!editorIsOpen(host) || choosing || pointerInside || activeCoverSheet || activeEditSheet) return;
          const active = document.activeElement;
          if (active && host.contains(active)) return;
          void saveEditor(host);
        }, 0);
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Escape") { event.preventDefault(); closeEditor(host); return; }
        // Enter breaks the line where the description is arranged; the name and the date save on Enter because
        // each of them is one line by nature, and a lead-with-modifier combination saves the identity early.
        if (event.key === "Enter" && (kind === "name" || kind === "birth" || event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          void saveEditor(host);
        }
      });
    });
    // The check is the explicit version of leaving the editor: it means "this is what I want to keep".
    parts.confirm?.addEventListener("click", (event) => {
      event.preventDefault();
      void saveEditor(host);
    });
  }

  // The picker suggests city names as the owner writes, and the choice waits for the check: nothing
  // about the location leaves the editor on its own any more.
  function bindHeroLocation(host) {
    bindLocationPicker(host, { esc: (value) => String(value ?? ""), t, onSelect: (value) => { setHeroLocation(host, value); } });
  }

  return { bindHeroInlineEdit, bindHeroLocation };
}