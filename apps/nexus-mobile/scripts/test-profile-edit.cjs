/* global __dirname, process */
// The profile editor's contract, phone against the record. `src/lib/profileEdit.ts` is the phone's reading
// of `PATCH /api/persona/:persona` (`apps/nexus-web/lib/api.js` 3091-3275), of the handle routes
// (`GET /api/onboarding/handle`, `POST /api/onboarding`) and of the web's own editor
// (`public/profile-hero-edit.js`), so this script asks the sources the same questions the editor answers and
// insists on the same answers: the limits, the age rule, the handle shape, the one-change body, the save
// that is offered only when something changed, and the row the route echoes back.
//
// Usage: node scripts/test-profile-edit.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');
const REPO = resolve(ROOT, '..', '..');
const WEB = resolve(REPO, 'apps/nexus-web');

/** Compiled the way the app's other scripts compile TS: transpile, then run against a shimmed require. */
function compile(file) {
  return ts.transpileModule(readFileSync(file, 'utf8'), {
    fileName: file,
    compilerOptions: {
      allowJs: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React, esModuleInterop: true,
    },
  }).outputText;
}

/** Anything a module imports that this contract does not read: usable, never called. */
const loose = new Proxy(function loose() {}, {
  get: (target, key) => (key === '__esModule' ? true : loose), apply: () => loose, construct: () => loose,
});

function loadModule(file, overrides = {}, strict = false) {
  const moduleShim = { exports: {} };
  const requireShim = (id) => {
    if (Object.prototype.hasOwnProperty.call(overrides, id)) return overrides[id];
    if (strict) throw new Error(`${file} imports ${id}, which this contract does not stand in for`);
    return loose;
  };
  new Function('exports', 'require', 'module', compile(file))(moduleShim.exports, requireShim, moduleShim);
  return moduleShim.exports;
}

const bioText = loadModule(resolve(ROOT, 'src/lib/profileBioText.ts'), {}, true);
const edit = loadModule(resolve(ROOT, 'src/lib/profileEdit.ts'), { './profileBioText': bioText }, true);
const gazetteer = loadModule(resolve(ROOT, 'src/lib/profileGazetteer.ts'), {}, true);
const locationModule = loadModule(resolve(REPO, 'apps/nexus-web/public/profile-location.js'), {}, true);
const onboarding = loadModule(resolve(REPO, 'apps/nexus-web/public/onboarding.js'), {}, false);
const bioModule = loadModule(resolve(REPO, 'apps/nexus-web/public/profile-bio-text.js'), {}, true);

const API = readFileSync(resolve(WEB, 'lib/api.js'), 'utf8');
const SHEET = readFileSync(resolve(ROOT, 'src/components/ProfileEditSheet.tsx'), 'utf8');
const SCREEN = readFileSync(resolve(ROOT, 'src/screens/ProfileScreen.tsx'), 'utf8');

/** `api.js` writes a limit on this field; the phone may never be more generous than the route. */
const limitOf = (snippet) => {
  const pattern = new RegExp(`${snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, (\\d+)\\)`, 'g');
  const found = [...API.matchAll(pattern)];
  assert.ok(found.length, `api.js no longer writes ${snippet}`);
  return Number(found[found.length - 1][1]);
};

const PROFILE = {
  user_id: 7,
  persona: 'social',
  handle: 'romeodeepsek',
  name: 'Romeo',
  bio: 'Construiesc Nexus pe timp de noapte 🌙\nhttps://www.linkedin.com/in/romeo',
  location: 'Kraków, Polonia',
  age: 34,
  avatar: '/media/aa.jpg',
  cover: '/media/bb.jpg',
  cover_focus: 35,
  visibility: 'public',
  is_self: true,
  counts: { posts: 6, followers: 5, following: 32 },
};

