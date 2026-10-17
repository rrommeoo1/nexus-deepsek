import { memo } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { jungle } from '../theme/jungle';

/**
 * The field the app sits on: the dark leaf green of the theme, with the product's mark as a very quiet
 * watermark behind the content.
 *
 * The owner asked for it on every surface that used to be pure black and holds no media: login, empty
 * screens, the drawer, the bottom sheets, Settings, the wallet, the monetisation and the inbox. It is
 * deliberately *not* used over video, photo, story, camera or a viewer — a picture is not wallpaper.
 *
 * Rules it keeps, so it can never become an animation or a leak:
 *
 *   * one static 512 px picture (`assets/brand/jb-mark-512.png`), 90 % of the screen wide;
 *   * opacity 6–12 % — a watermark, not a logo;
 *   * `pointerEvents="none"` on the whole layer, so it never eats a tap;
 *   * `memo`, no state and no effect: it renders once and never again.
 *
 * There is no `expo-linear-gradient` in this app, so the field is a flat colour — which is also what the
 * owner asked for when a gradient is not already installed.
 */
export const JungleBackdrop = memo(function JungleBackdrop({
  opacity = 0.08,
  anchor = 'center',
}: {
  /** 0.06–0.08 for ordinary screens, up to 0.12 for the login screen. Never above 0.12. */
  opacity?: number;
  /** Where the letters sit: centred, or low enough to stay under a keyboard and a form. */
  anchor?: 'center' | 'bottom';
}) {
  const { width } = useWindowDimensions();
  const size = Math.round(width * 0.9);
  return (
    <View pointerEvents="none" style={[styles.field, anchor === 'bottom' && styles.low]}>
      <Image
        source={require('../../assets/brand/jb-mark-512.png')}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
        style={{ width: size, height: size, opacity }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  field: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: jungle.canvas,
    overflow: 'hidden',
  },
  low: { justifyContent: 'flex-end', paddingBottom: 24 },
});
