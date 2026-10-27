import { useMemo, useState } from 'react';
import { Dimensions, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { RemoteImage } from './PostMedia';
import { mediaKindOf, type MediaItem } from '../lib/socialTypes';
import { planTextTile, textTileCopy } from '../lib/profileTextTile';
import type { ArchivePost } from '../lib/profileContent';
import { pagePaletteOf, pageStyleForPost } from '../lib/textStyle';
import { socialTokens } from '../theme/social';

/**
 * A text post's cell, as a miniature reading page.
 *
 * The owner's words (26 October 2026): a text-only cell was "a blank moss-green rectangle", and what he
 * wanted instead was a page that looks like it belongs in a book — warm paper, dark ink, the title first
 * and the opening of the text under it. This component is that page, and nothing else: it takes a post,
 * asks `lib/profileTextTile.ts` what fits on the cell it is about to draw, and paints the answer.
 *
 * A cell, not a reader
 * --------------------
 * The page is set from a truncated copy of the stored words; the whole article is never rendered here,
 * and the post's own theme is not used as the paper (it is used as the hairline above the title, so an
 * author's colour choice still shows without turning the cell back into a coloured tile). Tapping the
 * cell is `ProfileTile`'s job and still opens the complete post in the editorial reader, with its
 * original text, media and pagination.
 *
 * The measuring is the point
 * --------------------------
 * The size of the type is decided by the box the cell really has, not by the screen it was designed on:
 * `onLayout` reports the measured cell once, and the plan is recomputed only when that box or the post
 * changes. A tile without a measurement yet is set for a third of the window, which is the same width to
 * within a point — so nothing flashes and nothing re-typesets while a finger scrolls the wall.
 */
export function ProfileTextTile({ post, media = null }: {
  post: ArchivePost;
  /** The one picture an article sets beside its words (`stageFor(post) === 'article'`), or nothing. */
  media?: MediaItem | null;
}) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const copy = useMemo(() => textTileCopy(post), [post]);
  const plate = media && mediaKindOf(media) !== 'audio' ? media : null;
  /**
   * The fallback box is a third of the window at the archive's own gap, which is the cell's real width
   * on this device to within a point; it only ever draws for the first frame of a freshly mounted wall.
   */
  const guess = useMemo(() => {
    const width = Math.max(80, Math.round(
      (Dimensions.get('window').width - socialTokens.archive.gridGap * (socialTokens.archive.gridColumns - 1)) / socialTokens.archive.gridColumns,
    ));
    return { width, height: Math.round(width / socialTokens.archive.tileAspect) };
  }, []);
  const width = box.width > 0 ? box.width : guess.width;
  const height = box.height > 0 ? box.height : guess.height;
  const plan = useMemo(
    () => planTextTile(copy, { width, height }, { margin: socialTokens.reading.margin, hasMedia: Boolean(plate) }),
    [copy, width, height, plate],
  );
  /**
   * The hairline above the title is the accent of the page this post actually opens on, read through the
   * same resolver the reader paints with (`pagePaletteOf` over `pageStyleForPost`): the author's theme
   * accent, or the paper's own for a post with no authored look. The paper under the words is the same
   * one (`TEXT_THEMES.paper`, see `socialTokens.reading`), so the cell and the page it opens cannot be
   * two different papers — and a stored `jungle` row shows its gold hairline over paper, exactly as the
   * page behind it now prints.
   */
  const accent = pagePaletteOf(pageStyleForPost(post.text_style)).accent;
  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout;
    if (!next.width || !next.height) return;
    if (Math.abs(next.width - box.width) < 0.5 && Math.abs(next.height - box.height) < 0.5) return;
    setBox({ width: next.width, height: next.height });
  };

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      onLayout={onLayout}
      style={styles.page}
    >
      <View style={[styles.rule, { backgroundColor: accent }]} />
      <View style={plan.centred ? styles.wordsCentred : styles.words}>
        {plan.title ? (
          <Text
            allowFontScaling={false}
            numberOfLines={plan.titleLines}
            ellipsizeMode="clip"
            style={[styles.title, { fontSize: plan.titleSize, lineHeight: plan.titleLine }]}
          >
            {plan.title}
          </Text>
        ) : null}
        {plate && plan.plate ? (
          <RemoteImage item={plate} fit="cover" style={[styles.plate, { height: plan.plate }]} />
        ) : null}
        {plan.body ? (
          <Text
            allowFontScaling={false}
            numberOfLines={plan.bodyLines}
            ellipsizeMode="clip"
            style={[styles.body, { fontSize: plan.bodySize, lineHeight: plan.bodyLine }]}
          >
            {plan.body}
          </Text>
        ) : null}
      </View>
      {plan.fade ? (
        <View pointerEvents="none" style={styles.fade}>
          {socialTokens.reading.fadeSteps.map((colour) => (
            <View key={colour} style={[styles.fadeStep, { backgroundColor: colour }]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const reading = socialTokens.reading;

const styles = StyleSheet.create({
  /**
   * The paper: the cell's own box, the archive's corner, one hairline so two pages in one row are still
   * two pages, and the page's margin. Everything inside is set in points derived from this box.
   */
  page: {
    width: '100%', height: '100%',
    padding: reading.margin,
    backgroundColor: reading.page,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: reading.pageEdge,
    overflow: 'hidden',
  },
  /** The hairline that carries the author's own theme into the page: the one decoration it allows itself. */
  rule: { width: reading.ruleWidth, height: reading.ruleHeight, borderRadius: reading.ruleHeight / 2 },
  words: { flex: 1, marginTop: 5 },
  /** A title page's words sit in the optical middle of the paper, not against its top edge. */
  wordsCentred: { flex: 1, justifyContent: 'center' },
  title: {
    color: reading.ink,
    fontFamily: reading.face,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  plate: { width: '100%', marginTop: 2, marginBottom: 4, borderRadius: 2, backgroundColor: reading.pageEdge },
  body: { color: reading.inkSoft, fontFamily: reading.face, fontWeight: '400' },
  /** The last lines dissolve into the paper: the page continues, and the cell says so quietly. */
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: reading.fadeHeight },
  fadeStep: { flex: 1 },
});
