import { Pressable, StyleSheet, Text, View } from 'react-native';
import { compactCount, type SocialPost } from '../lib/socialTypes';
import { socialTokens } from '../theme/social';
import { ReactionControl } from './ReactionControl';
import { SolidViewerIcon } from './SolidViewerIcon';

/**
 * The action row of a **card**: the five presses the web wires into every card (`wirePostActions()` in
 * app.js) — reaction, comments, save, repost, share — drawn as one line under the words of a 9:16 cell
 * (`PostCanvas` / `bottomActions`).
 *
 * One measure, `socialTokens.post.action`: 34px plates, a finger's height, one ink for every press so five
 * gestures read as one family instead of five shapes. The row keeps the web's own order, because a search
 * result is scanned the way the web's row is read.
 *
 * Round 9 (20 October 2026) took the second measure away. A page of the feed used to carry this same row at
 * the rail's own size across the whole width (`variant="bar"`, `socialTokens.post.actionBar`), and the owner
 * rejected it as a footer — „nu-mi place cum se vede ca și footer, deci trebuie scos". A page's presses are
 * the reader's vertical rail now, the very one a reel mounts (`PostRail`), so a page passes no row at all
 * and this component draws only the compact line a card carries. Nothing can bring the footer back by
 * asking for a variant: there is no variant left to ask for.
 *
 * A press that is *on* — a saved post, a reposted one — paints the brand's teal exactly as the reader's rail
 * does. This draws the row and nothing else: the surface that mounts it owns the state and the writes
 * (`PostCard`), which is why there is no store here.
 */
export function PostActionRow({
  summary, comments, reposts, saved, reposted, onReact, onOpenComments, onToggleSaved, onToggleRepost, onShare,
}: {
  summary?: SocialPost['reactions'];
  /** How many comments the post has; nothing is drawn when the server has not counted any. */
  comments?: number | null;
  /** `.clipMetric` for the share press: the post's reposts. */
  reposts?: number | null;
  saved: boolean;
  reposted: boolean;
  onReact: (kind: string, active: boolean) => void;
  onOpenComments: () => void;
  onToggleSaved: () => void;
  onToggleRepost: () => void;
  onShare: () => void;
}) {
  const measure = socialTokens.post.action;
  /** One plate, drawn once for the five presses: the object literal keeps a `StyleSheet` entry per field. */
  const plate = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: measure.gap,
    minHeight: measure.minHeight,
    paddingHorizontal: measure.paddingInline,
    borderWidth: 1,
    borderColor: measure.border,
    borderRadius: measure.radius,
    backgroundColor: measure.surface,
  };
  const plateOn = { borderColor: measure.borderOn, backgroundColor: measure.surfaceOn };
  const count = { color: measure.ink, fontSize: measure.count, fontWeight: '800' as const };
  /** +3 is the row's own long-standing offset: the mark sits one step above its plate's type. */
  const glyph = measure.glyph + 3;

  const reactionPlate = (
    <ReactionControl key="reaction" variant="row" summary={summary} onReact={onReact} />
  );

  const commentPlate = (
    <Pressable
      key="comments"
      accessibilityRole="button"
      accessibilityLabel="Comentarii"
      onPress={onOpenComments}
      style={plate}
    >
      <SolidViewerIcon kind="comment" size={glyph} color={measure.ink} />
      {compactCount(comments) ? <Text style={count}>{compactCount(comments)}</Text> : null}
    </Pressable>
  );

  const savePlate = (
    <Pressable
      key="save"
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Scoate din salvate' : 'Salvează'}
      accessibilityState={{ selected: saved }}
      onPress={onToggleSaved}
      style={[plate, saved && plateOn]}
    >
      <SolidViewerIcon kind="save" size={glyph} color={saved ? measure.inkOn : measure.ink} />
    </Pressable>
  );

  const repostPlate = (
    <Pressable
      key="repost"
      accessibilityRole="button"
      accessibilityLabel={reposted ? 'Anulează redistribuirea' : 'Redistribuie'}
      accessibilityState={{ selected: reposted }}
      onPress={onToggleRepost}
      style={[plate, reposted && plateOn]}
    >
      <SolidViewerIcon kind="repost" size={glyph} color={reposted ? measure.inkOn : measure.ink} />
      {compactCount(reposts) ? <Text style={count}>{compactCount(reposts)}</Text> : null}
    </Pressable>
  );

  const sharePlate = (
    <Pressable key="share" accessibilityRole="button" accessibilityLabel="Distribuie" onPress={onShare} style={plate}>
      <SolidViewerIcon kind="share" size={glyph} color={measure.ink} />
    </Pressable>
  );

  /** The web's own order — `wirePostActions()` — which a card of a list draws. */
  const presses = [reactionPlate, commentPlate, savePlate, repostPlate, sharePlate];

  return <View style={styles.row}>{presses}</View>;
}

const styles = StyleSheet.create({
  /** One line, the plates evenly spaced, and never wider than the frame's own padding allows. */
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
});
