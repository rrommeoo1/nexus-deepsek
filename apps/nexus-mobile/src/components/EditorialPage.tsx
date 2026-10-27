import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList, Image, PanResponder, Platform, Pressable, StyleSheet, Text, TextInput, View,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { RemoteImage, RemoteVideo } from './PostMedia';
import { PhotoViewer } from './ArticleMedia';
import { RichText } from './RichText';
import {
  EDITORIAL_EDGE_DWELL_MS, editorialDropLine, editorialEdge, editorialGesture, editorialGestureIdle,
  type EditorialGesture,
} from '../lib/editorialDrag';
import {
  flowEditorialDocument, measureTextWidth,
  type EditorialLine, type EditorialMediaBox, type EditorialPage as EditorialFlowPage,
} from '../lib/editorialFlow';
import {
  applyPlainText, editorialTextMap, placeMediaBlockAt, setMediaPlacement, setMediaWidth, setMediaWrap,
  MAX_MEDIA_WIDTH_FRACTION, MIN_MEDIA_WIDTH_FRACTION,
  type EditorialDocument, TEXT_MAX_CHARS,
} from '../lib/editorialDocument';
import { editorialSizeFor, type EditorialMediaSource } from '../lib/editorialPost';
import { mediaHeaders } from '../lib/session';
import { resolveMediaUri } from '../lib/mediaCache';
import { fontFamilyFor, pagePaletteOf, sizeOf, type TextStyle } from '../lib/textStyle';
import type { RailReserve } from '../lib/textPage';

/**
 * One editorial page, drawn as the article it will publish.
 *
 * The page is a real flow (`editorialFlow`): words wrap around a left or right picture and continue
 * across the full measure after it, while a full-width picture is a block above and below the words.
 * The same component draws the composer and the published reader; `editable` only adds the hidden
 * keyboard input, the caret and the media handles.
 *
 * Editing is direct. A tap on a line places the caret at the tapped character; the actual typing
 * happens in one invisible `TextInput` that holds the article's plain words, and the visible page is
 * re-flowed on every keystroke. That keeps the native IME, selection and keyboard behaviour without a
 * second editor screen or a preview.
 */

export type EditorialSelection = { blockId: string; kind: 'text' | 'media' };

/**
 * How wide a picture may stay when it is dragged to one side.
 *
 * A column of words is the whole point of the gesture: past this share of the measure the remaining
 * strip is narrower than a word, the flow finds no free interval and the page ends up with a picture
 * and no text beside it. The resize handle can still make it wider afterwards - deliberately.
 */
const WRAP_WIDTH_LIMIT = 0.62;