test('limitele editorului sunt cele pe care le scrie ruta, nu altele', () => {
  assert.equal(edit.PROFILE_EDIT_LIMITS.name, limitOf('sanitizeText(body.name'));
  assert.equal(edit.PROFILE_EDIT_LIMITS.bio, limitOf('sanitizeText(body.bio'));
  assert.equal(edit.PROFILE_EDIT_LIMITS.location, limitOf('sanitizeText(body.location'));
  assert.equal(edit.PROFILE_EDIT_LIMITS.handle, 30, '`sanitizeText(body.handle, 30)` of the onboarding route');
  // The age is one whole year between 13 and 120, refused before a request is made (`api.js:3127`).
  assert.ok(API.includes('parsedAge < 13 || parsedAge > 120'), 'the route confines the year');
  assert.equal(edit.PROFILE_EDIT_LIMITS.ageMin, 13);
  assert.equal(edit.PROFILE_EDIT_LIMITS.ageMax, 120);
  // The handle shape is the onboarding module's own pattern, not a second copy of it.
  assert.equal(edit.HANDLE_PATTERN.source, onboarding.NEXUS_HANDLE_PATTERN.source);
  for (const value of ['ab', 'a_b_9', 'A', '@x', 'x'.repeat(31), 'cu spațiu', 'RomeoDeep']) {
    const normalized = value.trim().replace(/^@/, '').toLowerCase();
    assert.equal(edit.HANDLE_PATTERN.test(normalized), onboarding.handleValidation(value).valid, value);
  }
});

test('vârsta se citește într-un singur fel: gol o șterge, restul e 13-120', () => {
  const draft = edit.profileDraft(PROFILE);
  assert.equal(edit.draftAge({ ...draft, age: '' }).value, null, 'gol șterge numărul');
  assert.equal(edit.draftAge({ ...draft, age: '34' }).value, 34);
  assert.equal(edit.draftAge({ ...draft, age: '12' }).value, undefined);
  assert.equal(edit.draftAge({ ...draft, age: '121' }).value, undefined);
  assert.ok(edit.draftAge({ ...draft, age: '12' }).reason, 'și spune de ce');
  assert.ok(edit.draftAge({ ...draft, age: '3 ani' }).reason);
  // A record that carries a birth date derives the age from it (`api.js:2999`), so the field is a reading.
  assert.equal(edit.ageIsDerived(PROFILE), false);
  assert.equal(edit.ageIsDerived({ ...PROFILE, birth_date: '1991-02-03' }), true);
});

test('propunerea se deschide pe ce spune profilul, iar linkul e adresa din descriere', () => {
  const draft = edit.profileDraft(PROFILE);
  assert.equal(draft.name, 'Romeo');
  assert.equal(draft.handle, 'romeodeepsek');
  assert.equal(draft.link, 'https://www.linkedin.com/in/romeo');
  assert.equal(draft.visibility, 'public');
  assert.equal(draft.age, '34');
  assert.equal(draft.coverFocus, 35);
  assert.equal(draft.avatar, null);
  assert.equal(draft.cover, null);
  // Nothing is invented for a profile that holds nothing.
  assert.deepEqual(edit.profileDraft(null), {
    name: '', handle: '', bio: '', link: '', location: '', age: '',
    visibility: 'public', avatar: null, cover: null, coverFocus: 35,
  });
});

