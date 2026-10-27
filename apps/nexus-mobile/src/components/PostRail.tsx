import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ReactionControl } from './ReactionControl';
import { SolidViewerIcon } from './SolidViewerIcon';
import { compactCount, type ReactionSummary } from '../lib/socialTypes';
import { socialTokens } from '../theme/social';

/**
 * How far the rail's last cell sits from the page's foot — 26dp, the `.clipQuickActions` bottom the reel
 * has always used. A page adds the band its tab bar owns on top of it; the constant keeps the reel and a
 * page of words on exactly the same line.
 */
export const RAIL_FOOT = 26;

/**
 * One press of the rail: the 56×56 cell every press shares (`.clipQuickActions>button`). Exported because
 * the room a page of words keeps for the rail is cut from these cells (`wordPageRailReserve` of
 * `lib/textPage.ts`) — the page cannot measure the column it must avoid unless the cell is a number here.
 */
export const RAIL_CELL = 56;

/** `.clipMusicDisc{margin-top:4px}`: the soundtrack's disc stands clear of the press above it. */
export const RAIL_SOUND_AIR = 4;

/**
 * The reader's action rail: one column of presses on the right of a page, the same on every kind of page.
 *
 * What the web gave it (app.js:4278-4299, feed-surface.css `.clipQuickActions`): a 56×56 cell for each
 * press, a 36×39 disc for the mark, a 14px metric row under it, all of it 10dp in from the right edge and
 * above the band the tab bar owns. The order is the rail's own, not a row's: reaction, comments, save,
 * share, and — only where a page has one — the soundtrack's disc.
 *
 * Round 9 (20 October 2026): this column was `ReelPage`'s private markup, and the owner asked for it on
 * every page of the feed — „zona cu reacții orizontală de jos, mutată vertical, exact la fel ca la reels…
 * același sistem de comentarii, de paletă etc. … trebuie adăugat la toate tipurile de content". So the
 * column left the reel and became this component: a page with a picture, a clip or **only words** mounts
 * the same rail, and the five presses cannot drift apart between content types again. The horizontal bar a
 * page of words used to carry at its foot (`PostActionRow variant="bar"`) is gone with that request.
 *
 * Two things it deliberately does not own: the state and the writes — the page that mounts it decides what
 * a press means, exactly as `PostActionRow` leaves that to `PostCard` — and its own vertical placement. It
 * is handed the distance from the page's foot (`bottom`), because a reel keeps clear of the tab bar and a
 * page of words follows the same band (`bottomInset`). That band is the tab bar's, and the bar is
 * permanent (round 10), so the rail is placed once and never moves with a swipe.
 */
