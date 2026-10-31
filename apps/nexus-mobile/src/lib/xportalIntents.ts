/**
 * Drumul unui link `xportal://wc` până la activitatea walletului.
 *
 * `Linking.openURL` nu ajunge: pune doar `NEW_TASK`, iar când walletul are deja o fereastră deschisă
 * asta se traduce printr-o **a doua** activitate care rămâne neagră (dovada și flag-urile sunt în
 * `xportalNavigation.ts`). Aici intent-ul e trimis cu `SINGLE_TOP | CLEAR_TOP`, deci sistemul anunță
 * activitatea care rulează deja în loc să mai deschidă una.
 *
 * Fallback-ul pe `Linking` rămâne pentru un telefon fără modulul nativ (Expo Go, un build mai vechi
 * decât această schimbare): acolo merge exact ca înainte, cu stivulirea știută, dar merge.
 */
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking } from 'react-native';
import { WALLET_INTENT_FLAGS } from './xportalNavigation';

/** `Intent.ACTION_VIEW`: exact ce face un link apăsat într-un browser. */
export const WALLET_INTENT_ACTION = 'android.intent.action.VIEW';

/** Cum a plecat linkul, ca trace-ul să spună dacă flag-urile au fost aplicate. */
export type WalletOpenTransport = 'intent' | 'link';

/**
 * Deschide un link de wallet și spune pe ce drum a plecat. Arunca doar dacă nici intent-ul, nici
 * `Linking` nu au reușit — atunci foaia scrie eroarea cititorului, ca înainte.
 */
export async function openWalletRequest(link: string): Promise<WalletOpenTransport> {
  if (!link) throw new Error('Linkul xPortal lipsește.');
  try {
    await IntentLauncher.startActivityAsync(WALLET_INTENT_ACTION, { data: link, flags: WALLET_INTENT_FLAGS });
    return 'intent';
  } catch {
    await Linking.openURL(link);
    return 'link';
  }
}
