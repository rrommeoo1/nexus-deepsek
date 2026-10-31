import { useMemo, useState, useEffect } from 'react';
import { Keyboard, Platform, useWindowDimensions } from 'react-native';
import { keyboardSpaceOf, type KeyboardSpace } from './keyboardSpace';

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
export function useKeyboardSpace(): KeyboardSpace {
  const { height } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const next = Math.max(0, Math.round(height));
    if (next > tallestWindow) tallestWindow = next;
  }, [height]);

  useEffect(() => {
    const shown = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => setKeyboardHeight(Math.max(0, Math.round(event.endCoordinates?.height ?? 0))),
    );
    const hidden = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0),
    );
    return () => { shown.remove(); hidden.remove(); };
  }, []);

  return useMemo(
    () => keyboardSpaceOf({
      baseHeight: Math.max(tallestWindow, Math.round(height)),
      windowHeight: height,
      keyboardHeight,
    }),
    [height, keyboardHeight],
  );
}