export function EditorialPage({
  document, style, media, width, height, editable = false, active = true,
  selectedMediaId = null, railReserve, onSelectBlock, onChangeDocument, accessibilityLabel,
}: {
  document: EditorialDocument;
  style: TextStyle;
  media: EditorialMediaSource[];
  width: number;
  height: number;
  editable?: boolean;
  /** Only the page the reader is looking at starts a clip. */
  active?: boolean;
  selectedMediaId?: string | null;
  /**
   * The room the reader's rail keeps at the right of the page, in the page's own points (`RailReserve`
   * of `lib/textPage.ts`). The words keep it only where it stands: the flow narrows the lines that reach
   * it and leaves every line above the buttons its full measure. The composer passes nothing — it has no
   * rail, and a page arranged without one must look exactly like the page that is read.
   */
  railReserve?: RailReserve | null;
  onSelectBlock?: (selection: EditorialSelection | null) => void;
  /** `remember` asks the composer to keep an undo snapshot for a layout gesture. */
  onChangeDocument?: (document: EditorialDocument, remember?: boolean) => void;
  accessibilityLabel?: string;
}) {
  /**
   * The page is painted from `pagePaletteOf`, not from the theme of the stored style: warm paper under
   * the words, dark ink for them, and the author's theme kept as the one accent the page decorates
   * itself with (the rule at its head, the frame of a selected picture). The composer, the feed and the
   * reader all mount this component, so a stored `jungle` page and a page typed this evening open on
   * the same paper — the theme never paints the background here.
   */
  const palette = pagePaletteOf(style);
  const measure = sizeOf(editorialSizeFor(document, style));
  const bodyFont = fontFamilyFor(style.font, Platform.OS) ?? 'serif';
  const [aspectRatios, setAspectRatios] = useState<Record<number, number>>({});
  const mediaKey = media.map((entry) => `${entry.mediaIndex}:${entry.uri}`).join('|');
  const [page, setPage] = useState(0);
  const [caret, setCaret] = useState({ start: 0, end: 0 });
  const [focusNonce, setFocusNonce] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<number>>(null);
  const map = useMemo(() => editorialTextMap(document), [document]);

  /**
   * The reader opens the photographs of the article in the same full-screen viewer the legacy lead
   * block uses. Only published files carry a `MediaItem`; a draft has a local URI and is arranged,
   * not viewed, so this list stays empty in the composer.
   */
  const photoItems = useMemo(() => {
    const seen = new Set<number>();
    const photos: { mediaIndex: number; item: NonNullable<EditorialMediaSource['item']> }[] = [];
    for (const entry of media) {
      if (entry.mediaType !== 'image' || !entry.item || seen.has(entry.mediaIndex)) continue;
      seen.add(entry.mediaIndex);
      photos.push({ mediaIndex: entry.mediaIndex, item: entry.item });
    }
    return photos;
  }, [media]);
  const [photoViewer, setPhotoViewer] = useState({ open: false, index: 0 });
  const openPhoto = useCallback((mediaIndex: number) => {
    const index = photoItems.findIndex((photo) => photo.mediaIndex === mediaIndex);
    if (index < 0) return;
    setPhotoViewer({ open: true, index });
  }, [photoItems]);

  /** Replacing a file at the same gallery position must be measured again. */
  useEffect(() => {
    setAspectRatios({});
  }, [mediaKey]);

  /** Measure each file once: a portrait photograph must keep its own proportions in the flow. */
  useEffect(() => {
    let alive = true;
    for (const entry of media) {
      if (!entry.uri || aspectRatios[entry.mediaIndex]) continue;
      if (entry.mediaType === 'video') {
        setAspectRatios((previous) => (
          previous[entry.mediaIndex] ? previous : { ...previous, [entry.mediaIndex]: 16 / 9 }
        ));
        continue;
      }
      const done = (fileWidth: number, fileHeight: number) => {
        if (!alive || !(fileWidth > 0) || !(fileHeight > 0)) return;
        const ratio = Math.min(4, Math.max(0.4, fileWidth / fileHeight));
        setAspectRatios((previous) => (
          Math.abs((previous[entry.mediaIndex] ?? 0) - ratio) < 0.001 ? previous : { ...previous, [entry.mediaIndex]: ratio }
        ));
      };
      const fail = () => done(4, 3);
      if (entry.item && entry.uri.startsWith('http')) {
        // The picture is measured from the file the reader actually draws (`lib/mediaCache.ts`):
        // `getSizeWithHeaders` goes through the same native image pipeline that drops the session
        // and would leave every remote page at the 4:3 fallback.
        resolveMediaUri({ uri: entry.uri, headers: mediaHeaders() })
          .then((local) => { if (alive) Image.getSize(local, done, fail); })
          .catch(fail);
      } else {
        Image.getSize(entry.uri, done, fail);
      }
    }
    return () => { alive = false; };
  }, [media, aspectRatios]);

  /**
   * The rail's room, as the flow asks for it: a rectangle of this page the words may not enter, anchored
   * to the page's right edge and to its foot, so the same numbers hold on every page of the article
   * (`RailReserve` of `lib/textPage.ts`). Kept as three numbers rather than as a rectangle, because a
   * rectangle would be rebuilt on every render and re-flow the whole article with it.
   */
  const reserveWidth = Math.max(0, railReserve?.width ?? 0);
  const reserveHeight = Math.max(0, railReserve?.height ?? 0);
  const reserveBottom = Math.max(0, railReserve?.bottom ?? 0);

  const flow = useMemo(() => flowEditorialDocument(document, {
    pageWidth: width,
    pageHeight: height,
    fontSize: measure.fontSize,
    lineHeight: measure.lineHeight,
    font: style.font,
    align: style.align,
    headingSize: Math.round(measure.fontSize * 1.42),
    headingLine: Math.round(measure.lineHeight * 1.3),
    marginX: Math.max(18, Math.round(width * 0.072)),
    marginTop: Math.max(20, Math.round(height * 0.052)),
    marginBottom: Math.max(22, Math.round(height * 0.064)),
    paragraphGap: Math.round(measure.lineHeight * 0.52),
    mediaGap: Math.round(measure.lineHeight * 0.55),
    aspectRatios,
    /** No rail, no room: a page arranged in the composer keeps the whole paper. */
    reserve: reserveWidth > 0 && reserveHeight > 0
      ? [{
        x: width - reserveWidth,
        y: height - reserveBottom - reserveHeight,
        width: reserveWidth,
        height: reserveHeight,
      }]
      : [],
    maxPages: 160,
  }), [document, width, height, measure.fontSize, measure.lineHeight, style.font, style.align, aspectRatios,
    reserveWidth, reserveHeight, reserveBottom]);

  const total = Math.max(1, flow.pageCount);
  const current = Math.min(page, total - 1);

  /**
   * The gesture that carries a picture across pages (`lib/editorialDrag.ts`).
   *
   * `frame` measures where this page sits on the screen, because a margin is a place on the screen and
   * `gesture.moveX` is measured against it. `moveGesture` is the machine's one door: every handler below
   * posts an event and draws whatever the machine now says, so a state can never be set by a handler that
   * was not allowed to set it.
   */
  const frame = useRef<View>(null);
  const frameOrigin = useRef({ x: 0, y: 0 });
  const gestureRef = useRef<EditorialGesture>(editorialGestureIdle);
  const [gesture, setGesture] = useState<EditorialGesture>(editorialGestureIdle);
  const moveGesture = useCallback((event: Parameters<typeof editorialGesture>[1]) => {
    gestureRef.current = editorialGesture(gestureRef.current, event);
    setGesture(gestureRef.current);
    return gestureRef.current;
  }, []);

  /** The finger took a picture: the article stands on the page the reader can see. */
  const beginDrag = useCallback((blockId: string) => {
    moveGesture({ type: 'begin', blockId, page: current, dx: 0, dy: 0 });
  }, [current, moveGesture]);

  /** The finger moved: which margin it is in is decided here, in the page's own points. */
  const moveDrag = useCallback((dx: number, dy: number, moveX: number) => {
    moveGesture({ type: 'move', dx, dy, edge: editorialEdge(Number(moveX) - frameOrigin.current.x, width) });
  }, [moveGesture, width]);

  /**
   * Held in a margin, the article turns one page after the dwell and the drag goes on: that is how a
   * picture reaches a page the finger could not otherwise touch. The timer belongs to the edge, so leaving
   * the band before the dwell cancels the turn instead of surprising the author with one.
   */
  useEffect(() => {
    if (gesture.state !== 'EDGE_PAGING' || !gesture.edge) return;
    const timer = setTimeout(() => {
      const next = editorialGesture(gestureRef.current, { type: 'dwell', pages: total });
      if (next.page === gestureRef.current.page) return;
      gestureRef.current = next;
      setGesture(next);
      listRef.current?.scrollToIndex({ index: next.page, animated: false });
      setPage(next.page);
    }, EDITORIAL_EDGE_DWELL_MS);
    return () => clearTimeout(timer);
  }, [gesture.edge, gesture.page, gesture.state, total]);

  /**
   * The page the caret sits on, as a plain number.
   *
   * The composer follows the author only when the *words* carry the caret onto another page. Watching
   * the current page here instead would call the pager back on every flip - a picture parked on a page
   * the caret is not on could never be reached, so it could never be selected or dragged.
   */
  const caretPage = useMemo(() => {
    if (!editable || caret.start !== caret.end) return null;
    const block = map.blocks.find((entry) => caret.start >= entry.start && caret.start <= entry.end);
    if (!block) return null;
    const local = caret.start - block.start;
    const line = flow.pages.flatMap((entry) => entry.lines).find((entry) => (
      entry.blockId === block.id && local >= entry.start && local <= entry.end
    ));
    return line ? line.page : null;
  }, [caret, editable, flow.pages, map.blocks]);

  useEffect(() => {
    if (caretPage === null) return;
    listRef.current?.scrollToIndex({ index: caretPage, animated: false });
    setPage(caretPage);
  }, [caretPage]);

  /**
   * A shorter article must not leave the pager parked past its last page.
   *
   * Arranging a picture can make the article shorter (words move up beside it) while the author is
   * looking at the old last page. The list would keep that offset and show an empty page, so the
   * composer pulls itself back onto the page that still exists.
   */
  useEffect(() => {
    if (page <= total - 1) return;
    setPage(total - 1);
    listRef.current?.scrollToOffset({ offset: (total - 1) * width, animated: false });
  }, [page, total, width]);

  const selectAt = useCallback((blockId: string, offset: number, requestFocus = true) => {
    setCaret({ start: offset, end: offset });
    if (requestFocus) setFocusNonce((value) => value + 1);
    const block = document.blocks.find((entry) => entry.id === blockId);
    onSelectBlock?.({ blockId, kind: block?.type === 'media' ? 'media' : 'text' });
  }, [document.blocks, onSelectBlock]);

  const onSelectionChange = useCallback((event: NativeSyntheticEvent<{ selection: { start: number; end: number } }>) => {
    const selection = event.nativeEvent.selection;
    setCaret({ start: selection.start, end: selection.end });
    const block = map.blocks.find((entry) => selection.start >= entry.start && selection.start <= entry.end);
    if (block) {
      const source = document.blocks.find((entry) => entry.id === block.id);
      onSelectBlock?.({ blockId: block.id, kind: source?.type === 'media' ? 'media' : 'text' });
    }
  }, [document.blocks, map.blocks, onSelectBlock]);

  const onChangeText = useCallback((value: string) => {
    if (!onChangeDocument) return;
    onChangeDocument(applyPlainText(document, value.slice(0, TEXT_MAX_CHARS)));
  }, [document, onChangeDocument]);

  useEffect(() => {
    if (focusNonce > 0) inputRef.current?.focus();
  }, [focusNonce]);

  /**
   * Where the author let go of a picture.
   *
   * A sideways drag chooses the side the words wrap on. A vertical drag chooses the *words* it stands
   * beside: the paragraph under the finger is cut at the line the picture was dropped over, so the
   * picture lands exactly there and the rest of the sentence flows on below it. The picture is never
   * re-ordered past a whole paragraph any more, because on a page that is one long paragraph "swap
   * with the next block" meant "jump to the very end" - which read as the picture refusing to move.
   */
  const dropMedia = useCallback((blockId: string, box: EditorialMediaBox, dx: number, dy: number, pageOnScreen = box.page) => {
    if (!onChangeDocument) return;
    let next = document;
    if (Math.abs(dx) >= Math.max(16, width * 0.045) && Math.abs(dx) > Math.abs(dy)) {
      const side = dx < 0 ? 'left' : 'right';
      next = setMediaPlacement(next, blockId, side);
      const block = next.blocks.find((entry) => entry.id === blockId);
      if (block && block.type === 'media') {
        /**
         * Words need a column. A picture that fills the measure, or that leaves a sliver too narrow for
         * a word, has to be narrowed before it can sit beside the text: otherwise the engine finds no
         * free interval, starts a new page and the page reads as a picture alone with the paragraph
         * pushed after it.
         */
        next = setMediaWidth(next, blockId, Math.min(block.widthFraction, WRAP_WIDTH_LIMIT));
        next = setMediaWrap(next, blockId, true);
      }
    }
    if (Math.abs(dy) >= Math.max(12, measure.lineHeight * 0.75)) {
      /**
       * The finger points at a line, and a page is only a slice of the article: a drop near the foot of a
       * page has to be able to reach the words that begin the next one. Rows are therefore compared in the
       * article's own vertical axis, not the page's, and the page is the one the article is showing *now*
       * (`pageOnScreen`): a drag that turned three pages with the dwell would otherwise drop the picture
       * back where it started.
       */
      const dropY = editorialDropLine(pageOnScreen, height, box.y + dy + box.height / 2);
      const target = nearestLine(flow.pages, dropY, height);
      if (target) next = placeMediaBlockAt(next, blockId, { blockId: target.blockId, offset: target.start });
    }
    /** A gesture that asks for the arrangement the page already has is not a step in the history. */
    if (JSON.stringify(next.blocks) === JSON.stringify(document.blocks)) return;
    onChangeDocument(next, true);
  }, [document, flow.pages, height, measure.lineHeight, onChangeDocument, width]);

  /**
   * Letting go: the machine names the page the picture lands on, the drop is applied once, and the
   * gesture goes back to reading. `page` is the page the dwell carried the article to, which is the fact a
   * test can read without a screenshot.
   */
  const endDrag = useCallback((blockId: string, box: EditorialMediaBox, dx: number, dy: number) => {
    const released = moveGesture({ type: 'release' });
    if (released.state !== 'DROP') return;
    const landedOn = released.page;
    moveGesture({ type: 'clear' });
    dropMedia(blockId, box, dx, dy, landedOn);
  }, [dropMedia, moveGesture]);

  /** One step per gesture: the width is previewed under the finger and committed once on release. */
  const resizeMedia = useCallback((blockId: string, fraction: number) => {
    if (!onChangeDocument) return;
    const next = setMediaWidth(document, blockId, fraction);
    if (JSON.stringify(next.blocks) === JSON.stringify(document.blocks)) return;
    onChangeDocument(next, true);
  }, [document, onChangeDocument]);

  const caretLine = useMemo(() => {
    if (!editable || caret.start !== caret.end) return null;
    const block = map.blocks.find((entry) => caret.start >= entry.start && caret.start <= entry.end);
    if (!block) return null;
    const local = caret.start - block.start;
    const lines = flow.pages.flatMap((entry) => entry.lines).filter((entry) => entry.blockId === block.id);
    const line = lines.find((entry) => local >= entry.start && local <= entry.end) ?? lines[lines.length - 1];
    if (!line) return null;
    const prefix = line.text.slice(0, Math.max(0, Math.min(line.text.length, local - line.start)));
    const textWidth = measureTextWidth(line.text, line.fontSize, style.font, line.heading);
    const centered = line.align === 'center' ? Math.max(0, (line.width - textWidth) / 2) : 0;
    return {
      page: line.page,
      x: line.x + centered + measureTextWidth(prefix, line.fontSize, style.font, line.heading),
      y: line.y,
      height: line.lineHeight,
    };
  }, [caret, editable, flow.pages, map.blocks, style.font]);

  const hasText = document.blocks.some((block) => block.type === 'paragraph' || block.type === 'heading');
  const focusEditor = useCallback(() => {
    const end = map.text.length;
    setCaret({ start: end, end });
    setFocusNonce((value) => value + 1);
    onSelectBlock?.(null);
  }, [map.text.length, onSelectBlock]);

  return (
    <View
      ref={frame}
      style={[styles.frame, { width, height, backgroundColor: palette.background }]}
      accessibilityLabel={accessibilityLabel}
      onLayout={() => {
        frame.current?.measureInWindow((x, y) => { frameOrigin.current = { x, y }; });
      }}
    >
      <FlatList
        ref={listRef}
        data={flow.pages.map((entry) => entry.index)}
        keyExtractor={(index) => `page-${index}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={total > 1}
        onMomentumScrollEnd={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
          const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width));
          setPage(Math.max(0, Math.min(total - 1, next)));
        }}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({ offset: info.index * width, animated: false });
        }}
        renderItem={({ item: index }) => {
          const entry = flow.pages[index];
          if (!entry) return null;
          return (
            <View style={{ width, height, backgroundColor: palette.background }}>
              {/**
               * The one place the author's theme still colours the page: a two-point rule at its head,
               * the same accent the wall's cell draws above its title. It decorates, it never spells.
               */}
              <View style={[styles.accent, { backgroundColor: palette.accent }]} />
              {editable && !hasText ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Începe textul paginii"
                  onPress={focusEditor}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
              {entry.lines.map((line) => {
                const place = {
                  position: 'absolute' as const,
                  left: line.x,
                  top: line.y,
                  width: line.width,
                  height: line.lineHeight,
                };
                const type = {
                  color: palette.text,
                  fontFamily: bodyFont,
                  fontSize: line.fontSize,
                  lineHeight: line.lineHeight,
                  fontWeight: line.heading ? '700' as const : '400' as const,
                  textAlign: line.align,
                };
                /**
                 * A published line keeps the marks inside it: `#subiect` opens its tag page and `@nume`
                 * opens that creator's profile, exactly as in a caption - a tag written in an article
                 * that does nothing when touched is a dead word. The mark keeps the paragraph's weight
                 * because a bolder word is wider than the width the flow reserved for this line.
                 */
                if (!editable) {
                  return (
                    <View key={`${line.blockId}-${line.start}-${line.page}`} style={place}>
                      <RichText
                        text={line.text}
                        numberOfLines={1}
                        ellipsizeMode="clip"
                        style={type}
                        hashtagStyle={[styles.mark, { color: palette.mark }]}
                        mentionStyle={[styles.mark, { color: palette.mark }]}
                        linkStyle={[styles.mark, { color: palette.mark, textDecorationLine: 'underline' }]}
                      />
                    </View>
                  );
                }
                return (
                  <Pressable
                    key={`${line.blockId}-${line.start}-${line.page}`}
                    onPress={(event) => {
                      const localX = Math.max(0, Math.min(line.width, event.nativeEvent.locationX));
                      const textWidth = measureTextWidth(line.text, line.fontSize, style.font, line.heading);
                      const centered = line.align === 'center' ? Math.max(0, (line.width - textWidth) / 2) : 0;
                      const relative = Math.max(0, localX - centered);
                      let offset = line.text.length;
                      for (let cursor = 0; cursor <= line.text.length; cursor++) {
                        if (measureTextWidth(line.text.slice(0, cursor), line.fontSize, style.font, line.heading) >= relative) {
                          offset = cursor;
                          break;
                        }
                      }
                      const block = map.blocks.find((candidate) => candidate.id === line.blockId);
                      selectAt(line.blockId, (block?.start ?? 0) + line.start + offset);
                    }}
                    style={place}
                  >
                    <Text allowFontScaling={false} numberOfLines={1} ellipsizeMode="clip" style={type}>
                      {line.text}
                    </Text>
                  </Pressable>
                );
              })}
              {entry.media.map((box) => (
                <EditorialMediaView
                  key={box.blockId}
                  box={box}
                  source={media.find((item) => item.mediaIndex === box.mediaIndex) ?? null}
                  selected={box.blockId === selectedMediaId}
                  editable={editable}
                  active={active && box.page === index}
                  accent={palette.accent}
                  contentWidth={flow.contentWidth}
                  onDragStart={() => beginDrag(box.blockId)}
                  onDragMove={(dx, dy, moveX) => moveDrag(dx, dy, moveX)}
                  onDrop={(dx, dy) => endDrag(box.blockId, box, dx, dy)}
                  onResize={(fraction) => resizeMedia(box.blockId, fraction)}
                  onSelect={() => onSelectBlock?.({ blockId: box.blockId, kind: 'media' })}
                  onOpenPhoto={photoItems.length ? openPhoto : undefined}
                />
              ))}
              {editable && caretLine && caretLine.page === index ? (
                <View
                  pointerEvents="none"
                  style={[styles.caret, {
                    left: caretLine.x,
                    top: caretLine.y,
                    height: caretLine.height,
                    // A caret is read, not decorated: it takes the paper's mark, never the theme accent.
                    backgroundColor: palette.mark,
                  }]}
                />
              ) : null}
              {!hasText && !entry.media.length && editable ? (
                <Text
                  pointerEvents="none"
                  allowFontScaling={false}
                  style={[styles.placeholder, {
                    color: `${palette.text}99`,
                    fontFamily: bodyFont,
                    fontSize: measure.fontSize,
                  }]}
                >
                  Scrie o pagină. Un gând, o observație, un fragment din pădure.
                </Text>
              ) : null}
            </View>
          );
        }}
      />
      {total > 1 ? (
        <View pointerEvents="none" style={styles.badge} accessibilityLabel={`Pagina ${current + 1} din ${total}`}>
          <Text allowFontScaling={false} style={styles.badgeText}>{`${current + 1}/${total}`}</Text>
        </View>
      ) : null}
      {editable ? (
        <TextInput
          ref={inputRef}
          value={map.text}
          onChangeText={onChangeText}
          onSelectionChange={onSelectionChange}
          selection={caret}
          multiline
          maxLength={TEXT_MAX_CHARS}
          editable
          caretHidden
          autoCorrect={false}
          autoCapitalize="sentences"
          accessibilityLabel="Textul postării"
          style={styles.hiddenInput}
        />
      ) : null}
      {photoItems.length ? (
        <PhotoViewer
          photos={photoItems.map((photo) => photo.item)}
          open={photoViewer.open}
          startIndex={photoViewer.index}
          onClose={() => setPhotoViewer((current) => ({ ...current, open: false }))}
        />
      ) : null}
    </View>
  );
}

