// P8 contracts: identity. The rules that matter to a person are pinned here — a handle is validated in
// one place, an account that never chose one is asked exactly once, the flow can only change what the
// record shows, and the hero edits the whole identity where it is read: the name, the description,
// the location, the photo and the cover leave through one check.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openDb } from "../lib/db.js";
import { createRepo, deriveAge, generatedHandle, NEXUS_HANDLE_PATTERN, normaliseBirthDate } from "../lib/repo.js";
import {
  PERSONA_CHOICES, VISIBILITY_CHOICES, handleValidation, onboardingRequired,
  onboardingDefaults, personaLabelKey, visibilityLabelKey, onboardingMarkup,
} from "../public/onboarding.js";

const api = readFileSync(new URL("../lib/api.js", import.meta.url), "utf8");
const repository = readFileSync(new URL("../lib/repo.js", import.meta.url), "utf8");
const database = readFileSync(new URL("../lib/db.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const module = readFileSync(new URL("../public/onboarding.js", import.meta.url), "utf8");
const profileExperience = readFileSync(new URL("../public/profile-experience.js", import.meta.url), "utf8");
const heroEdit = readFileSync(new URL("../public/profile-hero-edit.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/post-detail.css", import.meta.url), "utf8");
const profileExperienceCss = readFileSync(new URL("../public/profile-experience.css", import.meta.url), "utf8");
// The settings panels left app.js in wave 6e: the settings journeys are markup in their own module,
// and the screen that binds them stays in app.js.
const profilePanels = readFileSync(new URL("../public/profile-settings-panels.js", import.meta.url), "utf8");
const locale = readFileSync(new URL("../public/interface-locale.js", import.meta.url), "utf8");
const planning = readFileSync(new URL("../../../planning/NX-SOCIAL-X-SURFACE-v1.md", import.meta.url), "utf8");

function fixture() {
  const db = openDb(":memory:");
  const repo = createRepo(db);
  const chosen = repo.createUser({ handle: "aria", displayName: "Aria" });
  const generated = repo.createUser({ handle: "uaria7f3c", displayName: "uaria7f3c" });
  const wallet = repo.createUser({ handle: "wallet9c21", displayName: "wallet9c21" });
  for (const user of [chosen, generated, wallet]) repo.ensurePersona(user.id, "social", { visibility: "friends" });
  return { db, repo, chosen, generated, wallet };
}

test("a handle is validated once, and its rule is the same on both sides", () => {
  assert.equal(NEXUS_HANDLE_PATTERN.source, "^[a-z0-9_]{2,30}$");
  assert.equal(generatedHandle("uaria7f3c"), true);
  assert.equal(generatedHandle("wallet9c21"), true);
  assert.equal(generatedHandle("aria"), false);
  assert.equal(generatedHandle("wallet"), false, "a word that starts like a stub is still a chosen handle");
  assert.equal(generatedHandle(null), false);
  // The client mirrors the same rule, so the reader is told before the request is sent.
  assert.equal(handleValidation("Aria").value, "aria", "the @ and the case are normalised");
  assert.deepEqual(handleValidation("@Aria"), { value: "aria", valid: true, reason: null });
  assert.equal(handleValidation("a").valid, false);
  assert.equal(handleValidation("a").reason, "x.onboard.handleTooShort");
  assert.equal(handleValidation("are spații").valid, false);
  assert.equal(handleValidation("are spații").reason, "x.onboard.handleInvalid");
  assert.equal(handleValidation("ok_handle9").valid, true);
  assert.equal(handleValidation("x".repeat(31)).valid, false);
});

test("the first-run flow exists for accounts that never chose an identity", () => {
  const { db, repo, chosen, generated, wallet } = fixture();
  try {
    // A handle somebody typed is an identity decision: no flow.
    assert.equal(repo.onboardingState(repo.getUserById(chosen.id)).required, false);
    assert.equal(repo.onboardingState(repo.getUserById(chosen.id)).handle_source, "chosen");
    // A generated handle with no completion stamp is exactly the case the flow is for.
    const state = repo.onboardingState(repo.getUserById(generated.id));
    assert.equal(state.required, true);
    assert.equal(state.reason, "generated_handle");
    assert.equal(state.handle_source, "generated");
    assert.equal(state.completed_at, null);
    assert.equal(repo.onboardingState(repo.getUserById(wallet.id)).required, true);
    assert.equal(repo.onboardingState(null).required, false);
    // The client agrees with the server, and falls back to the same rule for an older payload.
    assert.equal(onboardingRequired({ handle: "uaria7f3c" }), true);
    assert.equal(onboardingRequired({ handle: "aria" }), false);
    assert.equal(onboardingRequired({ handle: "uaria7f3c" }, { required: false }), false, "the server wins");
  } finally { db.close(); }
});

test("claiming a handle respects the record: free, taken or invalid", () => {
  const { db, repo, chosen, generated } = fixture();
  try {
    assert.deepEqual(repo.handleAvailability("aria", generated.id), { handle: "aria", available: false, reason: "handle_taken" });
    // The same handle for the account that already owns it is not a conflict.
    assert.equal(repo.handleAvailability("aria", chosen.id).available, true);
    assert.deepEqual(repo.handleAvailability("Aria!"), { handle: "aria!", available: false, reason: "handle_invalid" });
    assert.equal(repo.handleAvailability("free_name").available, true);
    assert.equal(repo.claimHandle(generated.id, "aria").error, "handle_taken");
    const claimed = repo.claimHandle(generated.id, "@Free_Name");
    assert.equal(claimed.handle, "free_name");
    assert.equal(repo.getUserById(generated.id).handle, "free_name");
    assert.equal(repo.onboardingState(repo.getUserById(generated.id)).handle_source, "chosen", "a claimed handle is a chosen one");
  } finally { db.close(); }
});

test("completing onboarding names the persona, sets its visibility and stamps the record once", () => {
  const { db, repo, generated } = fixture();
  try {
    const result = repo.completeOnboarding({
      userId: generated.id, handle: "aria_nexus", displayName: "Aria N",
      persona: "social", visibility: "public", bio: "Prima mea descriere.",
    });
    assert.equal(result.error, undefined);
    assert.equal(result.user.handle, "aria_nexus");
    assert.equal(result.user.display_name, "Aria N");
    assert.equal(Number(result.user.onboarded_at) > 0, true);
    assert.equal(result.profile.name, "Aria N");
    assert.equal(result.profile.bio, "Prima mea descriere.");
    assert.equal(result.profile.visibility, "public");
    assert.equal(repo.onboardingState(result.user).required, false);
    assert.equal(repo.onboardingState(result.user).reason, "completed");
    // A second call cannot take a handle that is now someone else's, and cannot create a user.
    assert.equal(repo.completeOnboarding({ userId: 99999, displayName: "Nimeni" }).error, "user_not_found");
    // An invalid visibility is refused quietly, never stored.
    const other = repo.createUser({ handle: "uother1234", displayName: "Other" });
    const second = repo.completeOnboarding({ userId: other.id, handle: "aria_nexus", displayName: "Other", visibility: "friends" });
    assert.equal(second.error, "handle_taken");
    const third = repo.completeOnboarding({ userId: other.id, displayName: "Other", visibility: "totally-public" });
    assert.equal(third.profile.visibility, "public");
    // The completion stamp never moves once set.
    const stamped = Number(repo.getUserById(other.id).onboarded_at);
    repo.markOnboarded(other.id, stamped + 10_000);
    assert.equal(Number(repo.getUserById(other.id).onboarded_at), stamped);
  } finally { db.close(); }
});

test("the first-run sheet says what it does, and the client mirrors the server rules", () => {
  const context = {
    esc: (value) => String(value ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    t: (key) => key,
    defaults: { handle: "", displayName: "Aria", persona: "work", visibility: "friends", bio: "Salut" },
  };
  const markup = onboardingMarkup(context);
  assert.match(markup, /id="onboarding"/);
  assert.match(markup, /data-onboard-form/);
  assert.match(markup, /data-onboard-handle-state/);
  assert.equal((markup.match(/data-onboard-persona=/g) || []).length, PERSONA_CHOICES.length);
  assert.equal((markup.match(/data-onboard-visibility=/g) || []).length, VISIBILITY_CHOICES.length);
  assert.match(markup, /data-onboard-persona="work" aria-pressed="true"/);
  assert.match(markup, /data-onboard-visibility="friends" aria-pressed="true"/);
  assert.match(markup, /value="Aria"/);
  // The sheet never pre-fills an email or a generated handle.
  const defaults = onboardingDefaults({ handle: "uaria7f3c", display_name: "uaria7f3c", email: "aria@example.org" }, { handle_source: "generated", handle: "uaria7f3c" });
  assert.deepEqual(defaults, { handle: "", displayName: "uaria7f3c", persona: "social", visibility: "public", bio: "" });
  assert.equal(onboardingDefaults({ handle: "aria", display_name: "Aria" }, { handle_source: "chosen", handle: "aria" }).handle, "aria");
  assert.equal(personaLabelKey("market"), "x.onboard.persona.market");
  assert.equal(visibilityLabelKey("univers"), "x.onboard.visibility.public");
});

test("the server and the client agree on identity, and the hero edits itself", () => {
  // Server: one additive column, one exported rule, two routes, and the same safety assessment.
  assert.match(database, /add\("onboarded_at", "onboarded_at INTEGER"\);/);
  assert.match(database, /onboarded_at INTEGER,/);
  assert.match(repository, /export const NEXUS_HANDLE_PATTERN = \/\^\[a-z0-9_\]\{2,30\}\$\//);
  assert.match(repository, /export function generatedHandle\(handle\) \{/);
  assert.match(repository, /\/\/ ---- identity onboarding ----/);
  assert.match(api, /if \(method === "GET" && path === "\/api\/onboarding"\) \{/);
  assert.match(api, /if \(method === "GET" && path === "\/api\/onboarding\/handle"\) \{/);
  assert.match(api, /if \(method === "POST" && path === "\/api\/onboarding"\) \{/);
  assert.match(api, /return json\(res, 200, \{ ok: true, \.\.\.repo\.handleAvailability\(requested, auth\.user\.id\) \}\);/);
  assert.match(api, /if \(result\.error === "handle_taken"\) return json\(res, 409, \{ ok: false, code: "HANDLE_TAKEN"/);
  assert.match(api, /statement_of_reasons: \{ policy_version: assessment\.policyVersion/);
  assert.match(api, /if \(handle\) repo\.markOnboarded\(created\.id\);/);
  assert.match(api, /onboarding: repo\.onboardingState\(auth\.user\)/);
  // Client: the flow is its own module, it is started once after boot, and the hero edits name and bio.
  const assetVersion = (readFileSync(new URL("../public/index.html", import.meta.url), "utf8").match(/app\.js\?v=([0-9a-z-]+)/) || [])[1];
  assert.equal(typeof assetVersion, "string");
  assert.match(app, new RegExp("import \\{ bindOnboarding, onboardingDefaults, onboardingMarkup, onboardingRequired, visibilityLabelKey \\} from \"\\./onboarding\\.js\\?v=" + assetVersion + "\""));
  assert.match(app, new RegExp("import \\{ bindLocationPicker, closeLocationPicker \\} from \"\\./profile-location\\.js\\?v=" + assetVersion + "\""));
  assert.match(app, /function maybeStartOnboarding\(\) \{/);
  assert.match(app, /if \(!onboardingRequired\(state\?\.user, state\?\.onboarding\)\) return false;/);
  assert.match(app, /api\("\/api\/onboarding\/handle\?handle=" \+ encodeURIComponent\(handle\)\)/);
  // The editor is a module of its own, because app.js is at its byte budget: app.js builds one instance
  // with the current state and the current language, and the module owns the whole identity.
  assert.equal(app.includes('import { createProfileHeroEditor } from "./profile-hero-edit.js?v=' + assetVersion + '";'), true, "the hero editor is imported at the current asset version");
  assert.equal(heroEdit.includes('export function createProfileHeroEditor({ t, toast, api, newMutationKey, getState, bindLocationPicker, closeLocationPicker, bioMarkup, uploadMedia, safeMediaUrl, esc, visibilityLabel, openProfilePanel, reloadProfile }) {'), true, 'the hero editor takes the upload, the media guard, the linkifier and the wording of the lock');
  // Every door of the identity is in that module: the photos preview locally, the picker writes only the
  // chip, and one route call carries whatever changed.
  assert.equal(heroEdit.includes('function setHeroLocation(host, value) {'), true);
  assert.equal(heroEdit.includes('async function saveHeroLocation'), false);
  assert.equal(heroEdit.includes('if (location !== previousLocation) body.location = location;'), true);
  assert.equal(heroEdit.includes('if (avatar.url && avatar.url !== chosen.avatarSaved) body.avatar = avatar.url;'), true);
  assert.equal(heroEdit.includes('if (cover.url && cover.url !== chosen.coverSaved) body.cover = cover.url;'), true);
  assert.equal(heroEdit.includes('await uploadMedia(file, purpose)'), true);
  // Wave 6u: the preview is built from the file that will actually be uploaded (the canonical one), so what
  // the owner arranges in the crop screen is the bytes the server receives.
  assert.equal(heroEdit.includes('const preview = URL.createObjectURL(chosenFile);'), true);
  assert.equal(heroEdit.includes('const chosenFile = canonicalPhotoFile(file);'), true);
  assert.equal(heroEdit.includes('URL.revokeObjectURL(state[kind + "Preview"])'), true);
  assert.equal(heroEdit.includes('classList.add("heroEditing")'), true);
  assert.equal(heroEdit.includes('classList.remove("heroEditing")'), true);
  assert.equal(heroEdit.includes('parts.locationRow?.addEventListener("click", intoEditor, true)'), true);
  // The crop screen is part of the edit: it takes the focus as a dialog, and a blurred name field must not
  // read that as leaving the profile (wave 9v — that is what closed the editor and the crop screen with
  // it, which is why a second cover edit looked broken). Wave 10's edit page is a dialog too.
  assert.equal(heroEdit.includes('if (!editorIsOpen(host) || choosing || pointerInside || activeCoverSheet || activeEditSheet) return;'), true);
  assert.equal(heroEdit.includes('parts.bioText.innerHTML = body.bio ? bioOf(body.bio) : t("profile.bioPlaceholder");'), true);
  assert.match(app, /const profileHeroEditor = createProfileHeroEditor\(\{/);
  assert.match(app, /getState: \(\) => state,/);
  assert.match(app, /wirePostActions\(renderedHost, renderedPosts\); profileHeroEditor\.bindHeroInlineEdit\(renderedHost\); profileHeroEditor\.bindHeroLocation\(renderedHost\);/);
  assert.match(module, /export function bindOnboarding\(root, context\) \{/);
  assert.match(module, /export function handleValidation\(value\) \{/);
  assert.match(heroEdit, /function openEditor\(host, kind = "name"\) \{/);
  assert.match(heroEdit, /const savedRow = result\?\.persona && typeof result\.persona === "object" \? result\.persona : null;/);
  // One request carries whatever changed, and saving happens on the check, on Enter in the name or by
  // leaving the editor; Escape is the only explicit way out.
  assert.match(heroEdit, /if \(name !== previousName\) body\.name = name;/);
  assert.match(heroEdit, /if \(bio !== previousBio\) body\.bio = bio;/);
  assert.match(heroEdit, /parts\.confirm\?\.addEventListener\("click", \(event\) => \{/);
  assert.match(heroEdit, /if \(event\.key === "Escape"\) \{ event\.preventDefault\(\); closeEditor\(host\); return; \}/);
  assert.match(profileExperience, /data-hero-edit="name"/);
  assert.match(profileExperience, /data-hero-input="name"/);
  assert.match(profileExperience, /data-hero-bio-text/);
  // No buttons and no "You" prefix in the hero: editing is the text itself, and the owner is not a
  // stranger looking at their own page.
  assert.doesNotMatch(profileExperience, /ownerInlineTrigger|ownerInlineForm|ownerInlineCancel/);
  const heroMarkupLine = profileExperience.split("\n").find((line) => line.includes("'<h1>'"));
  assert.equal(/selfPrefix/.test(heroMarkupLine), false, "the hero must not print 'You' before the name");
  assert.match(css, /\.heroEditorInput\{display:block;width:100%/);
  assert.match(css, /\.ownerBio\.isEmpty \.heroEditable\{color:#7d8b94\}/);
  // Avatar and cover live in the hero and nowhere else: one rendering each, so no screen carries a
  // second copy of the same identity.
  assert.equal((profileExperience.match(/class="ownerCover"/g) || []).length, 1);
  assert.equal((profileExperience.match(/class="ownerAvatar"/g) || []).length, 1);
  assert.match(css, /\.onboardingLayer\{position:absolute;inset:0;z-index:60/);
  assert.match(css, /\.heroEditable\{cursor:text;border-radius:6px/);
  // The description is three lines and it keeps the lines the owner wrote — one link per line is the
  // reason the field is that tall. Its controls live in its own row: the pencil that opens the profile
  // editor, and the check that confirms the text while it is being written.
  assert.match(profileExperience, /data-hero-input="bio" rows="3"/);
  assert.match(profileExperience, /data-hero-confirm="profile"/);
  assert.match(css, /textarea\.heroEditorInput\{height:calc\(3 \* 1\.4em \+ 4px\)/);
  assert.match(css, /\.heroConfirm\{border-color:#2fbdb3;color:#32e8dd\}/);
  // Wave 6t: the pencil and the check wait at the right end of the band row, where the band cannot move
  // them — the button that opens the editor becomes the button that saves it. The name line keeps the
  // name and the lock, so a long name never pushes a control off the screen.
  const nameLineMarkup = profileExperience.slice(profileExperience.indexOf("'<h1>'"), profileExperience.indexOf("'</h1>'"));
  assert.doesNotMatch(nameLineMarkup, /data-owner-edit/);
  const actionsIndex = profileExperience.indexOf("'<div class=\"ownerHeroActions\">'");
  assert.ok(actionsIndex > 0, "the band row carries the owner's controls");
  const actionsMarkup = profileExperience.slice(actionsIndex, actionsIndex + 700);
  assert.match(actionsMarkup, /data-owner-edit/);
  assert.match(actionsMarkup, /data-hero-confirm="profile"/);
  assert.match(profileExperience, /'<div class="ownerTickerRow">'/);
  assert.doesNotMatch(profileExperience, /ownerBioRow/);
  assert.match(profileExperienceCss, /\.ownerIdentityText h1\{display:flex;flex-wrap:wrap;align-items:center;gap:6px/);
  assert.match(profileExperienceCss, /\.ownerBio\{display:-webkit-box[^}]*white-space:pre-line[^}]*webkit-line-clamp:3/);
  // Wave 6d: the pencil opens the whole page, so the markup carries the two photo affordances and the
  // stylesheet keeps them out of sight until the profile is in edit mode.
  assert.equal(profileExperience.includes('class="ownerAvatarSlot"'), true);
  assert.equal(profileExperience.includes('class="ownerAvatarEdit" data-hero-photo="avatar"'), true);
  assert.equal(profileExperience.includes('class="ownerCoverEdit" data-hero-photo="cover"'), true);
  assert.equal(profileExperience.includes('data-hero-file="avatar" type="file"'), true);
  assert.equal(profileExperience.includes("const bioOf = typeof bioMarkup === 'function'"), true);
  assert.equal(profileExperience.includes('profile.bio ? bioOf(profile.bio)'), true);
  assert.equal(profileExperienceCss.includes('.nexusOwnerProfile.heroEditing .ownerAvatarEdit{display:grid}'), true);
  assert.equal(profileExperienceCss.includes('.nexusOwnerProfile[data-profile-cover="0"] .ownerCover{display:none}'), true);
  assert.equal(profileExperienceCss.includes('.ownerBio a,.ownerBio a:visited{color:#67f5ed'), true);
  assert.equal(app.includes('import { profileBioMarkup } from "./profile-bio-text.js?v=' + assetVersion + '";'), true, "the description linkifier is imported at the current asset version");
  assert.equal(app.includes('bioMarkup: (text) => profileBioMarkup(text, esc),'), true);
  assert.equal(app.includes('uploadMedia: (file, purpose) => uploadMediaResumable(file, purpose),'), true);
  assert.equal(app.includes('bioMarkup: (text) => profileBioMarkup(text, esc)'), true);
  // The name, the description and the city are written through the escaping helper, so a quote in any
  // of them cannot break the value the editor and the picker read back.
  assert.equal(profileExperience.includes("attr(profile.location || '')"), true);
  assert.equal(profileExperience.includes("attr(profile.bio || '')"), true);
  assert.equal(profileExperience.includes("attr(name)"), true);
  assert.equal(profileExperience.includes("data-owner-location="), true);
  assert.match(profileExperience, /locationPickerMarkup\(\{ esc, t: tr \}\)/);
  // The location is chosen and saved with everything else, so no request leaves the chip on its own.
  assert.equal(heroEdit.includes('button.dataset.heroLocation = String(value ?? "").trim();'), true);
  assert.equal(heroEdit.includes('body: { location: String(value'), false);
  // No add button and no "You" anywhere on the identity surface: creating lives in the navigation, and
  // the owner is not a visitor on their own profile.
  assert.doesNotMatch(profileExperience, /data-owner-create|ownerActions/);
  assert.doesNotMatch(profileExperience, /selfPrefix/);
  // A restricted profile is a lock with a translated label, never the raw word "friends"; a public profile
  // shows the owner the open padlock, because the state is the padlock and not a word on the line.
  assert.match(profileExperience, /class="ownerVisibility ' \+ \(visibilityLocked \? 'isLocked' : 'isOpen'\)/);
  assert.match(profileExperience, /visibilityLabel\(profile\.visibility\)/);
  assert.doesNotMatch(profileExperience, /esc\(profile\.visibility/);
  // The hero holds the identity only: the content tabs and the media grid are its siblings again, so the
  // tab bar and the tiles stretch the whole screen instead of sitting inside the identity's padding —
  // that padding is what made the tab bar read as a floating black box and the photos look inset.
  const heroBlock = profileExperience.slice(profileExperience.indexOf("'<div class=\"ownerHero\">'"), profileExperience.indexOf("'<nav class=\"ownerContentTabs\""));
  assert.equal(heroBlock.includes("ownerContentTabs"), false, "the tab bar must not live inside the hero");
  assert.match(heroBlock, /'<\/div>',$/m);
  assert.match(profileExperience, /'<\/div>',\n    \/\/ The hero holds the identity only\./);
  // The profile screen carries no app header at all — no wordmark, no title, no Log out — and the
  // sign-out is a row in Access and security, next to the sessions it ends.
  assert.match(app, /if \(activeSlot === "account"\) \{\n    \/\/ The profile screen has no app header/);
  assert.equal((app.match(/profileAppHeader/g) || []).length, 0);
  assert.match(profilePanels, /id="profile-settings-logout"/);
  assert.match(app, /document\.getElementById\("profile-settings-logout"\)\?\.addEventListener\("click", \(\) => \{ void logoutFromProfile\(\); \}\)/);
  assert.match(profileExperienceCss, /\.phoneScreen:has\(\.accountScreen\) #phoneHeader\{display:none!important\}/);
  // No height override here: with the header gone the account screen is exactly the scrolling area plus
  // the navigation bar, which is the rule the shared stylesheet already states (100% - 86px).
  assert.doesNotMatch(profileExperienceCss, /:has\(\.accountScreen\) \.screenViewport\{/);
  assert.match(profileExperienceCss, /\.accountLogoutRow button\{display:flex/);
  // The identity is edited where it is read, so the settings panel neither duplicates the four fields nor
  // carries a shortcut to them: it holds the policy (visibility, messages, languages, region, prices,
  // profile kind) and the sign-out, and the line that opened a form from there is gone.
  assert.equal(app.includes('profile-assets-edit'), false);
  assert.equal(app.includes('persona-avatar'), false);
  assert.equal(app.includes('persona-cover'), false);
  assert.equal(app.includes('name="display"'), false);
  assert.equal(app.includes('<textarea name="bio"'), false);
  assert.equal(app.includes('uploadMediaResumable(file, "profile_avatar")'), false);
  assert.equal(profilePanels.includes('esc(t("profileEdit.moreSummary"))'), true);
  assert.match(app, /dialog\.innerHTML = '<form method="dialog"><h2>' \+ esc\(t\("x\.profile\.logout"\)\)/);
  // Four languages, the same keys, and the receipt names this wave.
  for (const key of ["x.onboard.title", "x.onboard.handleTaken", "x.onboard.visibilityHint", "profile.editName", "profile.inlineSaved", "profile.confirmBio", "profile.locationAdd", "profile.locationSearch", "profile.locationUse", "profile.logoutDetail", "profile.logoutConfirm", "profile.logoutPending", "profile.logoutFailed", "profile.editHint", "profileEdit.moreSummary"]) {
    assert.equal((locale.match(new RegExp(JSON.stringify(key) + ":", "g")) || []).length, 4, key);
  }
  assert.match(planning, /## 9\. Wave 6 \(P8\)/);
  assert.match(planning, /onboarded_at/);
});

test("a profile location is a chosen city name, and the picker suggests from a built-in list", async () => {
  // Server: one additive column, written through updatePersona, returned with the profile.
  assert.match(database, /location TEXT NOT NULL DEFAULT '',/);
  assert.match(database, /location: "location TEXT NOT NULL DEFAULT ''",/);
  assert.match(repository, /UPDATE personas SET name = \?, bio = \?, location = \?, age = \?, birth_date = \?, avatar = \?, cover = \?/);
  assert.match(repository, /location \?\? cur\.location,/);
  assert.match(api, /const location = body\.location === undefined \? undefined : sanitizeText\(body\.location, 80\);/);
  assert.match(api, /location: profile\.location \?\? "",/);
  // Profile text follows one safety rule, wherever it is written.
  assert.match(api, /const profileText = \[body\.name, body\.bio, body\.location\]\.filter/);
  const locationModule = readFileSync(new URL("../public/profile-location.js", import.meta.url), "utf8");
  // Nothing in the picker reads a device position or calls out: the list is data in this file. The
  // comments are allowed to say the word "geolocation"; the code is not allowed to use it.
  const locationCode = locationModule.replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(locationCode, /geolocation|navigator\.|fetch\(|XMLHttpRequest/);
  const { searchLocations, foldLocation } = await import("../public/profile-location.js");
  assert.equal(foldLocation("București"), "bucuresti");
  assert.equal(searchLocations("Buch", 3).includes("București, România"), true);
  assert.equal(searchLocations("bucharest").includes("București, România"), true, "the English name finds the city too");
  assert.equal(searchLocations("iasi")[0], "Iași, România");
  assert.equal(searchLocations("cluj")[0], "Cluj-Napoca, România");
  assert.equal(searchLocations("ka").includes("Kaunas, Lituania"), true);
  assert.equal(searchLocations("").length, 0);
  assert.equal(searchLocations("zzzz").length, 0);
  // Repo: the value is a name that survives unrelated writes, and it can be cleared.
  const { db, repo, chosen } = fixture();
  try {
    assert.equal(repo.updatePersona(chosen.id, "social", { location: "București, România" }).location, "București, România");
    assert.equal(repo.getPersona(chosen.id, "social").location, "București, România");
    assert.equal(repo.updatePersona(chosen.id, "social", { bio: "Altceva" }).location, "București, România");
    assert.equal(repo.updatePersona(chosen.id, "social", { location: "" }).location, "");
  } finally { db.close(); }
});



test("a date of birth is chosen from a calendar, and the age is derived from it every year", () => {
  // Server: one additive column holding a calendar day, one rule that reads a day, one that turns it into an
  // age, and a route that refuses a day the calendar does not have.
  assert.match(database, /  birth_date TEXT,/);
  assert.match(database, /birth_date: "birth_date TEXT",/);
  assert.match(repository, /export function normaliseBirthDate\(value\) \{/);
  assert.match(repository, /export function deriveAge\(birthDate, now = Date\.now\(\)\) \{/);
  assert.match(repository, /const nextBirthDate = birthDate === undefined\n        \? cur\.birth_date\n        : \(birthDate === null \|\| birthDate === "" \? null : \(writableBirthDate\(birthDate\) \?\? cur\.birth_date\)\);/);
  assert.match(repository, /export function writableBirthDate\(value, now = Date\.now\(\)\) \{/);
  assert.match(api, /const derivedAge = deriveAge\(profile\.birth_date\);/);
  assert.match(api, /let birthDate;/);
  assert.match(api, /if \(!parsedBirthDate\) return json\(res, 400, \{ ok: false, error: "birth date invalid" \}\);/);
  assert.match(api, /if \(!Number\.isInteger\(derivedAge\) \|\| derivedAge < 13 \|\| derivedAge > 120\) \{/);
  assert.match(api, /return json\(res, 400, \{ ok: false, error: "birth date out of range" \}\);/);
  // The age a profile shows is derived where it is read, and the day itself never leaves the owner's copy:
  // a reader is told how old somebody is, never the calendar day they were born on.
  assert.match(api, /age: Number\.isInteger\(derivedAge\) \? derivedAge : \(Number\.isInteger\(profile\.age\) \? profile\.age : null\),/);
  assert.match(api, /birth_date: target\.id === auth\.user\.id \? \(normaliseBirthDate\(profile\.birth_date\) \?\? null\) : null,/);
  // The derivation is a birthday, not a subtraction: the day has to have happened for the year to count.
  assert.equal(deriveAge("1983-12-05", Date.UTC(2026, 8, 21)), 42, "a birthday still ahead this year");
  assert.equal(deriveAge("1983-09-21", Date.UTC(2026, 8, 21)), 43, "the birthday counts on the day itself");
  assert.equal(deriveAge("1983-09-20", Date.UTC(2026, 8, 21)), 43);
  assert.equal(deriveAge("2030-01-01", Date.UTC(2026, 8, 21)), null, "a day that has not happened is not an age");
  assert.equal(normaliseBirthDate("2001-02-30"), null, "a day the calendar does not have is not a day");
  assert.equal(normaliseBirthDate("05/12/1983"), null, "the record holds one format, not a guess at many");
  // The record writes it, clears it, and never writes a day the interface could not have produced over the
  // day that is already there.
  const { db, repo, chosen } = fixture();
  try {
    assert.equal(repo.getPersona(chosen.id, "social").birth_date, null);
    assert.equal(repo.updatePersona(chosen.id, "social", { birthDate: "1983-12-05" }).birth_date, "1983-12-05");
    assert.equal(repo.updatePersona(chosen.id, "social", { birthDate: "1983-02-30" }).birth_date, "1983-12-05");
    assert.equal(repo.updatePersona(chosen.id, "social", { birthDate: "2100-01-01" }).birth_date, "1983-12-05");
    // A write that carries no date leaves the identity alone, and clearing it is a choice.
    repo.updatePersona(chosen.id, "social", { location: "București, România" });
    const written = repo.updatePersona(chosen.id, "social", { name: "Aria B" });
    assert.equal(written.birth_date, "1983-12-05");
    assert.equal(written.location, "București, România");
    assert.equal(repo.updatePersona(chosen.id, "social", { birthDate: null }).birth_date, null, "clearing it is a choice");
    assert.equal(repo.updatePersona(chosen.id, "social", {}).birth_date, null);
  } finally { db.close(); }
  // The client picks the day from a calendar - a date field, not a number somebody has to remember and
  // rewrite every year - and confirms the write from what the route echoes back.
  assert.match(profilePanels, /name="birth_date" type="date"/);
  assert.match(profilePanels, /data-profile-birth/);
  assert.match(profilePanels, /data-profile-location/);
  assert.match(profilePanels, /locationPickerMarkup\(\{ esc, t \}\)/);
  assert.match(profilePanels, /esc\(typeof persona\.birth_date === "string" \? persona\.birth_date : ""\)/);
  assert.match(profilePanels, /esc\(t\("profileEdit\.birthHint"\)\)/);
  assert.equal(app.includes('const birth = edit.querySelector("[data-profile-birth]");'), true);
  assert.equal(app.includes('if (birth) birth.value = typeof record?.birth_date === "string" ? record.birth_date : "";'), true);
  assert.match(app, /function profileAgeFromBirthDate\(value, now = Date\.now\(\)\) \{/);
  assert.match(app, /const birth = birthRaw === "" \? null : birthRaw;/);
  assert.match(app, /if \(birth !== null && !profileAgeFromBirthDate\(birth\)\) return output\.textContent = t\("profileEdit\.birthOutOfRange"\);/);
  assert.match(app, /location, \.\.\.\(birthChanged \? \{ birth_date: birth, age: null \} : \{\}\),/);
  assert.match(app, /const previousBirth = typeof record\?\.birth_date === "string" \? record\.birth_date : null;/);
  assert.match(app, /String\(result\.persona\.birth_date \|\| ""\) !== String\(birth \|\| ""\)/);
  assert.match(app, /\(birthChanged && result\.persona\.age !== null\)/);
  // The hero writes the two together as well: a write that touches the day clears the number an earlier
  // version of the record left there, so an empty field cannot resurrect it.
  assert.equal(heroEdit.includes('if (birthChanged) {'), true);
  assert.equal(heroEdit.includes('body.age = null;'), true);
  assert.equal(heroEdit.includes('&& (!("age" in body) || savedRow.age === null)'), true);
  assert.match(app, /bindLocationPicker\(edit, \{ esc, t, onSelect: \(value\) => \{ paintProfileLocation\(value\); \} \}\);/);
  // The lock beside the name opens the panel that edits it, and it is not edited in the hero.
  assert.match(app, /onVisibility: \(\) => selectProfileSection\("privacy"\),/);
  // The band is where the age is read, printed from the derived number, and the sentences exist in four
  // languages: the date, its hint, and the sentence a day out of range gets.
  const ticker = readFileSync(new URL("../public/profile-ticker.js", import.meta.url), "utf8");
  assert.match(ticker, /items\.push\(\{ kind: "age", icon: "🎂", count: age\.toLocaleString\(locale\), label: tr\("profile\.years"\) \}\);/);
  for (const key of ["profile.years", "profileEdit.birth", "profileEdit.birthHint", "profileEdit.birthOutOfRange", "profileEdit.city", "profileEdit.cityHint", "profileEdit.invalidCity", "profileEdit.identityTitle", "profileEdit.identityScoped", "profileEdit.choosingCover"]) {
    assert.equal((locale.match(new RegExp(JSON.stringify(key) + ":", "g")) || []).length, 4, key);
  }
  // The vocabulary that spoke about a hand-written number is gone, not left standing beside the new one.
  for (const key of ["profileEdit.age", "profileEdit.ageHint", "profileEdit.invalidAge"]) {
    assert.equal(locale.includes(`"${key}"`), false, key + " is retired");
  }
});

test("the edit page is a panel: one card, one size for every field, each with its name over it", () => {
  // The owner pressed the pencil and got boxes dropped into the profile text: a small frame for the city, a
  // different one for the date, loose text around them. The edit page is a panel now, and the panel is a form.
  const panel = profileExperience.slice(profileExperience.indexOf('\'<div class="heroEditorPanel"'), profileExperience.indexOf("// The hero holds the identity only."));
  assert.ok(panel.length > 200, "the panel is in the markup");
  // A reader never gets it: the whole block is behind the owner.
  assert.match(profileExperience, /isSelf\n      \? '<div class="heroEditorPanel" data-hero-editor-panel>'/);
  // Four rows, in the order they are read, and every one of them carries its name.
  const order = ['data-hero-input="name"', 'data-hero-input="bio"', 'data-owner-location="', 'data-hero-input="birth"'].map((needle) => panel.indexOf(needle));
  assert.equal(order.every((at) => at > -1), true, "name, description, city and date are all in the panel");
  assert.equal(order.join() === order.slice().sort((a, b) => a - b).join(), true, "and in that order");
  for (const label of ["profileEdit.rowName", "profileEdit.rowStatus", "profileEdit.city", "profileEdit.birth"]) {
    assert.equal(panel.includes(label), true, label + " is the name over its field");
  }
  // The name field left the heading: a field inside a heading is a field that cannot be given a size.
  const nameLineMarkup = profileExperience.slice(profileExperience.indexOf("'<h1>'"), profileExperience.indexOf("'</h1>'"));
  assert.equal(nameLineMarkup.includes('data-hero-input="name"'), false, "the heading holds words, not fields");
  // The two long fields take the whole panel and the two short ones share the row under them.
  assert.equal(panel.includes('class="heroField isWide"'), true);
  assert.equal(panel.includes('class="heroField ownerBirthField"'), true, "the date shares its row with the city");
  assert.equal(panel.includes('isWide ownerBirthField'), false);
  // The panel is closed until the pencil opens it, and every field in it is the same frame.
  assert.match(profileExperienceCss, /\.heroEditorPanel\{display:none\}/);
  assert.match(profileExperienceCss, /\.nexusOwnerProfile\.heroEditing \.heroEditorPanel\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
  assert.match(profileExperienceCss, /\.heroEditorPanel \.heroField>span\{color:#9fb2bb;font-size:11\.5px/);
  assert.match(profileExperienceCss, /\.heroEditorPanel \.heroEditorInput,\.heroEditorPanel \.ownerLocation\{width:100%;min-height:42px/);
  assert.match(profileExperienceCss, /\.heroEditorPanel \.ownerLocationRow\{position:relative;display:flex/);
  assert.match(profileExperienceCss, /\.heroEditorPanel \.ownerLocationPanel\{left:0;width:100%\}/);
});

test("the pencil opens a page, and the band above the identity is a whole-word setting", () => {
  // Server: one additive column whose default is what the product already reads, validated at the route,
  // and returned with the profile so a reader is shown the surface the owner arranged.
  assert.match(database, /  cover_mode TEXT NOT NULL DEFAULT 'cover',/);
  assert.match(database, /cover_mode: "cover_mode TEXT NOT NULL DEFAULT 'cover'",/);
  assert.match(repository, /const PROFILE_COVER_MODES = new Set\(\["cover", "stories"\]\);/);
  assert.match(repository, /const nextCoverMode = coverMode === undefined \? cur\.cover_mode : \(PROFILE_COVER_MODES\.has\(coverMode\) \? coverMode : cur\.cover_mode\);/);
  assert.match(repository, /cover_focus = \?, cover_mode = \?,/);
  assert.match(api, /const coverMode = body\.cover_mode === undefined \? undefined : sanitizeText\(body\.cover_mode, 12\)\.toLowerCase\(\);/);
  assert.match(api, /if \(coverMode !== undefined && !PROFILE_COVER_MODES\.has\(coverMode\)\) return json\(res, 400, \{ ok: false, error: "cover mode invalid" \}\);/);
  assert.match(api, /cover_mode: profile\.cover_mode === "stories" \? "stories" : "cover",/);
  // The record keeps the cover unless the owner chose the shelf, and a write that carries no mode leaves
  // the mode exactly as it was.
  const { db, repo, chosen } = fixture();
  try {
    assert.equal(repo.getPersona(chosen.id, "social").cover_mode, "cover");
    assert.equal(repo.updatePersona(chosen.id, "social", { coverMode: "stories" }).cover_mode, "stories");
    assert.equal(repo.updatePersona(chosen.id, "social", { coverMode: "MOMENTS" }).cover_mode, "stories", "a value the interface could not produce is not written");
    repo.updatePersona(chosen.id, "social", { name: "Aria B" });
    assert.equal(repo.getPersona(chosen.id, "social").cover_mode, "stories");
    assert.equal(repo.getPersona(chosen.id, "social").name, "Aria B");
    assert.equal(repo.updatePersona(chosen.id, "social", { coverMode: "cover" }).cover_mode, "cover");
  } finally { db.close(); }
  // Client: the page is a dialog, and every way in is one row with a name on it.
  assert.equal(heroEdit.includes('function openEditSheet(host) {'), true);
  assert.equal(heroEdit.includes('let activeEditSheet = null;'), true);
  assert.equal(heroEdit.includes('document.querySelector("[data-hero-edit-sheet]")?.remove();'), true);
  assert.equal(heroEdit.includes('<section class="heroEditSheet" role="dialog" aria-modal="true"'), true);
  for (const row of ['row("name",', 'row("birth",', 'row("location",', 'row("bio",', 'row("avatar",', 'row("cover-photo",', 'row("cover-position",', 'row("privacy-prices",']) {
    assert.equal(heroEdit.includes(row), true, row);
  }
  // The two choices are written where they are pressed, and the answer is checked against the request
  // before anything on the screen moves.
  assert.equal(heroEdit.includes('void writeSheetSetting(host, { cover_mode: button.dataset.coverMode });'), true);
  assert.equal(heroEdit.includes('headers: { "Idempotency-Key": newMutationKey("hero-setting") },'), true);
  assert.equal(heroEdit.includes('const wholeWords = Object.entries(fields).filter(([, value]) => value === null || typeof value !== "object");'), true);
  assert.equal(heroEdit.includes('wholeWords.every(([key, value]) => String(row[key] ?? "") === String(value));'), true);
  assert.equal(heroEdit.includes('document.querySelector("[data-hero-edit-status]")'), true);
  // A private profile is read by friends and by whoever pays, so the private choice opens the paid door
  // with the prices the record already holds - never a number invented by the client.
  assert.equal(heroEdit.includes('if (Number(record.private_access_enabled) === 1) return {};'), true);
  assert.equal(heroEdit.includes('void writeSheetSetting(host, next === "private" ? { visibility: next, ...privateAccessFields() } : { visibility: next });'), true);
  // The row opens the field it names, and the page steps aside for the check that saves the words.
  assert.equal(heroEdit.includes('if (id === "privacy-prices") { openProfilePanel?.("privacy"); return; }'), true);
  assert.equal(heroEdit.includes('openEditor(host, id);'), true);
  assert.equal(heroEdit.includes('if (kind === "location") parts.location?.click();'), true);
  // The date of birth is written by the same check as the name and the description, from the field the hero
  // carries: the field opens on the day the record holds, so opening the row cannot wipe it.
  assert.match(profileExperience, /data-hero-input="birth" data-hero-value="' \+ birthValue \+ '" type="date" min="1900-01-01" max="' \+ todayIso \+ '"/);
  assert.equal(heroEdit.includes('if (parts.birthInput) parts.birthInput.value = String(parts.birthInput.dataset.heroValue ?? "");'), true);
  assert.equal(heroEdit.includes('try { focus?.setSelectionRange?.(focus.value.length, focus.value.length); } catch { /* not a text field */ }'), true);
  assert.equal(heroEdit.includes('if (birthChanged) {'), true);
  assert.equal(heroEdit.includes('function ageFromBirthDate(value, now = Date.now()) {'), true);
  assert.equal(heroEdit.includes('if (!Number.isInteger(derived) || derived < 13 || derived > 120) {'), true);
  assert.equal(heroEdit.includes('toast(t("profileEdit.birthOutOfRange"));'), true);
  assert.match(profileExperienceCss, /\.heroBirthInput\{width:100%\}/);
  // The band prints the age the record derives, so a save that changed the day it comes from redraws the
  // profile - and the sheet says the date, not a number somebody rewrites every year.
  assert.equal(heroEdit.includes('if (["name", "bio", "location", "age", "birth_date"].some((key) => key in body)) reloadProfile?.();'), true);
  assert.match(app, /profileScreenRefresher = \(\) => renderProfiles\(vp\);/);
  // Everything the page needs comes from app.js: the escaper, the wording of the lock, and the door into a
  // settings panel - the page owns no policy and no translator.
  assert.match(app, /openProfilePanel: \(id\) => profileSectionSwitcher\?\.\(id\),/);
  assert.match(app, /visibilityLabel: \(visibility\) => t\(visibilityLabelKey\(visibility\)\),/);
  // The sentences the page prints exist in all four languages, and the surface it uses is in the css.
  for (const key of ["profileEdit.sheetTitle", "profileEdit.sheetHint", "profileEdit.rowName", "profileEdit.rowStatus", "profileEdit.rowPhoto", "profileEdit.rowCover", "profileEdit.rowVisibility", "profileEdit.coverModePhoto", "profileEdit.coverModeStories", "profileEdit.coverModeHint", "profileEdit.coverModeStoriesHint", "profileEdit.coverPositionAction", "profileEdit.publicHint", "profileEdit.privateHint", "profileEdit.privatePrices", "profileEdit.settingSaved", "profileEdit.settingFailed", "profile.presenceOnline", "profile.presenceAway"]) {
    assert.equal((locale.match(new RegExp(JSON.stringify(key) + ":", "g")) || []).length, 4, key);
  }
  assert.match(profileExperienceCss, /\.heroEditSheet\{display:grid;gap:12px;width:min\(540px,100%\)/);
  assert.match(profileExperienceCss, /\.heroEditChoices button\[aria-pressed="true"\]\{border-color:#2fbdb3/);
});
