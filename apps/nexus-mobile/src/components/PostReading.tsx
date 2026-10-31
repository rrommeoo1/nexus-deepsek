import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { blackSilver } from '../theme/blackSilver';
import {
  Platform, Pressable, ScrollView, StyleSheet, Text, View,
  type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type TextStyle as NativeTextStyle, type ViewStyle,
} from 'react-native';
import { RemoteImage, RemoteImageSource, RemoteImageSound, RemoteVideo, isVideoItem, type VideoFit } from './PostMedia';
import { RichText } from './RichText';
import { WordsBand } from './PostReadability';
import {
  MAX_MEDIA, MAX_TEXT_PAGES, mediaLeadHeight, textPageCapacity, textPages, textPagesWithLead, textPreview, type QuoteLayer,
} from '../lib/postPresentation';
import { fontFamilyFor, mediaFrameOf, pagePaletteOf, sizeOf, type TextStyle } from '../lib/textStyle';
import type { PageMode } from '../lib/pageMode';
import { PAGE_FOLIO, folioLabel } from '../lib/textPage';
import { mediaSourceForPath, postMediaItems, relativeTime, type SocialPost } from '../lib/socialTypes';
import { BrandAvatar } from './BrandAvatar';
import { socialTokens } from '../theme/social';
import { editorialType } from '../theme/editorial';

/**
 * The three content blocks of the universal 9:16 canvas, shared by the feed reader and by anything
 * that prints a post the same way:
 *
 *   `PostTextReading` - one page at a time of a text post, horizontally paged, with `1/3` progress.
 *   `PostMediaGallery` - up to five attachments on one horizontal pager; only the page in view plays.
 *   `QuotePanels`     - the bounded conversation of a quote post (latest, previous, original).
 *
 * They carry no actions of their own: the surface that mounts them brings the actions, so a clip, a picture
 * and a page of words all keep the reader's rail (`PostRail`), and only a card of a list keeps the compact
 * row under its words (`PostActionRow`).
 */

/** The page index a horizontal pager settled on, read from the offset and the measured width. */
function pageFromOffset(offset: number, width: number): number {
  if (!width) return 0;
  return Math.max(0, Math.round(offset / width));
}

