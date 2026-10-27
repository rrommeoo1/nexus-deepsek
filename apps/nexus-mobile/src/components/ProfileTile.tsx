import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { GestureResponderHandlers } from 'react-native';
import { router } from 'expo-router';
import { RemoteImage } from './PostMedia';
import { SolidViewerIcon } from './SolidViewerIcon';
import { ProfileTextTile } from './ProfileTextTile';
import { profileCompactCount, repostAttribution, type ArchivePost } from '../lib/profileContent';
import { mediaKindOf, postMediaItems, type MediaItem } from '../lib/socialTypes';
import { stageFor } from '../lib/postPresentation';
import { socialTokens } from '../theme/social';

/**
 * The door a cell carries when the grid it belongs to can be walked: the profile whose order the reader
 * is reading, the tab and reading that order came from, and *which cell* was pressed — `key`, the
 * `archiveKey` of the cell, which tells a repost from the post it carries. The place the wall drew the cell
 * in is deliberately not part of the door: the reader fetches the archive again, and a place is a fact
 * about a list that the next fetch can already have changed (`walkAnchor` in `lib/profileContent.ts`).
 */
export type ProfileTileDoor = { handle: string; key: string; tab: string; reading: string };

/**
 * What the owner may do with one cell while the grid is being arranged (`ProfileScreen`, long press).
 *
 * Every word here is decided by `lib/profileGrid.ts` (`manageActions`), not by this component: the tile
 * paints the controls it is handed and never decides on its own that a control exists. The drag is not
 * one of these controls: it is `handle`, below, and it lives on its own surface so that a pin or a
 * deletion can never be mistaken for the start of a drag.
 */
export type ProfileTileManage = {
  pinned: boolean;
  canPin: boolean;
  canDelete: boolean;
  pinWord: string;
  busy: boolean;
  onPin: () => void;
  onDelete: () => void;
};

/**
 * One cell of the profile archive.
 *
 * The grid is a wall of 9:16 *previews*, not a second reading surface: a photo or a clip shows its
 * own frame, a text-first post shows a quiet cover in its chosen theme, and the only printed number is
 * the view count the server already owns — in the corner the web also uses for it
 * (`profile-experience.css` `.profileTileViews`). Captions, author rows, reaction bars and comment
 * controls live in the Post, never in the cell.
 *
 * Three shapes, one component
 * ---------------------------
 * * **the door** (normal mode): the whole cell is a `Pressable`. A press opens this exact post through
 *   `/post/[id]` with the cell's own identity and the order it was opened from, and a press *held* for
 *   `holdMs` hands the grid to the owner (`onManage`).
 * * **the arranged cell** (`manage`): a plain `View` with a pin chip, a delete chip and a drag handle.
 *   The handle is its own responder (`handle`), so a drag can only start where the grip is drawn — a
 *   pin tap can no longer become a drag, and a drag can no longer be a scroll.
 * * **the carried cell** (`ghost`): the face alone, drawn by the screen in an overlay that follows the
 *   finger. It takes no touch at all.
 *
 * `dragging` is the cell the finger holds: its face is gone (the overlay is drawing it), its controls
 * are gone (they cannot be tapped mid-gesture), and what is left is the hole the drag will leave plus
 * the handle it is being held by. The handle *must* stay mounted: the native view is the gesture's own
 * touch target, and unmounting it mid-drag is exactly how a tile used to be left stuck under a finger.
 */
