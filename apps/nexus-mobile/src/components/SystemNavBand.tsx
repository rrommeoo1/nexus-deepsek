import { Platform, StyleSheet, View } from 'react-native';
import { NavigationBar } from 'expo-navigation-bar';
import { blackSilver } from '../theme/blackSilver';

/**
 * The phone's own navigation controls on a plate of metal — Back, Home and Overview, seen at last.
 *
 * Round 32 (owner, 31 October 2026): on a page of words opened from a profile the three system controls
 * stood *under* a cream page whose ink is `#1a221b` and whose paper is `#f4efe2`, while the system drew them
 * the way the app asks it to everywhere else — `style: "light"` (`app.json`), i.e. white. White on cream is
 * not a hard-to-see control; it is a control that is not there. The owner's words: „butoanele de jos abia se
 * văd pe fundalul alb".
 *
 * This is **not** the app's own bar. The app's tab bar (`AppNav`) is a React surface the feed reserves room
 * for and the reader never mounts; these are the device's buttons, drawn by Android over whatever the app
 * puts in the inset. So the fix is two things, and both are local to the one screen that needs them:
 *
 *   · a **plate** of `blackSilver.silver` (`#C4C7CB`, the metal this product already calls silver) exactly
 *     as tall as the device's own inset, painted at the very foot of the screen. The app is edge to edge
 *     (`expo-navigation-bar` v57 under RN 0.86: `setBackgroundColorAsync` is gone for that reason), so the
 *     band is the only way to give the system's glyphs a ground — and because it is drawn here and not set
 *     on the window, nothing else in the app sees it;
 *   · `style="dark"`, so Android draws the glyphs in its **own** dark ink rather than the white it uses
 *     everywhere else. What that ink measures is the system's business, not ours: on the Xiaomi MIX Flip it
 *     came out at (93,94,96), i.e. **3.83:1** against this plate — over the 3:1 a non-text control owes
 *     (WCAG 1.4.11), where white on the same cream had measured ~1.05:1. The plate is the lever the app
 *     really owns; the glyphs follow the system's own contrast rules.
 *
 * **It restores itself.** `expo-navigation-bar`'s `<NavigationBar>` is a stack of entries: mounting this
 * pushes `dark`, unmounting pops it and the module re-applies the app's default (`light`, from `app.json`).
 * A reader that leaves the screen — Back, Home, a swipe to the next post, a pushed route — therefore hands
 * the bar back exactly as it found it, with no `useEffect` of ours to get wrong.
 *
 * `height` is the device's bottom inset (`useSafeAreaInsets`), never a number of its own: a phone with a
 * 3-button bar gets a 48dp plate, a phone with a gesture pill gets the pill's own inset, and a screen with
 * no inset gets no plate at all (nothing was illegible there).
 */
export function SystemNavBand({ height = 0 }: { height?: number }) {
  const inset = Math.max(0, Math.round(Number(height) || 0));
  return (
    <>
      {Platform.OS === 'android' ? <NavigationBar style="dark" /> : null}
      {inset > 0 ? (
        <View
          pointerEvents="none"
          /**
           * Above the page (`PostCard` draws no `zIndex` of its own) and above the foot's door would be, so
           * the plate always covers the last 48dp of whatever the route painted there.
           */
          style={[styles.band, { height: inset }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  /** The metal, at the foot, with one hairline keeping it off the paper above it. */
  band: {
    position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 21,
    backgroundColor: blackSilver.silver,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: blackSilver.deepMercury,
  },
});
