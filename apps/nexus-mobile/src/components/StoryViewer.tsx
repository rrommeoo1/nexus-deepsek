import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { RemoteImage, RemoteImageSource, RemoteVideo } from './PostMedia';
import { initialsFor, mediaKindOf, mediaSourceForPath, type StoryView } from '../lib/socialTypes';
import { recordStoryView } from '../lib/stories';
import { openSocialProfile } from '../lib/profileNavigation';
import { useRelation } from '../lib/relations';
import { RelationButton } from './RelationButton';

/**
 * The full-screen story reader, drawn from `app.js:3392-3496` (markup and timing) and
 * `styles.css` `.storyViewer*` (geometry and colours):
 *
 *   #storyViewer[role=dialog][aria-modal][aria-label=Stories]  fixed, inset 0, background #000
 *   .storyViewerFrame   width min(100vw,520px), height 100dvh, radial-gradient(circle at 20% 20%,#16374d,#080b18 48%,#160c28)
 *   .storyProgressRail  left/right 9, top max(9px,safe-top), gap 4; bar 3px, radius 3, rgba(255,255,255,.30)
 *   .storyProgress b    the lit bar: #fff, box-shadow 0 0 7px rgba(85,238,255,.8)
 *   header              left/right 10, top safe+13, height 48, columns 38 / max-content / 1fr / 38px
 *   .storyViewerAvatar  36px, border 1.5px #51f4f4, radius 50 %, background #152536, initials 10px/800
 *   header b 12px · header small @handle 9px #d5e2e8 · header button 36px disc rgba(0,0,0,.18), 19px
 *   .storyViewerCaption left/right 18, bottom max(25px,safe), padding 12/14, radius 16, bg rgba(2,7,13,.28), 12px
 *   .storyHit           34 % wide, top 70, bottom 65 (previous on the left, next on the right)
 *   timing              image 5000 ms; floor 1500 ms (`app.js:3433-3448`)
 *
 * The `•••` options button of the web header is **not** drawn here: the only action the web wires
 * behind it is the archive call of the owner's own story (`app.js:2776`), and inventing a menu would
 * be a lie. It is listed as a remaining difference in `docs/parity-report/INDEX.md`.
 */
