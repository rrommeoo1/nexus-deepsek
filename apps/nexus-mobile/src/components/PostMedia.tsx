import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAudioPlayer } from 'expo-audio';
import { pauseIfAlive } from '../lib/audioLifecycle';
import { mediaKindOf, mediaSourceFor, type MediaItem, type MediaSource, type SocialPost } from '../lib/socialTypes';
import { cachedMediaUri, downloadMedia, immediateMediaUri, isRemoteMediaSource } from '../lib/mediaCache';

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
export type VideoFit = MediaFit | 'portrait-cover';

/** Decoded display orientation is shared by the feed and viewer for the same media object. */
const displayedPortraitByHash = new Map<string, boolean>();
const portraitProbeByHash = new Map<string, Promise<boolean>>();

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
  const uri = useMediaFile(source, onError);
  if (!uri) return null;
  // `onError` lets a surface answer honestly when `/media/…` refuses the object (`423 media
  // quarantined` for an unvalidated record, `410 media missing` for a purged one): the frame is
  // then replaced by a real sentence instead of staying silently black.
  return (
    <Image
      source={{ uri }}
      resizeMode={fit}
      style={style}
      accessibilityIgnoresInvertColors
      onError={onError}
    />
  );
}

/**
 * The file a picture is drawn from: the download cache for a remote source, the source itself for
 * a photo the reader picked on this device.
 *
 * `null` means "not yet": the surface underneath keeps its own ground (a tile's plate, the reader's
 * dark stage) instead of painting a broken frame. A download that the server refuses calls
 * `onError`, so a surface that owns a sentence still gets to say it.
 *
 * Why the bytes are downloaded rather than drawn from the URL: `lib/mediaCache.ts` tells the whole
 * of it — React Native 0.86's Android image pipeline drops `source.headers`, so `/media/…` answers
 * `401` to every picture while `expo-video` plays every clip with the same headers attached.
 */
export function useMediaFile(source: MediaSource | null | undefined, onError?: () => void): string | null {
  const [resolved, setResolved] = useState<{ target: string; file: string } | null>(null);
  const failure = useRef(onError);
  useEffect(() => { failure.current = onError; }, [onError]);
  const latest = useRef(source);
  useEffect(() => { latest.current = source; }, [source]);
  const target = source && isRemoteMediaSource(source) ? source.uri : '';
  useEffect(() => {
    if (!target) return;
    const known = cachedMediaUri(latest.current);
    if (known) { setResolved({ target, file: known }); return; }
    let alive = true;
    downloadMedia(latest.current as MediaSource)
      .then((file) => { if (alive) setResolved({ target, file }); })
      .catch(() => { if (alive) failure.current?.(); });
    return () => { alive = false; };
  }, [target]);

  if (!source) return null;
  if (!target) return source.uri;
  return immediateMediaUri(source) ?? (resolved && resolved.target === target ? resolved.file : null);
}


/**
 * A clip with the session attached and playback driven from outside (`active`), which is what lets a
 * list play only the reel the reader is looking at. The player is created from the same
 * `{uri, headers}` source so `/media/…` resolves exactly like it does on the web.
 */
