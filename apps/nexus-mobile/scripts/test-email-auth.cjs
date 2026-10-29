/* global __dirname */
// Emailul pe telefon (runda 37): linkurile, codul și ce ajunge la server.
//
// Ce se verifică aici: linkul `nexusdev://` este exact cel din `app.json`; un cod se citește din orice
// formă de link și nimic altceva nu trece drept cod; formularul spune din prima ce nu e în regulă, iar
// parola nu este niciodată „curățată”; cererile pleacă doar către backend-ul nostru (niciun provider de
// email nu este chemat din aplicație) și niciun token nu ajunge în log.
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

const email = load('src/lib/emailAuth.ts');
const TOKEN = '3F-rznuMLihCzt_69Y7pLFk1Iy5wTCPnHJE0xa00GAU';

test('linkul aplicației este cel declarat în app.json, iar codul se citește din orice formă', () => {
  const config = JSON.parse(readFileSync(resolve(ROOT, 'app.json'), 'utf8'));
  assert.equal(config.expo.scheme, email.EMAIL_DEEP_LINK_SCHEME, 'schema folosită în link este cea declarată');

  assert.equal(email.emailDeepLink('verify', TOKEN), `nexusdev://verify?token=${TOKEN}`);
  assert.equal(email.emailDeepLink('reset-password', TOKEN), `nexusdev://reset-password?token=${TOKEN}`);

  for (const url of [
    `nexusdev://verify?token=${TOKEN}`,
    `https://app.exemplu.ro/verify-email.html?token=${TOKEN}`,
    `https://app.exemplu.ro/reset-password.html?token=${TOKEN}&utm=x`,
    `token=${TOKEN}`,
  ]) {
    assert.equal(email.readEmailToken(url), TOKEN, url);
  }

  // Nimic altceva nu trece drept cod: prea scurt, caractere străine, gol, `token=` fără valoare.
  assert.equal(email.readEmailToken('nexusdev://verify'), '');
  assert.equal(email.readEmailToken('nexusdev://verify?token='), '');
  assert.equal(email.readEmailToken('nexusdev://verify?token=abc'), '');
  assert.equal(email.readEmailToken('nexusdev://verify?token=' + 'a'.repeat(19)), '');
  assert.equal(email.readEmailToken(`nexusdev://verify?token=${TOKEN}%3Cscript%3E`), '');
  assert.equal(email.readEmailToken(''), '');

  assert.equal(email.emailRouteFromUrl(`nexusdev://verify?token=${TOKEN}`), 'verify');
  assert.equal(email.emailRouteFromUrl('https://app.exemplu.ro/verify-email.html?token=x'), 'verify');
  assert.equal(email.emailRouteFromUrl(`nexusdev://reset-password?token=${TOKEN}`), 'reset-password');
  assert.equal(email.emailRouteFromUrl('https://app.exemplu.ro/reset-password.html?token=x'), 'reset-password');
  assert.equal(email.emailRouteFromUrl('nexusdev://profile'), '');
});

test('formularul spune din prima ce nu e în regulă, iar parola trece neatinsă', () => {
  const draft = { email: 'Owner@Exemplu.ro', handle: '', password: ' parole cu spații ', confirmation: ' parole cu spații ' };
  assert.equal(email.validateEmailRegistrationDraft('ro', draft), '', 'handle-ul este opțional');
  assert.equal(email.validateEmailRegistrationDraft('en', { ...draft, handle: '@Owner' }), '');
  assert.match(email.validateEmailRegistrationDraft('ro', { ...draft, email: 'nu-e-email' }), /email/i);
  assert.match(email.validateEmailRegistrationDraft('ro', { ...draft, handle: 'ana maria' }), /handle/i);
  assert.match(email.validateEmailRegistrationDraft('ro', { ...draft, password: 'scurt', confirmation: 'scurt' }), /8/);
  assert.match(email.validateEmailRegistrationDraft('ro', { ...draft, confirmation: 'altceva-123456' }), /nu coincid/);
  assert.match(email.validateEmailRegistrationDraft('en', { ...draft, confirmation: 'altceva-123456' }), /do not match/);

  assert.equal(email.validateNewPassword('ro', 'parola-noua-123', 'parola-noua-123'), '');
  assert.match(email.validateNewPassword('ro', 'parola-noua-123', 'parola-noua-124'), /nu coincid/);
  assert.match(email.validateNewPassword('en', 'scurt', 'scurt'), /8/);

  assert.match(email.emailLinkMessage('ro', 'missing'), /cod valid/);
  assert.match(email.emailLinkMessage('ro', 'changed'), /parola/i);
  assert.match(email.emailLinkMessage('en', 'verified'), /confirmed/i);
  assert.equal(email.normalizeEmailAddress(' Ana@Exemplu.RO '), 'ana@exemplu.ro');
  assert.equal(email.normalizeEmailAddress('ana'), '');
});

