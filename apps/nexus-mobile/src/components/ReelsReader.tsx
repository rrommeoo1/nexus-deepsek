import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View,
  type NativeScrollEvent, type NativeSyntheticEvent, type ViewToken,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReactionControl } from './ReactionControl';
import { RemoteImage, RemoteImageSound, RemoteImageSource, RemoteVideo } from './PostMedia';
import { SolidViewerIcon } from './SolidViewerIcon';
import { PostDecorations } from './PostDecorations';
import { setPostReaction, setPostRepost, setPostSaved, sharePost } from '../lib/postInteractions';
import {
  audioAttributionFor, compactCount, initialsFor, mediaKindOf, mediaSourceForPath, postMediaItems,
  relativeTime, viewerReaction,
  type MediaItem, type SocialPost,
} from '../lib/socialTypes';
import { socialTokens } from '../theme/social';
import { openSocialProfile } from '../lib/profileNavigation';

/**
 * The immersive Reels reader, drawn to the values the web uses for its own immersive presentation:
 *
 *   feed-surface.css:474-521  one reel owns the whole viewport, media edge-to-edge, `object-fit:cover`
 *   social-human-ux.css:6-7   the reader's own fit mode: `media-fit-fill` cover / `media-fit-fit` contain
 *   app.js:1744-1748          defaults are `immersive` + `fill` (cover), persisted per reader
 *   app.js:4278-4299          the rail: creator, reactions, comments, save, repost/share, soundtrack
 *
 * Paging is a snap per viewport, and only the reel in view is allowed to play, which is what keeps a
 * phone from decoding six videos at once. Every action behind the rail is a real endpoint call
 * (`lib/postInteractions`) - nothing here is a picture of a button.
 */
export function ReelsReader({ posts, refreshing, onRefresh, onEndReached, loadingMore, onOpenPost, onOpenComments }: {
  posts: SocialPost[];
  refreshing: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  loadingMore: boolean;
  /** `tapVideo` (app.js:3216): a single tap opens the reel full screen instead of pausing it. */
  onOpenPost: (post: SocialPost) => void;
  onOpenComments: (post: SocialPost) => void;
}) {
  const insets = useSafeAreaInsets();
  const navHeight = socialTokens.nav.paddingTop + socialTokens.nav.glass.height + Math.max(socialTokens.nav.paddingBottomMin, insets.bottom);
  const [pageHeight, setPageHeight] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  // Both values must stay identity-stable for the life of the reader, so they are memoised instead of
  // held in refs: reading `ref.current` during render is what the React Compiler rule forbids.
  const viewability = useMemo(() => ({ viewAreaCoveragePercentThreshold: 60 }), []);

  const onViewableItemsChanged = useCallback((info: { viewableItems: ViewToken[] }) => {
    const first = info.viewableItems.find((entry) => entry.isViewable);
    if (first && typeof first.index === 'number') setActiveIndex(first.index);
  }, []);

  const onMomentumEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!pageHeight) return;
    setActiveIndex(Math.round(event.nativeEvent.contentOffset.y / pageHeight));
  }, [pageHeight]);

  return (
    <View style={styles.reader} onLayout={(event) => setPageHeight(event.nativeEvent.layout.height)}>
      {pageHeight > 0 ? (
        <FlatList
          data={posts}
          keyExtractor={(post) => String(post.id)}
          pagingEnabled
          snapToInterval={pageHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({ length: pageHeight, offset: pageHeight * index, index })}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewability}
          onMomentumScrollEnd={onMomentumEnd}
          onEndReachedThreshold={0.8}
          onEndReached={onEndReached}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" progressViewOffset={8} />}
          renderItem={({ item, index }) => (
            <ReelPage
              post={item}
              height={pageHeight}
              overlayBottom={navHeight}
              active={index === activeIndex}
              muted={muted}
              onToggleMute={() => setMuted((value) => !value)}
              onOpenPost={() => onOpenPost(item)}
              onOpenComments={() => onOpenComments(item)}
            />
          )}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#ffffff" style={styles.footer} /> : null}
        />
      ) : null}
    </View>
  );
}

