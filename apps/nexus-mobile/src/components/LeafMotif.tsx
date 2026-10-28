import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { editorial } from '../theme/editorial';

/**
 * The Jungle Book signature: one sprig, three leaves, drawn as vector rather than shipped as a picture.
 *
 * Why a sprig and not a leaf icon: the owner asked for premium botanical editorial, "not cartoon jungle
 * decoration". A single repeated leaf glyph is a logo; a hand-drawn sprig with a stem, one leaf turned
 * away and two answering it reads as an illustration, which is what an editorial surface can carry at 8 %
 * behind words without shouting.
 *
 * Rules it keeps:
 *
 *   * `pointerEvents="none"` — it never eats a tap;
 *   * it is drawn only on text surfaces (a text post, a text thumbnail, the reply composer's plate), never
 *     over a photograph or a video;
 *   * it is a `memo` with no state and no effect, two paths and one gradient: it costs one draw per mount;
 *   * its colour and opacity are props, so a surface can keep it at 7 % on a card and at 14 % on a
 *     selected plate without a second asset.
 */
export const LeafMotif = memo(function LeafMotif({
  size = 180,
  opacity = 0.1,
  color = editorial.leaf,
  rotate = 0,
  mirrored = false,
  style,
}: {
  /** The width of the drawing; its height is `size * 1.6`. */
  size?: number;
  /** 0.05–0.16 on a card. Anything above 0.2 stops being a watermark. */
  opacity?: number;
  color?: string;
  /** Degrees, clockwise. A surface may tilt its sprig so two cards never look stamped. */
  rotate?: number;
  mirrored?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const height = Math.round(size * 1.6);
  return (
    <View pointerEvents="none" style={[styles.box, { width: size, height, opacity }, style]}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 160"
        style={[{ transform: [{ rotate: `${rotate}deg` }, ...(mirrored ? [{ scaleX: -1 }] : [])] }]}
      >
        <Defs>
          <LinearGradient id={`nxLeafFill-${size}-${rotate}-${mirrored ? 'm' : 'p'}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.85} />
            <Stop offset="1" stopColor={color} stopOpacity={0.18} />
          </LinearGradient>
        </Defs>
        {/* The stem: one curve from the foot to the tip, thinner than either leaf. */}
        <Path
          d="M50 158 C 45 124, 55 74, 49 8"
          fill="none"
          stroke={color}
          strokeOpacity={0.55}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
        {/* The upper leaf, turned away from the reader. */}
        <Path d="M49 44 C 60 26, 82 20, 95 25 C 91 45, 69 55, 49 46 Z" fill={`url(#nxLeafFill-${size}-${rotate}-${mirrored ? 'm' : 'p'})`} />
        {/* The answering leaf on the other side, lower, a little wider. */}
        <Path d="M49 88 C 33 72, 13 70, 3 78 C 9 97, 32 103, 49 90 Z" fill={`url(#nxLeafFill-${size}-${rotate}-${mirrored ? 'm' : 'p'})`} />
        {/* The third leaf closes the rhythm near the foot. */}
        <Path d="M50 122 C 63 110, 83 110, 94 116 C 88 132, 66 136, 50 124 Z" fill={color} fillOpacity={0.16} />
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  box: { overflow: 'hidden' },
});