test('un singur corp, doar cu câmpurile care chiar s-au schimbat', () => {
  const draft = edit.profileDraft(PROFILE);
  assert.deepEqual(edit.profileEditBody(PROFILE, draft), { body: {}, fields: [] });
  assert.equal(edit.profileEditDirty(PROFILE, draft), false, 'nimic schimbat, nimic de salvat');
  // A name, a place and a year, and nothing else.
  const moved = { ...draft, name: 'Romeo Deep', location: 'Cluj-Napoca, România', age: '35' };
  const { body, fields } = edit.profileEditBody(PROFILE, moved);
  assert.deepEqual(fields.sort(), ['age', 'location', 'name']);
  assert.equal(body.name, 'Romeo Deep');
  assert.equal(body.location, 'Cluj-Napoca, România');
  assert.equal(body.age, 35);
  assert.equal('bio' in body, false, 'descrierea atinsă doar de un nume nu se rescrie');
  assert.equal(edit.profileEditDirty(PROFILE, moved), true);
  // An emptied age clears the number instead of being an error.
  assert.equal(edit.profileEditBody(PROFILE, { ...draft, age: '' }).body.age, null);
  // The mode switch writes the word the person chose, and an untouched switch writes nothing at all: a
  // record that reads `friends` is not silently turned into `private` by a save about something else.
  const friends = { ...PROFILE, visibility: 'friends' };
  assert.equal('visibility' in edit.profileEditBody(friends, edit.profileDraft(friends)).body, false);
  assert.equal(edit.profileDraft(friends).visibility, 'friends', 'and the switch says which word it holds');
  assert.equal(
    edit.profileEditBody(friends, { ...edit.profileDraft(friends), visibility: 'private' }).body.visibility,
    'private',
  );
  // The description is written as typed, trimmed, with whatever address the link field still holds.
  assert.equal(
    edit.profileEditBody(PROFILE, { ...draft, bio: '  o descriere nouă  ' }).body.bio,
    'o descriere nouă\nhttps://www.linkedin.com/in/romeo',
  );
  // The sheet keeps the two fields in step - a description that lost its address takes the link field with
  // it (`onChangeText` re-reads `firstAddress`) - so nothing is added back behind the owner's back.
  assert.ok(SHEET.includes('bio.includes(draft.link) ? draft.link : firstAddress(bio)'), 'câmpurile rămân împreună');
  assert.equal(edit.profileEditBody(PROFILE, { ...draft, bio: 'o descriere nouă', link: '' }).body.bio, 'o descriere nouă');
  // A photo is written as the address the upload produced, and only when it is a different one.
  assert.deepEqual(edit.profileEditBody(PROFILE, draft, { avatar: '/media/cc.jpg', cover: '/media/bb.jpg' }).fields, ['avatar']);
  assert.equal(edit.profileEditBody(PROFILE, draft, { cover: '/media/dd.jpg' }).body.cover, '/media/dd.jpg');
  const sameFocus = edit.profileEditBody(PROFILE, { ...draft, coverFocus: 35 }, { cover: '/media/dd.jpg' }).body;
  assert.equal('cover_focus' in sameFocus, false, 'o copertă nouă la aceeași încadrare nu scrie încadrarea');
  // The crop travels with the picture, and this header lets it travel on its own while there is a picture to
  // frame - the record holds a cover here, so moving the frame is a change of its own.
  assert.deepEqual(edit.profileEditBody(PROFILE, { ...draft, coverFocus: 80 }, {}).body, { cover_focus: 80 });
  assert.deepEqual(
    edit.profileEditBody(PROFILE, { ...draft, coverFocus: 80 }, { cover: '/media/dd.jpg' }).body,
    { cover: '/media/dd.jpg', cover_focus: 80 },
  );
  // A profile without a cover has nothing to frame, so no focus is written on its own.
  const bare = { ...PROFILE, cover: null };
  assert.deepEqual(edit.profileEditBody(bare, { ...edit.profileDraft(bare), coverFocus: 80 }, {}).body, {});
});

test('ce oprește salvarea: numele și numele de utilizator obligatorii, restul doar când greșesc', () => {
  const draft = edit.profileDraft(PROFILE);
  assert.deepEqual(edit.profileEditIssues(draft, PROFILE), {}, 'un profil întreg nu are nicio problemă');
  assert.ok(edit.profileEditIssues({ ...draft, name: '   ' }, PROFILE).name);
  assert.ok(edit.profileEditIssues({ ...draft, handle: '' }, PROFILE).handle);
  assert.ok(edit.profileEditIssues({ ...draft, handle: 'cu spațiu' }, PROFILE).handle);
  assert.ok(edit.profileEditIssues({ ...draft, age: '9' }, PROFILE).age);
  assert.ok(edit.profileEditIssues({ ...draft, link: 'linkedin.com/in/romeo' }, PROFILE).link);
  assert.ok(edit.profileEditIssues({ ...draft, bio: 'x'.repeat(edit.PROFILE_EDIT_LIMITS.bio + 1) }, PROFILE).bio);
  // An empty description is not a problem, and neither is an address that was cleared.
  assert.deepEqual(edit.profileEditIssues({ ...draft, bio: '', link: '' }, PROFILE), {});
  // The holder of a birth date cannot be given a year here, and the field says so instead of failing later.
  const born = { ...PROFILE, birth_date: '1991-02-03' };
  assert.equal('age' in edit.profileEditIssues({ ...edit.profileDraft(born), age: '9' }, born), false);
});