export function PostTextReading({
  text, pages: fixedPages, style, pageStyle, textStyle, accessibilityLabel, onPress, lead, folio, mode = 'paper',
}: {
  /** The whole article. The reader paginates it against the box it was actually given. */
  text?: string | null;
  /** Pre-split pages, kept for callers that already know them (`TextPage`/tests). */
  pages?: string[];
  style?: StyleProp<ViewStyle>;
  pageStyle?: StyleProp<ViewStyle>;
  /**
   * The look its author chose (`posts.text_style`). `null` keeps the reader's own composition, so
   * every post written before the style existed reads exactly as it did.
   */
  textStyle?: TextStyle | null;
  accessibilityLabel?: string;
  /**
   * A picture block that shares the **first** page with the beginning of the article. The reader
   * measures it into the page (a bounded share, never the whole page) and splits the text with the
   * smaller first-page capacity, so the rest of the words continue on the next pages instead of the
   * picture forcing a separate page or a Reel composition.
   *
   * The function form receives the measured, unscaled cap (`baseHeight`), because the authored
   * frame can zoom the picture inside that cap (`textStyle.media`). The block itself draws at
   * `baseHeight * frame.scale`, and the reader reserves only the room the block really takes.
   */
  lead?: ReactNode | ((baseHeight: number) => ReactNode);
  /**
   * The row this reading's folio is printed in (`lib/textPage.ts::folioRow`), when the surface that mounts
   * it is not the default one. `undefined` — the feed, a card, the composer's receipt — keeps `PAGE_FOLIO`
   * exactly as round 31 left it; a page opened from a profile passes `PROFILE_FOLIO`, which stands 9dp
   * closer to the foot and asks the words for 10dp less clearance, because that page has no foot door to
   * reserve room for (`lib/readerBar.ts::profileReaderBottomInset`).
   *
   * Only this row moves. The type, the tracking and the ink are the folio's, and `folioLabel` still owns
   * the number: two surfaces, one printed row, one number.
   */
  folio?: { band: number; inset: number };
  /**
   * The reader's page mode (`lib/pageMode.ts`, round 46): warm paper or matte black. It comes from the
   * surface that mounted the page — a legacy page of words is read in the same two modes as an authored
   * one, or the toggle would only work on half the archive.
   */
  mode?: PageMode;
  /** `tapVideo` (app.js:3216): a tap on the reading opens the post, the way it does on the reel. */
  onPress?: () => void;
}) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [page, setPage] = useState(0);
  const [overflow, setOverflow] = useState<Record<number, boolean>>({});

  /**
   * The page's colours come from `pagePaletteOf`, never from the stored theme: every page of words is
   * warm paper with dark ink, and the theme only lends its accent where the page decorates itself. A row
   * written before the e-paper reading (or in `jungle`) is therefore read on paper without its stored
   * style being rewritten.
   */
  const palette = textStyle ? pagePaletteOf(textStyle, mode) : null;
  const measure = textStyle ? sizeOf(textStyle.size) : null;
  const fontSize = measure?.fontSize ?? 20;
  const lineHeight = measure?.lineHeight ?? 29;
  const hasLead = Boolean(lead);
  /**
   * The picture block takes a measured share of the first page, never the whole page: 34% of its
   * height, no more than 92% of its width (so a phone with a narrow reading column does not turn the
   * picture into a strip), and never more than 420 dp. The authored frame may then zoom that cap
   * between 45% and 120%, and move it; the page reserves exactly the room the block takes, so the
   * words that do not fit continue on the next page. The block draws the picture with `contain`, so a
   * very tall photograph is shown whole inside its frame instead of being cropped to fill it.
   */
  const baseLeadHeight = useMemo(() => {
    if (!hasLead || box.width < 40 || box.height < 80) return 0;
    return Math.max(0, Math.min(box.height * 0.34, box.width * 0.92, 420));
  }, [hasLead, box.width, box.height]);
  const mediaFrame = mediaFrameOf(textStyle);
  const leadHeight = useMemo(
    () => mediaLeadHeight(baseLeadHeight, box.width, box.height, mediaFrame),
    [baseLeadHeight, box.height, box.width, mediaFrame.scale, mediaFrame.y],
  );

  /**
   * The page is a measured box, not a fixed count. Before the first layout the old 420-character
   * default is used; one frame later the real width and height arrive and the same article is split
   * again into pages that fill the screen it is read on.
   */
  const measureCapacity = (height: number) => textPageCapacity({
    width: box.width,
    height,
    fontSize,
    lineHeight,
    glyph: textStyle?.font === 'mono' ? 0.6 : textStyle?.font === 'serif' ? 0.5 : 0.52,
    paddingHorizontal: palette ? 28 : 16,
    paddingVertical: palette ? 28 : 16,
  });
  const capacity = useMemo(
    () => measureCapacity(box.height),
    // `measureCapacity` is a pure projection of these values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [box.width, box.height, fontSize, lineHeight, textStyle?.font, palette],
  );
  const firstCapacity = useMemo(
    () => (hasLead ? measureCapacity(Math.max(0, box.height - leadHeight - 12)) : capacity),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasLead, leadHeight, capacity, box.width, box.height, fontSize, lineHeight, textStyle?.font, palette],
  );

  const rendered = useMemo(() => {
    if (typeof text === 'string') {
      return hasLead
        ? textPagesWithLead(text, firstCapacity, capacity, MAX_TEXT_PAGES).pages.filter(Boolean)
        : textPages(text, capacity, MAX_TEXT_PAGES).pages.filter(Boolean);
    }
    return (fixedPages ?? []).filter(Boolean);
  }, [text, fixedPages, capacity, firstCapacity, hasLead]);
  const total = rendered.length;
  /**
   * The pager and the folio are kept in agreement (owner, 31 October 2026: a page of a document printed
   * `1/22`, the *posts of the walk*, over a folio that said `1/3` — and the header that carried it is
   * gone, but the pager could still drift the same way on its own).
   *
   * The article is re-split whenever the box, the font scale or the lead picture changes, so `total` can
   * shrink under a reader who is standing on page 4; the horizontal pager, whose content just lost pages,
   * stays scrolled past the end while the folio has no page to name. The index is therefore pulled back to
   * the last real page, and `scrollTo` is issued **only when the page count changes**: a swipe must keep
   * owning the scroll, so the frame after a page change never re-issues an offset that could cancel the
   * reader's own momentum.
   */
  const pagerRef = useRef<ScrollView>(null);
  const pageRef = useRef(page);
  pageRef.current = page;
  useEffect(() => {
    if (page <= total - 1) return;
    setPage(Math.max(0, total - 1));
  }, [page, total]);
  useEffect(() => {
    if (total < 2 || !box.width) return;
    const index = Math.max(0, Math.min(pageRef.current, total - 1));
    pagerRef.current?.scrollTo({ x: index * box.width, animated: false });
  }, [total, box.width]);
  if (!total) return null;

  /** The badge and the pager always agree, even on the frame where a re-split shortens the article. */
  const current = Math.min(page, total - 1);
  const authoredWords: NativeTextStyle | null = palette ? {
    color: palette.text,
    fontFamily: fontFamilyFor(textStyle?.font ?? 'sans', Platform.OS),
    fontSize,
    lineHeight,
    textAlign: textStyle?.align ?? 'left',
  } : null;

  const onMomentum = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(pageFromOffset(event.nativeEvent.contentOffset.x, box.width));
  };

  const cards = rendered.map((entry, index) => (
    <Pressable
      key={`page-${index}`}
      accessibilityRole={onPress ? 'button' : undefined}
      style={[
        styles.readingPage,
        { width: box.width || undefined, height: box.height || undefined },
        palette ? { backgroundColor: palette.background } : null,
        pageStyle,
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      {/**
       * A page safely holds the capacity computed above, but an estimate is not a guarantee: a run of
       * very wide glyphs, an unbroken URL or a phone with an unusual font scale can still be taller
       * than the screen. The page therefore scrolls vertically *only when it has to*; scrolling is off
       * for a normal page, so the feed's own vertical swipe keeps working.
       */}
      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={[
          styles.pageWords,
          /** The row the surface printing this page keeps for its folio (`folio`); `undefined` keeps 26dp. */
          folio ? { paddingBottom: folio.band } : null,
          index === 0 && hasLead ? styles.pageWordsWithLead : null,
          palette ? styles.pageWordsAuthored : null,
        ]}
        showsVerticalScrollIndicator={overflow[index] === true}
        scrollEnabled={overflow[index] === true}
        nestedScrollEnabled
        onContentSizeChange={(_, height) => {
          const needsScroll = box.height > 0 && height > box.height + 2;
          setOverflow((previous) => (previous[index] === needsScroll ? previous : { ...previous, [index]: needsScroll }));
        }}
      >
        {index === 0 && hasLead ? (
          <View style={[styles.lead, { height: leadHeight }]}>
            {typeof lead === 'function' ? lead(baseLeadHeight) : lead}
          </View>
        ) : null}
        {/**
         * Blocul de cuvinte al unei pagini vechi.
         *
         * Runda 45 îi desena aici o bandă, ca un text publicat înainte de documente să nu fie singurul cadru
         * fără delimitare. Runda 46 a schimbat regula pentru paginile de text: banda se citește **numai în
         * cap**, iar sub cuvinte rămâne pagina curată — pe hârtie ca și pe negru. `WordsBand` rămâne pentru
         * măsurătoarea blocului, cu `band={false}`.
         */}
        <WordsBand
          id={`nxLegacyBand-${index}`}
          color={palette ? palette.text : '#f2f6f9'}
          frame={box.height || 900}
          ground={palette && mode === 'paper' ? 'paper' : 'night'}
          flex={false}
          band={false}
        >
          <RichText text={entry} style={[styles.readingText, authoredWords]} />
        </WordsBand>
      </ScrollView>
    </Pressable>
  ));

  return (
    <View
      style={style}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setBox((previous) => (previous.width === width && previous.height === height ? previous : { width, height }));
      }}
      accessibilityLabel={accessibilityLabel}
    >
      {total === 1 ? (
        <View style={styles.readingTrack}>{cards}</View>
      ) : (
        <ScrollView
          ref={pagerRef}
          style={styles.pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          onMomentumScrollEnd={onMomentum}
          contentContainerStyle={styles.readingTrack}
        >
          {cards}
        </ScrollView>
      )}
      {/**
        * The folio (owner, 30 October 2026: „numerotarea să fie jos, ca într-o carte").
        *
        * The old badge was a dark chip pinned to the page's lower right, floating over the last line and
        * — on a post opened from a profile — over the place the author attached. A book prints its
        * number centred at the foot, in the page's own ink and face, and keeps the text column above it:
        * the digits live in `PAGE_FOLIO.band`, the band the words already leave at the foot
        * (`pageWords.paddingBottom`), so nothing can ever be printed under them.
        */}
      {total > 1 ? (
        <View
          pointerEvents="none"
          style={[styles.folio, folio ? { bottom: folio.inset } : null]}
          accessibilityLabel={`Pagina ${current + 1} din ${total}`}
        >
          <Text
            allowFontScaling={false}
            style={[styles.folioText, { color: palette ? palette.text : '#f2f6f9' }]}
          >
            {folioLabel(current, total)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function PostMediaGallery({ post, active, muted, onError, onProgress, onCaptionPress, style, videoFit = 'portrait-cover' }: {
  post: SocialPost;
  active: boolean;
  muted: boolean;
  onError: () => void;
  /** The visible clip's position, for the surface's own progress strip (`PostCanvas`). */
  onProgress?: (fraction: number) => void;
  onCaptionPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /**
   * Cum se așază un **clip** din galerie în pagina lui (runda 47).
   *
   * O poză se citește de la sine cu `contain` (își păstrează proporția), dar un clip vertical acoperea
   * pagina, ca un reel. Previzualizarea de deasupra foii de comentarii este însă un cadru scund: acolo
   * clipul trebuie să se vadă întreg, deci `PostCanvas` cere `contain` numai pentru ea. Previzualizarea
   * compozitorului și pagina publicată nu schimbă nimic (valoarea implicită rămâne a cititorului).
   */
  videoFit?: VideoFit;
}) {
  const items = postMediaItems(post).slice(0, MAX_MEDIA);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  if (!items.length) return null;

  const onMomentum = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(pageFromOffset(event.nativeEvent.contentOffset.x, width));
  };

  return (
    <View style={style} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={items.length > 1}
        nestedScrollEnabled
        onMomentumScrollEnd={onMomentum}
      >
        {items.map((item, index) => {
          const video = isVideoItem(item);
          const played = active && index === page;
          return (
            <Pressable
              key={`${item.hash ?? 'item'}-${index}`}
              accessibilityRole="imagebutton"
              accessibilityLabel={onCaptionPress ? 'Redă sau oprește clipul' : 'Media'}
              onPress={onCaptionPress}
              style={[styles.galleryPage, { width: width || undefined }]}
            >
              {video
                ? <RemoteVideo item={item} fit={videoFit} style={styles.fill} active={played} muted={muted} soundtrack={post.external_audio} onProgress={played ? onProgress : undefined} onError={onError} />
                : <RemoteImage item={item} fit="contain" style={styles.fill} onError={onError} />}
              {!video ? <RemoteImageSound soundtrack={post.external_audio} active={played} muted={muted} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
      {items.length > 1 ? (
        <View style={styles.pageBadge} accessibilityLabel={`Media ${page + 1} din ${items.length}`}>
          <Text style={styles.pageBadgeText}>{`${Math.min(page + 1, items.length)}/${items.length}`}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * One layer of a conversation. The newest layer is the post being read, so it keeps the larger area;
 * the panels under it are the previous quote and the original.
 *
 * The layers are readings, not doors. The owner removed the full-screen post reading in round 8: the
 * 9:16 frame already is the whole post, so a layer states what it holds instead of promising a page a
 * press would have to open.
 */
export function QuotePanels({ layers }: { layers: QuoteLayer[] }) {
  if (!layers.length) return null;
  return (
    <View style={styles.panels}>
      {layers.map((layer, index) => (
        <QuotePanel key={`${layer.role}-${layer.post.id}-${index}`} layer={layer} />
      ))}
    </View>
  );
}

function QuotePanel({ layer }: { layer: QuoteLayer }) {
  const { post, role } = layer;
  const handle = post.author?.handle || 'nexus';
  const name = post.author?.display_name || handle;
  const avatar = mediaSourceForPath(post.author?.avatar);
  const preview = textPreview(post.caption, role === 'latest' ? 320 : 220);
  const thumb = postMediaItems(post)[0] ?? null;
  const stamp = relativeTime(post.created_at);

  return (
    <View style={[styles.panel, role === 'latest' && styles.panelLatest]}>
      <View style={styles.panelHead}>
        <View style={styles.panelDisc}>
          {avatar
            ? <RemoteImageSource source={avatar} fit="cover" style={styles.panelDiscImage} />
            : <BrandAvatar size={24} />}
        </View>
        <Text style={styles.panelName} numberOfLines={1}>{name}</Text>
        <Text style={styles.panelMeta} numberOfLines={1}>
          {`@${handle}${stamp ? ` · ${stamp}` : ''}`}
        </Text>
        {role !== 'latest' ? <Text style={styles.panelRole}>{role === 'original' ? 'ORIGINAL' : 'ANTERIOR'}</Text> : null}
      </View>
      {preview.text ? (
        <RichText text={preview.text} style={styles.panelText} numberOfLines={role === 'latest' ? 6 : 4} />
      ) : null}
      {thumb ? (
        <View style={styles.panelMediaRow}>
          <RemoteImage item={thumb} fit="cover" style={styles.panelThumb} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  readingTrack: { flexGrow: 1 },
  /** The pager owns the measured reading box; the pages are exactly that box. */
  pager: { flex: 1 },
  pageScroll: { flex: 1 },
  readingPage: { overflow: 'hidden' },
  /**
   * A page's words are centred when they fit and scroll from the top when they do not. The foot
   * padding is the folio's band (`PAGE_FOLIO.band`): the last line ends above the number, never on it.
   */
  pageWords: {
    flexGrow: 1, justifyContent: 'center', paddingTop: 8, paddingBottom: PAGE_FOLIO.band, paddingHorizontal: 2,
  },
  /** The first page of an article starts at the top: the picture is a block, then the words follow it. */
  pageWordsWithLead: { justifyContent: 'flex-start', paddingTop: 0 },
  /** The measured room the reader gives the picture block; the page capacity already reserved it. */
  lead: { width: '100%', flexShrink: 0, marginBottom: 12 },
  pageWordsAuthored: { paddingHorizontal: 14 },
  /** Body text of a text post: 20/29 is the reading size on a phone, never stretched to fill the screen. */
  readingText: { color: '#f2f6f9', fontSize: 20, lineHeight: 29, letterSpacing: 0.1 },
  /**
   * The folio: the book's own number, centred at the foot of the paper.
   *
   * No plate, no chip, no pill — the old badge was a dark rounded rectangle with white digits, which on
   * a cream page was the blackest thing on it. This is set type: the reading face's serif, ten points,
   * spaced, in the page's own ink at `PAGE_FOLIO.ink` of its strength, so it can be found when looked
   * for and never competes with a word.
   */
  folio: { position: 'absolute', left: 0, right: 0, bottom: PAGE_FOLIO.inset, alignItems: 'center' },
  folioText: {
    fontFamily: editorialType.serif,
    fontSize: PAGE_FOLIO.size,
    letterSpacing: PAGE_FOLIO.tracking,
    opacity: PAGE_FOLIO.ink,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  pageBadge: {
    position: 'absolute', right: 0, bottom: -2, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10, backgroundColor: 'rgba(8,10,13,0.72)',
  },
  pageBadgeText: { color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: '700' },
  fill: { width: '100%', height: '100%' },
  galleryPage: { height: '100%', alignItems: 'center', justifyContent: 'center' },
  panels: { gap: 8 },
  panel: {
    padding: 10, gap: 6, borderRadius: 14,
    backgroundColor: 'rgba(8,10,13,0.78)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  panelLatest: { backgroundColor: 'rgba(8,10,13,0.88)', borderColor: 'rgba(255,255,255,0.22)' },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelDisc: {
    width: 26, height: 26, borderRadius: 13, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    backgroundColor: blackSilver.graphite, borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)',
  },
  panelDiscImage: { width: '100%', height: '100%' },
  panelDiscText: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  panelName: { color: '#ffffff', fontSize: 13, fontWeight: '800', flexShrink: 1 },
  panelMeta: { color: 'rgba(255,255,255,0.66)', fontSize: 11, flexShrink: 1 },
  panelRole: { color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '800', letterSpacing: 0.6, marginLeft: 'auto' },
  panelText: { color: '#e9eff4', fontSize: 14, lineHeight: 20 },
  panelMediaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  panelThumb: { width: 52, height: 66, borderRadius: 8, backgroundColor: '#0a0b0e' },
});
