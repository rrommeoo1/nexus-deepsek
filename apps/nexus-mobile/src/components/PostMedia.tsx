import { useEffect } from 'react';
import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { mediaKindOf, mediaSourceFor, type MediaItem, type MediaSource } from '../lib/socialTypes';

/**
 * How a frame is filled, read from the web stylesheets - not chosen here:
 *
 *   feed-surface.css:518  `.presentation-immersive … .clipStage>.media{object-fit:cover;object-position:center}`
 *   social-human-ux.css:6 `.media-fit-fill … {object-fit:cover}` / :7 `.media-fit-fit … {object-fit:contain}`
 *   profile-experience.css:403 `.profileTileOpen img,video{object-fit:cover}` on a `aspect-ratio:1` tile
 *   post-detail.css:21    `.postDetailMedia{object-fit:contain;max-height:58vh}`
 *
 * `cover` is what the immersive Reels reader does by default (edge-to-edge, picture cropped); `contain`
 * is the "fit" the reader can switch to and the one the post page uses to preserve the whole frame.
 */
export type MediaFit = 'cover' | 'contain';

/** `<Image source={{uri,headers}}>` — the session travels with the request (`mediaHeaders`). */
export function RemoteImage({ item, fit = 'contain', style, onError }: {
  item?: MediaItem | null;
  fit?: MediaFit;
  style?: StyleProp<ImageStyle>;
  onError?: () => void;
}) {
  return <RemoteImageSource source={mediaSourceFor(item)} fit={fit} style={style} onError={onError} />;
}

/** The same picture, when the caller already holds the source (a profile avatar path, a cover). */
export function RemoteImageSource({ source, fit = 'contain', style, onError }: {
  source?: MediaSource | null;
  fit?: MediaFit;
  style?: StyleProp<ImageStyle>;
  onError?: () => void;
}) {
  if (!source) return null;
  // `onError` lets a surface answer honestly when `/media/…` refuses the object (`423 media
  // quarantined` for an unvalidated record, `410 media missing` for a purged one): the frame is
  // then replaced by a real sentence instead of staying silently black.
  return (
    <Image
      source={source}
      resizeMode={fit}
      style={style}
      accessibilityIgnoresInvertColors
      onError={onError}
    />
  );
}

/**
 * A clip with the session attached and playback driven from outside (`active`), which is what lets a
 * list play only the reel the reader is looking at. The player is created from the same
 * `{uri, headers}` source so `/media/…` resolves exactly like it does on the web.
 */
export function RemoteVideo({ item, fit = 'cover', style, active, muted = true, loop = true, nativeControls = false }: {
  item?: MediaItem | null;
  fit?: MediaFit;
  style?: StyleProp<ViewStyle>;
  active: boolean;
  muted?: boolean;
  loop?: boolean;
  nativeControls?: boolean;
}) {
  const source = mediaSourceFor(item);
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = loop;
    instance.muted = muted;
  });

  // A live player is a mutable native handle: expo-video exposes no declarative prop for these two,
  // so assigning them on the handle is the documented way to change them — exactly what the
  // `react-hooks/immutability` rule cannot see.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    player.loop = loop;
  }, [loop, player]);

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  if (!source) return null;
  return (
    <VideoView
      style={style}
      player={player}
      contentFit={fit}
      nativeControls={nativeControls}
      fullscreenOptions={{ enable: false }}
    />
  );
}

/** True when the item is something `RemoteImage` can print. */
export function isImageItem(item?: MediaItem | null): boolean {
  return mediaKindOf(item) === 'image';
}

export function isVideoItem(item?: MediaItem | null): boolean {
  return mediaKindOf(item) === 'video';
}

export const mediaStyles = StyleSheet.create({
  /** `.clipStage:before` — the dark plate the web puts under every clip. */
  plate: { backgroundColor: '#000000' },
  disc: { alignItems: 'center', justifyContent: 'center' },
  play: { color: '#ffffff', fontSize: 34, fontWeight: '800' },
  full: { width: '100%', height: '100%' },
});

export function MediaPlaceholder({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[mediaStyles.plate, style]} />;
}
