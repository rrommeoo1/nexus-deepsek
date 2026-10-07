import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View,
  type NativeScrollEvent, type NativeSyntheticEvent, type ViewToken,
} from 'react-native';
import { CommentsSheet } from './CommentsSheet';
import { RemoteImage, RemoteImageSource, RemoteVideo, type MediaFit } from './PostMedia';
import { setPostReaction, setPostRepost, setPostSaved, sharePost } from '../lib/postInteractions';
import {
  audioAttributionFor, compactCount, mediaKindOf, mediaSourceForPath, postMediaItems,
  REACTION_GLYPHS, reactionTotal, relativeTime, SOCIAL_REACTIONS, viewerReaction,
  type MediaItem, type SocialPost,
} from '../lib/socialTypes';

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
export function ReelsReader({ posts, refreshing, onRefresh, onEndReached, loadingMore }: {
  posts: SocialPost[];
  refreshing: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  loadingMore: boolean;
}) {
  const [pageHeight, setPageHeight] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [fit, setFit] = useState<MediaFit>('cover');
  const [muted, setMuted] = useState(true);
  const viewability = useRef({ viewAreaCoveragePercentThreshold: 60 });

  const onViewableItemsChanged = useRef((info: { viewableItems: ViewToken[] }) => {
    const first = info.viewableItems.find((entry) => entry.isViewable);
    if (first && typeof first.index === 'number') setActiveIndex(first.index);
  });

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
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={viewability.current}
          onMomentumScrollEnd={onMomentumEnd}
          onEndReachedThreshold={0.8}
          onEndReached={onEndReached}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" progressViewOffset={8} />}
          renderItem={({ item, index }) => (
            <ReelPage
              post={item}
              height={pageHeight}
              active={index === activeIndex}
              fit={fit}
              muted={muted}
              onToggleMute={() => setMuted((value) => !value)}
              onToggleFit={() => setFit((value) => (value === 'cover' ? 'contain' : 'cover'))}
            />
          )}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#ffffff" style={styles.footer} /> : null}
        />
      ) : null}
    </View>
  );
}