export function RemoteVideo({ item, fit = 'cover', style, active, muted = true, loop = true, nativeControls = false, soundtrack, onProgress, seekRef, onError, onAudioError }: {
  item?: MediaItem | null;
  fit?: VideoFit;
  style?: StyleProp<ViewStyle>;
  active: boolean;
  muted?: boolean;
  loop?: boolean;
  nativeControls?: boolean;
  soundtrack?: SocialPost['external_audio'];
  /**
   * Where the clip stands: the fraction (0-1), the position and the duration in seconds, sampled four
   * times a second. The surface that draws the clip owns the bar (`PostCanvas`), because the bar has to
   * sit *above* the frame's veil and clear of the action row: a clip here is drawn without native
   * controls (a tap is the play switch, `tapVideo`, app.js:3216).
   */
  onProgress?: (fraction: number, position: number, duration: number) => void;
  /** The surface's hand on the player: it fills `current` with a seek so a tap on the bar can move the clip. */
  seekRef?: { current: ((fraction: number) => void) | null };
  onError?: () => void;
  onAudioError?: (message: string) => void;
}) {
  const source = mediaSourceFor(item);
  const jamendo = soundtrack?.provider === 'jamendo' && /^https:\/\//i.test(soundtrack.audio_url ?? '') ? soundtrack : null;
  const soundtrackPlayer = useAudioPlayer(jamendo?.audio_url ?? null);
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = loop;
    instance.muted = muted || Boolean(jamendo);
    // Four samples a second draw a 3px strip smoothly; the default (once a second) would step.
    instance.timeUpdateEventInterval = 0.25;
  });
  const [portraitVideo, setPortraitVideo] = useState(() => item?.hash ? displayedPortraitByHash.get(item.hash) ?? false : false);

  // The failure handler lives in a ref so a caller's inline arrow does not re-subscribe the listener
  // on every render.
  const failure = useRef(onError);
  useEffect(() => { failure.current = onError; }, [onError]);
  const audioFailure = useRef(onAudioError);
  useEffect(() => { audioFailure.current = onAudioError; }, [onAudioError]);

  // The web plays a Jamendo track as a separate source, seeking to its signed preview segment as
  // the video advances. Do the same with the installed expo-audio player; the original clip is muted
  // only when an actual HTTPS catalog track is present. A failed seek must never surface as LogBox.
  useEffect(() => {
    if (!jamendo) return;
    const subscription = soundtrackPlayer.addListener('playbackStatusUpdate', (status) => {
      if (status.error) audioFailure.current?.('Melodia Jamendo nu a putut fi redată. Verifică conexiunea sau alege altă melodie.');
    });
    return () => subscription.remove();
  }, [jamendo, soundtrackPlayer]);

  useEffect(() => {
    if (!jamendo || !active || muted) {
      pauseIfAlive(soundtrackPlayer);
      return;
    }
    let seeking = false;
    let alive = true;
    const segment = Math.max(15, Math.min(60, Number(jamendo.segment_seconds) || 30));
    const duration = Math.max(0, Number(jamendo.duration) || 0);
    const offset = Math.max(0, Math.min(Math.max(0, duration - segment), Number(jamendo.preview_offset) || 0));
    const sync = () => {
      if (!soundtrackPlayer.isLoaded) return;
      const wanted = offset + (Math.max(0, player.currentTime || 0) % segment);
      if (!seeking && Math.abs(soundtrackPlayer.currentTime - wanted) > 0.45) {
        seeking = true;
        void soundtrackPlayer.seekTo(wanted).catch(() => {
          if (alive) audioFailure.current?.('Sincronizarea melodiei Jamendo a eșuat.');
        }).finally(() => { seeking = false; });
      }
      if (!soundtrackPlayer.playing) soundtrackPlayer.play();
    };
    sync();
    const interval = setInterval(sync, 500);
    return () => { alive = false; clearInterval(interval); pauseIfAlive(soundtrackPlayer); };
  }, [active, jamendo, muted, player, soundtrackPlayer]);

  // `/media/…` answers 423 for an unvalidated record and 410 for one whose bytes are gone, and a
  // dropped network answers the same way; expo-video reports all of them as `status: 'error'`, which
  // is the one signal a black stage would otherwise hide. Nothing else can tell the reader a clip
  // exists but cannot be played.
  useEffect(() => {
    const subscription = player.addListener('statusChange', (payload) => {
      if (payload.status === 'error') failure.current?.();
    });
    return () => subscription.remove();
  }, [player]);

  // The API omits dimensions, so read the actual decoded track. A vertical clip fills the tall
  // display; landscape clips retain their complete frame instead of being cropped into a slit.
  useEffect(() => {
    let alive = true;
    let thumbnailRequested = false;
    const update = (tracks: typeof player.availableVideoTracks) => {
      const size = tracks.find((track) => track.size.width > 0 && track.size.height > 0)?.size;
      if (!size) return;
      if (size.height > size.width) {
        if (item?.hash) displayedPortraitByHash.set(item.hash, true);
        setPortraitVideo(true);
      } else if (fit === 'portrait-cover' && !thumbnailRequested && !(item?.hash && displayedPortraitByHash.has(item.hash))) {
        // A rotated video can report landscape track dimensions while displaying portrait.
        // The native thumbnail has the display transform applied, unlike VideoTrack.size.
        thumbnailRequested = true;
        const hash = item?.hash;
        let probe = hash ? portraitProbeByHash.get(hash) : undefined;
        if (!probe) {
          probe = player.generateThumbnailsAsync(0, { maxWidth: 64, maxHeight: 64 })
            .then(([thumbnail]) => {
              if (!thumbnail) throw new Error('Video thumbnail unavailable');
              const portrait = thumbnail.height > thumbnail.width;
              if (hash) displayedPortraitByHash.set(hash, portrait);
              return portrait;
            });
          if (hash) {
            portraitProbeByHash.set(hash, probe);
            void probe.then(
              () => { portraitProbeByHash.delete(hash); },
              () => { portraitProbeByHash.delete(hash); },
            );
          }
        }
        probe.then((portrait) => { if (alive) setPortraitVideo(portrait); }).catch(() => {});
      }
    };
    update(player.availableVideoTracks);
    const loaded = player.addListener('sourceLoad', ({ availableVideoTracks }) => update(availableVideoTracks));
    const changed = player.addListener('videoTrackChange', ({ videoTrack }) => {
      if (videoTrack?.size) update([videoTrack]);
    });
    return () => { alive = false; loaded.remove(); changed.remove(); };
  }, [fit, item?.hash, player]);

  // A live player is a mutable native handle: expo-video exposes no declarative prop for these two,
  // so assigning them on the handle is the documented way to change them — exactly what the
  // `react-hooks/immutability` rule cannot see.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    player.muted = muted || Boolean(jamendo);
  }, [jamendo, muted, player]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    player.loop = loop;
  }, [loop, player]);

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  /**
   * The clip reports its position; the surface that composes the frame draws it. `onProgress` is kept
   * in a ref so a caller's inline arrow does not re-subscribe the listener on every render - the same
   * pattern the failure handlers above use.
   */
  const progress = useRef(onProgress);
  useEffect(() => { progress.current = onProgress; }, [onProgress]);
  /**
   * The player is the only thing that can move the clip, so the surface that draws the bar hands down one
   * setter here: the strip in `PostCanvas` stays a picture, and this is the hand that turns a tap into a
   * seek. It is re-pointed on every render so it always carries the current player.
   */
  const seeker = useRef(seekRef);
  useEffect(() => { seeker.current = seekRef; }, [seekRef]);
  useEffect(() => {
    if (!seeker.current) return;
    seeker.current.current = (fraction: number) => {
      const total = player.duration || 0;
      if (total <= 0) return;
      /** expo-video assigns the position directly; there is no `seekTo` on this player version. */
      player.currentTime = Math.max(0, Math.min(1, fraction)) * total;
    };
    return () => { if (seeker.current) seeker.current.current = null; };
  }, [player, seekRef]);
  useEffect(() => {
    const subscription = player.addListener('timeUpdate', ({ currentTime }) => {
      const total = player.duration || 0;
      const fraction = total > 0 ? Math.max(0, Math.min(1, currentTime / total)) : 0;
      progress.current?.(fraction, Math.max(0, currentTime), total);
    });
    return () => subscription.remove();
  }, [player]);

  if (!source) return null;
  const resolvedFit = fit === 'portrait-cover' ? (portraitVideo ? 'cover' : 'contain') : fit;
  return (
    <VideoView
      key={resolvedFit}
      style={style}
      player={player}
      contentFit={resolvedFit}
      nativeControls={nativeControls}
      fullscreenOptions={{ enable: false }}
    />
  );
}

