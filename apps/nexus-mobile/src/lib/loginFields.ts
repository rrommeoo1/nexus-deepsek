/** The two login languages the app already ships, so the labels follow the same switch. */
export type LocalAccountLocale = 'ro' | 'en';

/**
 * The two things a password field must get right, kept out of the component so they can be tested.
 *
 * 1. The eye changes **visibility only**. It never touches the value, so what the owner sees while the
 *    field is revealed is exactly what will be hashed: spaces, diacritics and punctuation included.
 *    Android rebuilds the text node when `secureTextEntry` flips, which moves the caret to the end —
 *    the value is unaffected, and that is the part that matters.
 * 2. Every password field says what the eye will do, for someone who cannot see the glyph.
 */

export type PasswordVisibility = { revealed: boolean };

export const PASSWORD_HIDDEN: PasswordVisibility = { revealed: false };

export function togglePasswordVisibility(state: PasswordVisibility): PasswordVisibility {
  return { revealed: !state.revealed };
}

/** `secureTextEntry` for a field: only a *secure* field can be revealed, and only while the eye is on. */
export function passwordSecureEntry(secure: boolean, state: PasswordVisibility): boolean {
  return secure ? !state.revealed : false;
}

export function passwordVisibilityLabel(locale: LocalAccountLocale, state: PasswordVisibility): string {
  if (locale === 'ro') return state.revealed ? 'Ascunde parola' : 'Arată parola';
  return state.revealed ? 'Hide password' : 'Show password';
}

/**
 * What is sent for a password. Deliberately the identity function: this exists so that any future
 * "helpful" trim, lowercase or normalisation has to delete a function and its test first. Round 36 was
 * started by a password stored under one rule and typed under another.
 */
export function passwordSubmissionValue(value: string): string {
  return value;
}

/** An identifier may be tidied: an email or handle is not a secret and case never distinguishes them. */
export function identifierSubmissionValue(value: string): string {
  return value.trim();
}

/** The confirmation field must equal the password byte for byte, before anything is sent. */
export function passwordsMatch(password: string, confirmation: string): boolean {
  return passwordSubmissionValue(password) === passwordSubmissionValue(confirmation);
}

export type LocalAccountDraft = { handle: string; email: string; password: string; confirmation: string };

/**
 * The client-side checks that make the form usable: a person should be told "parolele nu coincid"
 * before a round trip, and told the same rule the server enforces (8–256 characters).
 */
export function validateLocalAccountDraft(locale: LocalAccountLocale, draft: LocalAccountDraft): string {
  const handle = identifierSubmissionValue(draft.handle).replace(/^@/, '').toLowerCase();
  const password = passwordSubmissionValue(draft.password);
  if (!/^[a-z0-9_]{2,30}$/.test(handle)) {
    return locale === 'ro'
      ? 'Alege un handle de 2–30 de caractere: litere mici, cifre sau _.'
      : 'Pick a handle of 2–30 characters: lowercase letters, digits or _.';
  }
  if (password.length < 8 || password.length > 256) {
    return locale === 'ro' ? 'Parola trebuie să aibă între 8 și 256 de caractere.' : 'The password must be 8–256 characters.';
  }
  if (!passwordsMatch(password, draft.confirmation)) {
    return locale === 'ro' ? 'Cele două parole nu coincid.' : 'The two passwords do not match.';
  }
  const email = identifierSubmissionValue(draft.email);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return locale === 'ro' ? 'Adresa de email nu pare validă.' : 'That email address does not look valid.';
  }
  return '';
}
