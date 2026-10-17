/**
 * The one menu of the app — what the `≡` of my own profile opens.
 *
 * Until 18 October 2026 the app had two indexes: a drawer over the feed (five profiles, a new post, the
 * bell and the logout) and this menu (money, activity, settings). The owner retired the drawer — its
 * button and the mark beside it "se văd urât" over the clip — and asked for **one** menu holding
 * everything the drawer had. So this list is that menu: writing, the wallet, the ledger's two halves, the
 * creator's prices, the activity, the settings, and the door out of the session.
 *
 * The order and the words are data, so a test can hold them while the sheet changes shape, and so a door
 * a host cannot open disappears instead of staying as a row that opens nothing.
 */
export type ProfileMenuId =
  | 'newPost'
  | 'wallet'
  | 'income'
  | 'spending'
  | 'monetize'
  | 'notifications'
  | 'settings'
  | 'logout';

export type ProfileMenuItem = {
  id: ProfileMenuId;
  label: string;
  /** What the row opens, said in the row itself so nothing has to be guessed. */
  hint: string;
};

export const PROFILE_MENU_WORD = 'Deschide meniul';
export const PROFILE_MENU_CLOSE_WORD = 'Închide meniul';
/** The sheet's own name, read once when it opens. */
export const PROFILE_MENU_TITLE = 'Meniul Jungle Book';
/** The word over the row of profiles: the drawer's old label, kept so nothing has to be relearned. */
export const PROFILE_MENU_SWITCH_WORD = 'Schimbă profilul';

/** One profile the menu can switch to, in the owner's order (Social first). */
export type ProfileSwitchOption = { persona: string; label: string };

/** In the owner's order: write, money, prices, activity, settings, and the way out. */
export const PROFILE_MENU: readonly ProfileMenuItem[] = Object.freeze([
  { id: 'newPost', label: 'Postare nouă', hint: 'deschide camera' },
  { id: 'wallet', label: 'Portofel', hint: 'sold, retrageri, cereri' },
  { id: 'income', label: 'Venituri', hint: 'deconturile tale, pe rând' },
  { id: 'spending', label: 'Cheltuieli', hint: 'ce ai plătit, pe rând' },
  { id: 'monetize', label: 'Prețurile mele', hint: 'cât costă un like, un comentariu, o distribuire' },
  { id: 'notifications', label: 'Notificări', hint: 'activitatea contului' },
  { id: 'settings', label: 'Setări', hint: 'despre aplicație, build, server' },
  { id: 'logout', label: 'Ieși din cont', hint: 'închide sesiunea pe acest telefon' },
]);

/** The rows a host can actually open; a missing handler removes its row instead of faking it. */
export function profileMenuFor(
  handlers: Partial<Record<ProfileMenuId, (() => void) | undefined>>,
): Array<ProfileMenuItem & { run: () => void }> {
  return PROFILE_MENU
    .filter((entry) => typeof handlers[entry.id] === 'function')
    .map((entry) => ({ ...entry, run: handlers[entry.id] as () => void }));
}
