import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ReactionControl, type ReactionHeart } from './ReactionControl';
import { SolidViewerIcon } from './SolidViewerIcon';
import { compactCount, type ReactionSummary } from '../lib/socialTypes';
import { socialTokens, type ControlTone } from '../theme/social';

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
  bottom, summary, comments, reposts, saved, reposted, busy = false, sound = null, tone = 'night', heart = 'mark',
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
  /**
   * Which ground the column stands on — `socialTokens.post.controls`: the paper of a page of words, or the
   * night of a photograph, a clip and the profile's field (owner, 28 October 2026: the five presses wear a
   * discreet silver and graphite, and a white glyph on the cream was unreadable). The rail cannot guess its
   * ground — it is drawn *over* the page and sees no background — so the page that places it says which one
   * it is: `PostCard` passes `paper` for a page of words, and every other page keeps `night`.
   */
  tone?: ControlTone;
  /**
   * How the untouched Like press is drawn.
   *
   * `mark` (the default, and every regular post on both grounds) draws it as the palette's silver heart
   * — the same mark, the same ink and the same weight as Comment, Save and Share (round 31). `emoji`
   * keeps the white-heart emoji the Reels rail has shipped since round 9 and which the owner asked not
   * to disturb; `ReelsReader` passes it, so the immersive rail is exactly what it was.
   */
  heart?: ReactionHeart;
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
  /** The inks of the two grounds this column can stand on — the one source of every colour in it. */
  const controls = socialTokens.post.controls[tone];
  /**
   * The ink of a **glyph** on this ground (owner, 30 October 2026: „iconițele reacțiilor sunt negre").
   *
   * `controls.mark` is Mercury in shadow on a page of words and the silver this column has always worn
   * at night — so a comment, a save and a share on cream are a mark and not a black shape, while a clip,
   * a photograph and every Reel are exactly what they were. The count under a glyph keeps
   * `controls.count` (it is 11dp bold text and owes its 4.5:1) and a *state* keeps `controls.ink`
   * (`stateInk`), because a taken save is a mark of its own and not a second grey.
   */
  const markInk = controls.mark;
  const countInk = tone === 'paper' ? styles.countPaper : styles.countNight;
  /**
   * The colour of a press that has been *taken* — a save, a redistribution.
   *
   * With no plate left in the column there is no surface to invert, so the state cannot be a second
   * material: it is a mark (`styles.stateDot`) in the press's own ink, printed in the metric row the cell
   * already reserves. The ink never changes, which is the one thing that keeps a state readable on both
   * grounds — the silver and graphite of `controls` are chosen against the paper and against the
   * photograph, and an inverted pair has nothing to sit on any more.
   */
  const stateInk = { backgroundColor: controls.ink };
  return (
    <View style={[styles.rail, { bottom }]}>
      {/**
       * The owner removed the rail's avatar badge (19 October 2026): the author is already on the page,
       * beside the words, so a second ring above the like was one avatar too many. The rail opens with the
       * reaction's own press — the first of the four presses with no plate behind it.
       */}
      <ReactionControl variant="rail" summary={summary} tone={tone} heart={heart} onReact={onReact} onPanelChange={onPanelChange} />

      {/**
       * The three presses under the reaction are unboxed too (owner, 28 October 2026: „toate cele patru
       * butoane fără fundal" — the reaction had lost its plate and the other three had kept theirs). A
       * `Pressable` is still the whole 56×56 cell (`styles.cell`), so the thumb is exactly as easy to hit
       * as it was; what is gone is the squircle, its hairline and its shadow, which only ever hid the paper
       * or the photograph behind it.
       */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Comentarii"
        onPress={onOpenComments}
        style={styles.cell}
      >
        <View style={styles.disc}>
          <SolidViewerIcon kind="comment" size={socialTokens.reels.railIconSize} color={markInk} />
        </View>
        <Text style={[styles.count, countInk]}>{compactCount(comments) || ''}</Text>
      </Pressable>

      {/**
       * A save that has been taken prints the column's state mark under its own glyph (and nothing else —
       * save has no public count). It used to invert a dark plate; with the plates gone that inversion
       * would have been a white bookmark on cream.
       */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={saved ? 'Scoate din salvate' : 'Salvează'}
        accessibilityState={{ selected: saved }}
        onPress={onToggleSaved}
        style={styles.cell}
      >
        <View style={styles.disc}>
          <SolidViewerIcon kind="save" size={socialTokens.reels.railIconSize} color={markInk} />
        </View>
        <View style={styles.metricRow}>
          {saved
            ? <View style={[styles.stateDot, stateInk]} />
            /* `.railMetricPlaceholder` — save has no public count, so its metric row is reserved invisibly. */
            : <Text accessible={false} style={[styles.count, countInk, styles.countPlaceholder]}>•</Text>}
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Distribuie"
        onPress={onShare}
        style={styles.cell}
      >
        <View style={styles.disc}>
          <SolidViewerIcon kind="share" size={socialTokens.reels.railIconSize} color={markInk} />
        </View>
        <View style={styles.metricRow}>
          {reposted ? <View style={[styles.stateDot, stateInk]} /> : null}
          <Text style={[styles.count, countInk]}>{compactCount(reposts) || ''}</Text>
        </View>
      </Pressable>

      {busy ? <ActivityIndicator color={markInk} style={styles.spinner} /> : null}

      {sound ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={sound.label}
          accessibilityState={{ selected: !sound.muted }}
          onPress={sound.onToggle}
          style={[styles.soundDisc, sound.muted && styles.soundDiscMuted]}
        >
          <SolidViewerIcon kind={sound.muted ? 'mute' : 'sound'} size={socialTokens.reels.railIconSize} color={markInk} />
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
  open, bottom, reposted, tone = 'night', onToggleRepost, onShare,
}: {
  open: boolean;
  /**
   * The distance from the page's foot at which the reference draws its menu, plus whatever band the page
   * keeps for its tab bar (`PostRail.bottom` carries the same band).
   */
  bottom: number;
  reposted: boolean;
  /**
   * The ground the panel is drawn on, told by the page that opens it (`PostRail.tone`): a page of words is
   * silver paper with graphite words, every other page is the dark graphite sheet it has always been. A
   * menu is part of the press that opened it, so it cannot be the only dark surface on a cream page.
   */
  tone?: ControlTone;
  onToggleRepost: () => void;
  onShare: () => void;
}) {
  if (!open) return null;
  const paper = tone === 'paper';
  return (
    <View style={[styles.panel, paper ? styles.panelPaper : styles.panelNight, { bottom }]}>
      <Text style={[styles.panelTitle, paper ? styles.panelTitlePaper : styles.panelTitleNight]}>Distribuie postarea</Text>
      <Pressable accessibilityRole="button" onPress={onToggleRepost} style={styles.panelItem}>
        <Text style={[styles.panelText, paper ? styles.panelTextPaper : styles.panelTextNight]}>{reposted ? 'Anulează redistribuirea' : 'Redistribuie în feed'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onShare} style={styles.panelItem}>
        <Text style={[styles.panelText, paper ? styles.panelTextPaper : styles.panelTextNight]}>Distribuie în afara Jungle Book</Text>
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
  count: { fontSize: 11, fontWeight: '800', lineHeight: 14 },
  /** The metric row in the plate's own ink — a graphite count on cream, a silver one at night. */
  countPaper: { color: socialTokens.post.controls.paper.count },
  countNight: { color: socialTokens.post.controls.night.count },
  /**
   * The 14dp row under a glyph: the count of a press, and — for a press that has been taken — its mark.
   *
   * The height is fixed so that the state never moves the glyph above it: a cell is 56dp tall whatever its
   * metric row prints, which is what the whole column is measured from (`wordPageRailReserve`).
   */
  metricRow: { height: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  /**
   * A press that has been *taken*, since the column lost its plates (owner, 28 October 2026).
   *
   * Four points of the press's own ink, in the row the cell already reserves: a save and a redistribution
   * have no glyph of their own to become, and a plate to invert was the thing the owner refused. The mark is
   * small because the column is read, not counted — a state has to be noticed, not announced.
   */
  stateDot: { width: 4, height: 4, borderRadius: 2 },
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
    position: 'absolute', right: 10, left: 14, padding: 12, borderRadius: 16, gap: 8, borderWidth: 1,
  },
  /** The graphite sheet a clip and a photograph open their menu on. */
  panelNight: { backgroundColor: 'rgba(8,10,13,0.94)', borderColor: socialTokens.post.controls.night.edge },
  /** ...and the silver sheet a page of words opens the same menu on. */
  panelPaper: { backgroundColor: '#FBFAF6', borderColor: socialTokens.post.controls.paper.edge },
  panelTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  panelTitlePaper: { color: '#5B6366' },
  panelTitleNight: { color: '#A9B2B4' },
  panelItem: { paddingVertical: 9 },
  panelText: { fontSize: 14, fontWeight: '600' },
  panelTextPaper: { color: socialTokens.post.controls.paper.ink },
  panelTextNight: { color: socialTokens.post.controls.night.ink },
});