test('ce scrie ruta se citește înapoi din rândul pe care îl întoarce', () => {
  const body = { name: 'Roman', bio: 'nou', location: 'Sibiu, România', age: null, visibility: 'private', cover_focus: 80 };
  const row = { name: 'Roman', bio: 'nou', location: 'Sibiu, România', age: null, visibility: 'private', cover_focus: 80 };
  assert.equal(edit.profileSaveAccepted(body, row), true);
  assert.equal(edit.profileSaveAccepted(body, null), false, 'un răspuns fără rând nu e o salvare');
  assert.equal(edit.profileSaveAccepted(body, { ...row, name: 'Alt nume' }), false, 'un câmp altfel scris nu e o salvare');
  assert.equal(edit.profileSaveAccepted(body, { ...row, age: 34 }), false);
  assert.equal(edit.profileSaveAccepted(body, { ...row, cover_focus: 35 }), false);
  // What the header shows afterwards is the row, not the words that were typed.
  assert.deepEqual(edit.savedProfilePatch(body, row), {
    name: 'Roman', bio: 'nou', location: 'Sibiu, România', age: null, visibility: 'private', cover_focus: 80,
  });
  assert.deepEqual(edit.savedProfilePatch({ name: 'Roman' }, {}), { name: 'Roman' }, 'un rând fără câmpul cade pe ce s-a trimis');
});

test('linkul extern scrie adresa în descriere, acolo unde profilul o citește ca link', () => {
  const bio = 'Construiesc Nexus pe timp de noapte 🌙';
  const withLink = bioText.withAddress(bio, 'https://www.linkedin.com/in/romeo');
  assert.equal(withLink, `${bio}\nhttps://www.linkedin.com/in/romeo`);
  assert.equal(bioText.firstAddress(withLink), 'https://www.linkedin.com/in/romeo');
  // Replacing the address keeps the sentence around it, and the module anchors exactly the new one.
  const replaced = bioText.withAddress(withLink, 'https://nexus.example/romeo');
  assert.equal(bioText.firstAddress(replaced), 'https://nexus.example/romeo');
  assert.ok(bioModule.profileBioMarkup(replaced, (value) => String(value)).includes('<a href="https://nexus.example/romeo"'));
  assert.ok(!replaced.includes('linkedin.com'), 'adresa veche nu rămâne în urmă');
  // Clearing the field takes the address out with it, line and all.
  assert.equal(bioText.withAddress(withLink, ''), bio);
  // A description that never had one gets the address on a line of its own, and an empty one gets it alone.
  assert.equal(bioText.withAddress('', 'https://a.dev'), 'https://a.dev');
  assert.equal(bioText.withAddress('unu. doi.', 'https://a.dev'), 'unu. doi.\nhttps://a.dev');
});