/** One reel: the whole viewport, the picture, and the rail the reader actually uses. */
function ReelPage({ post, height, active, fit, muted, onToggleMute, onToggleFit }: {
  post: SocialPost;
  height: number;
  active: boolean;
  fit: MediaFit;
  muted: boolean;
  onToggleMute: () => void;
  onToggleFit: () => void;
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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [distributeOpen, setDistributeOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const mine = viewerReaction(summary);
  const plays = active && playing && isVideo;

  function fail(cause: unknown) {
    setNotice(cause instanceof Error ? cause.message : 'Acțiunea nu a putut fi trimisă.');
  }

  const react = (kind: string) => {
    const nextActive = mine !== kind;
    setPaletteOpen(false);
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
        <RemoteVideo item={cover} fit={fit} style={styles.media} active={plays} muted={muted} />
      ) : null}
      {cover && !isVideo ? <RemoteImage item={cover} fit={fit} style={styles.media} /> : null}
      {!cover ? <View style={styles.media} /> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pauză' : 'Redă clipul'}
        onPress={() => setPlaying((value) => !value)}
        style={styles.stage}
      />

      <View pointerEvents="none" style={styles.topPlate} />
      <View pointerEvents="none" style={styles.bottomPlate} />

      <View style={styles.chrome}>
        <Pressable accessibilityRole="button" accessibilityLabel="Mod de afișare a imaginii" onPress={onToggleFit} style={styles.disc}>
          <Text style={styles.discText}>{fit === 'cover' ? '⤢' : '⤡'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={muted ? 'Activează sunetul' : 'Oprește sunetul'} onPress={onToggleMute} style={styles.disc}>
          <Text style={styles.discText}>{muted ? '🔇' : '🔊'}</Text>
        </Pressable>
      </View>

      {isVideo && !plays ? (
        <View pointerEvents="none" style={styles.playState}><Text style={styles.playGlyph}>▶</Text></View>
      ) : null}

      <View style={styles.meta}>
        <View style={styles.creatorRow}>
          <View style={styles.creatorDisc}>
            <RemoteImageSource source={avatar} fit="cover" style={styles.creatorDiscImage} />
          </View>
          <View style={styles.creatorText}>
            <Text style={styles.creatorName} numberOfLines={1}>{name}</Text>
            <Text style={styles.creatorHandle} numberOfLines={1}>
              {`@${handle}`}{relativeTime(post.created_at) ? ` · ${relativeTime(post.created_at)}` : ''}
            </Text>
          </View>
        </View>
        {post.caption ? <Text style={styles.caption} numberOfLines={3}>{post.caption}</Text> : null}
        <Text style={styles.sound} numberOfLines={1}>{`♫ ${audioAttributionFor(post, name)}`}</Text>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </View>

      <View style={styles.rail}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reacționează"
          accessibilityState={{ selected: Boolean(mine) }}
          onPress={() => setPaletteOpen((open) => !open)}
          style={styles.railButton}
        >
          <Text style={styles.railGlyph}>{mine ? REACTION_GLYPHS[mine] : '🤍'}</Text>
          <Text style={styles.railCount}>{reactionTotal(summary) ? compactCount(reactionTotal(summary)) : ''}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Comentarii"
          onPress={() => setCommentsOpen(true)}
          style={styles.railButton}
        >
          <Text style={styles.railGlyph}>💬</Text>
          <Text style={styles.railCount}>{post.comment_count ? compactCount(post.comment_count) : ''}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Scoate din salvate' : 'Salvează'}
          accessibilityState={{ selected: saved }}
          onPress={save}
          style={styles.railButton}
        >
          <Text style={styles.railGlyph}>{saved ? '🔖' : '🏷'}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Distribuie"
          onPress={() => setDistributeOpen((open) => !open)}
          style={styles.railButton}
        >
          <Text style={[styles.railGlyph, reposted && styles.railGlyphOn]}>🔁</Text>
        </Pressable>

        {busy ? <ActivityIndicator color="#ffffff" style={styles.railSpinner} /> : null}
      </View>

      {paletteOpen ? (
        <View style={styles.palette}>
          {SOCIAL_REACTIONS.map((kind) => (
            <Pressable
              key={kind}
              accessibilityRole="button"
              accessibilityLabel={kind}
              accessibilityState={{ selected: mine === kind }}
              onPress={() => react(kind)}
              style={[styles.paletteButton, mine === kind && styles.paletteOn]}
            >
              <Text style={styles.paletteGlyph}>{REACTION_GLYPHS[kind]}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

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

      {commentsOpen ? <CommentsSheet post={post} onClose={() => setCommentsOpen(false)} /> : null}
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
  topPlate: { position: 'absolute', left: 0, right: 0, top: 0, height: 96, backgroundColor: 'rgba(0,0,0,0.34)' },
  bottomPlate: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 220, backgroundColor: 'rgba(0,0,0,0.46)' },
  chrome: { position: 'absolute', top: 14, right: 12, flexDirection: 'row', gap: 8 },
  disc: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.48)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  discText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  playState: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  playGlyph: { color: 'rgba(255,255,255,0.82)', fontSize: 54, fontWeight: '900' },
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
  sound: { color: 'rgba(255,255,255,0.74)', fontSize: 12 },
  notice: { color: '#ffc6c6', fontSize: 12, fontWeight: '600' },
  rail: { position: 'absolute', right: 10, bottom: 26, alignItems: 'center', gap: 14 },
  railButton: { alignItems: 'center', justifyContent: 'center', minWidth: 44, gap: 2 },
  railGlyph: { fontSize: 24 },
  railGlyphOn: { color: '#ff315f' },
  railCount: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  railSpinner: { marginTop: 4 },
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