export function StoryViewer({ stories, startIndex, onClose, onSeen, viewerId }: {
  stories: StoryView[];
  startIndex: number;
  onClose: () => void;
  /** Called once per story whose progress the server accepted, so the rail can dim it. */
  onSeen?: (storyId: number) => void;
  /**
   * The reader the shelf belongs to (`StoriesAnswer.viewerId`). It is what makes the author's relation chip
   * safe: without it the viewer cannot tell whose story this is, so no chip is drawn at all.
   */
  viewerId?: number | null;
}) {
  const [index, setIndex] = useState(() => Math.max(0, Math.min(stories.length - 1, startIndex)));
  const [failed, setFailed] = useState<number | null>(null);
  /**
   * `env(safe-area-inset-top)` din CSS-ul web-ului, citit de pe device: browserul îl raportează 0, dar pe
   * telefonul de test insetul de sus este **150 px fizici (≈58 CSS px)**, adică exact zona de status bar.
   * Măsurat în sesiunea pe telefon: rail-ul și antetul la `top: 12/22` cădeau *sub* bara de status, iar
   * un tap pe butonul „Închide" (y=120 fizic < 150) era înghițit de sistem. De aceea ambele folosesc
   * inserția reală, cu pragurile din CSS (`max(9px, safe-top)` și `+13px`).
   */
  const insets = useSafeAreaInsets();
  const topInset = Math.max(9, insets.top);
  const bottomInset = Math.max(25, insets.bottom);
  /** The animated bar is a value, not a ref: it is read in render, which a ref may not be. */
  const [progress] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const story = stories[index] ?? null;
  const media = story?.media ?? null;
  const kind = mediaKindOf(media);
  const author = story?.author ?? null;
  const name = String(author?.display_name || author?.handle || 'Jungle Book');
  /**
   * The author of this frame, from the one store (`useRelation`): the same word the profile header and the
   * feed card print. The chip is drawn only when the shelf said whose stories these are and the frame is not
   * the reader's own — `deriveRelationUi` would answer `self` there, and a dead button over a story is noise.
   */
  const authorId = Number(story?.user_id ?? author?.id);
  const relation = useRelation(Number.isSafeInteger(authorId) && authorId > 0 ? authorId : null);
  const relationTarget = Number.isSafeInteger(authorId) && authorId > 0 && authorId !== Number(viewerId)
    && author?.handle
    ? { userId: authorId, handle: String(author.handle), name, persona: 'social' as const }
    : null;
  const avatar = mediaSourceForPath(author?.avatar);

  /** Every story that was watched is committed once, with the progress it really reached. */
  const commit = (target: StoryView | null, completed: boolean) => {
    const id = Number(target?.id);
    if (!Number.isSafeInteger(id) || id <= 0) return;
    recordStoryView(id, completed ? 1 : Math.min(0.89, Math.max(0, Number(target?.view_progress) || 0)), completed)
      .then((viewed) => { if (viewed) onSeen?.(id); })
      .catch(() => { /* a view that cannot be recorded is not invented in the UI */ });
  };

  const step = (delta: number, completed: boolean) => {
    commit(story, completed);
    const next = index + delta;
    if (next < 0 || next >= stories.length) { onClose(); return; }
    setIndex(next);
  };

  // One timer per frame, with the web's own duration, stopped when the frame changes or unmounts.
  useEffect(() => {
    if (!story) return;
    progress.setValue(0);
    const duration = 5000;
    animation.current = Animated.timing(progress, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: false });
    animation.current.start();
    timer.current = setTimeout(() => step(1, true), duration);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      animation.current?.stop();
    };
    // `step` only reads the current index; the effect is re-armed per frame on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, story?.id, kind]);

  const bars = useMemo(() => stories.map((_, i) => i), [stories]);
  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={() => { commit(story, false); onClose(); }} statusBarTranslucent>
      <View accessibilityLabel="Stories" style={styles.screen}>
        <View style={styles.frame}>
          {/* `radial-gradient(circle at 20% 20%,#16374d,#080b18 48%,#160c28)` */}
          <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <RadialGradient id="nxStoryFrame" cx="20%" cy="20%" r="95%">
                <Stop offset="0" stopColor="#16374d" />
                <Stop offset="0.48" stopColor="#080b18" />
                <Stop offset="1" stopColor="#160c28" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#nxStoryFrame)" />
          </Svg>

          <View style={[styles.progressRail, { top: topInset }]}>
            {bars.map((i) => (
              <View key={i} style={styles.progressTrack}>
                {i < index ? <View style={styles.progressDone} /> : null}
                {i === index ? (
                  <Animated.View
                    style={[styles.progressDone, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
                  />
                ) : null}
              </View>
            ))}
          </View>

          {kind === 'video' && media ? (
            <RemoteVideo item={media} fit="contain" style={styles.media} active muted={false} loop={false} onError={() => setFailed(index)} />
          ) : null}
          {kind === 'image' && media ? <RemoteImage item={media} fit="contain" style={styles.media} onError={() => setFailed(index)} /> : null}
          {!media ? (
            <View style={styles.fallback}>
              <View style={styles.fallbackDisc}><Text style={styles.fallbackInitials}>{initialsFor(name, author?.handle)}</Text></View>
              <Text style={styles.fallbackCaption}>{story?.caption || 'Jungle Book Story'}</Text>
            </View>
          ) : null}
          {failed === index ? <Text style={styles.fallbackNote}>Story-ul nu a putut fi afișat.</Text> : null}

          <View style={[styles.header, { top: topInset + 13 }]}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Profilul lui @${author?.handle || name}`} onPress={() => openSocialProfile(author?.handle, onClose)} style={styles.avatar}>
              {avatar ? <RemoteImageSource source={avatar} fit="cover" style={styles.avatarImage} /> : <Text style={styles.avatarInitials}>{initialsFor(name, author?.handle)}</Text>}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Profilul lui @${author?.handle || name}`} onPress={() => openSocialProfile(author?.handle, onClose)} style={styles.authorLink}>
              <Text style={styles.name} numberOfLines={1}>{name}</Text>
              <Text style={styles.handle} numberOfLines={1}>{`@${author?.handle || 'junglebook'}`}</Text>
            </Pressable>
            {relationTarget ? <RelationButton variant="compact" target={relationTarget} relation={relation} viewerUserId={viewerId ?? null} style={styles.headerRelation} /> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Închide" onPress={() => { commit(story, false); onClose(); }} style={styles.headerButton}>
              <Text style={styles.headerGlyph}>×</Text>
            </Pressable>
          </View>

          {story?.caption ? <View style={[styles.caption, { bottom: bottomInset }]}><Text style={styles.captionText}>{story.caption}</Text></View> : null}

          <Pressable accessibilityRole="button" accessibilityLabel="Story anterior" onPress={() => step(-1, false)} style={[styles.hit, styles.hitPrev]} />
          <Pressable accessibilityRole="button" accessibilityLabel="Story următor" onPress={() => step(1, false)} style={[styles.hit, styles.hitNext]} />
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  /** `.storyViewer{position:fixed;inset:0;display:grid;place-items:center;background:#000;color:#fff}` */
  screen: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  /** `.storyViewerFrame{position:relative;width:min(100vw,520px);height:100dvh;overflow:hidden}` */
  frame: { width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#080b18' },
  /** `.storyProgressRail{left:9px;right:9px;top:max(9px,safe-top);gap:4px}` */
  progressRail: { position: 'absolute', zIndex: 8, left: 9, right: 9, top: 12, flexDirection: 'row', gap: 4 },
  /** `.storyProgress{height:3px;flex:1;border-radius:3px;background:rgba(255,255,255,.30)}` */
  progressTrack: { height: 3, flex: 1, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.30)' },
  /** `.storyProgress b{background:#fff;box-shadow:0 0 7px rgba(85,238,255,.8)}` */
  progressDone: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%', backgroundColor: '#ffffff', boxShadow: '0 0 7px rgba(85,238,255,0.8)' },
  /** `.storyViewerMedia{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000}` */
  media: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  /** `.storyViewerFallback{inset:0;place-content:center;gap:22px;padding:52px}` + the 116px disc. */
  fallback: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 22, padding: 52, backgroundColor: '#060914' },
  fallbackDisc: {
    width: 116, height: 116, borderRadius: 58, borderWidth: 1, borderColor: '#52eff8',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b1424',
    boxShadow: '0 0 50px rgba(0,229,255,0.3)',
  },
  fallbackInitials: { color: '#ffffff', fontSize: 34, fontWeight: '800' },
  fallbackCaption: { maxWidth: 330, color: '#ffffff', fontSize: 18, lineHeight: 26, textAlign: 'center' },
  fallbackNote: { color: '#96a2ad', fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
  /** `.storyViewerFrame>header{left:10px;right:10px;top:safe+13px;height:48px;columns 38/max-content/1fr/38px;gap:7px}` */
  header: { position: 'absolute', zIndex: 9, left: 10, right: 10, top: 22, height: 48, flexDirection: 'row', alignItems: 'center', gap: 7 },
  authorLink: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44 },
  /** `.storyViewerAvatar{width:36px;height:36px;border:1.5px solid #51f4f4;border-radius:50%;background:#152536;font-size:10px;font-weight:800}` */
  avatar: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: '#51f4f4',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#152536',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  /** `.storyViewerFrame>header b{font-size:12px}` with the same text shadow. */
  name: {
    color: '#ffffff', fontSize: 12, fontWeight: '700', textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 9,
  },
  /** `.storyViewerFrame>header small{color:#d5e2e8;font-size:9px;overflow:hidden;text-overflow:ellipsis}` */
  handle: {
    flex: 1, minWidth: 0, color: '#d5e2e8', fontSize: 9, textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 9,
  },
  /** `.storyViewerFrame>header button{width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.18);font-size:19px}` */
  headerButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.18)', alignItems: 'center', justifyContent: 'center' },
  /**
   * The author's relation chip, at the end of the header. It keeps its own width (the name and the handle are
   * the ones that truncate) and sits before the close disc, so the thumb that closes the frame never lands on
   * a follow action.
   */
  headerRelation: { flexShrink: 0 },
  headerGlyph: { color: '#ffffff', fontSize: 19, lineHeight: 22, textShadowColor: '#000000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  /** `.storyViewerCaption{left:18px;right:18px;bottom:max(25px,safe);padding:12px 14px;border-radius:16px;background:rgba(2,7,13,.28);font-size:12px}` */
  caption: { position: 'absolute', zIndex: 8, left: 18, right: 18, bottom: 25, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: 'rgba(2,7,13,0.28)' },
  captionText: { color: '#ffffff', fontSize: 12, lineHeight: 17, textShadowColor: '#000000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 7 },
  /** `.storyHit{top:70px;bottom:65px;width:34%}` */
  hit: { position: 'absolute', zIndex: 5, top: 70, bottom: 65, width: '34%' },
  hitPrev: { left: 0 },
  hitNext: { right: 0 },
});


