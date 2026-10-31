import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler, FlatList, Image, Keyboard, PanResponder, Platform, Pressable, StyleSheet, Text, TextInput, View,
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
  placeMediaBlockAt, setBlockText, setMediaPlacement, setMediaWidth, setMediaWrap,
  MAX_MEDIA_WIDTH_FRACTION, MIN_MEDIA_WIDTH_FRACTION,
  type EditorialDocument, TEXT_MAX_CHARS,
} from '../lib/editorialDocument';
import { editorialSizeFor, type EditorialMediaSource } from '../lib/editorialPost';
import { mediaHeaders } from '../lib/session';
import { resolveMediaUri } from '../lib/mediaCache';
import { fontFamilyFor, metricFaceFor, pagePaletteOf, sizeOf, TEXT_SELECTION_COLOR, type TextStyle } from '../lib/textStyle';
import type { PageMode } from '../lib/pageMode';
import { insertAtSelection, snapSelection, type TextSelection } from '../lib/textInsert';
import { RAIL_LINE_AIR, PAGE_FOLIO, folioLabel, pageFolioBand, type RailReserve } from '../lib/textPage';
import { editorialType } from '../theme/editorial';

/**
 * One editorial page, drawn as the article it will publish.
 *
 * The page is a real flow (`editorialFlow`): words wrap around a left or right picture and continue
 * across the full measure after it, while a full-width picture is a block above and below the words.
 * The same component draws the composer and the published reader; `editable` adds the paper's tap
 * target, the field and the media handles.
 *
 * Editing is one native field, never a hidden one. The page is drawn by the flow as absolutely placed
 * lines, so it holds no editable view under the finger — Android would have nothing to select in and no
 * clipboard menu to show. A tap *anywhere* on the paper (a word, the gap between two paragraphs, the
 * margin) therefore opens the field: a real, visible, focused multiline `TextInput` carrying the
 * paragraph the finger pointed at, in the page's own face and ink. Typing, the caret, the selection
 * handles and Android's own text toolbar (Copy, Paste, Select all) all belong to that field, and "Gata"
 * writes it back through `setBlockText` and returns to the flow-rendered page.
 *
 * Owner, 29 October 2026: „apăs lung pe text și nu se întâmplă nimic”. The invisible 1×1 input that
 * used to hold the words is gone: a phone cannot select text it cannot see, and a press that has to be
 * held on an exact line before anything appears reads as a dead page.
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

/**
 * How long a finger rests on a line before the field opens — 420ms, a little shorter than Android's own
 * long-press threshold (500ms), because the page is a *reading* surface: a press that lasts long enough to be
 * a selection should feel like a selection, not like waiting for the system.
 */
const FIELD_HOLD_MS = 420;

