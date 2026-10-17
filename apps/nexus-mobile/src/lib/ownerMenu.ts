/**
 * The owner's `⋯` menu of the profile header (`MONETIZATION-SPEC.md` §2, lotul „meniul de profil").
 *
 * The row used to carry three controls: the editor, a wide "Distribuie profilul" and a round `⋯` that
 * held nothing on one's own record. The owner's rule is narrower: one wide button (the editor) and one
 * round entry, and everything else lives behind the round entry — the monetisation first, because that
 * is the door the owner asked for, then sharing, then the wallet, then the settings (the drawer).
 *
 * The order is data, not layout: it is what a test can hold on to while the button changes shape.
 */
export type OwnerMenuId = 'monetize' | 'share' | 'wallet' | 'settings';

export type OwnerMenuItem = {
  id: OwnerMenuId;
  label: string;
  /** What the entry opens, said in the menu itself so nothing has to be guessed. */
  hint: string;
};

export const OWNER_MENU_WORD = 'Deschide meniul profilului';

export const OWNER_MENU: readonly OwnerMenuItem[] = Object.freeze([
  { id: 'monetize', label: 'Monetizează profilul', hint: 'prețuri, plafoane, cum văd fanii' },
  { id: 'share', label: 'Distribuie profilul', hint: 'trimite linkul profilului' },
  { id: 'wallet', label: 'Portofel', hint: 'sold, încasări, retrageri' },
  { id: 'settings', label: 'Setări', hint: 'meniul aplicației' },
]);

/** The four entries a host can actually open; a missing handler removes its row instead of faking it. */
export function ownerMenuFor(handlers: Partial<Record<OwnerMenuId, (() => void) | undefined>>): Array<OwnerMenuItem & { run: () => void }> {
  return OWNER_MENU
    .filter((entry) => typeof handlers[entry.id] === 'function')
    .map((entry) => ({ ...entry, run: handlers[entry.id] as () => void }));
}