export function PostRail({
  bottom, summary, comments, reposts, saved, reposted, busy = false, sound = null,
  onReact, onOpenComments, onToggleSaved, onShare, onPanelChange,
}: {
  /** How far the rail's last cell sits from the page's foot — 26dp plus the band the tab bar owns. */
  bottom: number;
  summary?: ReactionSummary | null;
  /** `.clipMetric` of the comments press: the count the page knows, or nothing to draw. */
  comments?: number | null;
  /** `.clipMetric` of the share press: the post's reposts. */
  reposts?: number | null;
  saved: boolean;
  reposted: boolean;
  /** A write in flight (a share the server has not answered yet): the column says so, quietly. */
  busy?: boolean;
  /**
   * `.clipMusicDisc`: the soundtrack of a clip, as a disc that toggles the sound. A photograph and a page
   * of words have no soundtrack, so they pass `null` — a mute button on a still would be a lie.
   */
  sound?: { muted: boolean; label: string; onToggle: () => void } | null;
  /** The reaction the reader chose, or the like it took back; the page turns it into its own write. */
  onReact: (kind: string) => void;
  onOpenComments: () => void;
  onToggleSaved: () => void;
  /** The share press. The page opens its own menu (`PostDistributePanel`), never a silent write. */
  onShare: () => void;
  /**
   * Told when the reaction panel opens and closes (`ReactionControl`): the panel is chosen by dragging
   * along its row, and the feed's pager must not take that drag at the native level while it is open.
   */
  onPanelChange?: (open: boolean) => void;
}) {
  return (
    <View style={[styles.rail, { bottom }]}>
      {/**
       * The owner removed the rail's avatar badge (19 October 2026): the author is already on the page,
       * beside the words, so a second ring above the like was one avatar too many. The rail opens with the
       * reaction plate.
       */}
      <ReactionControl variant="rail" summary={summary} onReact={onReact} onPanelChange={onPanelChange} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Comentarii"
        onPress={onOpenComments}
        style={styles.cell}
      >
        <View style={styles.disc}>
          <SolidViewerIcon kind="comment" size={socialTokens.reels.railIconSize} />
        </View>
        <Text style={styles.count}>{compactCount(comments) || ''}</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={saved ? 'Scoate din salvate' : 'Salvează'}
        accessibilityState={{ selected: saved }}
        onPress={onToggleSaved}
        style={styles.cell}
      >
        <View style={styles.disc}>
          <SolidViewerIcon kind="save" size={socialTokens.reels.railIconSize} color={saved ? '#ff315f' : '#ffffff'} />
        </View>
        {/* `.railMetricPlaceholder` — save has no public count, so its metric row is reserved invisibly. */}
        <Text accessible={false} style={[styles.count, styles.countPlaceholder]}>•</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Distribuie"
        onPress={onShare}
        style={styles.cell}
      >
        <View style={styles.disc}>
          <SolidViewerIcon kind="share" size={socialTokens.reels.railIconSize} color={reposted ? '#ff315f' : '#ffffff'} />
        </View>
        <Text style={styles.count}>{compactCount(reposts) || ''}</Text>
      </Pressable>

      {busy ? <ActivityIndicator color="#ffffff" style={styles.spinner} /> : null}

      {sound ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={sound.label}
          accessibilityState={{ selected: !sound.muted }}
          onPress={sound.onToggle}
          style={[styles.soundDisc, sound.muted && styles.soundDiscMuted]}
        >
          <SolidViewerIcon kind={sound.muted ? 'mute' : 'sound'} size={socialTokens.reels.railIconSize} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * `.clipMoreActions`: the menu the share press opens — a repost inside the feed, and a share with the
 * server's own sentence — drawn over the page, above the rail it was opened from.
 *
 * It is a panel and not a second press on the rail because a share is two different decisions, and one
 * 56px cell can only mean one of them. The owner read those two on a clip; every page of the feed now
 * offers the same two, from the same cell, in the same place.
 */
export function PostDistributePanel({
  open, bottom, reposted, onToggleRepost, onShare,
}: {
  open: boolean;
  /**
   * The distance from the page's foot at which the reference draws its menu, plus whatever band the page
   * keeps for its tab bar (`PostRail.bottom` carries the same band).
   */
  bottom: number;
  reposted: boolean;
  onToggleRepost: () => void;
  onShare: () => void;
}) {
  if (!open) return null;
  return (
    <View style={[styles.panel, { bottom }]}>
      <Text style={styles.panelTitle}>Distribuie postarea</Text>
      <Pressable accessibilityRole="button" onPress={onToggleRepost} style={styles.panelItem}>
        <Text style={styles.panelText}>{reposted ? 'Anulează redistribuirea' : 'Redistribuie în feed'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onShare} style={styles.panelItem}>
        <Text style={styles.panelText}>Distribuie în afara Jungle Book</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  /** `.clipQuickActions{right:8px;bottom:10px;gap:2px}` — the reader's action column. */
  rail: { position: 'absolute', right: 10, alignItems: 'center', gap: 2 },
  /** `.clipQuickActions>button:not(.clipRailAvatar)` — one predictable 56×56 action cell. */
  cell: {
    width: RAIL_CELL, minWidth: RAIL_CELL, height: RAIL_CELL, minHeight: RAIL_CELL,
    alignItems: 'center', justifyContent: 'center', gap: 1,
  },
  /** `.clipQuickActions :is(.clipSolidIcon,.reactionMetric>b)` 36×36 disc on the cell's 39px first row. */
  disc: { width: 36, minWidth: 36, height: 39, alignItems: 'center', justifyContent: 'center' },
  /** `.clipQuickActions :is(button small,.reactionMetric>em){font-size:11px;line-height:14px}` */
  count: { color: '#ffffff', fontSize: 11, fontWeight: '800', lineHeight: 14 },
  /** `.railMetricPlaceholder{visibility:hidden}` — a reserved metric row that prints nothing. */
  countPlaceholder: { opacity: 0 },
  spinner: { marginTop: 4 },
  /** `.clipMusicDisc` — a 56px single-row disc that keeps the soundtrack's own toggle. */
  soundDisc: {
    width: RAIL_CELL, height: RAIL_CELL, borderRadius: RAIL_CELL / 2, marginTop: RAIL_SOUND_AIR,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.42)', backgroundColor: '#0a0b0e',
  },
  soundDiscMuted: { opacity: 0.72 },
  /** `.clipMoreActions` — the share menu, one page margin in from both edges and above the rail. */
  panel: {
    position: 'absolute', right: 10, left: 14, padding: 12, borderRadius: 16, gap: 8,
    backgroundColor: 'rgba(8,10,13,0.94)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  panelTitle: { color: '#9fb0bd', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  panelItem: { paddingVertical: 9 },
  panelText: { color: '#f2f6f9', fontSize: 14, fontWeight: '600' },
});