/** A catalog soundtrack can accompany a still image too. Keep it inside the signed preview segment. */
export function RemoteImageSound({ soundtrack, active, muted, onAudioError }: {
  soundtrack?: SocialPost['external_audio'];
  active: boolean;
  muted: boolean;
  onAudioError?: (message: string) => void;
}) {
  const jamendo = soundtrack?.provider === 'jamendo' && /^https:\/\//i.test(soundtrack.audio_url ?? '') ? soundtrack : null;
  const player = useAudioPlayer(jamendo?.audio_url ?? null);
  const audioFailure = useRef(onAudioError);
  useEffect(() => { audioFailure.current = onAudioError; }, [onAudioError]);

  useEffect(() => {
    if (!jamendo) return;
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.error) audioFailure.current?.('Melodia Jamendo nu a putut fi redată.');
    });
    return () => subscription.remove();
  }, [jamendo, player]);

  useEffect(() => {
    if (!jamendo || !active || muted) { pauseIfAlive(player); return; }
    const segment = Math.max(15, Math.min(60, Number(jamendo.segment_seconds) || 30));
    const duration = Math.max(0, Number(jamendo.duration) || 0);
    const offset = Math.max(0, Math.min(Math.max(0, duration - segment), Number(jamendo.preview_offset) || 0));
    let seeking = false;
    let alive = true;
    const sync = () => {
      if (!player.isLoaded) return;
      if (!seeking && (player.currentTime < offset - 0.45 || player.currentTime >= offset + segment - 0.2)) {
        seeking = true;
        void player.seekTo(offset).catch(() => {
          if (alive) audioFailure.current?.('Melodia Jamendo nu a putut fi reluată.');
        }).finally(() => { seeking = false; });
      }
      if (!player.playing) player.play();
    };
    sync();
    const interval = setInterval(sync, 500);
    return () => { alive = false; clearInterval(interval); pauseIfAlive(player); };
  }, [active, jamendo, muted, player]);
  return null;
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
