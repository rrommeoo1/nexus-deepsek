import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SocialPost } from '../lib/socialTypes';
import type { StudioDecoration } from '../lib/studioManifest';
import { creatorTokens } from '../theme/creator';

function contentOf(item: StudioDecoration, now: number): string {
  if (item.type !== 'TIME' && item.type !== 'DATE') return item.text;
  if (!now) return '…';
  try {
    return new Intl.DateTimeFormat('ro-RO', item.type === 'TIME'
      ? { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: item.timezone }
      : { day: '2-digit', month: '2-digit', timeZone: item.timezone }).format(new Date(now));
  } catch { return ''; }
}

function DecorationLabel({ item, now, frameWidth }: { item: StudioDecoration; now: number; frameWidth: number }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const location = item.type === 'LOCATION';
  const clock = item.type === 'TIME' || item.type === 'DATE';
  const fontSize = location
    ? Math.min(creatorTokens.decoration.locationMaxFontSize, Math.max(creatorTokens.decoration.locationMinFontSize, frameWidth * creatorTokens.decoration.locationViewportFontRatio))
    : Math.min(creatorTokens.decoration.maxFontSize, Math.max(creatorTokens.decoration.minFontSize, frameWidth * creatorTokens.decoration.viewportFontRatio));
  return <View onLayout={(event) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((previous) => previous.width === width && previous.height === height ? previous : { width, height });
  }} style={[styles.decoration, {
    left: `${item.x}%`, top: `${item.y}%`, maxWidth: location ? '86%' : '78%',
    backgroundColor: item.background, borderRadius: location ? creatorTokens.decoration.locationRadius : 0,
    paddingHorizontal: clock ? creatorTokens.decoration.timeHorizontalPadding : creatorTokens.decoration.horizontalPadding,
    paddingVertical: clock ? creatorTokens.decoration.timeVerticalPadding : creatorTokens.decoration.verticalPadding,
    opacity: item.opacity,
    transform: [{ translateX: -size.width / 2 }, { translateY: -size.height / 2 }, { rotate: `${item.rotation}deg` }, { scale: item.scale }],
  }]}>
    <Text style={[styles.text, { color: item.color, fontSize, letterSpacing: clock ? creatorTokens.decoration.timeLetterSpacing : 0 }, location && styles.locationText]}>{contentOf(item, now)}</Text>
  </View>;
}

/** Renders the same server-verified decoration manifest that the web's `studioDecorationsMarkup` uses. */
export function PostDecorations({ post, fit }: { post: SocialPost; fit: 'cover' | 'contain' }) {
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
  const height = bounds.width && bounds.height
    ? fit === 'cover' ? Math.max(bounds.width / ratio, bounds.height) : Math.min(bounds.width / ratio, bounds.height)
    : 0;
  const width = height * ratio;
  return <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(event) => {
    const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
    setBounds((previous) => previous.width === nextWidth && previous.height === nextHeight ? previous : { width: nextWidth, height: nextHeight });
  }}>
    {width && height ? <View style={{ position: 'absolute', width, height, left: (bounds.width - width) / 2, top: (bounds.height - height) / 2 }}>
      {decorations.filter((item) => ['TEXT', 'TIME', 'DATE', 'LOCATION'].includes(item.type)).map((item) =>
        <DecorationLabel key={item.id} item={item} now={now} frameWidth={width} />)}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  decoration: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '800', textAlign: 'center', textShadowColor: '#000000', textShadowRadius: 7 },
  locationText: { textShadowRadius: 0 },
});
