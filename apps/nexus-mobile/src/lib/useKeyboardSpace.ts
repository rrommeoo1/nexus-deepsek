import { useMemo, useRef, useState, useEffect } from 'react';
import { Keyboard, Platform, useWindowDimensions } from 'react-native';
import { keyboardHeightOf, keyboardSpaceOf, type KeyboardSpace } from './keyboardSpace';

/**
 * Cea mai înaltă fereastră văzută în sesiune — fereastra **fără** tastatură.
 *
 * Stă într-o variabilă de modul, nu într-o stare: ea nu desenează nimic, este doar reperul față de care
 * `lib/keyboardSpace.ts` măsoară cât a cedat deja platforma. O scriere de variabilă într-un efect nu este o
 * randare în cascadă, deci regula `react-hooks/set-state-in-effect` nu are ce obiecta.
 */
let tallestWindow = 0;

/**
 * Cât loc lasă tastatura, ca valoare de stare — o singură măsurătoare pentru toate suprafețele.
 *
 * Se ascultă pe amândouă platformele: pe Android fereastra poate să nu se micșoreze deloc (edge-to-edge,
 * Android 15), iar pe iOS nu se micșorează niciodată. `lib/keyboardSpace.ts` decide apoi cât din ce
 * raportează tastatura mai trebuie cedat, comparând fereastra de acum cu reperul de mai sus.
 */
export function useKeyboardSpace(options: { modalWindow?: boolean } = {}): KeyboardSpace {
  const { height } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  /** Fereastra de acum, pentru ascultătorul care nu se remontează la fiecare randare. */
  const windowRef = useRef(Math.round(height));
  windowRef.current = Math.round(height);

  useEffect(() => {
    const next = Math.max(0, Math.round(height));
    if (next > tallestWindow) tallestWindow = next;
  }, [height]);

  useEffect(() => {
    /**
     * Cât de sus urcă tastatura, măsurat pe **muchia** ei, nu pe cifra pe care o dă ea.
     *
     * Runda 47, citit de pe telefon (`adb logcat`, 31 octombrie 2026): Gboard raporta
     * `endCoordinates.height = 399.5` dp, dar banda lui adevărată începea la 578.5 dp, adică 443 dp —
     * bara de unelte a tastaturii (iconițele, GIF, emoji, microfon) nu intră în cifra raportată. Foaia de
     * comentarii se așeza deci cu 43.5 dp prea jos, iar câmpul de comentariu intra sub taste.
     *
     * De aceea se citesc **amândouă**: înălțimea raportată și muchia de sus (`screenY`), iar din ele se
     * păstrează cea mai mare. A doua nu poate fi mai mică decât adevărul, deci o suprafață nu rămâne
     * niciodată sub tastatură; iar dacă o tastatură nu raportează `screenY`, rămâne prima cifră.
     */
    const shown = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        setKeyboardHeight(keyboardHeightOf({
          reported: Number(event.endCoordinates?.height) || 0,
          screenY: Number(event.endCoordinates?.screenY) || 0,
          windowHeight: windowRef.current,
        }));
      },
    );
    const hidden = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0),
    );
    return () => { shown.remove(); hidden.remove(); };
  }, []);

  /**
   * O foaie dintr-un `Modal` se anunță ca atare (runda 47).
   *
   * `Modal`-ul de Android are fereastra lui: fereastra rădăcină poate raporta o micșorare pentru tastatură
   * pe care foaia nu a primit-o încă, iar atunci garda `resized` ar scădea tastatura de două ori. Pentru o
   * foaie din `Modal` nu există „platforma a luat deja locul": ea plătește toată tastatura, o singură dată.
   * Restul suprafețelor (pagina compozitorului, editorul) rămân pe socoteala cu gardă, fiindcă acolo
   * fereastra chiar se micșorează.
   *
   * **Ce a fost de fapt stricat pe telefon** (măsurat cu `adb logcat`, 31 octombrie 2026, înainte de fix):
   * foaia se așeza cu 43.5 dp prea jos, iar câmpul de comentariu intra sub taste. Cifra care lipsea nu era
   * garda, ci muchia tastaturii: Gboard raporta 399.5 dp înălțime, dar banda lui începea la 443 dp. Asta se
   * repară mai sus, în ascultător (`screenY`); opțiunea de aici rămâne ca să nu se poată număra dublu.
   */
  return useMemo(
    () => (options.modalWindow
      ? keyboardSpaceOf({
        baseHeight: Math.max(0, Math.round(height)),
        windowHeight: height,
        keyboardHeight,
      })
      : keyboardSpaceOf({
        baseHeight: Math.max(tallestWindow, Math.round(height)),
        windowHeight: height,
        keyboardHeight,
      })),
    [height, keyboardHeight, options.modalWindow],
  );
}
