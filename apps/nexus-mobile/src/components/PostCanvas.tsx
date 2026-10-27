import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { RemoteImage, RemoteImageSource, RemoteVideo } from './PostMedia';
import { ArticleMediaBlock } from './ArticleMedia';
import { EditorialArticle, hasEditorialDocument } from './EditorialArticle';
import { PostMediaGallery, PostTextReading, QuotePanels } from './PostReading';
import { RichText } from './RichText';
import { JungleGrove } from './JungleGrove';
import { LeafMotif } from './LeafMotif';
import {
  initialsFor, mediaKindOf, mediaSourceForPath, postMediaItems, relativeTime, type SocialPost,
} from '../lib/socialTypes';
import { MAX_MEDIA, locationOf, needsTranslation, quoteChain, stageFor, tagsOf, textPages, textPreview } from '../lib/postPresentation';
import { pagePaletteOf, pageStyleForPost, textStyleForPost, defaultTextStyle } from '../lib/textStyle';
import { wordPageGutter, wordPageHead } from '../lib/textPage';
import { socialTokens } from '../theme/social';
import { STATEMENT_CHARS, editorial, editorialType } from '../theme/editorial';

/**
 * THE universal 9:16 post composition, in one place.
 *
 * The feed reel, the full-screen reader and a profile thumbnail are the same post seen from three
 * distances, so they are one layout seen from three distances: one component, one set of rules, three
 * `variant`s. The composition never changes between them - only the type scale, the amount of text a
 * small cell can carry, and whether a clip is allowed to play.
 *
 *   `variant="feed"`   inside the reader's reel: author under the picture, caption clamped to three
 *                      lines with `Citește tot`, a text post read page by page in the middle.
 *   `variant="reader"` the same, with the slightly larger type a dedicated reading surface can afford.
 *   `variant="tile"`   the archive cell: a cover with the author at the top and the first lines of the
 *                      post at the bottom, or - for a post without media - a typographic preview, so a
 *                      text post is a tile and not an empty square.
 *
 * Nothing here decides what a post can *do*: the surface that mounts it brings the actions — the reader's
 * rail beside a picture or a clip, one row at the foot of a page of words (`layout`). The canvas only
 * decides what a post *is* to look at.
 */

export type PostCanvasVariant = 'feed' | 'reader' | 'tile';

/**
 * Where a surface keeps the actions of the post it is drawing. A page with media is read with the thumb on
 * a rail (the reader's column, the same for a photograph and for a clip); a page of words carries its
 * actions as one row at the foot. The composition follows the actions instead of forcing one shape on both.
 */
export type PostCanvasLayout = 'reel' | 'post';

/** The width each variant is tuned at; a phone wider than that scales its type, never its layout. */
const REFERENCE_WIDTH: Record<PostCanvasVariant, number> = { feed: 469, reader: 469, tile: 155 };

/**
 * The statement scale. 24/34 is the size a short post is set at on a phone: large enough that the words
 * are the composition, small enough that four lines still fit between the author and the actions.
 */
const STATEMENT_SIZE = 24;
const STATEMENT_LINE = 34;

type Metrics = {
  name: number;
  handle: number;
  disc: number;
  caption: number;
  captionLine: number;
  reading: number;
  readingLine: number;
  quoteIntro: number;
  quoteIntroLine: number;
  padH: number;
  padB: number;
  /** Room the action rail keeps free on the right of the text block. */
  railGutter: number;
};

const METRICS: Record<PostCanvasVariant, Metrics> = {
  feed: {
    name: 14, handle: 12, disc: 42, caption: 14, captionLine: 19,
    reading: 20, readingLine: 29, quoteIntro: 16, quoteIntroLine: 22,
    padH: 14, padB: 22, railGutter: 78,
  },
  reader: {
    name: 15, handle: 12.5, disc: 44, caption: 15, captionLine: 20,
    reading: 21, readingLine: 30, quoteIntro: 17, quoteIntroLine: 23,
    padH: 16, padB: 26, railGutter: 78,
  },
  tile: {
    name: 9.5, handle: 8, disc: 18, caption: 9, captionLine: 12,
    reading: 11.5, readingLine: 15, quoteIntro: 9, quoteIntroLine: 12,
    padH: 7, padB: 9, railGutter: 0,
  },
};

/** A type scale for a frame `width` wide, held between sensible bounds on any phone. */
function scaleOf(width: number, variant: PostCanvasVariant): number {
  if (!width) return 1;
  return Math.min(1.45, Math.max(0.72, width / REFERENCE_WIDTH[variant]));
}

/**
 * The 9:16 frame itself, fitted inside whatever room a surface gives it. A phone is often taller than
 * 16/9 of its width, so the frame is centred in the room that is left and never stretched: the post
 * keeps one shape, the surface keeps its own. `bottomInset` is the part of the room a navigation bar
 * already owns, so no composition ends up behind the tab bar.
 */
export function PostStage({ children, bottomInset = 0, topInset = 0, fill = false, style }: {
  children: (frame: { width: number; height: number }) => React.ReactNode;
  bottomInset?: number;
  /** Room a floating control already owns above the frame (the reader's own back arrow). */
  topInset?: number;
  /**
   * A reading surface (a text post, a conversation) fills the room it is given instead of taking the 9:16
   * proportion: on a phone taller than 16/9 a 9:16 frame would leave two dead bands around the words, which
   * is the "post trapped in a card" the owner rejected. Media keeps the proportion, because a photograph is
   * never stretched to fill a screen.
   */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox((previous) => (previous.width === width && previous.height === height ? previous : { width, height }));
  };
  const padTop = Math.max(0, topInset);
  const padBottom = Math.max(0, bottomInset);
  const room = Math.max(0, box.height - padTop - padBottom);
  const width = fill ? box.width : Math.min(box.width, room * (9 / 16));
  const height = fill ? room : width * (16 / 9);
  return (
    // The insets are what make the frame real: it is centred in the room that is left *between* the
    // floating controls, not in the whole viewport.
    <View style={[styles.stage, { paddingTop: padTop, paddingBottom: padBottom }, style]} onLayout={onLayout}>
      {width > 0 && height > 0
        ? <View style={[styles.frame, { width, height }]}>{children({ width, height })}</View>
        : null}
    </View>
  );
}

