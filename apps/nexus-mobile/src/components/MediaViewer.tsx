import { useCallback, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { RemoteImage, RemoteVideo } from './PostMedia';
import { decideViewerGesture } from '../lib/socialGesture';
import { mediaKindOf, postMediaItems, type SocialPost } from '../lib/socialTypes';

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
export function MediaViewer({ post, gallery, onClose }: {
  post: SocialPost | null;
  /** The gallery the reader walks; without one it is the single post it was opened on. */
  gallery?: SocialPost[];
  onClose: () => void;
}) {
  const items = useMemo(
    () => (gallery && gallery.length ? gallery : post ? [post] : []).filter((entry) => postMediaItems(entry).length > 0),
    [gallery, post],
  );

  return (
    <Modal
      visible={post !== null}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {post ? <GalleryViewer key={post.id} post={post} items={items} onClose={onClose} /> : null}
    </Modal>
  );
}

/**
 * The open reader. It is keyed by the post it was opened on, so its place in the gallery is the place of
 * that post: another card starts at its own frame without an effect having to correct it afterwards. The
 * two plates and the counter are shown whenever the gallery holds more than one frame, so a clip — whose
 * drags belong to its own controls — can still be walked.
 */
function GalleryViewer({ post, items, onClose }: {
  post: SocialPost;
  items: SocialPost[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(() => Math.max(0, items.findIndex((entry) => entry.id === post.id)));
  const [failedId, setFailedId] = useState<number | null>(null);
  const current = items[index] ?? post;
  const media = postMediaItems(current)[0] ?? current.media ?? null;
  const isVideo = mediaKindOf(media) === 'video';
  const failed = failedId === current.id;

  /** One place through the gallery, wrapping at both ends — `step()` of app.js:5114-5133. */
  const step = useCallback((offset: number) => {
    if (items.length < 2) return;
    setFailedId(null);
    setIndex((value) => (value + offset + items.length) % items.length);
  }, [items.length]);

  const flick = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) => !isVideo && viewerIntent(gesture.dx, gesture.dy),
    onMoveShouldSetPanResponderCapture: (_event, gesture) => !isVideo && viewerIntent(gesture.dx, gesture.dy),
    onPanResponderRelease: (_event, gesture) => {
      const decision = decideViewerGesture({ dx: gesture.dx, dy: gesture.dy });
      if (decision.action === 'step') step(decision.offset);
    },
    onPanResponderTerminate: () => {},
  }), [isVideo, step]);

  return (
    <View style={styles.stage} {...flick.panHandlers}>
      <StatusBar hidden />
      {media && isVideo ? (
        <RemoteVideo item={media} fit="contain" style={styles.media} active muted={false} nativeControls onError={() => setFailedId(current.id)} />
      ) : null}
      {media && !isVideo ? <RemoteImage item={media} fit="contain" style={styles.media} /> : null}
      {!media ? <Text style={styles.note}>Această postare nu are media de afișat.</Text> : null}
      {failed ? <Text style={styles.note}>Clipul nu a putut fi redat.</Text> : null}

      <Pressable accessibilityRole="button" accessibilityLabel="Închide" onPress={onClose} style={styles.close}>
        <Text style={styles.closeText}>×</Text>
      </Pressable>

      {items.length > 1 ? (
        <>
          <View style={styles.plates}>
            <Pressable accessibilityRole="button" accessibilityLabel="Media anterioară" onPress={() => step(-1)} style={styles.plate}>
              <Text style={styles.plateText}>‹</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Media următoare" onPress={() => step(1)} style={styles.plate}>
              <Text style={styles.plateText}>›</Text>
            </Pressable>
          </View>
          <Text style={styles.counter}>{`${index + 1} / ${items.length}`}</Text>
        </>
      ) : null}

      {current.caption ? <Text style={styles.caption} numberOfLines={4}>{current.caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  media: { width: '100%', height: '100%' },
  close: {
    position: 'absolute', top: 40, right: 18, width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: '#ffffff', fontSize: 28, lineHeight: 30, fontWeight: '700' },
  /** The two plates that walk the gallery; the web keeps its own prev/next affordances at the same edges. */
  plates: {
    position: 'absolute', left: 8, right: 8, top: '50%', marginTop: -26,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  plate: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  plateText: { color: '#ffffff', fontSize: 26, lineHeight: 30, fontWeight: '700' },
  /** Where the reader stands in the gallery, in the same place the closing button sits. */
  counter: {
    position: 'absolute', top: 48, alignSelf: 'center', color: '#d8e2ea', fontSize: 13, fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    overflow: 'hidden',
  },
  caption: { position: 'absolute', left: 16, right: 16, bottom: 28, color: '#f2f6f9', fontSize: 14, lineHeight: 20 },
  note: { color: '#96a2ad', fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
});