export function ProfileTile({ post, pinnedFirst = false, door, onManage, holdMs = 500, manage, handle, dragging = false, dragLabel = '', ghost = false }: {
  post: ArchivePost;
  /** A pinned-first tab keeps a thin ring; it is part of the grid's explanation, not a badge. */
  pinnedFirst?: boolean;
  door?: ProfileTileDoor | null;
  /**
   * A press held for this long: the owner's arrangement of this grid. Absent on somebody else's grid.
   * Half a second, not a second: a hold that must last exactly one second races the finger's own lift,
   * and the race was lost often enough to open the post instead of the arrangement.
   */
  onManage?: () => void;
  holdMs?: number;
  manage?: ProfileTileManage | null;
  /** The drag surface: responder props for the grip. Only a cell the owner may arrange carries one. */
  handle?: GestureResponderHandlers | null;
  /** This cell is the one being dragged: its face rides the overlay and the hole stays to mark the place. */
  dragging?: boolean;
  /** What that hole says to a screen reader, e.g. `Poziția 2 din 13`. */
  dragLabel?: string;
  /** The face alone, for the overlay that follows the finger. */
  ghost?: boolean;
}) {
  const cover = postMediaItems(post).find((item) => mediaKindOf(item) !== 'audio') ?? null;
  const isVideo = mediaKindOf(cover) === 'video';
  const viewers = profileCompactCount(post.view_stats?.viewers);
  /**
   * What a cell shows is the post's own kind, not the guess "no picture, so nothing".
   *
   * `stageFor` is the classifier the feed and the reader already use: a page of words (`text`), an
   * authored article that happens to carry photographs (`article`), a clip (`reel`) or a picture
   * (`media`). A cell is a *page* when it has no picture at all — and also when it is an article, whose
   * identity is the page rather than the picture inside it (owner's rule, 26 October 2026: a text post
   * with inline pictures must not become a photo thumbnail with the article reduced to a caption).
   * A soundtrack alone is not a picture either, so a post whose only attachment is audio reads as words.
   */
  const article = Boolean(cover) && stageFor(post) === 'article';
  const plate: MediaItem | null = article ? cover : null;
  const words = !cover || article;
  const arranging = Boolean(manage);
  /**
   * Whose share this cell is (`repostAttribution`): printed as a chip over a picture, and set into the
   * paper by `ProfileTextTile` for a page of words — one line either way, never both.
   */
  const attribution = repostAttribution(post);
  const open = () => {
    router.push({
      pathname: '/post/[id]',
      params: door
        ? { id: String(post.id), key: door.key, profile: door.handle, tab: door.tab, reading: door.reading }
        : { id: String(post.id) },
    });
  };

  /** The face of the cell: its page or frame, the real count and the ring of a hoisted pin. */
  const face = (
    <>
      {words ? (
        <ProfileTextTile post={post} media={plate} />
      ) : cover && !isVideo ? (
        <RemoteImage item={cover} fit="cover" style={styles.fill} />
      ) : (
        <View style={[styles.fill, styles.videoPlate]}>
          <View style={styles.playDisc}>
            <View style={styles.playGlyph} />
          </View>
        </View>
      )}

      {cover && viewers ? (
        <View
          pointerEvents="none"
          style={[styles.viewsChip, arranging && styles.viewsChipLifted]}
          accessibilityLabel={`${viewers} vizualizări`}
        >
          <SolidViewerIcon kind="views" size={socialTokens.archive.tileViewsGlyph} color={socialTokens.archive.tileChipInk} />
          <Text allowFontScaling={false} style={styles.viewsText}>{viewers}</Text>
        </View>
      ) : null}

      {/** A share says whose it is, in the corner the count never uses (`repostAttribution`). */}
      {attribution && !words ? (
        <View
          pointerEvents="none"
          style={styles.repostChip}
          accessibilityLabel={attribution}
        >
          <Text allowFontScaling={false} numberOfLines={1} ellipsizeMode="tail" style={styles.repostChipText}>
            {`⟳ ${attribution}`}
          </Text>
        </View>
      ) : null}

      {pinnedFirst ? <View pointerEvents="none" style={styles.pinnedFirst} /> : null}
    </>
  );

  /**
   * The arranged cell: a plain responder-less `View` whose whole job is to hold the face, the two
   * actions and the grip. The grip is the *only* drag surface (`handle`), the two actions are their own
   * `Pressable`s, and neither can start the other. While the cell is carried (`dragging`) it keeps the
   * grip mounted and shows the hole the drag will leave, because the native grip view is the touch
   * target the gesture is attached to.
   */
  if (manage) {
    return (
      <View
        accessibilityRole="button"
        accessibilityLabel={dragging ? (dragLabel || `Locul ${post.id}`) : `Postarea ${post.id} din grilă`}
        accessibilityHint={dragging
          ? undefined
          : 'Butonul de mutare, din colț, ține locul de tragere. Butoanele de jos o fixează sau o șterg.'}
        style={[styles.tile, dragging && styles.tileHole]}
      >
        {dragging ? null : face}
        {dragging ? null : (
          <View style={styles.manageStrip}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${manage.pinWord} postarea ${post.id}`}
              accessibilityState={{ selected: manage.pinned, disabled: !manage.canPin || manage.busy }}
              disabled={!manage.canPin || manage.busy}
              onPress={manage.onPin}
              style={[styles.manageChip, manage.pinned && styles.manageChipOn, !manage.canPin && styles.manageChipOff]}
            >
              <Text allowFontScaling={false} style={styles.manageChipGlyph}>📌</Text>
            </Pressable>
            {manage.canDelete ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Șterge postarea ${post.id}`}
                accessibilityState={{ disabled: manage.busy }}
                disabled={manage.busy}
                onPress={manage.onDelete}
                style={[styles.manageChip, styles.manageChipDelete]}
              >
                <Text allowFontScaling={false} style={styles.manageChipGlyph}>🗑️</Text>
              </Pressable>
            ) : null}
          </View>
        )}
        {/**
         * The grip. A cell this account may not place (somebody else's post that is not a repost) has no
         * grip at all, so there is no surface to pull: `manageActions.canPlace` decides that, not this
         * component.
         */}
        {handle ? (
          <View
            {...handle}
            accessibilityRole="button"
            accessibilityLabel={`Mută postarea ${post.id}`}
            accessibilityHint="Ține apăsat aici și trage ca s-o muți. Restul celulei rămâne pentru butoane."
            style={[styles.manageHandle, dragging && styles.manageHandleHeld]}
          >
            <Text allowFontScaling={false} style={styles.manageHandleGlyph}>≡</Text>
          </View>
        ) : null}
      </View>
    );
  }

  /**
   * The carried cell's face: the overlay the screen moves with the finger. It takes no touch, so what is
   * under the finger stays the grip that owns the gesture.
   */
  if (ghost) {
    return <View pointerEvents="none" style={styles.ghostFace}>{face}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Deschide postarea ${post.id}`}
      accessibilityHint="Se deschide pe tot ecranul. Ține apăsat pentru a aranja grila."
      onPress={open}
      onLongPress={onManage}
      delayLongPress={holdMs}
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
    >
      {face}
    </Pressable>
  );
}


const styles = StyleSheet.create({
  /**
   * The cell: a third of the row, 9:16, and the archive's own surface. `flexBasis: 0` with `flexGrow: 1`
   * is what makes the three columns share the width exactly (`lib/profileGrid.ts` `tileSize` states the
   * same arithmetic as numbers), and `overflow: 'hidden'` keeps a photograph inside its cell instead of
   * painting over its neighbour.
   */
  tile: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    aspectRatio: socialTokens.archive.tileAspect,
    backgroundColor: socialTokens.archive.tileSurface,
    overflow: 'hidden',
  },
  tilePressed: { opacity: 0.86 },
  /** The face alone, inside the overlay the screen moves: it takes the whole box it was given. */
  ghostFace: { width: '100%', height: '100%', overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  videoPlate: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b1216' },
  playDisc: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(8,10,13,0.62)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
  },
  playGlyph: {
    width: 0, height: 0, marginLeft: 3,
    borderTopWidth: 6, borderBottomWidth: 6, borderLeftWidth: 9,
    borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#ffffff',
  },
  /**
   * `profile-experience.css` `.profileTileViews{left:37px;bottom:7px;gap:4px;height:24px;padding:0 7px;
   * border-radius:9px;font-size:11.5px}` — the corner a thumb already looks in, moved from the right where it
   * crowded the pin. The phone's play sign is the centred disc above, not a badge in this corner, so the count
   * starts at the archive's own inset and keeps the chip's measurements.
   */
  viewsChip: {
    position: 'absolute', left: socialTokens.archive.tileChipInset, bottom: socialTokens.archive.tileChipInset,
    flexDirection: 'row', alignItems: 'center', gap: socialTokens.archive.tileViewsGap,
    height: socialTokens.archive.tilePlayHeight, paddingHorizontal: socialTokens.archive.tileChipInset,
    borderRadius: socialTokens.archive.tilePlayRadius, backgroundColor: socialTokens.archive.tileChipSurface,
  },
  /** Above the two 44dp actions of an arranged cell, so the real count is never covered by a control. */
  viewsChipLifted: { bottom: socialTokens.archive.tileChipInset + 46 },
  viewsText: { color: socialTokens.archive.tileChipInk, fontSize: socialTokens.archive.tileViewsSize, fontWeight: '700' },
  /**
   * The share's chip: the top-left corner, the one the count and the play disc never use. It is a plate
   * of the same family as `viewsChip` so a repost cannot be read as a different kind of badge, and it
   * clips its own line instead of covering the picture's middle.
   */
  repostChip: {
    position: 'absolute', left: socialTokens.archive.tileChipInset, top: socialTokens.archive.tileChipInset,
    maxWidth: '92%', height: socialTokens.archive.tilePlayHeight,
    justifyContent: 'center', paddingHorizontal: socialTokens.archive.tileChipInset,
    borderRadius: socialTokens.archive.tilePlayRadius, backgroundColor: socialTokens.archive.tileChipSurface,
  },
  repostChipText: { color: socialTokens.archive.tileChipInk, fontSize: socialTokens.archive.tileViewsSize, fontWeight: '700' },
  pinnedFirst: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderWidth: 1, borderColor: socialTokens.archive.tilePinnedFirstEdge,
  },
  /**
   * The two actions of an arranged grid, on the cell they act on: a 44dp target each, at the foot of the
   * cell, dark plates so a bright photograph does not swallow them. They are the only controls the grid
   * adds, and they exist only while the grid is being arranged.
   */
  manageStrip: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, paddingBottom: 2,
  },
  manageChip: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: socialTokens.archive.tilePlayRadius, backgroundColor: 'rgba(6,11,17,0.78)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  manageChipOn: { borderColor: socialTokens.archive.tilePinnedFirstEdge, backgroundColor: 'rgba(13,42,44,0.9)' },
  manageChipOff: { opacity: 0.45 },
  manageChipDelete: { borderColor: 'rgba(255,90,110,0.5)' },
  manageChipGlyph: { fontSize: 16, lineHeight: 18 },
  /**
   * The grip: the one surface a drag may start from, in the corner of the cell a thumb already reaches.
   * It is a real 44dp target, drawn as a dark plate with three bars, so a held finger has something to
   * aim at instead of "somewhere on the picture".
   */
  manageHandle: {
    position: 'absolute', top: 4, right: 4, width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: socialTokens.archive.tilePlayRadius, backgroundColor: 'rgba(6,11,17,0.72)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
  },
  /** The same grip while the finger holds it: invisible, mounted, and still the gesture's own target. */
  manageHandleHeld: { opacity: 0 },
  manageHandleGlyph: {
    color: '#ffffff', fontSize: 20, lineHeight: 22, fontWeight: '900',
    transform: [{ rotate: '90deg' }],
  },
  /**
   * The hole a carried cell leaves: the place the drag would drop it into. It is the insertion
   * indicator, it takes no touch (its grip is the only child that listens), and it moves with the other
   * cells when the target changes.
   */
  tileHole: {
    backgroundColor: 'rgba(13,42,44,0.55)',
    borderWidth: 2, borderStyle: 'dashed', borderColor: socialTokens.archive.tilePinnedFirstEdge,
  },
});