/**
 * One post as a card of a list: the universal 9:16 frame, as tall as the card's own width allows, with
 * the list's margin under it. The frame is the same one `PostStage` draws for the reel — a card is not a
 * second composition, only the same frame asked to size itself instead of being centred in a viewport.
 * There is no larger reading to open: the card is the whole post, and a tap on it is not a door.
 */
export function PostFrame({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.frame, styles.card, style]}>{children}</View>;
}

export function PostCanvas({
  post, variant = 'feed', layout = 'reel', active = false, muted = true, expanded = false,
  onError, onOpenAuthor, onToggleExpanded, onTranslate, notice, noticeTone = 'error',
  onPressMedia, authorAction, playBadge = false, bottomActions, page = false,
  topInset = 0, bottomInset = 0,
}: {
  post: SocialPost;
  variant?: PostCanvasVariant;
  /**
   * Where the actions of the surface live, and therefore where the words go:
   *
   *   `reel` — the reader's vertical rail hugs the right edge of the frame, so the author and the caption
   *            sit at the bottom left and keep `metrics.railGutter` free on their right (`ReelsReader`,
   *            `.clipQuickActions{right:8px;bottom:10px}`). A picture is read here too (round 8, item 2):
   *            the owner asked for the photo of a page to fill the screen with its reactions on the rail;
   *   `post` — a page of words is read like a post, not like a picture: the author is stamped at the top
   *            of the frame, the words keep the width, and the actions are the reader's rail (`PostRail`),
   *            mounted by the surface beside the composition. Where that surface says `page`, the head
   *            starts in the notification band and the words keep the rail's 78px free.
   */
  layout?: PostCanvasLayout;
  /** Only the post the reader is looking at may decode a clip. */
  active?: boolean;
  muted?: boolean;
  /** A caption longer than the reel's three lines, opened in place. */
  expanded?: boolean;
  /**
   * The device's own room, as the composition honours it. On a page that fills the window the media runs
   * edge to edge, so these are the only places where the hardware is respected: `topInset` is the status
   * clock and the notch (the author starts under it), `bottomInset` is the floating tab bar and the
   * gesture sign (the caption and the action row end above it). A 9:16 card passes neither.
   */
  topInset?: number;
  bottomInset?: number;
  onError?: () => void;
  onOpenAuthor?: () => void;
  onToggleExpanded?: () => void;
  /** `captionTranslationButtonMarkup` (`.clipTranslate`): the post's own translation door. */
  onTranslate?: () => void;
  /** The reader's own sentence about the post (a soundtrack that could not play, a translation). */
  notice?: string;
  /** Which ink that sentence wears: a failure is red, a translation is the brand's teal. */
  noticeTone?: 'error' | 'info';
  /**
   * What a tap on the picture itself does. The target sits between the media and the text, so the
   * caption's own press still wins where the two overlap. On a reel it is the play switch; a card of a
   * list passes nothing, because a post is read in place and has no page of its own to open.
   */
  onPressMedia?: () => void;
  /**
   * The author's relation, in the author line itself (`layout="post"`): a picture read as a post prints
   * the same compact word a list row does (`RelationButton`) beside the face, and a card whose author is
   * the reader prints nothing (`deriveRelationUi` answers `self`). A clip keeps its author at the bottom
   * with the rail, so `reel` ignores this.
   */
  authorAction?: React.ReactNode;
  /**
   * A clip that is not playing says so with the play sign the archive cell uses (`tilePlayDisc`). A feed
   * card never starts its decoder (`active` is false), so without the sign a clip card reads as a frozen
   * photograph. The reader, which starts its clip, leaves it off.
   */
  playBadge?: boolean;
  /**
   * The action row of a **card of a list** (`layout="post"`, no `page`), drawn inside the frame under the
   * caption (`PostActionRow`): a 9:16 cell has no rail to put beside the words, so its five presses are
   * composed with it. A page of the feed passes nothing — its presses are the rail the surface mounts over
   * the composition (`PostRail`), never a row at the foot (`bottomActions`).
   */
  bottomActions?: React.ReactNode;
  /**
   * This composition *is* the page, not a cell of a list: its head starts at `topInset` itself — under the
   * status clock, in the notification band, which is where the owner asked a page of words to begin
   * (20 October 2026) — and the right of the page keeps `metrics.railGutter` free for the action rail the
   * surface draws beside it. A card of a list leaves this off: it keeps the canvas's own padding and its
   * compact row under the words.
   */
  page?: boolean;
}) {
  const [width, setWidth] = useState(0);
  /**
   * How far the clip has played (0-1), reported by `RemoteVideo.onProgress`. It lives here and not in the
   * media component because the strip has to be drawn *after* the frame's veil: a clip is composed without
   * native controls, and the veil would otherwise bury a 3px line at the bottom of the frame.
   */
  const [watched, setWatched] = useState(0);
  /** The clip's clock: fraction for the bar, position and duration for the words beside it. */
  const [clock, setClock] = useState({ position: 0, duration: 0 });
  /** The player's hand, filled by `RemoteVideo`: a tap on the bar seeks through it. */
  const seekRef = useRef<((fraction: number) => void) | null>(null);
  const trackWidth = useRef(0);
  const reportProgress = useCallback((fraction: number, position = 0, duration = 0) => {
    // Below half a percent nothing moves on screen; not re-rendering there keeps a long clip cheap.
    setWatched((previous) => (Math.abs(previous - fraction) < 0.005 ? previous : fraction));
    setClock((previous) => {
      /** The readout ticks once a second, not four times: a clock that flickers is a clock that lies. */
      const nextPosition = Math.floor(position);
      const nextDuration = Math.floor(duration);
      if (previous.position === nextPosition && previous.duration === nextDuration) return previous;
      return { position: nextPosition, duration: nextDuration };
    });
  }, []);
  const metrics = METRICS[variant];
  const k = scaleOf(width, variant);
  const tile = variant === 'tile';
  /** A picture read like a post: the author goes up, the words keep the width, the actions go beside them. */
  const stacked = layout === 'post' && !tile;
  const stage = stageFor(post);
  /**
   * A page of **words** — a text post, or an authored article with pictures inside it — as opposed to a
   * picture, a clip or a cell of a list. It is the one composition the owner asked to be read as a page
   * of a book, and the one whose head he asked to be set a step larger (27 October 2026).
   */
  const wordPage = page && !tile && (stage === 'text' || stage === 'article');
  /**
   * The room the rail keeps on the right of the words. A reel has always kept it; a *page* of words keeps
   * it too, because its five presses are the same rail (`PostRail`) — only a cell of a list has no rail,
   * and there the row under the words takes the full width.
   *
   * A page of words keeps exactly the rail's own footprint (`TEXT_PAGE_RAIL_GUTTER`: the 56dp cell 10dp
   * in from the edge, plus air) instead of the reel's wider 78dp: the article is the page, and every
   * point given away on the right is a column of paper the words cannot use while the buttons stand on
   * the same edge either way.
   */
  const railGutter = stacked && !page ? 0 : wordPageGutter(metrics.railGutter, wordPage);
  /**
   * The head of a page of words: the author's face and name one step larger than the same head on a
   * card, because the page is the whole screen and a 14dp name over an 18dp page margin reads as a
   * caption. Only the words are set this way — a picture, a clip and a cell keep `metrics` exactly, so
   * no photograph grew a face it did not ask for (`lib/textPage.ts`).
   */
  const head = wordPageHead(metrics, wordPage);
  /** Where the head of a page begins: at the notification band itself, or below the card's own padding. */
  const headTop = (page ? 0 : metrics.padB) + topInset;

  /**
   * `Vezi traducerea` is offered only for a page the reader cannot already read. A post in the
   * phone's own language - or in English - is not a foreign text, and the owner asked for that door
   * to disappear instead of asking a reader to translate their own words.
   */
  const translation = onTranslate && needsTranslation(post.language) ? onTranslate : undefined;
  const items = postMediaItems(post).slice(0, MAX_MEDIA);
  const cover = items[0] ?? null;
  const isVideo = mediaKindOf(cover) === 'video';
  const reading = textPages(post.caption);
  const conversation = quoteChain(post);
  const preview = textPreview(post.caption, tile ? 220 : 320);
  /**
   * A caption that does not fit the reel's three lines is offered its own door: the paged reading
   * (`textPages`) or, for a text that is long but still one page, a simple expansion in place.
   */
  const longCaption = reading.pages.length > 1 || textPreview(post.caption, 150).hasMore;
  /**
   * A text post short enough to be *said* rather than read: exactly one page, and inside
   * `STATEMENT_CHARS`. It is set as a statement in the system serif with a generous line height; a longer
   * post keeps the body face and the paged reading, because a decorative font over a paragraph is a
   * defect, not a style.
   */
  const statementText = reading.pages.length === 1 ? reading.pages[0] : '';
  /**
   * The look its author chose, for a page of words only (`null` on every other kind of post): the face,
   * the measure, the alignment and the document of the page — `null` when the row carries no style.
   *
   * An article with photographs (`stage === 'article'`) is the same page: its pictures are blocks inside
   * the reading instead of a full-bleed cover.
   */
  const authored = stage === 'text' || stage === 'article' ? textStyleForPost(post.text_style) : null;
  /**
   * The page the words are actually set on — always a page, never `null` (owner's rule, 27 October 2026:
   * paper everywhere).
   *
   * The author's look when the row carries a readable one, the paper default when it does not. That is
   * the rule the wall's cell already follows (`ProfileTextTile` paints paper for a post with no theme),
   * so the thumbnail and the page it opens can no longer be two different papers. A picture, a clip or a
   * quote is not a page and keeps the reader's own composition (`null`): scenery, a scrim and white words
   * over a photograph are the reader's design, not a missing theme.
   */
  const pageStyle = stage === 'text' || stage === 'article' ? pageStyleForPost(post.text_style) : null;
  /**
   * The paper, its ink, and the author's accent — `pagePaletteOf`, the one place a page's colours are
   * decided. A row stored in `jungle` (the composer's old default: every page published before 26
   * October 2026) therefore opens as warm paper with dark serif ink and its gold as a hairline, instead
   * of the green-black screen it used to paint; a row stored in any other theme opens the same paper
   * with that theme's accent. No stored row is rewritten to get there.
   */
  const pagePalette = pageStyle ? pagePaletteOf(pageStyle) : null;
  /**
   * The head of a page is set in the page's ink: the reader's white name over a cream page would print
   * the author into the paper.
   */
  const pageInk = pagePalette ? { color: pagePalette.text } : null;
  const pageFaintInk = pagePalette ? { color: pagePalette.text, opacity: 0.72 } : null;
  /**
   * What is *read* inside a page takes the paper's own accent — a hashtag, a mention, the `Vezi
   * traducerea` label, the tags under the words. The author's theme accent stays on the one thing that
   * decorates rather than spells: the frame of the translation chip (`pageChip`), drawn in the colour
   * the wall's cell draws its hairline in.
   */
  const pageAccent = pagePalette ? { color: pagePalette.mark } : null;
  const pageMark = pagePalette ? { color: pagePalette.mark, fontWeight: '700' as const } : styles.mark;
  const pageChip = pagePalette ? { borderColor: pagePalette.accent, backgroundColor: 'transparent' } : null;
  const pageNotice = pagePalette ? [styles.noticePaper, noticeTone === 'info' && styles.noticeInfoPaper] : [styles.notice, noticeTone === 'info' && styles.noticeInfo];
  const statement = !authored && stage === 'text' && statementText.length > 0 && statementText.length <= STATEMENT_CHARS && !longCaption;
  const avatar = mediaSourceForPath(post.author?.avatar);
  const handle = post.author?.handle || 'nexus';
  const name = post.author?.display_name || handle;
  const stamp = relativeTime(post.created_at);
  const location = locationOf(post);
  const tags = tagsOf(post);
  const repostName = post.repost?.reposter?.display_name || post.repost?.reposter?.handle || '';

  const author = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Profilul lui @${handle}`}
      onPress={onOpenAuthor}
      disabled={!onOpenAuthor}
      style={styles.authorRow}
    >
      <View style={[styles.disc, { width: head.disc, height: head.disc, borderRadius: head.disc / 2 }]}>
        {avatar
          ? <RemoteImageSource source={avatar} fit="cover" style={styles.fill} />
          : <Text style={[styles.discText, { fontSize: head.name * 0.8 }]}>{initialsFor(name, handle)}</Text>}
      </View>
      <View style={styles.authorText}>
        <Text style={[styles.name, { fontSize: head.name }, pageInk]} numberOfLines={1}>{name}</Text>
        <Text style={[styles.handle, { fontSize: head.handle }, pageFaintInk]} numberOfLines={1}>
          {[`@${handle}`, stamp, location].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
  /**
   * The archive cell. A picture is the cover; a clip has no poster frame the phone can draw without
   * starting one decoder per cell, so it gets the canvas's own portrait plate - the play sign, the author
   * and the first line - instead of the empty square the grid used to leave behind.
   */
  if (tile) {
    const plate = !cover || isVideo;
    const original = conversation.layers[conversation.layers.length - 1]?.post;
    const originalHandle = original?.author?.handle || 'nexus';
    return (
      <View style={styles.fill} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {!plate ? <RemoteImage item={cover} fit="cover" style={styles.media} onError={onError} /> : null}
        {plate ? (
          <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id={`nxTilePlate-${post.id}`} x1="0" y1="0" x2="0.6" y2="1">
                <Stop offset="0" stopColor={editorial.cardTop} />
                <Stop offset="0.55" stopColor="#121914" />
                <Stop offset="1" stopColor={editorial.cardBottom} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#nxTilePlate-${post.id})`} />
          </Svg>
        ) : null}
        {/* The cell carries the same sprig as the full frame, at the scale a thumbnail can hold. */}
        {plate ? (
          <LeafMotif size={Math.round(width * 1.1)} opacity={0.12} rotate={10} style={{ position: 'absolute', right: -Math.round(width * 0.2), top: -Math.round(width * 0.08) }} />
        ) : null}
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id={`nxTileVeil-${post.id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity={0.5} />
              <Stop offset="0.32" stopColor="#000000" stopOpacity={0.06} />
              <Stop offset="0.7" stopColor="#000000" stopOpacity={0.42} />
              <Stop offset="1" stopColor="#000000" stopOpacity={0.94} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#nxTileVeil-${post.id})`} />
        </Svg>

        {isVideo ? (
          <View pointerEvents="none" style={styles.tilePlayDisc}>
            <View style={[styles.tilePlayGlyph, { borderLeftWidth: 9 * k, borderTopWidth: 6 * k, borderBottomWidth: 6 * k }]} />
          </View>
        ) : null}

        <View style={[styles.tileBody, { padding: metrics.padH, paddingBottom: isVideo ? 34 : metrics.padH }]}>
          <View style={styles.authorRow}>
            <View style={[styles.disc, { width: metrics.disc, height: metrics.disc, borderRadius: metrics.disc / 2 }]}>
              {avatar
                ? <RemoteImageSource source={avatar} fit="cover" style={styles.fill} />
                : <Text style={[styles.discText, { fontSize: metrics.name }]}>{initialsFor(name, handle).slice(0, 2)}</Text>}
            </View>
            <Text style={[styles.name, { fontSize: metrics.name }]} numberOfLines={1}>{name}</Text>
          </View>

          <View style={styles.tileTexts}>
            {stage === 'quote' ? (
              <View style={styles.tileQuote}>
                <Text style={[styles.tileQuoteMark, { fontSize: metrics.reading * 1.5 }]}>{'„'}</Text>
                <Text style={[styles.tileQuoteText, { fontSize: metrics.caption, lineHeight: metrics.captionLine }]} numberOfLines={2}>
                  {textPreview(original?.caption, 90).text || 'Conversație'}
                </Text>
                <Text style={[styles.tileQuoteAuthor, { fontSize: metrics.handle }]} numberOfLines={1}>
                  {`@${originalHandle}`}
                </Text>
              </View>
            ) : null}

            {stage !== 'quote' && preview.text ? (
              stage === 'text' ? (
                <Text style={[styles.tileReading, { fontSize: metrics.reading, lineHeight: metrics.readingLine }]} numberOfLines={7}>
                  {preview.text}
                </Text>
              ) : (
                <Text style={[styles.tileCaption, { fontSize: metrics.caption, lineHeight: metrics.captionLine }]} numberOfLines={3}>
                  {preview.text}
                </Text>
              )
            ) : null}

            {stage === 'quote' && post.caption ? (
              <Text style={[styles.tileQuoteIntro, { fontSize: metrics.caption, lineHeight: metrics.captionLine }]} numberOfLines={2}>
                {post.caption}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  }



  const hasMedia = items.length > 0;

  return (
    <View style={styles.fill} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {/**
       * The field under the picture. A page is the whole window, and a picture is not always the window's
       * shape: a landscape clip keeps its whole frame (`portrait-cover` falls back to `contain` for it), so
       * the room it leaves is filled with the jungle's own card instead of a black band — and the words that
       * sit over that room are on the composition, not on a strip. A picture that covers the page hides this
       * layer completely.
       */}
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id={`nxCanvasField-${post.id}`} x1="0" y1="0" x2="0.7" y2="1">
            <Stop offset="0" stopColor={editorial.cardTop} />
            <Stop offset="0.55" stopColor="#121814" />
            <Stop offset="1" stopColor={editorial.cardBottom} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#nxCanvasField-${post.id})`} />
      </Svg>

      {stage !== 'article' && items.length > 1 ? (
        <PostMediaGallery
          post={post}
          active={active}
          muted={muted}
          onError={() => onError?.()}
          onProgress={reportProgress}
          onCaptionPress={onPressMedia}
          style={styles.media}
        />
      ) : null}
      {stage !== 'article' && items.length <= 1 && cover && isVideo ? (
        <RemoteVideo
          item={cover}
          fit="portrait-cover"
          style={styles.media}
          active={active}
          muted={muted}
          soundtrack={post.external_audio}
          onProgress={reportProgress}
          seekRef={seekRef}
          onError={() => onError?.()}
          onAudioError={() => onError?.()}
        />
      ) : null}
      {stage !== 'article' && items.length <= 1 && cover && !isVideo ? (
        <RemoteImage item={cover} fit="cover" style={styles.media} onError={onError} />
      ) : null}

      {onPressMedia && stage !== 'article' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Redă sau oprește clipul"
          onPress={onPressMedia}
          style={styles.media}
        />
      ) : null}

      {/* A text post is not a black screen: the frame carries its own editorial plate. */}
      {!hasMedia || stage === 'article' ? (
        pagePalette ? (
          /**
           * A page of words paints its paper edge to edge — the one paper of the product, whatever theme
           * the row was written in (`pagePaletteOf`). No grove and no veil: the paper/ink pair was
           * checked for contrast, and scenery over a page would be wallpaper.
           */
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: pagePalette.background }]} />
        ) : (
          <>
            <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
              <Defs>
                <LinearGradient id={`nxCanvasPlate-${post.id}`} x1="0" y1="0" x2="0.7" y2="1">
                  <Stop offset="0" stopColor={editorial.cardTop} />
                  <Stop offset="0.55" stopColor="#121814" />
                  <Stop offset="1" stopColor={editorial.cardBottom} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill={`url(#nxCanvasPlate-${post.id})`} />
            </Svg>
            {/**
             * The jungle behind the words (`JungleGrove`): moss, fronds and a slow canopy light, grown at
             * the edges of the frame and shaded under the type. It is scenery, never wallpaper over a
             * picture or over a page: on a photograph, on a clip, and on the paper page above nothing is
             * drawn — a frame of words is a page, and paper does not grow a forest.
             */}
            <JungleGrove seed={String(post.id)} dim={statement ? 0.28 : 0.36} />
          </>
        )
      ) : null}

      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id={`nxCanvasVeil-${post.id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" stopOpacity={0.44} />
            <Stop offset="0.22" stopColor="#000000" stopOpacity={0.04} />
            <Stop offset="0.62" stopColor="#000000" stopOpacity={0.18} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0.92} />
          </LinearGradient>
          {/**
           * A post's head sits *over* the picture (`layout="post"`), so it needs its own scrim: the
           * gradient falls from the card's charcoal to nothing across the height of the author block. A
           * photograph is never blurred, dimmed or cropped for the sake of the words — the words get a
           * reading surface of their own.
           */}
          <LinearGradient id={`nxCanvasHead-${post.id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={editorial.fieldDeep} stopOpacity={0.96} />
            <Stop offset="0.6" stopColor={editorial.fieldDeep} stopOpacity={0.72} />
            <Stop offset="1" stopColor={editorial.fieldDeep} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {/**
         * The scrim under the words is a picture's reading surface, so a picture keeps all of it. A frame
         * that is not a page (a quote, a post of words the reader composes itself) keeps four tenths: its
         * plate is charcoal already, and the grove under it carries a well and a vignette of its own — a
         * full veil would paint the moss out of the foot of the frame (`JungleGrove`). A page of words
         * keeps none: paper under a black scrim is a grey page, and the whole point of the e-paper reading
         * is that its paper is the colour it says it is.
         */}
        <Rect width="100%" height="100%" fill={`url(#nxCanvasVeil-${post.id})`} opacity={pagePalette ? 0 : hasMedia ? 1 : 0.4} />
        {stacked && hasMedia && stage !== 'article' ? <Rect width="100%" height={132 + topInset} fill={`url(#nxCanvasHead-${post.id})`} /> : null}
      </Svg>

      {/**
       * The clip's clock is drawn with the composition, not over the frame's edge: the bar, its times and
       * its seek live in the bottom block above the action row (`videoClock` below), so a 3px strip can no
       * longer slide under the reactions. Nothing is drawn until the clip has actually been read.
       */}

      {/**
       * A clip that is not playing says so, with the sign the archive cell uses: a card keeps the decoder
       * off (`active` is false), so the frame would otherwise read as a frozen photograph.
       */}
      {playBadge && isVideo && !active ? (
        <View pointerEvents="none" style={styles.playBadge}>
          <View style={styles.playDisc}>
            <View style={styles.playGlyph} />
          </View>
        </View>
      ) : null}

      {stage === 'media' || stage === 'reel' ? (
        <>
          {/**
           * A picture's author is stamped at the top of the frame, the way the post page of the web prints it:
           * the bottom belongs to the words and to the row of actions under them. A clip keeps the author at
           * the bottom, beside the rail its thumb already knows.
           */}
          {stacked ? (
            <View style={[styles.top, { paddingHorizontal: metrics.padH, paddingTop: headTop }]}>
              {repostName ? (
                <Text style={[styles.repostLine, { fontSize: metrics.handle }]} numberOfLines={1}>
                  {`${repostName} a repostat`}
                </Text>
              ) : null}
              {authorAction ? (
                <View style={styles.authorLine}>
                  {author}
                  {authorAction}
                </View>
              ) : author}
            </View>
          ) : null}

          <View style={[styles.bottom, { paddingHorizontal: metrics.padH, paddingBottom: (bottomActions ? Math.round(metrics.padB * 0.4) : metrics.padB) + bottomInset }]}>
          {!stacked && repostName ? (
            <Text style={[styles.repostLine, { fontSize: metrics.handle }]} numberOfLines={1}>
              {`${repostName} a repostat`}
            </Text>
          ) : null}

          <View style={[styles.bottomInner, { paddingRight: railGutter }]}>
            {!stacked ? author : null}
            {post.caption ? (
              <RichText
                text={post.caption}
                style={[styles.caption, { fontSize: metrics.caption, lineHeight: metrics.captionLine }]}
                numberOfLines={expanded ? 12 : 3}
                onPress={longCaption ? onToggleExpanded : undefined}
              />
            ) : null}
            {longCaption ? (
              <Text style={[styles.readMore, { fontSize: metrics.handle }]} onPress={onToggleExpanded}>
                {expanded ? 'Mai puțin' : 'Citește tot'}
              </Text>
            ) : null}
            {translation ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Vezi traducerea" onPress={translation} style={styles.translate}>
                <Text style={[styles.translateText, { fontSize: Math.max(9, metrics.handle - 2) }]}>Vezi traducerea</Text>
              </Pressable>
            ) : null}
            {notice ? <Text style={[styles.notice, noticeTone === 'info' && styles.noticeInfo]}>{notice}</Text> : null}
          </View>
          {/**
           * The row of actions of a post (`PostActionRow` of the reader): under the words, inside the frame,
           * so a picture is acted on where its caption ends instead of beside a rail that is not there.
           */}
          {bottomActions ? <View style={[styles.actionsRow, { paddingRight: railGutter }]}>{bottomActions}</View> : null}
          {/**
           * The clip's clock (§9): a bar with the position it is at, the length it has, and a seek. It sits
           * *above* the action row — never over it — and only once the clip has really been read, so forty
           * cards in a list do not each carry an empty 0:00/0:00 line.
           */}
          {isVideo && clock.duration > 0 ? (
            <View style={styles.videoClock}>
              <Pressable
                accessibilityRole="adjustable"
                accessibilityLabel={`Clip la ${formatClock(clock.position)} din ${formatClock(clock.duration)}. Apasă pe bară pentru a căuta.`}
                onLayout={(event) => { trackWidth.current = event.nativeEvent.layout.width; }}
                onPress={(event) => {
                  const width = trackWidth.current;
                  if (width > 0) seekRef.current?.(Math.max(0, Math.min(1, event.nativeEvent.locationX / width)));
                }}
                style={styles.videoTrack}
              >
                <View style={styles.videoRail}>
                  <View style={[styles.videoFill, { width: `${Math.round(watched * 100)}%` }]} />
                </View>
              </Pressable>
              <Text style={styles.videoTime}>{`${formatClock(clock.position)} / ${formatClock(clock.duration)}`}</Text>
            </View>
          ) : null}
        </View>
        </>
      ) : (
        <View style={[styles.reading, { paddingHorizontal: metrics.padH, paddingTop: headTop, paddingBottom: metrics.padB + bottomInset }]}>
          {/**
           * The head of a post, at the top of the frame: face, display name, @handle, publication date and
           * the location the author attached (never an invented one — `locationOf` reads
           * `publishing.location` and answers '' otherwise).
           */}
          <View style={styles.readingHead}>
            {repostName ? (
              <Text style={[styles.repostLine, { fontSize: metrics.handle }, pageFaintInk]} numberOfLines={1}>
                {`${repostName} a repostat`}
              </Text>
            ) : null}
            {authorAction ? <View style={styles.authorLine}>{author}{authorAction}</View> : author}
          </View>

          {/**
           * The middle of the frame: the words, centred in the room the head and the action row leave.
           * A short post is set as a statement (system serif, generous line height); a long one keeps the
           * body face and the paged reading, because a decorative font over a paragraph is a defect.
           */}
          <View style={styles.readingCenter}>
            <View style={[styles.readingBodyWrap, { paddingRight: railGutter }]}>
              {stage === 'quote' ? (
                <>
                  {post.caption ? (
                    <RichText
                      text={post.caption}
                      style={[styles.quoteIntro, { fontSize: metrics.quoteIntro, lineHeight: metrics.quoteIntroLine }]}
                      numberOfLines={6}
                      hashtagStyle={styles.mark}
                      mentionStyle={styles.markMention}
                    />
                  ) : null}
                  <QuotePanels layers={conversation.layers} />
                  {conversation.omitted > 0 ? (
                    <Text style={styles.quoteNote}>
                      {`+${conversation.omitted} ${conversation.omitted === 1 ? 'strat anterior' : 'straturi anterioare'} în conversație`}
                    </Text>
                  ) : null}
                  {translation ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="Vezi traducerea" onPress={translation} style={styles.translate}>
                      <Text style={[styles.translateText, { fontSize: Math.max(10, metrics.handle - 1) }]}>Vezi traducerea</Text>
                    </Pressable>
                  ) : null}
                  {notice ? <Text style={[styles.notice, noticeTone === 'info' && styles.noticeInfo]}>{notice}</Text> : null}
                </>
              ) : (
                <>
                  {hasEditorialDocument(post) ? (
                    <EditorialArticle post={post} style={pageStyle ?? defaultTextStyle()} active={active} />
                  ) : statement ? (
                    <RichText
                      text={statementText}
                      style={[styles.statement, { fontSize: STATEMENT_SIZE, lineHeight: STATEMENT_LINE }, pageInk]}
                      onPress={onPressMedia}
                      hashtagStyle={pageMark}
                      mentionStyle={pageMark}
                    />
                  ) : (
                    <PostTextReading
                      text={post.caption}
                      style={styles.readingBody}
                      textStyle={pageStyle}
                      lead={stage === 'article' ? (baseHeight) => (
                        <ArticleMediaBlock
                          items={items}
                          frame={pageStyle?.media}
                          baseHeight={baseHeight}
                          onError={onError}
                        />
                      ) : undefined}
                      accessibilityLabel={`Textul postării lui @${handle}`}
                      onPress={onPressMedia}
                    />
                  )}
                  {/**
                   * `See translation` sits *under the words it translates*, not at the foot of the screen:
                   * the old reading pushed it to the frame's bottom edge with a flex spacer, which is
                   * exactly what the owner saw as detached. Here it follows the block that ends the text.
                   */}
                  {translation ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="Vezi traducerea" onPress={translation} style={[styles.translate, pageChip]}>
                      <Text style={[styles.translateText, { fontSize: Math.max(10, metrics.handle - 1) }, pageAccent]}>Vezi traducerea</Text>
                    </Pressable>
                  ) : null}
                  {notice ? <Text style={pageNotice}>{notice}</Text> : null}
                  {tags.length ? (
                    <Text style={[styles.readingMeta, { fontSize: metrics.handle }, pageAccent]} numberOfLines={2}>
                      {tags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' ')}
                    </Text>
                  ) : null}
                </>
              )}
            </View>
          </View>

          {/**
           * The row of a **cell** of a list, under its words. `readingCenter` above takes every free line,
           * so these presses always land on the cell's last line — where a card's row sits — and never
           * directly under a short statement. A page of the feed draws nothing here: its presses are the
           * rail beside it (`PostRail`), which is why the owner's footer could be removed without taking
           * the actions with it.
           */}
          {bottomActions ? <View style={styles.actionsRow}>{bottomActions}</View> : null}
        </View>
      )}
    </View>
  );
}

