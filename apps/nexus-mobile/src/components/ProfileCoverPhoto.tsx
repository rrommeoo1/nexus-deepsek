import { useState } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

/**
 * `.ownerCover{height:168px}` with `.ownerCover img{width:100%;height:100%;object-fit:cover}` and
 * `style="object-position:center <coverFocus>%"`: the stripe of the picture the band shows, and which part
 * of it is in that stripe.
 *
 * A native image has no `object-position`, so the same framing is reached by moving the picture inside a
 * clipped frame. The drawn height is the frame's width over the picture's own ratio, and the offset is
 * what remains between that height and the frame - taken at the same percentage the stylesheet takes, so
 * `cover_focus: 0` shows the top of the picture, `100` the bottom, and `35` (the record's default) the
 * stripe the web shows by default.
 */
export function ProfileCoverPhoto({ source, focus = 35, height, style }: {
  source?: ImageSourcePropType | null;
  /** `profile.cover_focus`, 0-100. */
  focus?: number;
  height: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [frameWidth, setFrameWidth] = useState(0);
  const [picture, setPicture] = useState<{ width: number; height: number } | null>(null);
  const ratio = picture && picture.width > 0 ? picture.height / picture.width : 0;
  const drawnHeight = frameWidth > 0 && ratio > 0 ? frameWidth * ratio : 0;
  const travel = Math.max(0, drawnHeight - height);
  const position = Math.min(100, Math.max(0, Number(focus) || 0)) / 100;

  return (
    <View
      style={[styles.frame, { height }, style]}
      onLayout={(event) => setFrameWidth(event.nativeEvent.layout.width)}
    >
      {source ? (
        <Image
          source={source}
          style={[
            styles.image,
            drawnHeight > 0 ? { width: frameWidth, height: drawnHeight } : styles.stretched,
            drawnHeight > 0 && travel > 0 ? { transform: [{ translateY: -travel * position }] } : null,
          ]}
          resizeMode="cover"
          onLoad={(event) => setPicture(event.nativeEvent.source ?? null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /** `.ownerCover{overflow:hidden}` — the frame the picture is moved inside. */
  frame: { overflow: 'hidden' },
  /** The picture, pinned to the top of the frame and moved by its own height. */
  image: { position: 'absolute', top: 0, left: 0 },
  /** Before the picture has reported its size: the surface is filled, and the frame never jumps. */
  stretched: { width: '100%', height: '100%' },
});