export function EditorialPage({
  document, style, media, width, height, editable = false, active = true,
  selectedMediaId = null, railReserve, onSelectBlock, onChangeDocument, onFieldChange, insertRequest,
  focusRequest, accessibilityLabel, folio, mode = 'paper',
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
  /**
   * The paragraph the field holds, reported on every change and `null` once it closes.
   *
   * The composer needs this because the field is a *second* source of words beside `document`: while it is
   * open, the committed page is missing whatever has been typed or pasted into it. Handing the words up
   * lets the composer derive the exact page (`setBlockText`) for the character counter, for `Publică` and
   * for the draft it saves — instead of publishing the page as it was *before* the field was opened, which
   * is what the owner saw as „publică textul vechi" (round 29).
   */
  onFieldChange?: (field: { blockId: string | null; text: string } | null) => void;
  /**
   * An emoji (or any short text) the composer wants typed into the paragraph being written.
   *
   * The composer used to rebuild the *whole* article from `body` when an emoji was pressed, which silently
   * threw away whatever the open field held — the paste was replaced by the old words. An insert request is
   * applied here, in the field, where the author is actually writing; the nonce makes the same emoji twice
   * two inserts.
   */
  insertRequest?: { text: string; nonce: number } | null;
  /**
   * A request to open the field and put the caret in it, spent once per change of the number.
   *
   * The composer's toolbar keeps a „Tastatură" door: while a panel (emoji, face, measure) is open the
   * keyboard is away, and choosing to go back to writing has to bring it back — the author pressed a door
   * that says *keyboard*, and finding the paper inert under the thumb would read as a broken button. The
   * field is opened here (a paragraph of its own, as a tap does) and focused after the sheet has mounted.
   */
  focusRequest?: number;
  accessibilityLabel?: string;
  /**
   * The row this page prints its folio in (`lib/textPage.ts::folioRow`).
   *
   * `undefined` — the composer, the feed, the composer's receipt — keeps `PAGE_FOLIO`: the digits at
   * `PAGE_FOLIO.inset` and the flow keeping `pageFolioBand()` above them. The reader opened from a profile
   * passes `PROFILE_FOLIO` (round 32): the digits stand 9dp closer to the foot, in the paper the page got
   * back when its foot door was removed. The *flow* is deliberately left on the same `max(band, 6.4%)`
   * margin, so the line breaks of an authored article — and therefore its page count — cannot move with
   * the number's position.
   */
  folio?: { band: number; inset: number };
  /**
   * Cum se citește pagina (runda 46): hârtia caldă de până acum sau negrul mat al cititorului de noapte.
   *
   * Este o **preferință a cititorului** (`lib/pageMode.ts`), nu o proprietate a rândului: compozitorul o
   * lasă pe cea implicită (`paper`), iar cititorul o dă mai departe din comutatorul din capul paginii.
   * Structura, măsura, rândurile și fotografiile rămân exact aceleași — se schimbă numai perechea de
   * culori din care pagina își ia cerneala și hârtia.
   */
  mode?: PageMode;
}) {
  /**
   * The page is painted from `pagePaletteOf`, not from the theme of the stored style: warm paper under
   * the words, dark ink for them, and the author's theme kept as the one accent the page decorates
   * itself with (the rule at its head, the frame of a selected picture). The composer, the feed and the
   * reader all mount this component, so a stored `jungle` page and a page typed this evening open on
   * the same paper — the theme never paints the background here.
   */
  const palette = pagePaletteOf(style, mode);
  const measure = sizeOf(editorialSizeFor(document, style));
  const bodyFont = fontFamilyFor(style.font, Platform.OS) ?? 'serif';
  /**
   * The face the flow *measures* with, which is not the face the page is *drawn* in: the metric tables come
   * from three font files (`lib/fontMetrics.ts`), while the six faces the author can choose are drawn by the
   * system. `metricFaceFor` pairs each authored face with the table that can only over-estimate it, so a line
   * the flow thinks fits is a line React Native can draw without cutting its last word.
   */
  const metricFont = metricFaceFor(style.font);
  const [aspectRatios, setAspectRatios] = useState<Record<number, number>>({});
  const mediaKey = media.map((entry) => `${entry.mediaIndex}:${entry.uri}`).join('|');
  const [page, setPage] = useState(0);
  /**
   * The paragraph being edited in the *field* — a real, visible, native `TextInput` that a tap anywhere on
   * the paper opens (owner, 29 October 2026: „nu pot să lipesc text din browser").
   *
   * A page of words is drawn by the flow as absolutely placed lines, so there is no native editable view
   * under the finger: the old implementation kept the words in a 1×1 field that only the keyboard talked
   * to, and a line under the finger was just a `Pressable` — no selection, no handles, no Paste. The sheet
   * below is a genuine field for the one paragraph the author is writing in, so Android's own text menu
   * (Copy, Paste, Select all) works where the words are, while the page's composition stays the flow's.
   *
   * `caret` is the offset a tap asked for, spent once: it pins the selection for the first frame so the
   * cursor lands where the finger did, and the first `onSelectionChange` releases it, because a controlled
   * selection that outlives the tap would drag the caret back on every re-render.
   */
  const [field, setField] = useState<{
    blockId: string | null;
    text: string;
    /**
     * The tap's place, spent once (see `openField`): a one-shot pin for the first frame of the sheet.
     */
    caret: number | null;
    /**
     * The range the phone last reported for this field, in offsets of `text`.
     *
     * This is what the emoji panel types into. It used to be thrown away — `onSelectionChange` spent
     * the event on releasing the pin and nothing kept the range — so a pressed emoji could only be
     * appended to the end of the paragraph (`JUNGLE_BOOK_PROGRESS.md` §33.2). `null` means the field
     * has not reported a selection since it was opened.
     */
    selection: TextSelection | null;
  } | null>(null);
  const fieldRef = useRef<TextInput>(null);
  /**
   * Unde era cursorul când s-a închis câmpul.
   *
   * „Gata” (și butonul Înapoi al telefonului) aruncă foaia, și cu ea intervalul pe care autorul îl
   * așezase. Bara compozitorului — deci și „Emoji” — stă sub tastatură cât timp foaia e deschisă, iar
   * butonul Înapoi al telefonului închide foaia (nu doar tastatura), deci pe un telefon real drumul spre
   * panoul de emoji trece *după* închiderea câmpului. Fără acest ref, fiecare emoji ajungea la sfârșitul
   * paragrafului, exact raportul din 28 octombrie 2026 (§33.2), fiindcă `else`-ul din efectul de inserare
   * nu avea ce cursor să folosească. Este un ref, nu o stare: nu are voie să re-randeze pagina.
   */
  const lastCaretRef = useRef<{ blockId: string | null; offset: number } | null>(null);
  const listRef = useRef<FlatList<number>>(null);

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

  /**
   * The two margins of the measure (owner, 28 October 2026: „textul nu folosește lățimea ecranului, deși are
   * loc până la butoane").
   *
   * A page that carries the rail gives the words everything the buttons do not stand on: a modest reading
   * margin on the left, and on the right only `RAIL_LINE_AIR` — the same six points that separate a line
   * from the buttons when a line reaches their height. The rail's own rectangle (`reserve` below) is what
   * keeps the lower right clear, so a second, symmetric margin there would be paper given away twice: the
   * page used to stand `max(18, 7.2 %)` on *both* sides — 46dp of empty paper on a 469dp phone, measured on
   * the owner's Xiaomi — above buttons that only stand in the corner.
   *
   * A page with no rail (the composer's preview) keeps the symmetric margin it has always composed with.
   */
  const margins = useMemo(() => {
    const symmetric = Math.max(18, Math.round(width * 0.072));
    if (!(reserveWidth > 0)) return { left: symmetric, right: symmetric };
    return { left: Math.max(12, Math.round(width * 0.032)), right: RAIL_LINE_AIR };
  }, [width, reserveWidth]);

  const flow = useMemo(() => flowEditorialDocument(document, {
    pageWidth: width,
    pageHeight: height,
    fontSize: measure.fontSize,
    lineHeight: measure.lineHeight,
    font: metricFont,
    align: style.align,
    headingSize: Math.round(measure.fontSize * 1.42),
    headingLine: Math.round(measure.lineHeight * 1.3),
    marginLeft: margins.left,
    marginRight: margins.right,
    marginTop: Math.max(20, Math.round(height * 0.052)),
    /**
     * The folio's band, taken from the foot of every page (owner, 30 October 2026: „numerotarea să fie
     * jos, ca într-o carte"). The flow is told the margin is never smaller than `PAGE_FOLIO.band`, so no
     * line can ever be laid out under the number — and because the number is *inside* the paper's own
     * margin rather than floating over it, the measure the author sees in the composer is the measure the
     * reader gets: the same `1/22` breaks in both.
     */
    marginBottom: Math.max(pageFolioBand(), Math.round(height * 0.064)),
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
  }), [document, width, height, measure.fontSize, measure.lineHeight, metricFont, style.align, aspectRatios,
    margins, reserveWidth, reserveHeight, reserveBottom]);

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

  const hasText = document.blocks.some((block) => block.type === 'paragraph' || block.type === 'heading');

  /**
   * Open the field for one paragraph — the only road to the phone's own selection menu and clipboard.
   *
   * A paragraph written before opens with its own words and, when the finger asked for a place, with the
   * caret already there. A page with no words yet opens with no block at all: whatever is typed becomes the
   * article's first paragraphs when the field closes.
   */
  const openField = useCallback((blockId: string | null, caret: number | null = null) => {
    if (!editable) return;
    const block = blockId === null ? null : document.blocks.find((entry) => entry.id === blockId);
    const words = block && (block.type === 'paragraph' || block.type === 'heading') ? block : null;
    const at = words && caret !== null ? Math.max(0, Math.min(words.text.length, caret)) : null;
    setField({
      blockId: words ? words.id : null,
      text: words ? words.text : '',
      caret: at,
      // The tap is also the first range: an emoji pressed before the phone reports a selection lands
      // under the finger, not at the end of the paragraph.
      selection: at === null ? null : { start: at, end: at },
    });
    // Degetul a spus unde: acesta este cursorul, până când altcineva îl mută.
    lastCaretRef.current = { blockId: words ? words.id : null, offset: at ?? (words ? words.text.length : 0) };
    onSelectBlock?.(null);
  }, [document.blocks, editable, onSelectBlock]);

  /**
   * Which paragraph the finger pointed at, and where in it.
   *
   * The flow already knows the line under a point, so the page does not guess: `lines` are the drawn rows of
   * this page, each carrying its block, its own slice of the paragraph and its measured width. A press in the
   * gap between two paragraphs (or on the paper under the last word) has no line and takes the nearest one
   * above it, so the finger always lands in *some* paragraph instead of in nothing.
   */
  const paragraphAt = useCallback((pointX: number, pointY: number) => {
    const sheet = flow.pages[current];
    if (!sheet || !sheet.lines.length) return { blockId: null as string | null, caret: null as number | null };
    const above = sheet.lines.filter((line) => line.y <= pointY);
    const under = above.length ? above[above.length - 1] : sheet.lines[0];
    const inside = pointY >= under.y && pointY <= under.y + under.lineHeight ? under : above[above.length - 1] ?? under;
    const localX = Math.max(0, Math.min(inside.width, pointX - inside.x));
    const textWidth = measureTextWidth(inside.text, inside.fontSize, metricFont, inside.heading);
    const centered = inside.align === 'center' ? Math.max(0, (inside.width - textWidth) / 2) : 0;
    const relative = Math.max(0, localX - centered);
    let offset = inside.text.length;
    for (let cursor = 0; cursor <= inside.text.length; cursor++) {
      if (measureTextWidth(inside.text.slice(0, cursor), inside.fontSize, metricFont, inside.heading) >= relative) {
        offset = cursor;
        break;
      }
    }
    return { blockId: inside.blockId, caret: inside.start + offset };
  }, [current, flow.pages, metricFont]);

  /**
   * Close the field and write its paragraph back.
   *
   * The words travel through `setBlockText` (`lib/editorialDocument.ts`): blank lines become paragraphs,
   * media and page breaks stay where they were arranged, and a paragraph emptied to nothing is removed
   * rather than stored blank (the server refuses a document with a blank paragraph, and a draft carrying one
   * would fail to publish a week later, for a reason nobody could see).
   */
  const closeField = useCallback(() => {
    const open = field;
    if (open) {
      // Cursorul supraviețuiește închiderii: bara cu „Emoji" este sub tastatură, deci emoji-ul se apasă
      // după „Gata", iar inserarea trebuie să știe unde stătea autorul (`lastCaretRef`).
      const range = open.selection ?? open.caret ?? open.text.length;
      lastCaretRef.current = { blockId: open.blockId, offset: typeof range === 'number' ? range : range.end };
    }
    setField(null);
    Keyboard.dismiss();
    if (!open || !onChangeDocument) return;
    const next = setBlockText(document, open.blockId, open.text);
    if (next !== document) onChangeDocument(next, false);
  }, [document, field, onChangeDocument]);

  /**
   * The words in the field, told to the composer (`onFieldChange`). Every character the author types is a
   * fact the caption depends on, and the composer cannot read it from `document`: the page is only written
   * on `Gata`.
   */
  useEffect(() => {
    onFieldChange?.(field ? { blockId: field.blockId, text: field.text } : null);
  }, [field, onFieldChange]);

  /**
   * An insert request lands at the caret.
   *
   * With the field open the emoji goes where the phone last reported the selection — replacing it if the
   * author had dragged over a range — and the caret is left right after it, so a second emoji pressed
   * without touching the field follows the first instead of jumping to the end (the report of 28 October
   * 2026: `JUNGLE_BOOK_PROGRESS.md` §33.2). With no field open it opens the last paragraph of the page
   * with the emoji already at its end (an empty page opens with just the emoji, and the first word typed
   * after it becomes the article). The request is spent once, by nonce — an effect that re-ran on a fresh
   * `field` object would type the emoji again on every keystroke.
   */
  const insertNonce = insertRequest?.nonce ?? 0;
  useEffect(() => {
    if (!insertRequest || !editable) return;
    const addition = insertRequest.text;
    setField((current) => {
      if (current) {
        // No range reported since the field opened and no tap place either: the end of the paragraph,
        // which is what "the author has not put the cursor anywhere" means.
        const range = current.selection ?? current.caret ?? current.text.length;
        const typed = insertAtSelection(current.text, addition, typeof range === 'number' ? { start: range, end: range } : range);
        return { ...current, text: typed.text, caret: typed.caret, selection: { start: typed.caret, end: typed.caret } };
      }
      /**
       * Foaia este închisă. „Gata" și butonul Înapoi al telefonului o închid, iar bara compozitorului
       * (deci „Emoji") stă sub tastatură cât timp e deschisă, așa că pe un telefon real acesta este
       * drumul pe care merge fiecare emoji. Cursorul lăsat de autor se respectă atâta timp cât
       * paragraful lui mai există; numai fără niciun cursor emoji-ul merge la sfârșitul ultimului
       * paragraf, care este ce are nevoie o pagină goală.
       */
      const retained = lastCaretRef.current;
      const remembered = retained && retained.blockId
        ? document.blocks.find((block) => block.id === retained.blockId)
        : null;
      const target = remembered && (remembered.type === 'paragraph' || remembered.type === 'heading') ? remembered : null;
      if (target) {
        const offset = Math.max(0, Math.min(target.text.length, retained!.offset));
        const typed = insertAtSelection(target.text, addition, { start: offset, end: offset });
        return { blockId: target.id, text: typed.text, caret: typed.caret, selection: { start: typed.caret, end: typed.caret } };
      }
      const last = [...document.blocks].reverse().find((block) => block.type === 'paragraph' || block.type === 'heading');
      const words = last && (last.type === 'paragraph' || last.type === 'heading') ? last : null;
      const typed = `${words ? words.text : ''}${addition}`;
      return { blockId: words ? words.id : null, text: typed, caret: typed.length, selection: { start: typed.length, end: typed.length } };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insertNonce]);

  /**
   * A focus request opens the field (if it is closed) and puts the caret in it.
   *
   * `autoFocus` covers the frame the sheet mounts on; the timer covers the other case — the sheet was already
   * open and only the keyboard was away (the author dismissed it with the system's back gesture) — where the
   * `TextInput` is mounted and merely unfocused. The timer is cleared on the next request so two presses of
   * „Tastatură" cannot focus a field that has been closed in between.
   */
  const focusNonce = focusRequest ?? 0;
  useEffect(() => {
    if (!editable || focusNonce === 0) return;
    setField((current) => {
      if (current) return current;
      const last = [...document.blocks].reverse().find((block) => block.type === 'paragraph' || block.type === 'heading');
      const words = last && (last.type === 'paragraph' || last.type === 'heading') ? last : null;
      return { blockId: words ? words.id : null, text: words ? words.text : '', caret: null, selection: null };
    });
    const timer = setTimeout(() => fieldRef.current?.focus(), 60);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  /**
   * The phone's own Back closes the field before it closes the composer, so a paragraph being pasted is
   * never lost to a thumb that meant "one step back".
   */
  useEffect(() => {
    if (!editable || !field) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { closeField(); return true; });
    return () => subscription.remove();
  }, [closeField, editable, field]);

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
          /**
           * Banda de sub cuvinte a plecat (runda 46).
           *
           * Runda 45 desena aici un strat măsurat pe rândurile fluxului. Ownerul a cerut contrariul, precis:
           * pe o postare de text se citește **numai capul**, iar corpul articolului rămâne curat — fără văl,
           * fără gradient peste hârtie. Rândurile au deci pagina goală sub ele, pe amândouă terenurile, iar
           * `firstLine`/`lastLine` nu mai sunt socotite deloc (o măsurătoare care nu se mai desenează este
           * o socoteală pe care nimeni nu o poate verifica).
           */
          return (
            <View style={{ width, height, backgroundColor: palette.background }}>
              {/**
               * The one place the author's theme still colours the page: a two-point rule at its head,
               * the same accent the wall's cell draws above its title. It decorates, it never spells.
               */}
              <View style={[styles.accent, { backgroundColor: palette.accent }]} />
              {editable ? (
                /**
                 * The paper itself is the door to the field.
                 *
                 * It sits *under* the lines and the pictures, so a word keeps its own, more exact handler and a
                 * photograph keeps its drag; everything else on the page — the gap between two paragraphs, the
                 * margin, the empty paper of a page with no words yet — opens the field for the nearest
                 * paragraph. Before this, only a press that landed exactly on a drawn line did anything, which
                 * on a phone reads as a page that ignores the finger (owner, 29 October 2026).
                 */
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={hasText ? 'Scrie în pagină' : 'Începe textul paginii'}
                  accessibilityHint="Deschide câmpul de scriere. Ține apăsat în câmp pentru a lipi text."
                  onPress={(event) => {
                    const point = paragraphAt(event.nativeEvent.locationX, event.nativeEvent.locationY);
                    openField(point.blockId, point.caret);
                  }}
                  onLongPress={(event) => {
                    const point = paragraphAt(event.nativeEvent.locationX, event.nativeEvent.locationY);
                    openField(point.blockId, point.caret);
                  }}
                  delayLongPress={FIELD_HOLD_MS}
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
                        allowFontScaling={false}
                        style={type}
                        hashtagStyle={[styles.mark, { color: palette.mark }]}
                        mentionStyle={[styles.mark, { color: palette.mark }]}
                        linkStyle={[styles.mark, { color: palette.mark, textDecorationLine: 'underline' }]}
                      />
                    </View>
                  );
                }
                /**
                 * A word is the most exact door there is: the press is measured against this line's own
                 * advances, so the caret lands on the character the finger is pointing at.
                 */
                const caretAt = (locationX: number) => {
                  const localX = Math.max(0, Math.min(line.width, locationX));
                  const textWidth = measureTextWidth(line.text, line.fontSize, metricFont, line.heading);
                  const centered = line.align === 'center' ? Math.max(0, (line.width - textWidth) / 2) : 0;
                  const relative = Math.max(0, localX - centered);
                  let offset = line.text.length;
                  for (let cursor = 0; cursor <= line.text.length; cursor++) {
                    if (measureTextWidth(line.text.slice(0, cursor), line.fontSize, metricFont, line.heading) >= relative) {
                      offset = cursor;
                      break;
                    }
                  }
                  return line.start + offset;
                };
                return (
                  <Pressable
                    key={`${line.blockId}-${line.start}-${line.page}`}
                    onPress={(event) => openField(line.blockId, caretAt(event.nativeEvent.locationX))}
                    /**
                     * Held, this line opens the field of *its own* paragraph at the same place: the same words,
                     * in a native editable view, with Android's selection menu (Paste included) on top of
                     * them. The hold is 420 ms — shorter than Android's own 500 ms — so the page answers the
                     * finger before the system does.
                     */
                    onLongPress={(event) => openField(line.blockId, caretAt(event.nativeEvent.locationX))}
                    delayLongPress={FIELD_HOLD_MS}
                    accessibilityRole="button"
                    accessibilityLabel={`Editează paragraful: ${line.text}`}
                    accessibilityHint="Deschide câmpul de scriere, cu meniul telefonului pentru lipire și copiere."
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
      {/**
        * The folio: the page's number, centred at the foot of the paper like a book's.
        *
        * It used to be a dark chip in the corner (`styles.badge`) — a black rectangle with white digits
        * over a cream page, standing on top of whatever the page had there. Now it is set type at the
        * foot, in the page's own ink at `PAGE_FOLIO.ink` of its strength, and the flow keeps
        * `PAGE_FOLIO.band` clear above it (`marginBottom`), so it is never printed over a word.
        */}
      {total > 1 ? (
        <View
          pointerEvents="none"
          style={[styles.folio, folio ? { bottom: folio.inset } : null]}
          accessibilityLabel={`Pagina ${current + 1} din ${total}`}
        >
          <Text
            allowFontScaling={false}
            style={[styles.folioText, { color: palette.text }]}
          >
            {folioLabel(current, total)}
          </Text>
        </View>
      ) : null}
      {/**
       * The field: one paragraph, in a native editable view, over the paper it belongs to.
       *
       * This is where Android's own text menu lives (`Paste`, `Copy`, `Select all`) and where the selection
       * handles and the keyboard behave as they do in any other field — the page behind it is the flow's
       * composition, not an input. It is deliberately *visible* and deliberately *paper*: the author has to
       * see the words they are selecting, and the sheet has to read as the same page, not as a dialog. The
       * words are written back on `Gata` (and by anything else that closes it), never on every keystroke,
       * because re-flowing the article under every character of a pasted page would be work nobody sees.
       *
       * Nothing sits above it: the sheet is the last child of the page frame and the field fills the sheet, so
       * the finger that comes down on a word is touching a real `EditText` — which is the whole point, because
       * a selection toolbar belongs to the text view and to nothing else on the screen.
       */}
      {editable && field ? (
        <View style={[StyleSheet.absoluteFill, styles.fieldSheet, { backgroundColor: palette.background }]}>
          <View style={styles.fieldHead}>
            <Text style={[styles.fieldTitle, { color: palette.mark }]}>PARAGRAFUL</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Gata"
              accessibilityHint="Salvează paragraful în pagină."
              onPress={closeField}
              style={styles.fieldDone}
              hitSlop={10}
            >
              <Text style={[styles.fieldDoneText, { color: palette.mark }]}>Gata</Text>
            </Pressable>
          </View>
          <Text style={[styles.fieldHint, { color: `${palette.text}99` }]}>
            Ține apăsat pe un cuvânt ca să copiezi, lipești sau selectezi tot.
          </Text>
          <TextInput
            ref={fieldRef}
            value={field.text}
            onChangeText={(text) => setField((current) => (current ? { ...current, text } : current))}
            /** The tap's place, spent once: the first selection change releases the pin. */
            selection={field.caret === null ? undefined : { start: field.caret, end: field.caret }}
            /**
             * The range the phone reports is the caret the emoji panel types at — kept, not just spent on
             * releasing the pin (`lib/textInsert.ts`). It is snapped on use, so a range that arrived
             * before a paste, or that points inside an emoji, cannot cut a character in half.
             */
            onSelectionChange={(event) => {
              const reported = snapSelection(field.text, event.nativeEvent.selection);
              // Ultimul cursor cunoscut, chiar dacă foaia se închide imediat după aceea.
              lastCaretRef.current = { blockId: field.blockId, offset: reported.end };
              setField((current) => (current ? { ...current, caret: null, selection: reported } : current));
            }}
            multiline
            autoFocus
            maxLength={TEXT_MAX_CHARS}
            allowFontScaling={false}
            textAlignVertical="top"
            selectionColor={TEXT_SELECTION_COLOR}
            autoCorrect={false}
            autoCapitalize="sentences"
            accessibilityLabel="Paragraful paginii"
            accessibilityHint="Câmpul de scriere. Ține apăsat pentru meniul telefonului: Lipire, Copiere, Selectează tot."
            placeholder="Scrie sau lipește textul paragrafului."
            placeholderTextColor={`${palette.text}66`}
            style={[styles.fieldInput, {
              color: palette.text,
              fontFamily: bodyFont,
              fontSize: measure.fontSize,
              lineHeight: measure.lineHeight,
            }]}
          />
        </View>
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
  /**
   * The page indicator of a page written in the composer, and the same folio the reader prints.
   *
   * Centred across the paper, sitting `PAGE_FOLIO.inset` above its foot — never in a corner and never on
   * a plate. `alignItems: 'center'` with both edges pinned is what makes it the *middle* of the page on
   * every width, from a narrow phone to a tablet, without a measured offset.
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
  /** The field a long press opens: the page's own paper, page margin and page type, with a head that says what
   * is being edited and one door out of it.
   *
   * It covers the page instead of floating over it (no border, no shadow, no scrim): what the author is
   * selecting must be the same words in the same ink as the page, and the only new thing on the screen is the
   * row at its top.
   */
  fieldSheet: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 14, gap: 10 },
  fieldHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  /** One line of instruction, because Android's own toolbar has to be found by a thumb, not by a manual. */
  fieldHint: { fontSize: 11, lineHeight: 15 },
  /** A 44dp target for a word: the door is read, the finger has to hit it. */
  fieldDone: { minHeight: 44, minWidth: 64, alignItems: 'flex-end', justifyContent: 'center' },
  fieldDoneText: { fontSize: 15, fontWeight: '800' },
  /** The field itself: the page's face and measure, so the printed page and the typed one read alike. */
  fieldInput: { flex: 1, padding: 0, margin: 0 },
});
