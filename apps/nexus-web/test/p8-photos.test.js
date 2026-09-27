import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openDb } from "../lib/db.js";
import { createRepo } from "../lib/repo.js";
import { canonicalMime, inspectMedia } from "../lib/media.js";

const editor = readFileSync(new URL("../public/profile-hero-edit.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const css = readFileSync(new URL("../public/profile-experience.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const locale = readFileSync(new URL("../public/interface-locale.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
// Wave 6t: the cover crop is a contract between three places — the column that stores it, the route
// that refuses an impossible one, and the hero that draws it.
const api = readFileSync(new URL("../lib/api.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const media = readFileSync(new URL("../lib/media.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const experience = readFileSync(new URL("../public/profile-experience.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");

const keyCount = (key) => (locale.match(new RegExp('"' + key.replace(".", "\\.") + '":', "g")) || []).length;

test("a photo that cannot be stored no longer takes the written words with it", () => {
  // The two failures used to abort the whole save: the name, the description and the location the owner
  // typed were thrown away because a picture did not upload.
  assert.equal(/if \(avatar === null\) return;/.test(editor), false);
  assert.equal(/if \(cover === null\) return;/.test(editor), false);
  assert.match(editor, /let photoFailed = false;/);
  assert.match(editor, /if \(avatar === null\) \{ avatar = \{ url: "" \}; photoFailed = true; \}/);
  assert.match(editor, /if \(cover === null\) \{ cover = \{ url: "" \}; photoFailed = true; \}/);
  // The words are still written, and the failure is said afterwards.
  assert.match(editor, /return toast\(t\("profile\.inlinePhotoKept"\)\)/);
  assert.match(editor, /toast\(t\(photoFailed \? "profile\.inlinePhotoKept" : "profile\.inlineNothing"\)\)/);
});

test("the check is never mute, and it never throws the words away either", () => {
  // Every way out of the save says what happened instead of returning silently.
  assert.match(editor, /toast\(t\("profile\.inlineNothing"\)\)/);
  assert.match(editor, /if \(!persona\) \{ toast\(t\("profile\.inlineFailed"\)\); return; \}/);
  // A save that the route refused keeps the editor open with what was written still in it. Wave 6t gave
  // the cover its own write, so the branch is read inside the editor's save and not in whichever
  // function happens to be first in the file.
  const saveEditor = editor.slice(editor.indexOf("async function saveEditor(host)"), editor.indexOf("function bindHeroInlineEdit"));
  const refused = saveEditor.match(/if \(!savedOk\) \{([\s\S]*?)\n      \}/);
  assert.ok(refused, "the refused save has its own branch");
  assert.equal(/closeEditor\(host\)/.test(refused[1]), false);
  assert.match(refused[1], /profile\.inlineBlocked/);
  assert.match(refused[1], /profile\.inlineFailed/);
});

test("a refresh around a chosen photo cannot swallow the save", () => {
  // The editor can be rebuilt under the owner's hands; the chosen photo belongs to the profile, so it is
  // drawn again and the check reopens the editor instead of doing nothing.
  assert.match(editor, /function showPendingPreviews\(host\)/);
  assert.match(editor, /showPendingPreviews\(host\);\n    autoGrow\(parts\.bioInput\);/);
  assert.match(editor, /if \(!editorIsOpen\(host\)\) \{\n      if \(!chosenPhoto\) return;\n      openEditor\(host, "name"\);\n      toast\(t\("profile\.inlineReopened"\)\);/);
  assert.match(editor, /const chosenPhoto = Boolean\(chosen\.avatar \|\| chosen\.cover\)/);
});

test("the first press on a photo badge already means choose a photo", () => {
  // The old handler opened the editor and swallowed the press, so the owner had to press twice before
  // anything happened - and a press that appears to do nothing is what a failed save looks like.
  assert.equal(/if \(intoEditor\(event\)\) return; openPicker\("avatar"\)/.test(editor), false);
  assert.equal(/if \(intoEditor\(event\)\) return; openPicker\("cover"\)/.test(editor), false);
  assert.match(editor, /parts\.avatarEdit\?\.addEventListener\("click", \(event\) => \{\n      if \(!editorIsOpen\(host\)\) intoEditor\(event\);\n      openPicker\("avatar"\);\n    \}\);/);
  // Wave 6t: a cover that exists opens on the crop screen in the same press, and only a profile without
  // one goes straight to the file picker.
  const coverHandler = editor.slice(editor.indexOf('parts.coverEdit?.addEventListener("click"'), editor.indexOf("[['avatar', parts.avatarFile]"));
  assert.match(coverHandler, /if \(!editorIsOpen\(host\)\) intoEditor\(event\);/);
  assert.match(coverHandler, /const source = state\.coverPreview \|\| state\.coverSaved;/);
  assert.match(coverHandler, /if \(!source\) \{ openPicker\("cover"\); return; \}/);
  assert.match(coverHandler, /openCoverSheet\(host, \{ source, focus: state\.coverFocus, file: state\.cover, previous: state\.coverSaved \}\);/);
});

test("the controls a finger has to hit accept a 44px press", () => {
  // Wave 6t moved the pencil and the check to the right end of the band row, and they grew to the full
  // 44px: there is room there for a real button, so the glyph no longer needs an invisible halo.
  assert.match(css, /\.ownerHeroActions \.heroIconButton\{position:relative;width:44px;height:44px/);
  assert.match(css, /\.ownerHeroActions \.heroIconButton:hover,\.ownerHeroActions \.heroIconButton:focus-visible\{border-color:#2fbdb3/);
  assert.match(css, /\.nexusOwnerProfile\.heroEditing \.ownerAvatarEdit\{display:grid\}/);
  assert.match(css, /\.nexusOwnerProfile\.heroEditing \.ownerAvatarEdit::before\{content:'';position:absolute;inset:-9px\}/);
  // 44px on the two band controls, and the badge is 26..28 + 2*9 = 44..46.
  assert.match(css, /\.ownerAvatarEdit\{position:absolute;right:-3px;bottom:-3px;z-index:3;display:none;width:28px;height:28px/);
});

test("the messages the owner will read exist in every interface language", () => {
  for (const key of ["profile.inlineNothing", "profile.inlinePhotoKept", "profile.inlineReopened", "profileEdit.invalidImageType", "profileEdit.avatarFailed"]) {
    assert.equal(keyCount(key), 4, key);
  }
  // Wave 6t: the crop screen and the Moments tab speak in four languages too, or they speak in one.
  for (const key of ["profileEdit.coverTitle", "profileEdit.coverPosition", "profileEdit.coverMove", "profileEdit.coverSave", "profileEdit.coverSaved", "profile.tabMoments", "profile.empty.moments.title", "profile.empty.moments.detail"]) {
    assert.equal(keyCount(key), 4, key);
  }
  // The refusal of a picture the browser cannot use keeps its own sentence.
  assert.match(locale, /"profile\.inlinePhotoKept": "[^"]*✓[^"]*"/);
});

test("a cover crop is stored, clamped, and never invented by the client", () => {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const user = repo.createUser({ handle: "crop", displayName: "Crop" });
  // A profile that never chose a crop starts where the automatic one puts it.
  assert.equal(repo.ensurePersona(user.id, "social", { visibility: "friends" }).cover_focus, 35);
  assert.equal(repo.updatePersona(user.id, "social", { coverFocus: 12 }).cover_focus, 12);
  // The route refuses a crop it cannot use (below), and the repository never writes an impossible one:
  // a whole number is clamped to the frame, and anything that is not a whole number keeps what the
  // owner already had instead of overwriting it with a guess.
  assert.equal(repo.updatePersona(user.id, "social", { coverFocus: 150 }).cover_focus, 100);
  assert.equal(repo.updatePersona(user.id, "social", { coverFocus: -5 }).cover_focus, 0);
  assert.equal(repo.updatePersona(user.id, "social", { coverFocus: 3.5 }).cover_focus, 0);
  assert.equal(repo.updatePersona(user.id, "social", { coverFocus: "60" }).cover_focus, 0);
  assert.equal(repo.updatePersona(user.id, "social", { coverFocus: 12 }).cover_focus, 12);
  assert.equal(repo.updatePersona(user.id, "social", {}).cover_focus, 12);
  // The route refuses a crop it cannot use and carries the one it can.
  assert.match(api, /if \(coverFocus !== undefined && \(!Number\.isInteger\(coverFocus\) \|\| coverFocus < 0 \|\| coverFocus > 100\)\) \{/);
  assert.match(api, /coverFocus,/);
  // The profile a reader loads carries the crop with the photo, and the hero draws the frame it names.
  assert.match(api, /cover_focus: Number\.isInteger\(profile\.cover_focus\)/);
  assert.match(experience, /const coverFocus = Number\.isFinite\(Number\(profile\.cover_focus\)\)/);
  assert.match(experience, /data-cover-focus="' \+ coverFocus \+ '"/);
  assert.match(experience, /style="object-position:center ' \+ coverFocus \+ '%"/);
  // The editor sends the crop with the photo and reports a save the route did not echo back.
  assert.match(editor, /if \(\("cover" in body \|\| chosen\.cover\) && chosen\.coverFocus !== chosen\.coverFocusSaved\) body\.cover_focus = chosen\.coverFocus;/);
  assert.match(editor, /&& \(!\("cover_focus" in body\) \|\| Number\(savedRow\.cover_focus \?\? 35\) === body\.cover_focus\)/);
  db.close();
});

test("a photograph is labelled the way the server checks it, not the way a gallery happens to name it", () => {
  // The server compares the declared type with the file's own signature: a phone that calls a jpeg
  // "image/jpg" would have its cover stored as quarantined, which looks to the owner exactly like a save
  // that failed. The client therefore sends the canonical name, and the server understands the aliases too.
  assert.match(editor, /const IMAGE_TYPE_ALIASES = new Map\(\[\n  \["image\/jpg", "image\/jpeg"\]/);
  assert.match(editor, /function canonicalPhotoFile\(file\) \{/);
  assert.match(editor, /const chosenFile = canonicalPhotoFile\(file\);\n    const declared = String\(chosenFile\?\.type \?\? ""\)\.toLowerCase\(\);/);
  // A file whose extension says jpeg is re-labelled, and the refusal names the type it refused.
  assert.match(editor, /return new File\(\[file\], file\.name \|\| "photo", \{ type: byName, lastModified: Number\(file\.lastModified\) \|\| Date\.now\(\) \}\);/);
  assert.match(editor, /toast\(t\("profileEdit\.invalidImageType"\) \+ \(declared \? " · " \+ declared : ""\)\)/);
  assert.match(media, /export function canonicalMime\(value\) \{/);
  assert.match(media, /const mime = canonicalMime\(declaredMime\);/);
  assert.match(media, /mime = canonicalMime\(mime\);/);
  assert.equal(canonicalMime("image/jpg"), "image/jpeg");
  assert.equal(canonicalMime("IMAGE/PJPEG"), "image/jpeg");
  assert.equal(canonicalMime("image/x-png"), "image/png");
  assert.equal(canonicalMime("image/heic"), "image/heic", "a type nobody aliased stays what it is");
  const jpeg = Buffer.concat([Buffer.from("ffd8ffe000104a464946000101", "hex"), Buffer.alloc(64, 3), Buffer.from("ffd9", "hex")]);
  assert.equal(inspectMedia(jpeg, "image/jpg").status, "ready_local_validation");
  assert.equal(inspectMedia(jpeg, "image/jpeg").status, "ready_local_validation");
  assert.equal(inspectMedia(jpeg, "image/heic").status, "quarantined", "a wrong label is still refused");
});

test("an upload that fails says which step refused it", () => {
  // The old path reported one generic sentence for every failure, so a phone could not tell an integrity
  // failure from a full disk. The code that was refused is now part of the sentence.
  assert.equal(editor.includes("uploadMedia(file, purpose).catch(() => null)"), false);
  assert.match(editor, /const upload = await uploadMedia\(file, purpose\)\.catch\(\(error\) => \(\{ error \}\)\);/);
  assert.match(editor, /const text = failed \+ " · " \+ String\(upload\.error\.code \|\| upload\.error\.name \|\| "unknown"\);/);
  // The crop screen carries the same sentence, and the file it is working on.
  assert.match(editor, /function setCoverStatus\(text, isError = false\) \{/);
  assert.match(editor, /'<p class="coverSheetStatus" data-cover-status hidden><\/p>',/);
  assert.match(editor, /fileLine\.textContent = describePhoto\(file\);/);
  assert.match(css, /\.coverSheetStatus\.isError\{color:#ff9baa\}/);
});

test("a cover opens on a crop screen, with the whole photo and one save", () => {
  assert.match(editor, /function openCoverSheet\(host, \{ source, focus, file = null, previous = "" \}\)/);
  assert.match(editor, /data-cover-frame/);
  assert.match(editor, /data-cover-range/);
  assert.match(editor, /frame\.addEventListener\("pointermove"/);
  // Dragging the photo down shows a higher part of it, and the number stays a whole percentage.
  assert.match(editor, /current = clampFocus\(dragging\.start - \(\(event\.clientY - dragging\.y\) \/ frame\.clientHeight\) \* 100\)/);
  // One button writes it: the same request carries the address and the crop.
  assert.match(editor, /const body = \{ cover_focus: value \};/);
  assert.match(editor, /async function commitCover\(host, \{ file, focus, previous = "" \}\)/);
  assert.match(editor, /toast\(t\("profileEdit\.coverSaved"\)\)/);
  // A choice that is abandoned goes back to what the profile holds instead of being lost.
  assert.match(editor, /releasePreview\(state, "cover"\);\n        state\.cover = null;/);
  // The sheet cannot outlive the hero it edits.
  assert.match(editor, /document\.querySelector\("\[data-cover-sheet\]"\)\?\.remove\(\);/);
  // The band reads a photo and the crop screen is bigger still.
  assert.match(css, /\.ownerCover\{height:168px\}/);
  assert.match(css, /\.coverSheetFrame\{position:relative;height:230px/);
  assert.match(css, /\.coverSheetFrame\{[^}]*touch-action:none/);
  assert.match(css, /\.coverSheet menu \[data-cover-save\]\{grid-column:1\/-1;border-color:#167d7b/);
});


test("a cover edited a second time keeps its crop screen and can take another photo", () => {
  // Wave 9v: "Change cover photo" used to close the sheet it was pressed in, so a dismissed dialog, a
  // refused file or a file that was too large left the owner on a profile whose crop screen was gone -
  // "I cannot add another one" was a second edit working against a screen that no longer existed.
  const another = editor.slice(editor.indexOf("[data-cover-another]"), editor.indexOf("saveButton.addEventListener"));
  assert.match(another, /setCoverStatus\(t\("profileEdit\.choosingCover"\)\)/);
  assert.match(another, /pickers\?\.cover\?\.\(\)/);
  assert.equal(/close\(/.test(another), false, "the button that asks for another photo does not close the sheet");
  // A file dialog opened a second time over the same file reports nothing: the field is emptied before it
  // opens, so choosing the photo that is already on the profile is a choice like any other.
  const picker = editor.slice(editor.indexOf("const openPicker = (kind) => {"), editor.indexOf("pickers = { cover"));
  assert.match(picker, /input\.value = "";\n      input\.click\(\);/);
  // One crop screen at a time, and the replaced one takes its window listener with it: a node that is only
  // removed from the DOM keeps answering Escape and would undo the choice the sheet above it arranges.
  assert.match(editor, /let activeCoverSheet = null;/);
  assert.match(editor, /function disposeCoverSheet\(\) \{/);
  assert.match(editor, /window\.removeEventListener\("keydown", sheet\.onKey, true\);/);
  assert.match(editor, /document\.querySelector\("\[data-cover-sheet\]"\)\?\.remove\(\);/);
  assert.match(editor, /disposeCoverSheet\(\);\n    const parts = editorParts\(host\);/);
  assert.match(editor, /if \(activeCoverSheet\?\.onKey === onKey\) activeCoverSheet = null;/);
  assert.match(editor, /activeCoverSheet = \{ onKey \};/);
  // The crop screen is a dialog: it takes the focus on purpose, and the hero editor used to read that as
  // "the reader left the profile" - it saved, closed itself and removed the crop screen with it. That is
  // the sentence that made a second cover edit look like a screen that had stopped working. Wave 10 added
  // the edit page to the same list: it is a dialog too, and a blur that lands on it is not a departure.
  assert.match(editor, /if \(!editorIsOpen\(host\) \|\| choosing \|\| pointerInside \|\| activeCoverSheet \|\| activeEditSheet\) return;/);
  // The crop screen cannot outlive the hero it edits, and the editor leaves it through the same door.
  assert.match(editor, /sheet would be arranging a photo that is no longer there\.\n    disposeCoverSheet\(\);/);
  // The corner control is one labelled button instead of a scrim stretched over the photo: the glyph and
  // its words are one row inside a button sized to them, so they can never drift apart.
  assert.match(css, /\.ownerCoverEdit\{position:absolute;inset:10px 10px auto auto;/);
  assert.match(css, /\.nexusOwnerProfile\.heroEditing \.ownerCoverEdit\{display:inline-flex\}/);
});

test("the description field reads like a field, and it still keeps its three lines", () => {
  // Wave 9v: the editor drew the description as a flat grey slab with the text glued to its left edge. It
  // is padded and bounded by an outline rather than a border, because a border eats into the height the
  // field measures for itself when it grows to three lines.
  const detail = readFileSync(new URL("../public/post-detail.css", import.meta.url), "utf8");
  assert.match(detail, /textarea\.heroEditorInput\{padding:8px 10px;border:0;background:#08121a;border-radius:12px;box-shadow:0 0 0 1px #26343d\}/);
  assert.match(detail, /textarea\.heroEditorInput:focus\{border-color:#2fbdb3;box-shadow:0 0 0 1px #2fbdb3\}/);
  // The name is no longer one line inside a heading: it is a row of the panel, so its field takes the frame
  // the panel gives every field instead of a smaller padding of its own.
  assert.equal(detail.includes(".ownerIdentityText .heroEditorInput{padding:2px 6px}"), false);
  assert.match(css, /\.heroEditorPanel \.heroEditorInput,\.heroEditorPanel \.ownerLocation\{width:100%;min-height:42px/);
  // Three lines are still the promise, and the growing field measures padding and not borders.
  assert.match(detail, /textarea\.heroEditorInput\{height:calc\(3 \* 1\.4em \+ 4px\)/);
});
