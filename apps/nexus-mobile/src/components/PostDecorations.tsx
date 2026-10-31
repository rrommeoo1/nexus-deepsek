import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SocialPost } from '../lib/socialTypes';
import { mediaContentRect, type OverlayFit } from '../lib/overlayFrame';
import { PostOverlay } from './PostOverlay';

/**
 * The decorations a published post carries, drawn by the one layer the composer also draws
 * (`components/PostOverlay`).
 *
 * Renders the same server-verified decoration manifest that the web's `studioDecorationsMarkup` uses,
 * inside the rectangle the media really occupies: `mediaContentRect` of `lib/overlayFrame.ts` is the
 * number both surfaces read, so a label the author placed at 40 % of the picture stands at 40 % of the
 * picture on the reader's phone, at the size the creator sheet gives it — never at a size measured from
 * the phone or from the box it was dragged in.
 */
export function PostDecorations({ post, fit }: { post: SocialPost; fit: OverlayFit }) {
  const manifest = post.creator_studio?.integrity === 'VERIFIED' ? post.creator_studio.manifest : null;
  const decorations = manifest?.decorations ?? [];
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [now, setNow] = useState(0);
  const clock = decorations.some((item) => item.type === 'TIME' || item.type === 'DATE');

  useEffect(() => {
    if (!clock) return;
    const first = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, [clock]);

  if (!decorations.length) return null;
  const ratio = manifest?.transform?.ratio || (manifest?.aspect === 'VERTICAL_9_16' ? 9 / 16 : 3 / 4);
  const rect = mediaContentRect({ width: bounds.width, height: bounds.height, ratio, fit });
  return <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(event) => {
    const { width, height } = event.nativeEvent.layout;
    setBounds((previous) => previous.width === width && previous.height === height ? previous : { width, height });
  }}>
    {rect.width && rect.height
      ? <PostOverlay decorations={decorations} bounds={bounds} ratio={ratio} fit={fit} now={now} />
      : null}
  </View>;
}
