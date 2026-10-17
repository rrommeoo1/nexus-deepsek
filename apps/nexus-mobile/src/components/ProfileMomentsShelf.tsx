import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StoryViewer } from './StoryViewer';
import { RemoteImage } from './PostMedia';
import type { MomentTile } from '../lib/profileContent';
import { socialTokens } from '../theme/social';

/**
 * The shelf of saved stories, drawn to `.ownerMomentsPanel` (`profile-experience.css:67-75`, measured in
 * `docs/web-ref/profile/tab-4.dom.json`: the panel is 47 tall at the top of the content region, its header
 * `b` at 13px/700 with `padding:0 14px 6px`, and the row it holds is `gap:12px;padding:2px 14px`):
 *
 *   `.ownerMomentsPanel button{flex:0 0 54px;min-width:0;overflow:hidden;color:#aebac1}`
 *   `.ownerMomentsPanel button i{width:50px;height:50px;border:2px solid #27ded2;border-radius:50%;
 *                                background:#0b1720;color:#2ce8dc;font-size:20px}`
 *   `.ownerMomentsPanel button small{margin-top:4px;font-size:10px;text-overflow:ellipsis}`
 *
 * The saved-story shelf is the answer to the Momente tab — a profile is not the place to publish a story,
 * so the archive is what a reader finds there — and pressing a tile plays it: the album's own stories from
 * their first one, or the profile's active stories from the tile's own index, which is exactly what
 * `data-profile-album` and `data-profile-moment` do (`profile-experience.js:475-482`).
 */
export function ProfileMomentsShelf({ shelf }: {
  shelf: { title: string; tiles: MomentTile[] };
}) {
  const [playing, setPlaying] = useState<number | null>(null);
  const tile = playing === null ? null : shelf.tiles[playing] ?? null;

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>{shelf.title}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityLabel={shelf.title}
      >
        {shelf.tiles.map((entry, index) => (
          <Pressable
            key={entry.key}
            accessibilityRole="button"
            accessibilityLabel={entry.title}
            onPress={() => setPlaying(index)}
            style={styles.tile}
          >
            <View accessible={false} style={styles.circle}>
              {entry.cover
                ? <RemoteImage item={entry.cover} fit="cover" style={styles.cover} />
                : <Text style={styles.mark}>{entry.kind === 'album' ? '▣' : '✦'}</Text>}
            </View>
            <Text style={styles.label} numberOfLines={1}>{entry.title}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {tile && tile.gallery.length ? (
        <StoryViewer
          stories={tile.gallery}
          startIndex={tile.kind === 'album' ? 0 : playing ?? 0}
          onClose={() => setPlaying(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /** `.ownerMomentsPanel{padding:6px 0 10px}` */
  panel: {
    paddingTop: socialTokens.archive.momentsPaddingTop,
    paddingBottom: socialTokens.archive.momentsPaddingBottom,
  },
  /** `.ownerMomentsPanel header{padding:0 14px 6px}` with `header b{font-size:13px}` */
  header: {
    paddingHorizontal: socialTokens.archive.momentsHeaderPaddingHorizontal,
    paddingBottom: socialTokens.archive.momentsHeaderPaddingBottom,
  },
  title: {
    color: socialTokens.archive.momentHeaderInk,
    fontSize: socialTokens.archive.momentsHeaderSize,
    fontWeight: '700',
  },
  /** `.ownerMomentsPanel>div{display:flex;gap:12px;padding:2px 14px}` */
  row: {
    gap: socialTokens.archive.momentsRowGap,
    paddingHorizontal: socialTokens.archive.momentsRowPaddingHorizontal,
    paddingVertical: socialTokens.archive.momentsRowPaddingVertical,
  },
  /** `.ownerMomentsPanel button{flex:0 0 54px;overflow:hidden;color:#aebac1}` */
  tile: { width: socialTokens.archive.momentWidth, alignItems: 'center' },
  circle: {
    width: socialTokens.archive.momentCircle,
    height: socialTokens.archive.momentCircle,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: socialTokens.archive.momentCircleBorder,
    borderRadius: socialTokens.archive.momentCircle / 2,
    backgroundColor: socialTokens.archive.momentCircleSurface,
  },
  cover: { width: '100%', height: '100%' },
  /** The sign a tile with nothing saved in it shows instead of a picture: '▣' for an album, '✦' for a story. */
  mark: { color: socialTokens.archive.momentCircleInk, fontSize: socialTokens.archive.momentCircleSize },
  /** `.ownerMomentsPanel button small{margin-top:4px;font-size:10px}` */
  label: {
    marginTop: socialTokens.archive.momentTitleMarginTop,
    color: socialTokens.archive.momentTitleInk,
    fontSize: socialTokens.archive.momentTitleSize,
  },
});
