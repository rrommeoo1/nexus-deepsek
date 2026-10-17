/**
 * The profile's own index of doors — what the three bars (≡) at the top of my record open.
 *
 * Until 17 October 2026 those bars opened the drawer, and the drawer is a different thing: it holds the
 * five profiles, the new post, the bell and the logout. The owner drew the line: the drawer belongs to the
 * first page of the feed and to its own button, and the profile's bars open a **profile menu** instead —
 * money, activity and settings, in that order, with nothing in it that changes who is signed in.
 *
 * The order and the words are data, so a test can hold them while the sheet changes shape, and so a door
 * a host cannot open disappears instead of staying as a row that opens nothing.
 */
export type ProfileMenuId = 'wallet' | 'income' | 'spending' | 'notifications' | 'monetize' | 'settings';

export type ProfileMenuItem = {
  id: ProfileMenuId;
  label: string;
  /** What the row opens, said in the row itself so nothing has to be guessed. */
  hint: string;
};

export const PROFILE_MENU_WORD = 'Deschide meniul profilului';
export const PROFILE_MENU_CLOSE_WORD = 'Închide meniul profilului';
/** The sheet's own name, read once when it opens. */
export const PROFILE_MENU_TITLE = 'Meniul profilului';

/** In the owner's order: Portofel, Venituri, Cheltuieli, Notificări, Monetizează profilul, Setări. */
export const PROFILE_MENU: readonly ProfileMenuItem[] = Object.freeze([
  { id: 'wallet', label: 'Portofel', hint: 'sold, retrageri, cereri' },
  { id: 'income', label: 'Venituri', hint: 'deconturile tale, pe rând' },
  { id: 'spending', label: 'Cheltuieli', hint: 'ce ai plătit, pe rând' },
  { id: 'notifications', label: 'Notificări', hint: 'activitatea contului' },
  { id: 'monetize', label: 'Monetizează profilul', hint: 'prețuri, praguri, cum văd fanii' },
  { id: 'settings', label: 'Setări', hint: 'banda de profil, despre aplicație' },
]);

/**
 * The doors that belong to the drawer and must never appear in this menu (the owner's rule): ending the
 * session, changing the profile, and writing a new post. This list is the test's handle on that rule.
 */
export const DRAWER_ONLY_WORDS = Object.freeze(['Deconectare', 'Schimbă profilul', 'Postare nouă']);

/** The rows a host can actually open; a missing handler removes its row instead of faking it. */
export function profileMenuFor(
  handlers: Partial<Record<ProfileMenuId, (() => void) | undefined>>,
): Array<ProfileMenuItem & { run: () => void }> {
  return PROFILE_MENU
    .filter((entry) => typeof handlers[entry.id] === 'function')
    .map((entry) => ({ ...entry, run: handlers[entry.id] as () => void }));
}
