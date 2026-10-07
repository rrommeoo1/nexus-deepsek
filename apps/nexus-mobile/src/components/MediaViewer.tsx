import { StatusBar } from 'expo-status-bar';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { RemoteImage, RemoteVideo } from './PostMedia';
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
 * A 9:16 clip therefore plays on the whole screen with the complete frame visible (never cropped), on a
 * black stage, exactly like the web reader. The picture travels with the session through `RemoteImage`
 * / `RemoteVideo`, so a `/media/…` that needs a credential still resolves here.
 */
export function MediaViewer({ post, onClose }: { post: SocialPost | null; onClose: () => void }) {
  const items = post ? postMediaItems(post) : [];
  const media = items[0] ?? post?.media ?? null;
  const isVideo = mediaKindOf(media) === 'video';

  return (
    <Modal
      visible={post !== null}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.stage}>
        <StatusBar hidden />
        {post && media && isVideo ? (
          <RemoteVideo item={media} fit="contain" style={styles.media} active muted={false} nativeControls />
        ) : null}
        {post && media && !isVideo ? <RemoteImage item={media} fit="contain" style={styles.media} /> : null}
        {post && !media ? <Text style={styles.note}>Această postare nu are media de afișat.</Text> : null}

        <Pressable accessibilityRole="button" accessibilityLabel="Închide" onPress={onClose} style={styles.close}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>

        {post?.caption ? <Text style={styles.caption} numberOfLines={4}>{post.caption}</Text> : null}
      </View>
    </Modal>
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
  caption: { position: 'absolute', left: 16, right: 16, bottom: 28, color: '#f2f6f9', fontSize: 14, lineHeight: 20 },
  note: { color: '#96a2ad', fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
});