/** One reel: the whole viewport, the picture, and the rail the reader actually uses. */
function ReelPage({ post, height, overlayBottom, active, muted, onToggleMute, onOpenPost, onOpenComments }: {
  post: SocialPost;
  height: number;
  overlayBottom: number;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onOpenPost: () => void;
  onOpenComments: () => void;
}) {
  const items = postMediaItems(post);
  const cover: MediaItem | null = items[0] ?? post.media ?? null;
  const isVideo = mediaKindOf(cover) === 'video';
  const avatar = mediaSourceForPath(post.author?.avatar);
  const handle = post.author?.handle || 'nexus';
  const name = post.author?.display_name || handle;

  const [playing, setPlaying] = useState(true);
  const [summary, setSummary] = useState(post.reactions ?? null);
  const [saved, setSaved] = useState(Boolean(post.saved_by_me));
  const [reposted, setReposted] = useState(Boolean(post.reposted_by_me));
  const [distributeOpen, setDistributeOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);

  const mine = viewerReaction(summary);
  const plays = active && playing && isVideo;

  function fail(cause: unknown) {
    setNotice(cause instanceof Error ? cause.message : 'Acțiunea nu a putut fi trimisă.');
  }

  const react = (kind: string) => {
    const nextActive = mine !== kind;
    setSummary((previous) => ({ ...(previous ?? {}), viewer_reaction: nextActive ? kind : null }));
    setPostReaction(post.id, kind, nextActive)
      .then((answer) => setSummary({ counts: answer.counts, viewer_reaction: answer.viewer_reaction }))
      .catch(fail);
  };

  const save = () => {
    const next = !saved;
    setSaved(next);
    setPostSaved(post.id, next).then((answer) => setSaved(answer.saved)).catch((cause) => { setSaved(!next); fail(cause); });
  };

  const repost = () => {
    const next = !reposted;
    setDistributeOpen(false);
    setReposted(next);
    setPostRepost(post.id, next)
      .then((answer) => setReposted(Boolean(answer.reposted_by_me ?? answer.active)))
      .catch((cause) => { setReposted(!next); fail(cause); });
  };

  // Sharing is off by design on this product; the server's own sentence is what the reader sees.
  const share = () => {
    setDistributeOpen(false);
    setBusy(true);
    sharePost(post.id).catch(fail).finally(() => setBusy(false));
  };

  return (
    <View style={[styles.page, { height }]}>
      {cover && isVideo ? (
        <RemoteVideo item={cover} fit="portrait-cover" style={styles.media} active={plays} muted={muted} soundtrack={post.external_audio} onError={() => setMediaFailed(true)} onAudioError={setNotice} />
      ) : null}
      {cover && !isVideo ? <RemoteImage item={cover} fit="contain" style={styles.media} onError={() => setMediaFailed(true)} /> : null}
      {cover && !isVideo ? <RemoteImageSound soundtrack={post.external_audio} active={active && playing && !mediaFailed} muted={muted} onAudioError={setNotice} /> : null}
      {!cover ? <View style={styles.media} /> : null}

      {/**
       * `video aria-label="Deschide Reel-ul pe tot ecranul"` + `bindDoubleTapHeart(video, { onSingle: tapVideo })`
       * (app.js:3178,3216): one tap opens the reader. Playback is not toggled here - the web keeps that on the
       * clip's own `[data-clip-play]` control, which is the disc below.
       */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Deschide Reel-ul pe tot ecranul"
        onPress={onOpenPost}
        style={styles.stage}
      />

      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="nxReelVeil" x1="0" y1="0" x2="0" y2="1">
            {socialTokens.reels.veil.map((stop) => (
              <Stop key={stop.offset} offset={stop.offset} stopColor="#000000" stopOpacity={Number(stop.color.slice(stop.color.lastIndexOf(',') + 1, -1))} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#nxReelVeil)" />
      </Svg>
      <PostDecorations post={post} fit={isVideo ? 'cover' : 'contain'} />

      {mediaFailed ? (
        <View pointerEvents="none" style={styles.playState}>
          <Text style={styles.unavailable}>Fișierul media nu a putut fi încărcat.</Text>
        </View>
      ) : null}

      {isVideo && active && !playing ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Redă clipul" onPress={() => setPlaying(true)} style={styles.playState}>
          <SolidViewerIcon kind="play" size={54} />
        </Pressable>
      ) : null}

      <View style={[styles.meta, { bottom: styles.meta.bottom + overlayBottom }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Profilul lui @${handle}`} onPress={() => openSocialProfile(post.author?.handle)} style={styles.creatorRow}>
          <View style={styles.creatorDisc}>
            <RemoteImageSource source={avatar} fit="cover" style={styles.creatorDiscImage} />
          </View>
          <View style={styles.creatorText}>
            <Text style={styles.creatorName} numberOfLines={1}>{name}</Text>
            <Text style={styles.creatorHandle} numberOfLines={1}>
              {`@${handle}`}{relativeTime(post.created_at) ? ` · ${relativeTime(post.created_at)}` : ''}
            </Text>
          </View>
        </Pressable>
        {post.caption ? <Text style={styles.caption} numberOfLines={3}>{post.caption}</Text> : null}
        {/**
         * `captionTranslationButtonMarkup` (caption-translation.js:11-13, `.clipTranslate`): the web paints
         * "Vezi traducerea" under the caption and only fails on press when the browser holds no on-device
         * Translator. React Native holds none either, so the press answers with the same unavailable sentence.
         */}
        {post.caption ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Vezi traducerea"
            onPress={() => setNotice('Traducerea pe dispozitiv nu este disponibilă în această aplicație.')}
            style={styles.translate}
          >
            <Text style={styles.translateText}>Vezi traducerea</Text>
          </Pressable>
        ) : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </View>

      <View style={[styles.rail, { bottom: styles.rail.bottom + overlayBottom }]}>
        {/**
         * `.clipQuickActions>.clipRailAvatar` (feed-surface.js:201, feed-surface.css:148-150): the owner moved the
         * profile up the rail, above the reactions, so the mark sits where a thumb already is. It stays the button
         * it always was - it opens the creator's moment - which on the phone is the reel itself.
         */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Profilul lui @${handle}`}
          onPress={() => openSocialProfile(post.author?.handle)}
          style={styles.railAvatar}
        >
          <View style={styles.railAvatarDisc}>
            {avatar
              ? <RemoteImageSource source={avatar} fit="cover" style={styles.railAvatarImage} />
              : <Text style={styles.railAvatarText}>{initialsFor(name, handle)}</Text>}
          </View>
        </Pressable>

        <ReactionControl variant="rail" summary={summary} onReact={(kind) => react(kind)} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Comentarii"
          onPress={onOpenComments}
          style={styles.railButton}
        >
          <View style={styles.railDisc}>
            <SolidViewerIcon kind="comment" size={socialTokens.reels.railIconSize} />
          </View>
          <Text style={styles.railCount}>{post.comment_count ? compactCount(post.comment_count) : ''}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Scoate din salvate' : 'Salvează'}
          accessibilityState={{ selected: saved }}
          onPress={save}
          style={styles.railButton}
        >
          <View style={styles.railDisc}>
            <SolidViewerIcon kind="save" size={socialTokens.reels.railIconSize} color={saved ? '#ff315f' : '#ffffff'} />
          </View>
          {/* `.railMetricPlaceholder` — save has no public count, so its metric row is reserved invisibly. */}
          <Text accessible={false} style={[styles.railCount, styles.railCountPlaceholder]}>•</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Distribuie"
          onPress={() => setDistributeOpen((open) => !open)}
          style={styles.railButton}
        >
          <View style={styles.railDisc}>
            <SolidViewerIcon kind="share" size={socialTokens.reels.railIconSize} color={reposted ? '#ff315f' : '#ffffff'} />
          </View>
          <Text style={styles.railCount}>{post.reposts ? compactCount(post.reposts) : ''}</Text>
        </Pressable>

        {busy ? <ActivityIndicator color="#ffffff" style={styles.railSpinner} /> : null}

        {/**
         * `.clipMusicDisc` (app.js:4285, feed-surface.css:751-753): the soundtrack lives on the rail as a disc
         * that toggles the sound, and the attribution it carries is its accessible name.
         */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${muted ? 'Activează' : 'Oprește'} sunetul · ${audioAttributionFor(post, name)}`}
          accessibilityState={{ selected: !muted }}
          onPress={onToggleMute}
          style={[styles.musicDisc, muted && styles.musicDiscMuted]}
        >
          <SolidViewerIcon kind={muted ? 'mute' : 'sound'} size={socialTokens.reels.railIconSize} />
        </Pressable>
      </View>

      {distributeOpen ? (
        <View style={styles.distribute}>
          <Text style={styles.distributeTitle}>Distribuie postarea</Text>
          <Pressable accessibilityRole="button" onPress={repost} style={styles.distributeItem}>
            <Text style={styles.distributeText}>{reposted ? 'Anulează redistribuirea' : 'Redistribuie în feed'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={share} style={styles.distributeItem}>
            <Text style={styles.distributeText}>Distribuie în afara Nexus</Text>
          </Pressable>
        </View>
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  reader: { flex: 1, backgroundColor: '#000000' },
  footer: { paddingVertical: 18 },
  /** `feed-surface.css:484 .clipCard{height:100%}` — one reel owns the viewport. */
  page: { width: '100%', backgroundColor: '#000000', overflow: 'hidden' },
  /** `.clipStage>.media{width:100%;height:100%}` plus the fit mode handled by `contentFit`/`resizeMode`. */
  media: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  /** The tap target over the picture: play/pause, exactly the surface the web puts there. */
  stage: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  playState: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  unavailable: { color: '#ffc6c6', fontSize: 13, fontWeight: '600', textAlign: 'center', paddingHorizontal: 24 },
  meta: { position: 'absolute', left: 14, right: 84, bottom: 22, gap: 6 },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  creatorDisc: {
    width: 42, height: 42, borderRadius: 21, overflow: 'hidden', backgroundColor: '#111820',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center',
  },
  creatorDiscImage: { width: '100%', height: '100%' },
  creatorText: { flex: 1, minWidth: 0 },
  creatorName: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  creatorHandle: { color: 'rgba(255,255,255,0.78)', fontSize: 12 },
  caption: { color: '#f2f6f9', fontSize: 14, lineHeight: 19 },
  /** `.clipTranslate` — the caption's own translation door: 10px, weight 800, near-white. */
  translate: { alignSelf: 'flex-start', minHeight: 24, justifyContent: 'center' },
  translateText: { color: 'rgba(255,255,255,0.86)', fontSize: 10, fontWeight: '800' },
  notice: { color: '#ffc6c6', fontSize: 12, fontWeight: '600' },
  /** `.clipQuickActions{right:8px;bottom:10px;gap:2px}` — the reader's action column. */
  rail: { position: 'absolute', right: 10, bottom: 26, alignItems: 'center', gap: 2 },
  /** `.clipQuickActions>.clipRailAvatar{width:62px;margin:0 0 8px}` — the cell is wider than the ring it holds. */
  railAvatar: { width: 62, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  /** `.clipRailAvatar>i` — a 46px ring with the avatar inside it (or the initials when there is none). */
  railAvatarDisc: {
    width: 46, height: 46, borderRadius: 23, overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.86)', backgroundColor: '#111820',
    alignItems: 'center', justifyContent: 'center',
  },
  railAvatarImage: { width: '100%', height: '100%' },
  railAvatarText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  /** `.clipQuickActions>button:not(.clipRailAvatar)` — one predictable 56×56 action cell. */
  railButton: { width: 56, minWidth: 56, height: 56, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 1 },
  /** `.clipQuickActions :is(.clipSolidIcon,.reactionMetric>b)` 36×36 disc on the cell's 39px first row. */
  railDisc: { width: 36, minWidth: 36, height: 39, alignItems: 'center', justifyContent: 'center' },
  /** `.clipQuickActions :is(.viewerSolidSvg,.viewerReactionHeart)` 29×29, on the row above its metric. */
  /** `.clipQuickActions :is(button small,.reactionMetric>em){font-size:11px;line-height:14px}` */
  railCount: { color: '#ffffff', fontSize: 11, fontWeight: '800', lineHeight: 14 },
  /** `.railMetricPlaceholder{visibility:hidden}` — a reserved metric row that prints nothing. */
  railCountPlaceholder: { opacity: 0 },
  railSpinner: { marginTop: 4 },
  /** `.clipMusicDisc` — a 56px single-row disc that keeps the soundtrack's own toggle. */
  musicDisc: {
    width: 56, height: 56, borderRadius: 28, marginTop: 4,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.42)', backgroundColor: '#0a0b0e',
  },
  musicDiscMuted: { opacity: 0.72 },
  palette: {
    position: 'absolute', right: 10, bottom: 214, flexDirection: 'row', flexWrap: 'wrap', maxWidth: 190,
    justifyContent: 'flex-end', gap: 6, padding: 8, borderRadius: 18,
    backgroundColor: 'rgba(8,10,13,0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  paletteButton: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  paletteOn: { backgroundColor: 'rgba(255,49,95,0.35)' },
  paletteGlyph: { fontSize: 19 },
  distribute: {
    position: 'absolute', right: 10, bottom: 214, left: 14, padding: 12, borderRadius: 16, gap: 8,
    backgroundColor: 'rgba(8,10,13,0.94)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  distributeTitle: { color: '#9fb0bd', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  distributeItem: { paddingVertical: 9 },
  distributeText: { color: '#f2f6f9', fontSize: 14, fontWeight: '600' },
});

