/**
 * The email side of the account, kept out of the screens so it can be tested without a device.
 *
 * Round 37 gave the server a real email system (`apps/nexus-web/lib/email/`). The phone has two ways
 * to take part in it:
 *
 *   1. **The form** — register with an address, ask for a confirmation link, ask for a reset link.
 *   2. **The link** — `nexusdev://verify?token=…` and `nexusdev://reset-password?token=…`, which the
 *      emailed web page offers on Android (`public/email-link.js`) and which the two routes in
 *      `src/app/` answer. The scheme is the one already declared in `app.json` (`"scheme": "nexusdev"`),
 *      so nothing here invents a new one.
 *
 * Tokens are never logged, never stored, and never shown: they arrive in a URL parameter, are handed
 * to the server once, and the screen only reports what the server answered.
 */
import type { LocalAccountLocale } from './loginFields';

export const EMAIL_DEEP_LINK_SCHEME = 'nexusdev';
export const EMAIL_VERIFY_ROUTE = 'verify';
export const EMAIL_RESET_ROUTE = 'reset-password';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,200}$/;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** `nexusdev://verify?token=…` — the exact link the emailed page offers to the installed app. */
export function emailDeepLink(route: string, token: string): string {
  return `${EMAIL_DEEP_LINK_SCHEME}://${route}?token=${encodeURIComponent(String(token ?? ''))}`;
}

/**
 * The token inside any of the three shapes this product can produce: the app deep link, the web page
 * (`https://…/verify-email.html?token=…`) or a bare query string. Anything that is not a plausible
 * token returns `""`, so a malformed link never becomes a request to the server.
 */
export function readEmailToken(url: string): string {
  const raw = String(url ?? '');
  if (!raw) return '';
  const query = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : raw;
  const match = /(?:^|&)token=([^&#]+)/.exec(query);
  if (!match) return '';
  let token = '';
  try { token = decodeURIComponent(match[1]); } catch { return ''; }
  return TOKEN_PATTERN.test(token) ? token : '';
}

export type EmailRoute = 'verify' | 'reset-password' | '';

/** Which screen a URL asks for. `nexusdev://verify` and `…/verify-email.html` both say `verify`. */
export function emailRouteFromUrl(url: string): EmailRoute {
  const raw = String(url ?? '').toLowerCase();
  if (!raw) return '';
  if (raw.includes('/verify-email') || raw.includes('://verify') || raw.startsWith('verify?')) return 'verify';
  if (raw.includes('/reset-password') || raw.includes('://reset-password') || raw.startsWith('reset-password?')) return 'reset-password';
  return '';
}

export function normalizeEmailAddress(value: string): string {
  const clean = String(value ?? '').trim().toLowerCase();
  return EMAIL_PATTERN.test(clean) ? clean : '';
}

export type EmailRegistrationDraft = { email: string; handle: string; password: string; confirmation: string };

/**
 * The checks that make the form usable before a round trip. The handle is optional here (the server
 * derives one from the address); the address is not, because it is where the confirmation goes.
 */
export function validateEmailRegistrationDraft(locale: LocalAccountLocale, draft: EmailRegistrationDraft): string {
  const email = String(draft.email ?? '').trim();
  if (!EMAIL_PATTERN.test(email.toLowerCase())) {
    return locale === 'ro' ? 'Scrie adresa de email la care vrei să primești confirmarea.' : 'Enter the email address that should receive the confirmation.';
  }
  const handle = String(draft.handle ?? '').trim().replace(/^@/, '').toLowerCase();
  if (handle && !/^[a-z0-9_]{2,30}$/.test(handle)) {
    return locale === 'ro'
      ? 'Handle-ul are 2–30 de caractere: litere mici, cifre sau _.'
      : 'The handle is 2–30 characters: lowercase letters, digits or _.';
  }
  const password = String(draft.password ?? '');
  if (password.length < 8 || password.length > 256) {
    return locale === 'ro' ? 'Parola trebuie să aibă între 8 și 256 de caractere.' : 'The password must be 8–256 characters.';
  }
  if (password !== String(draft.confirmation ?? '')) {
    return locale === 'ro' ? 'Cele două parole nu coincid.' : 'The two passwords do not match.';
  }
  return '';
}

/** The same 8–256 rule for the "choose a new password" screen, and nothing else. */
export function validateNewPassword(locale: LocalAccountLocale, password: string, confirmation: string): string {
  const value = String(password ?? '');
  if (value.length < 8 || value.length > 256) {
    return locale === 'ro' ? 'Parola trebuie să aibă între 8 și 256 de caractere.' : 'The password must be 8–256 characters.';
  }
  if (value !== String(confirmation ?? '')) {
    return locale === 'ro' ? 'Cele două parole nu coincid.' : 'The two passwords do not match.';
  }
  return '';
}

/**
 * What the login screen prints when the server refuses the credentials.
 *
 * The server answers `401 {"error":"invalid credentials"}` — a correct but English sentence that the
 * native screen used to print verbatim, in the middle of a Romanian form (`JUNGLE_BOOK_PROGRESS.md`
 * §39). The web client has always translated the same two answers (`public/app.js`:
 * `auth.invalidCredentials` / `auth.rateLimited`), so the phone now says the same thing instead of
 * showing the wire text. Any other refusal keeps the server's own sentence, which is the only place
 * that knows why (an invalid address, an unconfirmed account, a closed registration).
 */
export function signInFailureMessage(status: number, code: string, serverText: string): string {
  const marker = String(code ?? '').trim().toUpperCase();
  if (status === 401) return 'Emailul sau parola nu sunt corecte.';
  if (status === 429 || marker === 'RATE_LIMITED') return 'Prea multe încercări. Așteaptă și reîncearcă.';
  const text = String(serverText ?? '').trim();
  return text || `Serverul a răspuns cu ${status}.`;
}

/** One sentence per state a link screen can be in, so the copy is in one place and testable. */

export function emailLinkMessage(locale: LocalAccountLocale, state: 'checking' | 'verified' | 'changed' | 'missing' | 'failed'): string {
  const ro = {
    checking: 'Se verifică linkul…',
    verified: 'Adresa a fost confirmată. Intră în cont cu emailul și parola.',
    changed: 'Parola a fost schimbată, iar sesiunile vechi au fost deconectate. Intră cu parola nouă.',
    missing: 'Linkul nu conține un cod valid. Deschide-l din mesajul primit pe email.',
    failed: 'Linkul este invalid, a expirat sau a fost deja folosit.',
  };
  const en = {
    checking: 'Checking the link…',
    verified: 'Your address is confirmed. Sign in with your email and password.',
    changed: 'Your password was changed and the old sessions were signed out. Sign in with the new one.',
    missing: 'The link has no valid code. Open it from the message you received.',
    failed: 'The link is invalid, expired or already used.',
  };
  return (locale === 'ro' ? ro : en)[state];
}