test('refuzul serverului la login ajunge pe ecran în română, nu ca text de protocol', () => {
  // Runda 39: serverul răspunde `401 {"error":"invalid credentials"}` și ecranul tipărea exact atât.
  // Clientul web traducea de mult aceleași două răspunsuri (`public/app.js`: `auth.invalidCredentials`),
  // deci telefonul spune acum aceeași propoziție, iar orice alt refuz păstrează textul serverului, care
  // este singurul care știe motivul (adresă invalidă, cont neconfirmat, înregistrare închisă).
  assert.equal(email.signInFailureMessage(401, '', 'invalid credentials'), 'Emailul sau parola nu sunt corecte.');
  assert.equal(email.signInFailureMessage(429, '', 'too many'), 'Prea multe încercări. Așteaptă și reîncearcă.');
  assert.equal(email.signInFailureMessage(400, 'RATE_LIMITED', ''), 'Prea multe încercări. Așteaptă și reîncearcă.');
  assert.equal(
    email.signInFailureMessage(403, 'EMAIL_UNVERIFIED', 'verifică adresa de email înainte de autentificare'),
    'verifică adresa de email înainte de autentificare',
  );
  assert.equal(email.signInFailureMessage(500, '', ''), 'Serverul a răspuns cu 500.');
  // Un mesaj de protocol nu are voie să ajungă pe ecran: 401 nu depinde de limba serverului.
  assert.doesNotMatch(email.signInFailureMessage(401, '', 'invalid credentials'), /invalid credentials/i);
  // Și funcția chiar este folosită de loginul pe email, nu doar definită.
  const session = readFileSync(resolve(ROOT, 'src/lib/session.ts'), 'utf8');
  assert.match(session, /signInFailureMessage\(response\.status/);
});

test('aplicația cheamă doar backend-ul nostru și nu ține niciun token în log', () => {
  const session = readFileSync(resolve(ROOT, 'src/lib/session.ts'), 'utf8');
  for (const route of [
    '/auth/email/register', '/auth/email/verification/send', '/auth/email/verification/confirm',
    '/auth/email/reset-request', '/auth/email/reset-confirm',
  ]) {
    assert.ok(session.includes(route), `session.ts trebuie să cheme ${route}`);
  }
  // Niciun provider de email nu este chemat din aplicație: cheia lui trăiește doar pe server.
  assert.doesNotMatch(session, /api\.resend\.com|api\.brevo\.com|NEXUS_EMAIL_API_KEY/);

  const verify = readFileSync(resolve(ROOT, 'src/app/verify.tsx'), 'utf8');
  const reset = readFileSync(resolve(ROOT, 'src/app/reset-password.tsx'), 'utf8');
  assert.match(verify, /readEmailToken/);
  assert.match(verify, /confirmEmailVerification/);
  assert.match(reset, /confirmEmailPasswordReset/);
  assert.match(reset, /validateNewPassword/);
  assert.match(reset, /passwordSubmissionValue/);
  for (const screen of [verify, reset]) {
    assert.doesNotMatch(screen, /console\.(log|warn)\(/, 'un token nu ajunge în log');
    assert.doesNotMatch(screen, /SecureStore|AsyncStorage/, 'tokenul nu se stochează');
  }

  // Ecranul de login alege fluxul după ce spune serverul, nu după o presupunere.
  const index = readFileSync(resolve(ROOT, 'src/app/index.tsx'), 'utf8');
  assert.match(index, /registerEmailAccount/);
  assert.match(index, /requestEmailPasswordReset/);
  assert.match(index, /authCapabilities\?\.email/);
});

