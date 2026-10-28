/* global __dirname */
// Câmpurile de autentificare, așa cum le folosește ecranul de login (round 36).
//
// Ce se verifică aici: ochiul schimbă doar vizibilitatea, niciodată textul; parola ajunge la server exact
// cum a fost tastată (spații, diacritice, punctuație); identificatorul e singurul care se curăță; iar
// ecranul nu mai are butoane care doar afișează o propoziție în loc să cheme serverul.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const ROOT = resolve(__dirname, '..');

function load(relative) {
  const source = readFileSync(resolve(ROOT, relative), 'utf8');
  const code = ts.transpileModule(source, {
    fileName: relative,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const shim = { exports: {} };
  new Function('module', 'exports', 'require', code)(shim, shim.exports, require);
  return shim.exports;
}

const fields = load('src/lib/loginFields.ts');

test('ochiul schimbă doar vizibilitatea, niciodată textul', () => {
  const hidden = fields.PASSWORD_HIDDEN;
  assert.equal(hidden.revealed, false);
  const shown = fields.togglePasswordVisibility(hidden);
  assert.equal(shown.revealed, true);
  assert.equal(fields.togglePasswordVisibility(shown).revealed, false);
  // Un câmp nesecurizat nu devine niciodată „parolă ascunsă" din greșeală.
  assert.equal(fields.passwordSecureEntry(true, hidden), true);
  assert.equal(fields.passwordSecureEntry(true, shown), false);
  assert.equal(fields.passwordSecureEntry(false, hidden), false);
  assert.equal(fields.passwordSecureEntry(false, shown), false);
  assert.equal(fields.passwordVisibilityLabel('ro', hidden), 'Arată parola');
  assert.equal(fields.passwordVisibilityLabel('ro', shown), 'Ascunde parola');
  assert.equal(fields.passwordVisibilityLabel('en', hidden), 'Show password');
  assert.equal(fields.passwordVisibilityLabel('en', shown), 'Hide password');
});

test('parola trece neatinsă, inclusiv spații și punctuație', () => {
  const typed = '  pa ro!lã TĂCUT  #1  ';
  assert.equal(fields.passwordSubmissionValue(typed), typed);
  assert.equal(fields.passwordSubmissionValue(' a ').length, 3);
  // Identificatorul e singurul care se curăță: nu e secret și nu distinge majusculele.
  assert.equal(fields.identifierSubmissionValue('  Owner@Nexus.ro '), 'Owner@Nexus.ro');
  assert.equal(fields.passwordsMatch(typed, typed), true);
  assert.equal(fields.passwordsMatch(typed, `${typed} `), false);
  assert.equal(fields.passwordsMatch('parola-123', 'Parola-123'), false);
});

test('formularul de cont local spune din prima ce nu e în regulă', () => {
  const good = { handle: '@Owner', email: '', password: 'parola-123456', confirmation: 'parola-123456' };
  assert.equal(fields.validateLocalAccountDraft('ro', good), '');
  assert.equal(fields.validateLocalAccountDraft('en', { ...good, email: 'owner@nexus.ro' }), '');
  assert.match(fields.validateLocalAccountDraft('ro', { ...good, handle: 'a' }), /handle/i);
  assert.match(fields.validateLocalAccountDraft('ro', { ...good, handle: 'ana maria' }), /handle/i);
  assert.match(fields.validateLocalAccountDraft('ro', { ...good, password: 'scurt', confirmation: 'scurt' }), /8/);
  assert.match(fields.validateLocalAccountDraft('ro', { ...good, confirmation: 'altceva-123456' }), /nu coincid/);
  assert.match(fields.validateLocalAccountDraft('en', { ...good, confirmation: 'altceva-123456' }), /do not match/);
  assert.match(fields.validateLocalAccountDraft('ro', { ...good, email: 'nu-e-email' }), /email/i);
});

test('ecranul de login are un singur câmp de parolă, cu ochi, și cheamă serverul', () => {
  const login = readFileSync(resolve(ROOT, 'src/components/NexusLogin.tsx'), 'utf8');
  assert.match(login, /secureTextEntry=\{hidden\}/);
  assert.match(login, /passwordVisibilityLabel\(locale, visibility\)/);
  assert.match(login, /accessibilityLabel=\{toggleLabel\}/);
  assert.match(login, /accessibilityRole="button" accessibilityLabel=\{toggleLabel\}/);
  // Toate câmpurile trec prin componenta comună, deci toate câmpurile de parolă au același ochi.
  assert.equal((login.match(/<AuthField /g) ?? []).length, 6);
  // Trei câmpuri de parolă (login, parolă nouă, confirmare) și toate trei primesc ochiul.
  assert.equal((login.match(/secure(?: newPassword)? locale=\{locale\}/g) ?? []).length, 3);
  // Fără text de tip „se face în versiunea web": butonul chiar trimite datele.
  assert.doesNotMatch(login, /versiunea web/);

  const screen = readFileSync(resolve(ROOT, 'src/app/index.tsx'), 'utf8');
  assert.doesNotMatch(screen, /Crearea contului se face momentan/);
  assert.doesNotMatch(screen, /Recuperarea se face prin xPortal/);
  assert.match(screen, /registerWithLocalAccount/);
  assert.match(screen, /resetLocalPassword/);
  assert.match(screen, /<PasswordRecoverySheet/);

  const session = readFileSync(resolve(ROOT, 'src/lib/session.ts'), 'utf8');
  assert.match(session, /\/auth\/local\/register/);
  assert.match(session, /\/auth\/local\/password-reset/);
  assert.match(session, /\/api\/auth-capabilities/);
  // Nicio parolă nu se scrie pe disc: sesiunea păstrează doar tokenul și id-ul dispozitivului.
  const stored = session.slice(session.indexOf('export function writeSession'), session.indexOf('export function clearSession'));
  assert.doesNotMatch(stored, /password/i);
});
