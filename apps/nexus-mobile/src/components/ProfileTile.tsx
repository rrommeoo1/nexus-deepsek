import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MediaViewer } from './MediaViewer';
import { RemoteImage } from './PostMedia';
import { profileCompactCount, type ArchivePost } from '../lib/profileContent';
import { mediaKindOf, postMediaItems, type SocialPost } from '../lib/socialTypes';
import { socialTokens } from '../theme/social';

/**
 * One cell of the archive's grid (`profile-experience.js:229-258`): a square that shows the post's cover,
 * the two facts a clip adds — the play sign and how many people watched it, in the corners a thumb
 * already knows — the mark of a repost (`profileRepostBadge`, '⟳') and the mark of a pin the owner left
 * on it (`profileTilePinned`, '📌'). A tile with a photo draws the picture in `cover`; a tile with a clip
 * draws the stage and its sign, which is what the app already does for a clip in a card
 * (`PostCard.tsx:111`): the web's own `<video muted playsinline>` shows a still frame, and the phone has
 * no poster frame to draw without starting one decoder per cell. Pressing the tile opens the full-screen
 * reader over the tab's media, the web's `onOpenPost(id, posts)`.
 *
 * The pin *control* of the web (`data-pin-post`, `app.js:9319` `POST /api/posts/:id/pin`) is not drawn:
 * this app has no pin call in `lib/postInteractions`, and a button that opens nothing would be a door
 * painted on a wall. The mark of a post the payload says is pinned is drawn, because that is a reading.
 */
export function ProfileTile({ post, gallery, onOpen, pinnedFirst = false }: {
  post: ArchivePost;
  /** The media posts of the archive this tile was drawn from — the gallery the reader walks. */
  gallery?: SocialPost[];
  onOpen?: (post: SocialPost) => void;
  /**
   * `.profileTile.isPinnedFirst{outline:1px solid #2fbdb3;outline-offset:-1px}` (`applyOrder`,
   * `profile-experience.js:527`): on a tab that hoists the owner's pins the tile says so itself, because an
   * order nobody can explain is an order that looks broken.
   */
  pinnedFirst?: boolean;
}) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const cover = postMediaItems(post)[0] ?? post.media ?? null;
  const isVideo = mediaKindOf(cover) === 'video';
  const viewers = profileCompactCount(post.view_stats?.viewers);
  const pinned = Math.max(0, Number(post.pinned_at) || 0) > 0;
  const reposter = post.__repost ?? null;
  const open = () => { if (onOpen) onOpen(post); else setViewerOpen(true); };

  return (
    <View style={styles.tile}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isVideo ? 'Redă clipul pe tot ecranul' : 'Deschide media pe tot ecranul'}
        onPress={open}
        style={styles.open}
      >
        {!isVideo && failed ? <Text accessible={false} style={styles.unavailable}>Media nu a putut fi afișată.</Text> : null}
        {!isVideo && !failed ? (
          <RemoteImage item={cover} fit="cover" style={styles.fill} onError={() => setFailed(true)} />
        ) : null}

        {isVideo ? <Text accessible={false} style={styles.playChip}>▶</Text> : null}
        {isVideo && viewers ? (
          <Text accessible accessibilityLabel={`${viewers} vizualizări`} style={styles.viewsChip}>
            {`👁 ${viewers}`}
          </Text>
        ) : null}
        {reposter ? <Text accessible={false} style={styles.repostBadge}>⟳</Text> : null}
        {pinned ? <Text accessible={false} style={styles.pinnedMark}>📌</Text> : null}
        {/** `.profileTile.isPinnedFirst{outline:1px solid #2fbdb3;outline-offset:-1px}` — a ring inside the cell. */}
        {pinnedFirst ? <View pointerEvents="none" style={styles.pinnedFirst} /> : null}
      </Pressable>

      <MediaViewer post={viewerOpen ? post : null} gallery={gallery} onClose={() => setViewerOpen(false)} />
    </View>
  );
}

/**
 * `.ownerTile{position:relative;aspect-ratio:1;background:#101923;color:#dce8ec}` inside the grid's
 * `repeat(3,1fr)`: a tile takes one third of its row and its own height, with the corner marks of
 * `.profileTilePlay`, `.profileTileViews`, `.profileRepostBadge` and `.profileTilePinned` on top of it.
 */
const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: 0,
    aspectRatio: 1,
    backgroundColor: socialTokens.archive.tileSurface,
    overflow: 'hidden',
  },
  open: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
  unavailable: { color: socialTokens.archive.tileInk, fontSize: 11, textAlign: 'center', paddingHorizontal: 8 },
  /** `.profileTilePlay{left:7px;bottom:7px;width:26px;height:24px;border-radius:9px;font-size:10px}` */
  playChip: {
    position: 'absolute',
    left: socialTokens.archive.tileChipInset,
    bottom: socialTokens.archive.tileChipInset,
    width: socialTokens.archive.tilePlayWidth,
    height: socialTokens.archive.tilePlayHeight,
    borderRadius: socialTokens.archive.tilePlayRadius,
    backgroundColor: socialTokens.archive.tileChipSurface,
    color: socialTokens.archive.tileChipInk,
    fontSize: socialTokens.archive.tilePlaySize,
    lineHeight: socialTokens.archive.tilePlayHeight,
    textAlign: 'center',
  },
  /** `.profileTileViews{left:37px;bottom:7px;gap:4px;height:24px;padding:0 7px;border-radius:9px;font-size:11.5px}` */
  viewsChip: {
    position: 'absolute',
    left: socialTokens.archive.tileViewsStart,
    bottom: socialTokens.archive.tileChipInset,
    height: socialTokens.archive.tilePlayHeight,
    paddingHorizontal: socialTokens.archive.tileChipInset,
    borderRadius: socialTokens.archive.tilePlayRadius,
    backgroundColor: socialTokens.archive.tileChipSurface,
    color: socialTokens.archive.tileChipInk,
    fontSize: socialTokens.archive.tileViewsSize,
    lineHeight: socialTokens.archive.tilePlayHeight,
    overflow: 'hidden',
  },
  /** `.profileRepostBadge{top:6px;left:6px;padding:1px 5px;border-radius:9px;background:rgba(11,23,32,.8);color:#8ff5ee;font-size:11px}` */
  repostBadge: {
    position: 'absolute',
    top: socialTokens.archive.pinInset,
    left: socialTokens.archive.pinInset,
    paddingHorizontal: socialTokens.archive.repostBadgePadding,
    borderRadius: socialTokens.archive.repostBadgeRadius,
    backgroundColor: socialTokens.archive.repostBadgeSurface,
    color: socialTokens.archive.repostBadgeInk,
    fontSize: socialTokens.archive.repostBadgeSize,
    fontWeight: '700',
  },
  /** `.profileTilePinned{top:7px;left:7px;font-size:12px}` */
  pinnedMark: {
    position: 'absolute',
    top: socialTokens.archive.tileChipInset,
    left: socialTokens.archive.tileChipInset,
    fontSize: socialTokens.archive.tilePinnedSize,
  },
  /**
   * `.profileTile.isPinnedFirst{outline:1px solid #2fbdb3;outline-offset:-1px}`: an outline drawn inside the
   * cell's own edge, so it neither covers a neighbour nor changes a single measurement of the row.
   */
  pinnedFirst: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderColor: socialTokens.archive.tilePinnedFirstEdge,
  },
});
