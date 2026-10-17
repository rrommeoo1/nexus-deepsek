import { useCallback, useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Keyboard, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { CommentsSheet } from './CommentsSheet';
import { ReactionControl } from './ReactionControl';
import { RemoteImage, RemoteImageSound, RemoteImageSource, RemoteVideo } from './PostMedia';
import { SolidViewerIcon } from './SolidViewerIcon';
import { PostDecorations } from './PostDecorations';
import { decideViewerGesture } from '../lib/socialGesture';
import { openSocialProfile } from '../lib/profileNavigation';
import { setPostReaction, setPostRepost, setPostSaved, sharePost } from '../lib/postInteractions';
import { audioAttributionFor, compactCount, initialsFor, mediaKindOf, mediaSourceForPath, postMediaItems, viewerReaction, type ReactionSummary, type SocialPost } from '../lib/socialTypes';

/**
 * The full-screen media reader, drawn to the values the web already uses for its own viewer:
 *
 *   feed-surface.css:2616-2623  `body .mediaViewer.reelViewer … .viewerStage>video, img
 *                               {object-fit:contain;object-position:center center;background:#000}`
 *   feed-surface.css:2579       `body .reelViewer.viewerCommentsOpen .viewerStage>video` keeps `contain`
 *   post-detail.css:21          `.postDetailMedia{object-fit:contain;max-height:58vh}` (the same "show the
 *                               whole frame" rule the viewer follows)
 *
 * The reader walks a gallery, the way the web's does: `openMediaViewer(items, index)` is handed the media
 * posts of the surface the reader came from and keeps the ones that really carry media (app.js:4911-4918),
 * and one flick moves one place through that list, wrapping at both ends (`step()`, app.js:5114-5133), with
 * `decideViewerGesture` choosing the axis the flick meant.
 *
 * A 9:16 clip therefore plays on the whole screen with the complete frame visible (never cropped), on a
 * black stage, exactly like the web reader. The picture travels with the session through `RemoteImage`
 * / `RemoteVideo`, so a `/media/…` that needs a credential still resolves here.
 * One honest note about the flick: a clip is played by the platform's own controls (`nativeControls`), and
 * the seek bar of those controls is dragged horizontally, so on a clip every drag is left to the controls
 * and the two side plates step instead. A picture has no such strip, which is where the flick is read.
 */

/** How far a flick has to move before the reader takes it over: well under the 48px that decides it. */
const CLAIM_TRAVEL = 24;

/** Whether a flick travelled far enough in either axis to be the reader's rather than a stray touch. */
function viewerIntent(dx: number, dy: number): boolean {
  return Math.max(Math.abs(dx), Math.abs(dy)) >= CLAIM_TRAVEL;
}
export function MediaViewer({ post, gallery, onClose, onCommentCreated, onOpenThread, onOpenCommentsRoot, embedded = false, startWithComments = false }: {
  post: SocialPost | null;
  /** The gallery the reader walks; without one it is the single post it was opened on. */
  gallery?: SocialPost[];
  startWithComments?: boolean;
  onClose: () => void;
  onCommentCreated?: (postId: number) => void;
  onOpenThread?: (post: SocialPost, commentId: number) => void;
  onOpenCommentsRoot?: (post: SocialPost) => void;
  embedded?: boolean;
}) {
  const items = useMemo(
    () => (gallery && gallery.length ? gallery : post ? [post] : []).filter((entry) => postMediaItems(entry).length > 0),
    [gallery, post],
  );

  if (embedded) return post ? <GalleryViewer key={post.id} post={post} items={items} onClose={onClose} onCommentCreated={onCommentCreated} onOpenThread={onOpenThread} onOpenProfile={(handle) => openSocialProfile(handle)} startWithComments={startWithComments} /> : null;
  return (
    <Modal
      visible={post !== null}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {post ? <GalleryViewer key={post.id} post={post} items={items} onClose={onClose} onCommentCreated={onCommentCreated} onOpenThread={onOpenThread} onOpenProfile={(handle) => openSocialProfile(handle, onClose)} onOpenCommentsRoot={onOpenCommentsRoot} startWithComments={startWithComments} /> : null}
    </Modal>
  );
}

/**
 * The open reader. It is keyed by the post it was opened on, so its place in the gallery is the place of
 * that post: another card starts at its own frame without an effect having to correct it afterwards. The
 * two plates and the counter are shown whenever the gallery holds more than one frame, so a clip — whose
 * drags belong to its own controls — can still be walked.
 */
function GalleryViewer({ post, items, onClose, onCommentCreated, onOpenThread, onOpenProfile, onOpenCommentsRoot, startWithComments }: {
  post: SocialPost;
  items: SocialPost[];
  onClose: () => void;
  onCommentCreated?: (postId: number) => void;
  onOpenThread?: (post: SocialPost, commentId: number) => void;
  onOpenProfile: (handle: string) => void;
  onOpenCommentsRoot?: (post: SocialPost) => void;
  startWithComments: boolean;
}) {
  const insets = useSafeAreaInsets();
  // The shortcut follows the Android navigation inset. Keep the creator and soundtrack above
  // its top edge, preserving their existing 8/9 px clearance when the inset is small.
  const commentBottom = Math.max(9, insets.bottom);
  const contentBottom = commentBottom + 58;
  const [index, setIndex] = useState(() => Math.max(0, items.findIndex((entry) => entry.id === post.id)));
  const [failedId, setFailedId] = useState<number | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(startWithComments);
  const [commentCounts, setCommentCounts] = useState<Record<number, number>>({});
  const [commentKeyboardOpen, setCommentKeyboardOpen] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const shown = Keyboard.addListener('keyboardDidShow', () => setCommentKeyboardOpen(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setCommentKeyboardOpen(false));
    return () => { shown.remove(); hidden.remove(); };
  }, []);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [reactionByPost, setReactionByPost] = useState<Record<number, ReactionSummary>>({});
  const [savedByPost, setSavedByPost] = useState<Record<number, boolean>>({});
  const [repostedByPost, setRepostedByPost] = useState<Record<number, boolean>>({});
  const [distributeOpen, setDistributeOpen] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [notice, setNotice] = useState('');
  const current = items[index] ?? post;
  const openComments = () => onOpenCommentsRoot ? onOpenCommentsRoot(current) : setCommentsOpen(true);
  const commentCount = Math.max(Number(current.comment_count ?? 0), commentCounts[current.id] ?? 0);
  const media = postMediaItems(current)[0] ?? current.media ?? null;
  const isVideo = mediaKindOf(media) === 'video';
  const failed = failedId === current.id;
  const avatar = mediaSourceForPath(current.author?.avatar);
  const handle = current.author?.handle || 'nexus';
  const name = current.author?.display_name || handle;
  const summary = reactionByPost[current.id] ?? current.reactions ?? null;
  const saved = savedByPost[current.id] ?? Boolean(current.saved_by_me);
  const reposted = repostedByPost[current.id] ?? Boolean(current.reposted_by_me);

  function fail(cause: unknown) {
    setNotice(cause instanceof Error ? cause.message : 'Acțiunea nu a putut fi trimisă.');
  }

  const react = (kind: string) => {
    const active = viewerReaction(summary) !== kind;
    setReactionByPost((previous) => ({ ...previous, [current.id]: { ...(summary ?? {}), viewer_reaction: active ? kind : null } }));
    setPostReaction(current.id, kind, active)
      .then((answer) => setReactionByPost((previous) => ({ ...previous, [current.id]: { counts: answer.counts, viewer_reaction: answer.viewer_reaction } })))
      .catch(fail);
  };

  const save = () => {
    setSavedByPost((previous) => ({ ...previous, [current.id]: !saved }));
    setPostSaved(current.id, !saved)
      .then((answer) => setSavedByPost((previous) => ({ ...previous, [current.id]: answer.saved })))
      .catch((cause) => { setSavedByPost((previous) => ({ ...previous, [current.id]: saved })); fail(cause); });
  };

  const repost = () => {
    setDistributeOpen(false);
    setRepostedByPost((previous) => ({ ...previous, [current.id]: !reposted }));
    setPostRepost(current.id, !reposted)
      .then((answer) => setRepostedByPost((previous) => ({ ...previous, [current.id]: Boolean(answer.reposted_by_me ?? answer.active) })))
      .catch((cause) => { setRepostedByPost((previous) => ({ ...previous, [current.id]: reposted })); fail(cause); });
  };

  /** One place through the gallery, wrapping at both ends — `step()` of app.js:5114-5133. */
  const step = useCallback((offset: number) => {
    if (items.length < 2) return;
    setFailedId(null);
    setCommentsOpen(false);
    setDistributeOpen(false);
    setCaptionExpanded(false);
    setNotice('');
    setPlaying(true);
    setIndex((value) => (value + offset + items.length) % items.length);
  }, [items.length]);

  const flick = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) => !isVideo && !commentsOpen && viewerIntent(gesture.dx, gesture.dy),
    onMoveShouldSetPanResponderCapture: (_event, gesture) => !isVideo && !commentsOpen && viewerIntent(gesture.dx, gesture.dy),
    onPanResponderRelease: (_event, gesture) => {
      const decision = decideViewerGesture({ dx: gesture.dx, dy: gesture.dy });
      if (decision.action === 'step') step(decision.offset);
    },
    onPanResponderTerminate: () => {},
  }), [commentsOpen, isVideo, step]);

  return (
    <View style={styles.stage} {...flick.panHandlers}>
      <StatusBar style="light" />
      <View style={[styles.mediaArea, commentsOpen && styles.mediaAreaComments]}>
        {media && isVideo ? (
          <RemoteVideo key={current.id} item={media} fit={commentsOpen ? 'contain' : 'portrait-cover'} style={styles.media} active={playing && !failed} muted={muted} soundtrack={current.external_audio} onError={() => setFailedId(current.id)} onAudioError={setNotice} />
        ) : null}
        {media && !isVideo ? <RemoteImage item={media} fit="contain" style={styles.media} onError={() => setFailedId(current.id)} /> : null}
        {media && !isVideo ? <RemoteImageSound key={current.id} soundtrack={current.external_audio} active={!failed && !commentsOpen} muted={muted} onAudioError={setNotice} /> : null}
        {!media ? <Text style={styles.note}>Această postare nu are media de afișat.</Text> : null}
        {failed ? <Text style={styles.note}>Fișierul media nu a putut fi încărcat.</Text> : null}
        {isVideo ? <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pauză' : 'Redă clipul'} onPress={() => setPlaying((value) => !value)} style={StyleSheet.absoluteFill} /> : null}
        {!playing && isVideo ? <View pointerEvents="none" style={styles.pauseMark}><SolidViewerIcon kind="play" size={52} /></View> : null}
        {!commentsOpen ? (
          <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs><LinearGradient id="nxViewerVeil" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#000000" stopOpacity={0.42} />
              <Stop offset="24%" stopColor="#000000" stopOpacity={0} />
              <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
            </LinearGradient></Defs>
            <Rect width="100%" height="100%" fill="url(#nxViewerVeil)" />
          </Svg>
        ) : null}
        <PostDecorations post={current} fit={isVideo && !commentsOpen ? 'cover' : 'contain'} />
      </View>

      {!commentsOpen ? (
        <>
          <Pressable accessibilityRole="button" accessibilityLabel="Înapoi la feed" onPress={onClose} style={[styles.back, { top: Math.max(10, insets.top) }]}>
            <SolidViewerIcon kind="back" size={22} />
          </Pressable>

          <View style={[styles.rail, { right: Math.max(6, insets.right), bottom: contentBottom }]}>
            <Pressable accessibilityRole="button" onPress={() => onOpenProfile(current.author?.handle || '')} style={styles.railAvatar} accessibilityLabel={`Profilul lui @${handle}`}>
              {avatar ? <RemoteImageSource source={avatar} fit="cover" style={styles.railAvatarImage} />
                : <Text style={styles.railAvatarText}>{initialsFor(name, handle)}</Text>}
            </Pressable>
            <ReactionControl variant="rail" summary={summary} onReact={react} />
            <Pressable accessibilityRole="button" accessibilityLabel="Comentarii" onPress={openComments} style={styles.railButton}>
              <SolidViewerIcon kind="comment" /><Text style={styles.railCount}>{compactCount(commentCount)}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={saved ? 'Scoate din salvate' : 'Salvează'} accessibilityState={{ selected: saved }} onPress={save} style={styles.railButton}>
              <SolidViewerIcon kind="save" color={saved ? '#ff315f' : '#ffffff'} /><Text accessible={false} style={styles.metricPlaceholder}>•</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Redistribuie sau distribuie" onPress={() => setDistributeOpen((open) => !open)} style={styles.railButton}>
              <SolidViewerIcon kind="share" color={reposted ? '#ff315f' : '#ffffff'} /><Text style={styles.railCount}>{compactCount(current.reposts ?? 0)}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`${muted ? 'Activează' : 'Oprește'} sunetul · ${audioAttributionFor(current, name)}`} onPress={() => setMuted((value) => !value)} style={styles.musicDisc}>
              <SolidViewerIcon kind={muted ? 'mute' : 'sound'} />
            </Pressable>
          </View>

          <View style={[styles.creator, { bottom: contentBottom + 1 }]}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Profilul lui @${handle}`} onPress={() => onOpenProfile(current.author?.handle || '')}><Text style={styles.creatorName} numberOfLines={1}>{name}</Text></Pressable>
            {current.caption ? <Pressable accessibilityRole="button" accessibilityLabel={captionExpanded ? 'Restrânge descrierea' : 'Extinde descrierea'} onPress={() => setCaptionExpanded((value) => !value)}>
              <Text style={styles.caption} numberOfLines={captionExpanded ? undefined : 2}>{current.caption}</Text>
            </Pressable> : null}
            {current.caption ? <Pressable accessibilityRole="button" accessibilityLabel="Vezi traducerea" onPress={() => setNotice('Traducerea pe dispozitiv nu este disponibilă în această aplicație.')}><Text style={styles.translate}>Vezi traducerea</Text></Pressable> : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          </View>

          <Pressable accessibilityRole="button" accessibilityLabel="Adaugă un comentariu" onPress={openComments} style={[styles.commentShortcut, { bottom: commentBottom }]}>
            <Text style={styles.commentShortcutText}>Adaugă un comentariu…</Text><SolidViewerIcon kind="comment" size={21} />
          </Pressable>

          {distributeOpen ? <View style={styles.distribute}>
            <Pressable accessibilityRole="button" accessibilityLabel={reposted ? 'Anulează redistribuirea' : 'Redistribuie în feed'} onPress={repost} style={styles.distributeItem}><Text style={styles.distributeText}>{reposted ? 'Anulează redistribuirea' : 'Redistribuie în feed'}</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Distribuie în afara Nexus" onPress={() => { setDistributeOpen(false); sharePost(current.id).catch(fail); }} style={styles.distributeItem}><Text style={styles.distributeText}>Distribuie în afara Nexus</Text></Pressable>
          </View> : null}
        </>
      ) : (
        <View style={[styles.commentsPanel, commentKeyboardOpen && styles.commentsPanelKeyboard]}>
          <View style={styles.commentPostHeader}>
            <Pressable accessibilityRole="button" accessibilityLabel="Înapoi la media" onPress={() => setCommentsOpen(false)} style={styles.commentBack}>
              <SolidViewerIcon kind="back" size={19} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Profilul lui @${handle}`} onPress={() => onOpenProfile(current.author?.handle || '')} style={styles.commentIdentity}>
              <View style={styles.commentAvatar}>
                {avatar ? <RemoteImageSource source={avatar} fit="cover" style={styles.railAvatarImage} />
                  : <Text style={styles.commentAvatarText}>{initialsFor(name, handle)}</Text>}
              </View>
              <View style={styles.commentCreatorText}>
                <Text style={styles.commentCreatorName} numberOfLines={1}>{name}</Text>
                <Text style={styles.commentCreatorHandle} numberOfLines={1}>{`@${handle}`}</Text>
              </View>
            </Pressable>
            <View style={styles.commentPostActions}>
              <ReactionControl variant="card" summary={summary} onReact={react} />
              <View style={styles.commentPostMetric}><SolidViewerIcon kind="comment" size={19} /><Text style={styles.commentPostCount}>{compactCount(commentCount) || '0'}</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel={reposted ? 'Anulează redistribuirea' : 'Redistribuie'} onPress={repost} style={styles.commentPostMetric}><SolidViewerIcon kind="repost" size={19} color={reposted ? '#ff315f' : '#ffffff'} /><Text style={styles.commentPostCount}>{compactCount(current.reposts ?? 0) || '0'}</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={saved ? 'Scoate din salvate' : 'Salvează'} onPress={save} style={styles.commentPostMetric}><SolidViewerIcon kind="save" size={19} color={saved ? '#ff315f' : '#ffffff'} /></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Distribuie" onPress={() => sharePost(current.id).catch(fail)} style={styles.commentPostMetric}><SolidViewerIcon kind="share" size={19} /></Pressable>
            </View>
          </View>
          <CommentsSheet key={current.id} post={current} presentation="viewer" onClose={() => setCommentsOpen(false)} onOpenProfile={onOpenProfile} onOpenThread={onOpenThread ? (commentId) => onOpenThread(current, commentId) : undefined} onCommentCreated={(postId) => {
            setCommentCounts((previous) => ({ ...previous, [postId]: Math.max(previous[postId] ?? 0, Number(current.comment_count ?? 0)) + 1 }));
            onCommentCreated?.(postId);
          }} onCountSeen={(postId, count) => setCommentCounts((previous) =>
            (previous[postId] ?? 0) >= count ? previous : { ...previous, [postId]: count }
          )} />
        </View>
      )}

      {items.length > 1 && !commentsOpen ? (
        <View pointerEvents="box-none" style={styles.galleryNav}>
          <Pressable accessibilityRole="button" accessibilityLabel="Media anterioară" onPress={() => step(-1)} style={styles.galleryEdge} />
          <Pressable accessibilityRole="button" accessibilityLabel="Media următoare" onPress={() => step(1)} style={styles.galleryEdge} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: '#000000' },
  mediaArea: { position: 'absolute', left: 0, right: 0, top: 0, height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000', overflow: 'hidden' },
  mediaAreaComments: { height: '34%' },
  media: { width: '100%', height: '100%' },
  pauseMark: { position: 'absolute', alignSelf: 'center', top: '45%' },
  back: { position: 'absolute', left: 10, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.08)' },
  rail: { position: 'absolute', top: 92, bottom: 67, width: 58, alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  railAvatar: { width: 62, height: 62, borderRadius: 31, padding: 3, borderWidth: 3, borderColor: '#8b39f5', backgroundColor: '#080c13', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 8, transform: [{ translateY: -4 }] },
  railAvatarImage: { width: '100%', height: '100%', borderRadius: 28 },
  railAvatarText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
  railButton: { width: 56, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 1 },
  railCount: { color: '#ffffff', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  metricPlaceholder: { color: 'transparent', fontSize: 11, lineHeight: 14 },
  musicDisc: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: 'rgba(255,255,255,0.42)', backgroundColor: '#0a0b0e', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  creator: { position: 'absolute', left: 18, right: 76, bottom: 68, alignItems: 'flex-start' },
  creatorName: { color: '#ffffff', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  caption: { color: '#ffffff', fontSize: 13, lineHeight: 18 },
  translate: { color: 'rgba(255,255,255,0.86)', fontSize: 10, minHeight: 22, paddingVertical: 1 },
  notice: { color: '#ffc6c6', fontSize: 11 },
  commentShortcut: { position: 'absolute', left: 12, right: 12, height: 50, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', backgroundColor: 'rgba(5,8,6,0.66)', paddingLeft: 18, paddingRight: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  commentShortcutText: { color: 'rgba(255,255,255,0.72)', fontSize: 14, fontWeight: '500' },
  distribute: { position: 'absolute', right: 68, bottom: 80, minWidth: 186, padding: 8, borderRadius: 14, backgroundColor: 'rgba(8,10,13,0.94)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  distributeItem: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  distributeText: { color: '#ffffff', fontSize: 13 },
  commentsPanel: { position: 'absolute', left: 0, right: 0, top: '34%', bottom: 0 },
  commentsPanelKeyboard: { top: 0 },
  commentPostHeader: { backgroundColor: '#0b0d10' },
  commentBack: { position: 'absolute', zIndex: 5, left: 8, top: 9, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  commentIdentity: { minHeight: 50, paddingTop: 4, paddingBottom: 2, paddingLeft: 52, paddingRight: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111820' },
  commentAvatarText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  commentCreatorText: { flex: 1 },
  commentCreatorName: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  commentCreatorHandle: { color: '#8d9298', fontSize: 11 },
  commentPostActions: { height: 40, minHeight: 40, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 2 },
  commentPostMetric: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  commentPostCount: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  galleryNav: { position: 'absolute', left: 0, right: 0, top: '35%', bottom: 80, flexDirection: 'row', justifyContent: 'space-between' },
  galleryEdge: { width: 12, height: '100%' },
  note: { color: '#96a2ad', fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
});