/**
 * The line the dropped picture is standing over: the one whose centre is nearest the finger.
 *
 * Rows are the only thing a finger can point at inside a paragraph, and a row is exactly the unit the
 * flow engine already cut: anchoring to a line start means the cut lands on a word boundary the words
 * themselves chose, never inside a letter. Pages are stacked one under the other, so every row is
 * measured on the article's vertical axis and a drop can cross from one page into the next.
 */
function nearestLine(pages: EditorialFlowPage[], y: number, pageHeight: number): EditorialLine | null {
  let best: EditorialLine | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const page of pages) {
    for (const line of page.lines) {
      const gap = Math.abs(page.index * pageHeight + line.y + line.lineHeight / 2 - y);
      if (gap < distance) {
        distance = gap;
        best = line;
      }
    }
  }
  return best;
}

/**
 * The picture on a page, under the author's hand.
 *
 * A gesture is *previewed*, not committed row by row: the box follows the finger and the handle sets
 * the width, and exactly one document edit happens on release. That is what makes Undo restore the
 * page before the gesture and what lets the flow re-wrap the words once, at the end.
 */
function EditorialMediaView({
  box, source, selected, editable, active, accent, contentWidth, onDrop, onDragStart, onDragMove, onResize, onSelect, onOpenPhoto,
}: {
  box: EditorialMediaBox;
  source: EditorialMediaSource | null;
  selected: boolean;
  editable: boolean;
  active: boolean;
  accent: string;
  /** The width the words may use, so a resize is stored as the share the document keeps. */
  contentWidth: number;
  /** Where the picture was let go, in page coordinates; the page decides what that means. */
  onDrop: (dx: number, dy: number) => void;
  /** The finger took the picture: the page machine begins its drag. */
  onDragStart: () => void;
  /** The finger moved: `moveX` is its place on the screen, which is how the margins are read. */
  onDragMove: (dx: number, dy: number, moveX: number) => void;
  /** The width the author settled on, as a share of the content width. */
  onResize: (widthFraction: number) => void;
  onSelect: () => void;
  /** The reader opens the pressed photograph; a draft has no full-screen viewer. */
  onOpenPhoto?: (mediaIndex: number) => void;
}) {
  const frame = useRef({ contentWidth, box });
  frame.current = { contentWidth, box };
  const doors = useRef({ onSelect, onDrop, onDragStart, onDragMove, onResize });
  doors.current = { onSelect, onDrop, onDragStart, onDragMove, onResize };
  /** The finger's own offsets, so the picture stands under it instead of waiting for the release. */
  const [drag, setDrag] = useState({ dx: 0, dy: 0 });
  const [dragging, setDragging] = useState(false);
  const [width, setWidth] = useState<number | null>(null);
  const start = useRef({ fraction: 0 });

  const fractionOf = useCallback((dx: number) => {
    const current = frame.current;
    const raw = start.current.fraction + dx / Math.max(1, current.contentWidth);
    return Math.min(MAX_MEDIA_WIDTH_FRACTION, Math.max(MIN_MEDIA_WIDTH_FRACTION, raw));
  }, []);

  const dragGesture = useRef(PanResponder.create({
    /**
     * Bubbling, never capture: the resize grip is a child of the picture, and a parent that claims the
     * touch in the capture phase would make the grip unreachable. Becoming the responder is itself what
     * tells the native pager and scroller to keep their hands off the gesture.
     */
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    /** The pager and the composer's scroller must not take the gesture back in the middle of a drag. */
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      doors.current.onSelect();
      doors.current.onDragStart();
      setDragging(true);
      setDrag({ dx: 0, dy: 0 });
    },
    onPanResponderMove: (_event, gesture) => {
      setDrag({ dx: gesture.dx, dy: gesture.dy });
      /** The page machine reads the margins from the finger's place on the screen (`gesture.moveX`). */
      doors.current.onDragMove(gesture.dx, gesture.dy, gesture.moveX);
    },
    onPanResponderRelease: (_event, gesture) => {
      setDragging(false);
      setDrag({ dx: 0, dy: 0 });
      doors.current.onDrop(gesture.dx, gesture.dy);
    },
    onPanResponderTerminate: () => {
      setDragging(false);
      setDrag({ dx: 0, dy: 0 });
    },
  })).current;


  const resizeGesture = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      const current = frame.current;
      start.current = { fraction: current.box.width / Math.max(1, current.contentWidth) };
      doors.current.onSelect();
    },
    onPanResponderMove: (_event, gesture) => setWidth(fractionOf(gesture.dx) * frame.current.contentWidth),
    onPanResponderRelease: (_event, gesture) => {
      setWidth(null);
      doors.current.onResize(fractionOf(gesture.dx));
    },
    onPanResponderTerminate: () => setWidth(null),
  })).current;

  const localImage = source && !source.item ? source.uri : null;
  const picture = localImage ? (
    <Image source={{ uri: localImage }} resizeMode="contain" style={styles.fill} />
  ) : (
    <RemoteImage item={source?.item ?? null} fit="contain" style={styles.fill} />
  );
  const opensPhoto = Boolean(
    !editable && onOpenPhoto && box.mediaType === 'image' && (localImage || source?.item),
  );
  /**
   * The box under the finger: a live width while the handle moves, and the finger's own offsets while
   * the picture is dragged. The height follows the width so the photograph keeps its proportions the
   * way the flow will draw it once the gesture is committed.
   */
  const previewWidth = Math.max(1, width ?? box.width);
  const previewHeight = box.width > 0 ? (box.height * previewWidth) / box.width : box.height;
  const moving = dragging || Math.abs(drag.dx) > 0.5 || Math.abs(drag.dy) > 0.5;

  return (
    <View
      {...(editable ? dragGesture.panHandlers : {})}
      style={[
        styles.mediaBox,
        { left: box.x, top: box.y, width: previewWidth, height: previewHeight },
        moving ? { transform: [{ translateX: drag.dx }, { translateY: drag.dy }], opacity: 0.9 } : null,
        selected || moving ? { borderWidth: 2, borderColor: accent } : null,
      ]}
      accessibilityRole={editable ? 'imagebutton' : 'image'}
      accessibilityLabel={box.mediaType === 'video' ? 'Clipul paginii' : 'Fotografia paginii'}
      accessibilityHint={editable
        ? 'Atinge pentru selectare. Trage în sus sau în jos ca s-o așezi între cuvinte; la stânga sau la dreapta, ca să alegi partea de care se lipesc cuvintele.'
        : undefined}
    >
      {source?.mediaType === 'video' || box.mediaType === 'video' ? (
        source?.item ? (
          <RemoteVideo
            item={source.item}
            fit="contain"
            style={styles.fill}
            active={active}
            muted
            loop
            nativeControls
          />
        ) : (
          <View style={styles.clipPlate}>
            <Text allowFontScaling={false} style={styles.clipText}>CLIP</Text>
          </View>
        )
      ) : opensPhoto ? (
        <Pressable
          accessibilityRole="imagebutton"
          accessibilityLabel="Deschide fotografia paginii"
          accessibilityHint="Se deschide pe tot ecranul."
          onPress={() => onOpenPhoto?.(box.mediaIndex)}
          style={styles.fill}
        >
          {picture}
        </Pressable>
      ) : picture}
      {editable && selected ? (
        <>
          <View pointerEvents="none" style={[styles.selectionRing, { borderColor: accent }]} />
          <View
            {...resizeGesture.panHandlers}
            style={[styles.resizeHit, { borderColor: accent }]}
            accessibilityRole="adjustable"
            accessibilityLabel="Lățimea fotografiei"
            accessibilityHint="Trage spre dreapta ca s-o lărgești, spre stânga ca s-o îngustezi."
          >
            <View style={[styles.resizeGrip, { backgroundColor: accent }]} />
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  accent: { position: 'absolute', left: 26, top: 20, width: 34, height: 3, borderRadius: 2 },
  caret: { position: 'absolute', width: 2, borderRadius: 1 },
  placeholder: {
    position: 'absolute', left: 26, right: 26, top: 52, lineHeight: 32, opacity: 0.9,
  },
  mediaBox: { position: 'absolute', overflow: 'hidden', backgroundColor: '#00000010' },
  selectionRing: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderWidth: 1,
  },
  /**
   * A 44dp target for a 12dp grip: a thumb that misses the dot by a millimetre still resizes, which is
   * the difference between a handle that works on a phone and one that only works with a mouse.
   */
  resizeHit: {
    position: 'absolute', right: -8, bottom: -8, width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.02)',
  },
  resizeGrip: { width: 12, height: 12, borderRadius: 6 },
  mark: { fontWeight: '400' },
  clipPlate: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0b0e' },
  clipText: { color: '#f6f8fb', fontSize: 11, fontWeight: '800', letterSpacing: 2.4 },
  badge: {
    position: 'absolute', right: 10, bottom: 8, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10, backgroundColor: 'rgba(8,10,13,0.72)',
  },
  badgeText: { color: 'rgba(255,255,255,0.86)', fontSize: 11, fontWeight: '700' },
  hiddenInput: {
    position: 'absolute', left: 0, top: 0, width: 1, height: 1, opacity: 0.01,
    color: 'transparent', backgroundColor: 'transparent', padding: 0,
  },
});