test('sugestiile de locație sunt lista webului, cu aceleași răspunsuri', () => {
  // The list itself is the module's own array, read from the module's source: it exports the search, not
  // the names it searches, so the names are taken from where the module keeps them.
  const source = readFileSync(resolve(REPO, 'apps/nexus-web/public/profile-location.js'), 'utf8');
  const list = /const GAZETTEER = Object\.freeze\(\[([\s\S]*?)\]\);/.exec(source);
  assert.ok(list, 'profile-location.js no longer keeps its list in GAZETTEER');
  assert.deepEqual([...gazetteer.GAZETTEER], eval(`[${list[1]}]`));
  for (const query of ['', 'Ia', 'Buch', 'bucharest', 'cluj', 'new y', 'krakow', 'zzz', 'Chișinău']) {
    assert.deepEqual(gazetteer.searchLocations(query), locationModule.searchLocations(query), query);
    assert.deepEqual(gazetteer.searchLocations(query, 3), locationModule.searchLocations(query, 3), `${query} limited`);
  }
  // What the module's own folding does, question by question.
  for (const value of ['Iași, România', '  București  România ', 'ZÜRICH, Elveția', '']) {
    assert.equal(gazetteer.foldLocation(value), locationModule.foldLocation(value), value);
  }
  // The saved value is the label from the list, never what the search folded (`profileLocationLabel`).
  assert.equal(gazetteer.profileLocationLabel('', 'Adaugă o locație'), 'Adaugă o locație');
  assert.equal(gazetteer.profileLocationLabel('Iași, România', 'Adaugă'), 'Iași, România');
});

test('editorul scrie exact ușile pe care le are recordul', () => {
  // One route writes the profile, and the phone calls it exactly as the web's editor does.
  assert.ok(SHEET.includes('`/api/persona/${encodeURIComponent(persona)}`'), 'ruta profilului');
  assert.ok(SHEET.includes("method: 'PATCH'"), 'cu PATCH, ca `profile-hero-edit.js`');
  assert.ok(SHEET.includes('profileSaveAccepted(body, result.persona)'), 'și citește rândul întors');
  // The handle has its own door in the record, and it is used only when the handle actually changed.
  assert.ok(SHEET.includes('if (claimed) {'), 'doar când s-a schimbat');
  assert.ok(SHEET.includes("'/api/onboarding'"), 'revendicarea trece prin ruta recordului');
  assert.ok(SHEET.includes('`/api/onboarding/handle?handle=${encodeURIComponent(typed)}`'), 'disponibilitatea la tastare');
  assert.ok(SHEET.includes('HANDLE_PATTERN.test(typed)'), 'întrebată doar pentru un nume bine format');
  // The bytes go up before the record is written, with the record's own purposes.
  assert.ok(
    SHEET.indexOf("photoUrl(draft.cover, 'profile_cover')") < SHEET.indexOf('profileEditBody(profile, draft'),
    'pozele urcă înaintea scrierii',
  );
  assert.ok(SHEET.includes('purpose, scope: draftScope('), 'sesiunile de încărcare au scopul contului');
  assert.ok(SHEET.includes("'profile_avatar'") && SHEET.includes("'profile_cover'"), 'cele două scopuri ale profilului');
  // A save is offered only when something changed and everything required is right.
  assert.ok(SHEET.includes('const canSave = dirty && !Object.keys(issues).length && !saving;'));
  assert.ok(SHEET.includes('disabled={!canSave}'), 'butonul de salvare');
  // The two photos are opened from the gallery, and the avatar is cropped square before it is stored.
  assert.ok(SHEET.includes('ImagePicker.launchImageLibraryAsync({'), 'galeria');
  // The picker crops the portrait square; the cover is no longer picked here at all (MIGRATION.md §19.2).
assert.ok(SHEET.includes('allowsEditing: true'), 'decupează poza de profil');
assert.ok(!SHEET.includes("pickPhoto('cover')"), 'coperta nu se mai alege din acest editor');
  assert.ok(SHEET.includes('aspect: [1, 1]'), 'pătrat, pentru cercul din header');
  assert.ok(SHEET.includes('requestMediaLibraryPermissionsAsync'), 'și cere permisiunea');
  // The screen merges what came back, so the header and the band show the stored values at once.
  assert.ok(SCREEN.includes('onSaved={(patch) => setData('), 'fără reîncărcare');
  assert.ok(SCREEN.includes('{ ...previous.profile, ...patch }'), 'rândul scris se pune peste profilul din mână');
  assert.ok(SCREEN.includes('visible={editOpen && Boolean(profile?.is_self)}'), 'și doar pe profilul propriu');
});