/** `0:07`, `1:04` — the clock a clip's bar prints. */
function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  stage: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: editorial.fieldDeep },
  /**
   * The one frame every post is composed in. It carries no outline and no radius: a post is a reading
   * surface that fills the room it is given, not a card floating on a page. The 9:16 proportion is what
   * gives it its shape; everything around it is the matte-jungle field.
   */
  frame: {
    overflow: 'hidden',
    backgroundColor: editorial.cardBottom,
  },
  /**
   * The same frame as a card of a list (`PostFrame`): as tall as its own width allows (9:16), with the
   * list's margin under it. A `PostCanvas` inside measures itself, so nothing else has to be told the
   * height.
   */
  card: { width: '100%', aspectRatio: 9 / 16, marginBottom: socialTokens.post.marginBottom },
  fill: { width: '100%', height: '100%' },
  media: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  /**
   * The author of a picture, stamped at the top of the frame (`layout="post"`). It floats over the media
   * on the same veil the bottom block uses, so the name is legible over a bright photograph too.
   */
  top: { position: 'absolute', left: 0, right: 0, top: 0, gap: 6 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 6 },
  bottomInner: { gap: 6 },
  /**
   * The row of actions of a post (`layout="post"`): one line under the caption, its buttons evenly spaced
   * and never narrower than a finger. It belongs to the composition, so the frame's own padding keeps it
   * off the edge and nothing floats above the picture.
   */
  actionsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6,
    marginTop: 8, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: editorial.hairline,
  },
  /**
   * `.clipProgress` is now a real control (§9): the track, the two times and the seek. It lives above the
   * action row inside the frame, so it never collides with the reactions; the fill is the botanical leaf.
   */
  videoClock: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  videoTrack: {
    flex: 1, height: 16, justifyContent: 'center',
  },
  videoRail: { height: 4, borderRadius: 2, backgroundColor: 'rgba(241,242,237,0.22)', overflow: 'hidden' },
  videoFill: { height: 4, borderRadius: 2, backgroundColor: editorial.leaf },
  videoTime: { color: editorial.inkMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.3, minWidth: 72, textAlign: 'right' },
  /** The author line of a post plus the author's relation, side by side. */
  authorLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  /**
   * A clip that has not started: the archive cell's disc (`tilePlayDisc`), at the size a full frame can
   * carry, centred over the picture so the card says "this plays" without starting the decoder.
   */
  playBadge: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  playDisc: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(8,10,13,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)',
  },
  playGlyph: {
    width: 0, height: 0, marginLeft: 4,
    borderTopWidth: 9, borderBottomWidth: 9, borderLeftWidth: 15,
    borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#ffffff',
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  disc: {
    overflow: 'hidden', backgroundColor: editorial.panel, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: editorial.leafEdge,
  },
  discText: { color: editorial.ink, fontWeight: '800' },
  authorText: { flex: 1, minWidth: 0 },
  name: { color: editorial.ink, ...editorialType.display, fontSize: 15 },
  handle: { color: editorial.inkMuted, letterSpacing: 0.2 },
  caption: { color: editorial.ink },
  readMore: { color: editorial.leafInk, fontWeight: '800' },
  repostLine: { color: editorial.leaf, fontWeight: '700', letterSpacing: 0.3 },
  /**
   * `.clipTranslate` — the post's own translation door, in the leaf accent so it belongs to the same
   * language as a hashtag and a mention. It sits under the words it translates.
   */
  translate: {
    alignSelf: 'flex-start', minHeight: 30, justifyContent: 'center',
    paddingHorizontal: 12, borderRadius: 12, marginTop: 10,
    borderWidth: 1, borderColor: editorial.leafEdge, backgroundColor: editorial.leafSoft,
  },
  translateText: { color: editorial.leafInk, fontWeight: '800', letterSpacing: 0.4 },
  /**
   * The reader's sentence about a post. It is a note, not a paragraph: a slim block with a coloured rule
   * on the left, so a translation ("Traducere: …") and a failure ("Fișierul media nu a putut fi
   * încărcat.") read as two different things without either of them shouting.
   */
  notice: {
    color: '#ffc9c9', fontSize: 12, fontWeight: '600', alignSelf: 'stretch',
    paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8,
    borderLeftWidth: 2, borderLeftColor: '#ff315f', backgroundColor: 'rgba(255,49,95,0.14)',
  },
  /** The brand's teal for a note that is information rather than a failure (a translation). */
  noticeInfo: {
    color: '#dcfbf7', borderLeftColor: '#2fbdb3', backgroundColor: 'rgba(47,189,179,0.14)',
  },
  /**
   * The same two notes on a page of paper: the inks above are written for the charcoal plate (a pale
   * rose on a dark rule) and would be unreadable on `#f4efe2`, so a page gets a dark rose and a dark
   * teal on a wash of the same hue.
   */
  noticePaper: {
    color: '#7c1d2b', fontSize: 12, fontWeight: '600', alignSelf: 'stretch',
    paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8,
    borderLeftWidth: 2, borderLeftColor: '#b3243c', backgroundColor: 'rgba(179,36,60,0.10)',
  },
  noticeInfoPaper: {
    color: '#0e4f4b', borderLeftColor: '#178b82', backgroundColor: 'rgba(23,139,130,0.12)',
  },

  /**
   * The reading stage owns the frame: the head at the top, the words centred in the room that is left,
   * the action row at the foot. The translation chip is inside the centred block, under the words, so it
   * can never drift to the frame's edge on a short post.
   */
  reading: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, gap: 10 },
  readingHead: { gap: 6 },
  readingCenter: { flex: 1, justifyContent: 'center' },
  /**
   * The reading block owns the room between the head and the action row. Without `flex: 1` here the
   * paged reader (`PostTextReading`) has an auto-height parent, its own `flex: 1` collapses to a zero
   * height (Yoga's `flexBasis: 0`), and Android clips every word away while the absolutely positioned
   * `x/y` badge still paints - the exact "Page 1/5 and no text" defect of round 10.
   */
  readingBodyWrap: { flex: 1, gap: 2 },
  readingBody: { flex: 1 },
  /** A short post set as a statement: the platform serif, warm ink, a line height that lets it breathe. */
  statement: { color: editorial.ink, ...editorialType.display, letterSpacing: 0.2 },
  /** Hashtags and mentions wear the same leaf accent as the translation door. */
  mark: { color: editorial.leafInk, fontWeight: '700' },
  markMention: { color: editorial.leaf, fontWeight: '700' },
  readingMeta: { color: editorial.inkQuiet, letterSpacing: 0.4, marginTop: 8 },
  quoteIntro: { color: editorial.ink },
  quoteNote: { color: editorial.inkMuted, fontSize: 11, fontWeight: '600' },

  /** The archive cell's own plate and typography. */
  tileBody: { flex: 1, justifyContent: 'space-between' },
  tileTexts: { gap: 4 },
  tileReading: { color: editorial.ink, ...editorialType.display, letterSpacing: 0.15 },
  tileCaption: { color: editorial.ink },
  tileQuote: {
    padding: 5, gap: 1, borderRadius: 6,
    backgroundColor: 'rgba(8,10,13,0.62)', borderWidth: 1, borderColor: editorial.hairline,
  },
  tileQuoteMark: { color: editorial.leaf, fontWeight: '800', lineHeight: 16 },
  tileQuoteText: { color: editorial.ink },
  tileQuoteAuthor: { color: editorial.inkMuted },
  tileQuoteIntro: { color: editorial.ink, fontWeight: '700' },
  tilePlayDisc: {
    position: 'absolute', top: '38%', alignSelf: 'center',
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(8,10,13,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.65)',
  },
  tilePlayGlyph: {
    width: 0, height: 0, marginLeft: 3,
    borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#ffffff',
  },
});

