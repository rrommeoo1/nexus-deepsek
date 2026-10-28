import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BrandLogo } from './BrandLogo';

/**
 * The face of a profile that has no photograph — the **existing JB fruit logo**, reused.
 *
 * The owner, 31 October 2026: „profilurile fără poză să folosească logo-ul JB cu fructe, exact cel din
 * Messages și Friends — nu iniţiale, nu siluetă". The artwork already existed: it is the drawing the
 * launcher icon, the inbox header and the watermark are cut from (`assets/brand/jb-mark-*.png`,
 * `BrandLogo`). So this component loads nothing new — it is the *same* transparent mark, drawn at 82 % of
 * whatever disc it is put in, which is what makes it read as a face at 18 dp and at 92 dp alike.
 *
 * Why 82 % and not 100: the PNG carries its own transparent margin (the letters occupy ~80 % of the
 * side), so a full-bleed draw would already look inset; scaling to 82 % of the disc leaves the disc's
 * own hairline visible and keeps the fruit off the rounded edge. The disc itself is the caller's — every
 * surface already owns a circular, `overflow: 'hidden'` plate (`mercuryAvatar.plate`), and a real
 * photograph still paints over it, so nothing here can replace a person's own picture.
 *
 * It draws no text at all: no initials, no silhouette, no invented symbol.
 */
export const BRAND_AVATAR_FILL = 0.82;

/** The smallest a mark may be drawn and still be recognisable as the logo rather than a smudge. */
export const BRAND_AVATAR_MIN = 12;

export function BrandAvatar({ size, style }: {
  /** The **disc's** side, in points. The mark is drawn at `size * BRAND_AVATAR_FILL`. */
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  const mark = Math.max(BRAND_AVATAR_MIN, Math.round(size * BRAND_AVATAR_FILL));
  return (
    <View pointerEvents="none" style={[styles.box, style]}>
      <BrandLogo variant="fruit" size={mark} />
    </View>
  );
}

const styles = StyleSheet.create({
  /** A square, centred box: the disc's own clipping rounds the mark, so nothing is cropped here. */
  box: { alignItems: 'center', justifyContent: 'center' },
});
