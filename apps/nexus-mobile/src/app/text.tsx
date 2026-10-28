/**
 * The TEXT composer: one article page, set and arranged by its author.
 *
 * This is the third mode beside PHOTO and VIDEO. It creates a **Post**, never a Reel (a clip alone is
 * still a Reel, because the store writes `kind = 'video'` for it). The page is a 9:16 article and it is
 * read in the feed through `post.text_style`; photographs attached to it stay inside the article.
 *
 * Four rules shape the screen:
 *
 * - there is exactly **one** page, drawn by `EditorialPage` from an editorial document: paragraphs,
 *   headings, media and page breaks. The author types into the page and sees the article as it will
 *   publish; there is no second text card and no preview modal;
 * - the words flow around a picture (left or right), continue over the full measure after it, and a
 *   full-width picture is a block above and below the text. Two pictures can share a page when they
 *   fit. The document is stored in `text_style.document`, validated by the same rules the server
 *   applies, so the published page reopens exactly as it was arranged;
 * - all writing goes through `applyDocument`: the caption sent on publish is the words of the page on
 *   screen, and a layout gesture keeps an undo snapshot;
 * - the look is one Kindle page and nothing else. Owner, 29 October 2026: „scoate selectorul de temă”.
 *   The page is the warm e-paper of `pagePaletteOf` — that was already true whatever theme was stored,
 *   because a theme only ever marked the page with its accent — so the six-swatch chooser was a control
 *   that changed a hairline and promised a colour the reader never prints. The composer now writes every
 *   page with `TEXT_DEFAULT_THEME`; the letter (LITERĂ) and the measure (MĂRIME) stay, because they change
 *   how the words are *set*, and alignment is the page's own left edge with no selector at all. The stored
 *   `background`/`text` pair is still the theme's own (the server refuses any other pair), but it is never
 *   painted: the colours of a page come from the palette, at paint time.
 *
 * The publishing details travel *inside the request body* (`visibility`, `publishing`), not as
 * client-side flags: `/api/posts` is the one authority that writes them. The draft is local and separate
 * from the camera's media manifest (`lib/textDraft.ts`); it survives a refusal and a cold start, and it
 * is removed only by a confirmed publish or an explicit discard.
 *
 * A confirmed publish does not go back to the camera it was opened from. The route under this composer is
 * `/camera` (`camera.tsx` pushes it), so `router.back()` used to land the author in a viewfinder they had
 * not asked for; the composer now dismisses the stack and opens `/post/:id` of the post the server
 * confirmed (`PublishedPost.id`), which is the only place the new page can be read, liked or commented on.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { blackSilver } from '../theme/blackSilver';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator, Alert, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch,
  Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialPage, type EditorialSelection } from '../components/EditorialPage';
import { TextToolbar, type TextToolbarPanel } from '../components/TextToolbar';
import { requirePageCapabilities, requireTextStyleContract } from '../lib/backendVersion';
import { loadEditorIdentity, type EditorIdentity } from '../lib/capturePublish';
import {
  appendMediaBlock, documentCharCount, documentPlainText, placeMediaBlockAtFraction, reconcileMedia, remapMediaIndexes,
  removeEditorialBlock, setBlockText, setDocumentTypography, setMediaPlacement, setMediaWidth, setMediaWrap,
  toggleHeadingBlock, type EditorialDocument, type EditorialMediaBlock, type EditorialPlacement, type EditorialTypography,
} from '../lib/editorialDocument';
import { editorialMediaForAttachments } from '../lib/editorialPost';
import { PUBLISHING_LIMITS } from '../lib/publishing';
import {
  PROVENANCE_LABELS, publishErrorMessage, publishIntentKey, publishPost,
  type ContentProvenance, type MediaRef, type PostVisibility,
} from '../lib/publishClient';
import { detectPlace, readLocationPermission, type PlaceDetection } from '../lib/location';
import { pickTextAttachments, uploadTextAttachments } from '../lib/textAttachments';
import {
  MAX_TEXT_ATTACHMENTS, discardTextDraft, emptyTextDraft, loadTextDraft, saveTextDraft, touchTextDraft,
  type TextAttachment, type TextDraft,
} from '../lib/textDraft';
import {
  TEXT_DEFAULT_THEME, TEXT_MAX_CHARS, readTextStyle, type TextStyle,
} from '../lib/textStyle';

/** The four placements the media toolbar offers; the engine's ids are also the spoken names. */
const PLACEMENTS: readonly { id: EditorialPlacement; label: string }[] = [
  { id: 'left', label: 'Stânga' },
  { id: 'right', label: 'Dreapta' },
  { id: 'center', label: 'Centru' },
  { id: 'full', label: 'Toată lățimea' },
];

/**
 * The size the page is set at lives in the toolbar (`TextToolbar`) and in `EDITORIAL_TYPOGRAPHIES`; the
 * composer only stores it (`draft.document.typography`).
 */

/**
 * The three doors a page can have, and the backend value behind each one.
 *
 * The product's privacy matrix (`apps/nexus-web/lib/privacy-matrix.js`) knows four levels, and the three
 * kept here are exactly three of them — nothing is renamed and nothing is invented:
 *
 * - `public` — anyone the profile is visible to;
 * - `friends` — only a *mutual* follow (`MUTUAL`), which is what „Privat" means in this app: the people
 *   who are actually friends, not everyone who pressed Follow;
 * - `private` — the author, plus whoever holds a private-access entitlement (`PRIVATE_ENTITLEMENT`). The
 *   web already prints this level as „Doar eu", so the label is the product's own word, and the composer
 *   says the rest in one line under the control.
 *
 * `followers` („anyone who follows me") stays a valid backend value but is no longer offered: the owner
 * asked for three doors. A draft that already carries it keeps it and shows it as an extra position, so a
 * page can never be switched to a wider audience by opening the composer.
 */
const VISIBILITY_CHOICES: readonly { id: PostVisibility; label: string; note: string }[] = [
  { id: 'public', label: 'Public', note: 'Oricine poate citi pagina.' },
  { id: 'friends', label: 'Privat', note: 'Doar prietenii — urmărire reciprocă — o văd.' },
  { id: 'private', label: 'Doar eu', note: 'Doar tu, și cine are acces privat de la tine.' },
];

const LEGACY_VISIBILITY: { id: PostVisibility; label: string; note: string } = {
  id: 'followers', label: 'Urmăritori', note: 'Doar cine te urmărește. Setat înainte; poți schimba oricând.',
};

/**
 * What the author declares about how the page was made — `normalizeProvenance` of
 * `apps/nexus-web/lib/moderation.js`, unchanged and in its own field. This is *not* visibility: a page can
 * be public and AI-assisted at the same time.
 *
 * The values are the four the server accepts; only the words on the segments are shorter, because
 * „Creat de mine / cameră (declarație)" does not fit a thumb-wide segment. The full sentence
 * (`PROVENANCE_LABELS`) is printed under the control for the position that is chosen.
 */
const PROVENANCE_CHOICES: readonly { id: ContentProvenance; label: string }[] = [
  { id: 'NOT_DECLARED', label: 'Nu declar' },
  { id: 'CAMERA_CAPTURED_DECLARED', label: 'Făcut de mine' },
  { id: 'AI_ASSISTED', label: 'AI asistat' },
  { id: 'AI_GENERATED', label: 'Generat de AI' },
];

/** What the composer is doing about the place the page was written in. */
type PlaceState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'offered' }
  | { status: 'found'; label: string }
  | { status: 'denied' }
  | { status: 'unavailable'; note: string };

/**
 * How long the gallery may stay closed before the composer gives the button back.
 *
 * Five minutes is more than anyone needs to choose five photographs and short enough that a picker killed by
 * the system (or an answer the phone dropped) cannot leave „+ Fotografie" deaf until the app restarts.
 */
const GALLERY_DEADLINE_MS = 5 * 60 * 1000;

/** A promise with a deadline: the deadline is an error the composer can print, not a state it waits in. */
function withinDeadline<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    work.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (reason) => { clearTimeout(timer); reject(reason); },
    );
  });
}

export default function TextComposer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  /**
   * One page, one look. The stored draft keeps whatever face, measure and composed blocks it has, but its
   * theme is the Kindle default: the chooser that used to rewrite it is gone (owner, 29 October 2026), and a
   * draft written when the composer still offered six swatches must not open on an accent the author can no
   * longer change.
   */
  const [draft, setDraft] = useState<TextDraft>(() => {
    const stored = loadTextDraft();
    return { ...stored, style: readTextStyle({ ...stored.style, theme: TEXT_DEFAULT_THEME }) };
  });
  const [identity, setIdentity] = useState<EditorIdentity | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The id the server confirmed. It gates a second press on Publică and is the address the reader opens. */
  const [publishedId, setPublishedId] = useState<number | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaProgress, setMediaProgress] = useState<string | null>(null);
  const [selected, setSelected] = useState<EditorialSelection | null>(null);
  /**
   * The place the page says it was written in. It starts from the draft — a location that survived a restart
   * is the author's, not a suggestion — and it is never re-detected after the author pressed the X.
   */
  const [place, setPlace] = useState<PlaceState>(() => (
    draft.publishing.location ? { status: 'found', label: draft.publishing.location } : { status: 'idle' }
  ));
  /**
   * The author said no to this place: the composer must not ask again, not even after a cold start.
   *
   * `placeRemoved` is the guard *for this visit* (it also stops an answer that arrives after the X), while
   * `draft.locationDismissed` is the same decision written down, so a restart does not detect the place again
   * and quietly put back what the author removed.
   */
  const placeRemoved = useRef(false);
  /** The last thirty layouts, so a dragged picture can be put back where it was. */
  const history = useRef<EditorialDocument[]>([]);
  /** One key per intent: an answer lost on a bad connection is replayed, not written twice. */
  const publishKey = useRef(publishIntentKey());

  /**
   * The paragraph the writing field holds, exactly as `EditorialPage` reports it (`onFieldChange`).
   *
   * Round 29's rule: **the words on screen are the words that publish.** While the sheet is open the
   * committed `draft.document` is a stale copy of the article — it is only written when `Gata` is pressed —
   * so everything the composer derives from the page (the caption, the counter, the payload of `Publică`,
   * the draft on disk) is derived from `flight` on top of it, never from `draft.body` alone. Before this,
   * `Publică` sent `draft.body`, i.e. the article *before* the paste: the owner pasted a page, published
   * without pressing `Gata`, and read their old text in the feed.
   */
  const [flight, setFlight] = useState<{ blockId: string | null; text: string } | null>(null);
  const flightRef = useRef<{ blockId: string | null; text: string } | null>(null);
  /**
   * A request to type something (an emoji) into the paragraph being written. It travels to the field as a
   * nonce, so the same emoji twice is two inserts and no insert is ever replayed by a re-render.
   */
  const [insertRequest, setInsertRequest] = useState<{ text: string; nonce: number } | null>(null);
  const insertNonce = useRef(0);
  /** Which panel — if any — of the compact toolbar is open (keyboard, emoji, face, measure). */
  const [panel, setPanel] = useState<TextToolbarPanel>(null);
  /**
   * A request to give the keyboard back to the field, spent once per press of „Tastatură".
   *
   * The field is opened by the page and by this nonce (`EditorialPage.focusRequest`), so the toolbar can put
   * the caret back into the paragraph without knowing anything about the field's own state.
   */
  const [focusRequest, setFocusRequest] = useState(0);

  /**
   * A door of the toolbar. Opening a panel puts the keyboard away — a panel and a keyboard want the same
   * 300 dp of screen, and the words are safe in `flight` while it is closed — and „Tastatură" gives the
   * keyboard back to the paragraph.
   */
  function changePanel(next: TextToolbarPanel) {
    setPanel(next);
    if (next === null) {
      setFocusRequest((count) => count + 1);
      return;
    }
    Keyboard.dismiss();
  }

  /**
   * The field reports on every change, and a change of words is a new publish intent: a retry after a
   * failed send must not be replayed with the previous body (`Idempotency-Key`).
   */
  const onFieldChange = useCallback((next: { blockId: string | null; text: string } | null) => {
    const current = flightRef.current;
    const same = current && next ? current.blockId === next.blockId && current.text === next.text : current === next;
    if (same) return;
    flightRef.current = next;
    publishKey.current = publishIntentKey();
    setFlight(next);
  }, []);

  /**
   * The page as it would be if `Gata` were pressed at this instant.
   *
   * `setBlockText` is the very function the field writes through on `Gata` (`EditorialPage.closeField`), so
   * this is not an approximation of the commit: it *is* the commit. With no field open `flight` is `null`
   * and `page` is the committed document — the same object, so nothing re-flows.
   */
  const page = useMemo(
    () => (flight ? setBlockText(draft.document, flight.blockId, flight.text) : draft.document),
    [draft.document, flight],
  );
  const body = documentPlainText(page);
  /**
   * The words, counted the way the server counts them: paragraph separators are furniture of the page,
   * not characters of the article. Arranging a picture splits a paragraph in two, and a counter that
   * jumped by one on a layout gesture would look like lost text.
   */
  const characters = documentCharCount(page);
  const overLimit = characters > TEXT_MAX_CHARS;
  const pageWidth = Math.min(width - 40, 380);
  const pageHeight = pageWidth * (16 / 9);
  const selectedMedia = selected?.kind === 'media'
    ? (draft.document.blocks.find((block) => block.id === selected.blockId && block.type === 'media') ?? null) as EditorialMediaBlock | null
    : null;
  const selectedText = selected?.kind === 'text'
    ? draft.document.blocks.find((block) => block.id === selected.blockId && block.type !== 'media' && block.type !== 'pagebreak') ?? null
    : null;

  useEffect(() => {
    let active = true;
    loadEditorIdentity()
      .then((value) => { if (active) setIdentity(value); })
      .catch((reason: unknown) => {
        if (active) setIdentityError(reason instanceof Error ? reason.message : 'Contul nu a putut fi citit.');
      });
    return () => { active = false; };
  }, []);

  /** Every edit is a new intent, so the next publish is not replayed as the previous one. */
  const edit = useCallback((patch: Partial<TextDraft>) => {
    publishKey.current = publishIntentKey();
    setError(null);
    setDraft((current) => touchTextDraft({ ...current, ...patch }));
  }, []);

  /**
   * A page edit: the words and the layout travel together, and the caption sent on publish is always
   * the words of the document that is on screen. A layout gesture keeps one snapshot for Undo; typing
   * does not, because the keyboard already owns undo inside the hidden editor.
   */
  const applyDocument = useCallback((next: EditorialDocument, remember = false) => {
    if (remember) {
      history.current = [...history.current.slice(-29), draft.document];
    }
    edit({ document: next, body: documentPlainText(next) });
  }, [draft.document, edit]);

  const undoLayout = useCallback(() => {
    const previous = history.current.pop();
    if (!previous) return;
    edit({ document: previous, body: documentPlainText(previous) });
    setSelected(null);
  }, [edit]);

  /**
   * The local draft is written a little after the last keystroke, never on every character.
   *
   * It is written from `page`, not from `draft`: a paragraph pasted into the field is part of the article
   * the moment it is on screen, and a phone that loses the app between the paste and `Gata` must reopen
   * with the pasted words, not with the page they replaced.
   */
  useEffect(() => {
    if (publishedId !== null) return;
    const timer = setTimeout(() => {
      try { saveTextDraft({ ...draft, document: page, body }); } catch { /* a full disk must not close the composer */ }
    }, 400);
    return () => clearTimeout(timer);
  }, [body, draft, page, publishedId]);

  function applyStyle(patch: Partial<TextStyle>) {
    // `readTextStyle` is tolerant and always keeps the theme's own colour pair, because the server
    // validates and stores that pair on publish. The pair is never painted — the page's colours come
    // from `pagePaletteOf` — so a theme change repaints only the accent, the face, the measure or the
    // alignment.
    edit({ style: readTextStyle({ ...draft.style, ...patch }) });
  }

  /**
   * An emoji is typed into the paragraph the author is writing in — at the caret, never into the page
   * behind them.
   *
   * It used to rebuild the whole article from `draft.body` (`applyPlainText`), which is the *committed*
   * page: with the field open, pressing an emoji threw away everything pasted or typed in it and put the
   * old words back. The request now goes to `EditorialPage`, which types it at the range the phone last
   * reported for the field (replacing a dragged-over selection) or opens the last paragraph with it.
   * Nothing is written to `document` until `Gata`, so the two never disagree.
   */
  function insertEmoji(emoji: string) {
    if (characters >= TEXT_MAX_CHARS) return;
    insertNonce.current += 1;
    publishKey.current = publishIntentKey();
    setInsertRequest({ text: emoji, nonce: insertNonce.current });
  }

  /**
   * Where the page was written, asked for once.
   *
   * The owner does not type a place any more (29 October 2026): the phone knows it, and the geocoder this
   * product already runs turns the fix into a name. `prompt` is the difference between the two ways in —
   * opening the composer reads the permission without a dialog and only silences a *granted* one, while a
   * press on „Folosește locația" is the press Android's dialog belongs to.
   *
   * Every failure is a sentence and a page that still publishes: a refused permission, a phone with no fix
   * and a geocoder that said nothing all end in `place` being `denied` or `unavailable`, never in a block on
   * the Publică button.
   */
  async function askPlace(prompt: boolean) {
    if (placeRemoved.current) return;
    if (place.status === 'checking') return;
    const permission = await readLocationPermission();
    if (permission === 'undetermined' && !prompt) { setPlace({ status: 'offered' }); return; }
    if (permission === 'unavailable') {
      setPlace({ status: 'unavailable', note: 'Aplicația instalată nu poate citi locația. Instalează versiunea nouă și încearcă din nou.' });
      return;
    }
    if (permission === 'denied') { setPlace({ status: 'denied' }); return; }
    setPlace({ status: 'checking' });
    const result: PlaceDetection = await detectPlace(draft.publishing.locationPrecision);
    if (placeRemoved.current) { setPlace({ status: 'idle' }); return; }
    if (result.status === 'found') {
      setPlace({ status: 'found', label: result.label });
      edit({ publishing: { ...draft.publishing, location: result.label }, locationDismissed: false });
      return;
    }
    if (result.status === 'denied') { setPlace({ status: 'denied' }); return; }
    setPlace({ status: 'unavailable', note: result.reason });
  }

  /**
   * The X beside the place. It empties `publishing.location` — the same field the publish sends — so the
   * page is written without a place at all: no label is hidden while a coordinate travels underneath,
   * because no coordinate ever lived in the draft to begin with.
   */
  function removePlace() {
    placeRemoved.current = true;
    setPlace({ status: 'idle' });
    edit({ publishing: { ...draft.publishing, location: '' }, locationDismissed: true });
  }

  /**
   * The first read of the permission, once the composer is on screen. It never shows a system dialog: an
   * undetermined permission becomes the offer below, and a granted one is used straight away. A page whose
   * author already removed the place is left alone.
   */
  useEffect(() => {
    if (placeRemoved.current || draft.locationDismissed) return;
    if (draft.publishing.location) return;
    void askPlace(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * The attachment toolbar. The gallery is Android's own picker; a chosen file stays local until the
   * publish uploads it, so cancelling, refusing or losing the network never costs the attachment.
   */
  async function chooseAttachments(kind: TextAttachment['kind'], replaceIndex?: number) {
    if (mediaBusy) return;
    const current = draft.attachments;
    if (replaceIndex !== undefined && kind === 'video' && current.length > 1) {
      setError('Un clip trebuie să fie singurul atașament al paginii. Șterge celelalte fișiere mai întâi.');
      return;
    }
    if (replaceIndex === undefined) {
      if (kind === 'video' && current.length) {
        setError('Un clip nu poate fi adăugat lângă alte fișiere. Șterge-le mai întâi.');
        return;
      }
      if (kind === 'image' && current.some((item) => item.kind === 'video')) {
        setError('Șterge clipul înainte de a adăuga fotografii.');
        return;
      }
      if (current.length >= MAX_TEXT_ATTACHMENTS) {
        setError(`Poți atașa cel mult ${MAX_TEXT_ATTACHMENTS} fișiere unei pagini.`);
        return;
      }
    }
    const remaining = replaceIndex === undefined ? MAX_TEXT_ATTACHMENTS - current.length : 1;
    setMediaBusy(true);
    setError(null);
    try {
      /**
       * The gallery is a promise the phone resolves when the picker closes — and it does not always close.
       *
       * Left as it was, a picker whose answer never arrived kept `mediaBusy` true for the rest of the session:
       * „+ Fotografie" stopped answering and only restarting the app brought it back
       * (`JUNGLE_BOOK_PROGRESS.md` §27.6, defect 3). The deadline is long enough for a real visit to the
       * gallery and short enough that the composer recovers by itself; a late answer is dropped, because the
       * attachment the author sees must be one the draft actually kept.
       */
      const picked = await withinDeadline(
        pickTextAttachments(kind, remaining),
        GALLERY_DEADLINE_MS,
        'Galeria nu a răspuns. Închide-o și încearcă din nou.',
      );
      if (picked.skipped.length) {
        setError(`Nu am putut atașa: ${picked.skipped.slice(0, 3).join(', ')}. Formatele acceptate sunt JPEG, PNG, WebP, MP4 și WebM.`);
      }
      if (!picked.attachments.length) return;
      const next = replaceIndex === undefined
        ? [...current, ...picked.attachments]
        : current.map((item, index) => (index === replaceIndex ? picked.attachments[0] : item));
      const clipped = next.slice(0, MAX_TEXT_ATTACHMENTS);
      let document = draft.document;
      if (replaceIndex === undefined) {
        for (let index = current.length; index < clipped.length; index++) {
          document = appendMediaBlock(document, index, clipped[index].kind);
        }
      } else if (clipped[replaceIndex]) {
        document = {
          ...document,
          blocks: document.blocks.map((block) => (
            block.type === 'media' && block.mediaIndex === replaceIndex
              ? { ...block, mediaType: clipped[replaceIndex].kind }
              : block
          )),
        };
      }
      edit({ attachments: clipped, document, body: documentPlainText(document) });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Atașamentul nu a putut fi ales.');
    } finally {
      setMediaBusy(false);
    }
  }

  function removeAttachment(uri: string) {
    const index = draft.attachments.findIndex((item) => item.uri === uri);
    if (index < 0) return;
    const document = remapMediaIndexes(draft.document, index);
    edit({
      attachments: draft.attachments.filter((item) => item.uri !== uri),
      document,
      body: documentPlainText(document),
    });
    setSelected(null);
  }

  /**
   * „Scoate din pagină" removes the picture **and its file**.
   *
   * Two lists describe the same photographs — the media block that draws one and the attachment that
   * uploads one — and a block without its file was the exact shape of the bug the owner reported: the
   * picture left the page, the file stayed in the gallery, and the publish uploaded every file of the
   * gallery (`reconcileMedia` in `lib/editorialDocument.ts` is the guard that catches the rest, but the
   * gesture itself must not create the drift). Removing by *file* reuses `removeAttachment`, which
   * renumbers the remaining blocks.
   */
  function removeMediaFromPage(block: EditorialMediaBlock) {
    const uri = draft.attachments[block.mediaIndex]?.uri;
    if (uri) { removeAttachment(uri); return; }
    applyDocument(removeEditorialBlock(draft.document, block.id), true);
    setSelected(null);
  }

  /** The media toolbar edits the selected block, never an index guessed from the file list. */
  function changeSelectedMedia(change: (current: EditorialDocument, id: string) => EditorialDocument) {
    if (!selectedMedia) return;
    applyDocument(change(draft.document, selectedMedia.id), true);
  }

  function close() {
    if (publishedId !== null) { router.back(); return; }
    if (!body.trim()) { router.back(); return; }
    Alert.alert('Păstrezi textul?', 'Textul nesalvat poate rămâne pe telefon ca ciornă.', [
      { text: 'Renunță', style: 'destructive', onPress: () => { discardTextDraft(); router.back(); } },
      { text: 'Păstrează ciorna', onPress: () => {
        /** The draft on disk carries the words of the field too: `page` is the commit, `draft` alone is not. */
        try { saveTextDraft({ ...draft, document: page, body }); } catch { /* best effort: the composer still closes */ }
        router.back();
      } },
      { text: 'Continuă scrierea', style: 'cancel' },
    ]);
  }

  async function publish() {
    if (busy || publishedId !== null) return;
    if (!body.trim()) { setError('Scrie textul postării înainte de a publica.'); return; }
    if (overLimit) { setError(`Textul depășește ${TEXT_MAX_CHARS} de caractere.`); return; }
    const owner = identity;
    if (!owner) { setError(identityError ?? 'Contul nu a putut fi citit. Autentifică-te din nou.'); return; }
    /**
     * What leaves the phone is decided **here**, from the page on screen.
     *
     * - `page` is the commit the field is holding (`flight` applied through `setBlockText`), so a paragraph
     *   pasted but not yet closed with `Gata` is published as pasted — the whole point of the round;
     * - `reconciled` keeps only the files the page actually shows, in page order, and renumbers their blocks
     *   to match the order they are uploaded in. A clip that was taken out of the page (or left over from a
     *   page rewritten by a paste) can therefore never travel to the server and turn up in the post.
     *
     * `caption` and `textStyle.document` are the same words and the same blocks as `file` indices, so the
     * post, its gallery and its page cannot describe three different articles.
     */
    const reconciled = reconcileMedia(page, draft.attachments.length);
    const file = reconciled.kept.map((index) => draft.attachments[index]);
    const caption = documentPlainText(reconciled.document);
    if (!caption.trim()) { setError('Scrie textul postării înainte de a publica.'); return; }
    setBusy(true);
    setError(null);
    try {
      /**
       * Before a byte is uploaded: does this server know what a page is?
       *
       * A deployment from before the editorial rounds keeps the caption and the photographs, drops
       * `text_style`, and answers `ok: true` (`JUNGLE_BOOK_PROGRESS.md` §15.3). Asking here — rather than
       * only reading the answer — means nothing is left uploaded on a server that cannot use it, and the
       * author is told the truth while the draft is still theirs.
       */
      /**
       * …and, one question deeper, does it know *this letter*?
       *
       * The allowlist behind `text_style` grew: a server that answers version 1 stores three faces and
       * refuses `slab` / „Mașină", `casual` and `condensed` with `TEXT_STYLE_INVALID`, which the editor could
       * only translate into „Alege o temă din listă" — a sentence about the theme, for a face. The owner hit
       * exactly that on 28 October 2026. The version question is asked first, so an older server is answered
       * with a sentence that names the face, the draft stays on the phone, and nothing is uploaded.
       */
      await requireTextStyleContract(draft.style);
      await requirePageCapabilities();
      /** The page's files are uploaded now, in page order, and the post references them as `media_items`. */
      let mediaItems: MediaRef[] = [];
      if (file.length) {
        setMediaProgress(`Se încarcă atașamentul 1 din ${file.length}…`);
        mediaItems = await uploadTextAttachments(owner, file, (progress) => {
          setMediaProgress(`Se încarcă atașamentul ${progress.index + 1} din ${progress.total}… ${progress.percent}%`);
        });
      }
      setMediaProgress('Se scrie postarea…');
      const result = await publishPost({
        key: publishKey.current,
        userId: owner.userId,
        intent: {
          persona: owner.persona,
          caption,
          visibility: draft.visibility,
          provenance: draft.provenance,
          publishing: draft.publishing,
          textStyle: { ...draft.style, document: reconciled.document },
          media: null,
          mediaItems,
          kind: file.length ? file[0].kind : null,
        },
      });
      try { discardTextDraft(); } catch { /* the post is live even if the local file lingers */ }
      setPublishedId(result.id);
      /**
       * The page that was just written is what the author came for, so the composer hands them the page.
       *
       * `dismissAll()` empties the stack this composer was pushed onto — `/camera` is under it, because the
       * „TEXT" button of the viewfinder is the only door here (`camera.tsx`) — and the post is then pushed on
       * the feed, so Back from the new page returns to the wall and never to a camera the author did not ask
       * for. The id is the one the server answered with (`PublishedPost.id`), never a guess from the feed.
       */
      try {
        if (router.canDismiss()) router.dismissAll();
        router.push({ pathname: '/post/[id]', params: { id: String(result.id) } });
      } catch {
        /** A router that refuses the move leaves the receipt on screen rather than a composer with no page. */
      }
    } catch (reason) {
      setError(reason instanceof Error && (
        reason.name === 'TextAttachmentError' || reason.name === 'UploadClientError' || reason.name === 'BackendVersionError'
      )
        ? reason.message
        : publishErrorMessage(reason));
    } finally {
      setBusy(false);
      setMediaProgress(null);
    }
  }

  const accountNote = identity
    ? `Publici ca @${identity.persona}.`
    : identityError ?? 'Se citește contul…';
  /**
   * The doors this draft can be given. `followers` is only here when the draft already carries it: a stored
   * level the composer no longer offers must stay visible and selectable, or a page could silently widen.
   */
  const visibilityChoices = draft.visibility === 'followers'
    ? [LEGACY_VISIBILITY, ...VISIBILITY_CHOICES]
    : VISIBILITY_CHOICES;
  const visibilityNote = visibilityChoices.find((choice) => choice.id === draft.visibility)?.note ?? '';

  /**
   * The receipt, and the fallback: it is only ever painted when the navigation to `/post/:id` did not
   * happen. A published page opens as the page itself, with its rail, its comments and its Back to the wall.
   */
  if (publishedId !== null) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.publishedCard}>
          <Text style={styles.publishedMark}>PUBLICAT</Text>
          <Text style={styles.publishedTitle}>Pagina ta este în feed.</Text>
          <Text style={styles.publishedBody}>
            {`Postarea #${publishedId} este scrisă. Rămâne o pagină în feed, nu un Reel.`}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Deschide postarea publicată"
            style={styles.primary}
            onPress={() => router.replace({ pathname: '/post/[id]', params: { id: String(publishedId) } })}
          >
            <Text style={styles.primaryText}>{`Deschide postarea #${publishedId}`}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Închide compozitorul" onPress={() => router.back()}>
            <Text style={styles.discardText}>Închide</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Închide compozitorul" onPress={close} style={styles.headerSide} hitSlop={8}>
          <Text style={styles.headerAction}>Înapoi</Text>
        </Pressable>
        <Text style={styles.headerTitle}>TEXT</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Publică postarea de text"
          accessibilityState={{ disabled: busy || !identity || !body.trim() || overLimit }}
          disabled={busy || !identity || !body.trim() || overLimit}
          onPress={() => { void publish(); }}
          style={styles.headerSide}
          hitSlop={8}
        >
          {busy ? <ActivityIndicator color="#ff315f" /> : (
            <Text style={[styles.headerAction, (!identity || !body.trim() || overLimit) && styles.headerActionOff]}>Publică</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollBody, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/**
         * ONE page, and it is the article itself. The words are typed into the page; a picture is a
         * block inside the same flow, and the paragraphs beside and under it move as it is arranged.
         * There is no second preview and no separate text box.
         */}
        <View style={styles.preview}>
          <View style={[styles.pageShell, { width: pageWidth, height: pageHeight }]}>
            <EditorialPage
              document={draft.document}
              style={draft.style}
              media={editorialMediaForAttachments(draft.attachments)}
              width={pageWidth}
              height={pageHeight}
              editable
              selectedMediaId={selected?.kind === 'media' ? selected.blockId : null}
              onSelectBlock={setSelected}
              onChangeDocument={applyDocument}
              onFieldChange={onFieldChange}
              insertRequest={insertRequest}
              focusRequest={focusRequest}
              accessibilityLabel="Pagina articolului"
            />
          </View>
          <View style={styles.gestureRow}>
            <Text style={styles.gestureHint}>
              Apasă pe text ca să scrii. Trage o fotografie în sus sau în jos și o așezi între cuvinte; la stânga
              sau la dreapta alegi partea de care se lipesc cuvintele. Mânerul îi schimbă lățimea.
            </Text>
          </View>
          <Text style={styles.pageFooter}>{`${characters}/${TEXT_MAX_CHARS} CARACTERE`}</Text>

          {selectedMedia ? (
            <View style={styles.layoutCard}>
              <Text style={styles.layoutTitle}>AȘEZAREA FOTOGRAFIEI</Text>
              <View style={styles.chipRow}>
                {PLACEMENTS.map((item) => (
                  <Chip
                    key={item.id}
                    label={item.label}
                    active={selectedMedia.placement === item.id}
                    onPress={() => changeSelectedMedia((doc, id) => setMediaPlacement(doc, id, item.id))}
                  />
                ))}
              </View>
              <View style={styles.chipRow}>
                <Chip
                  label={selectedMedia.wrapText ? 'Text în jur: da' : 'Text în jur: nu'}
                  active={selectedMedia.wrapText}
                  onPress={() => changeSelectedMedia((doc, id) => setMediaWrap(doc, id, !selectedMedia.wrapText))}
                />
                <Chip
                  label="Mai îngustă"
                  active={false}
                  onPress={() => changeSelectedMedia((doc, id) => setMediaWidth(doc, id, selectedMedia.widthFraction - 0.08))}
                />
                <Chip
                  label="Mai lată"
                  active={false}
                  onPress={() => changeSelectedMedia((doc, id) => setMediaWidth(doc, id, selectedMedia.widthFraction + 0.08))}
                />
              </View>
              <View style={styles.chipRow}>
                {/**
                  * Where in the words, not which block: "la mijloc" cuts the paragraph at half of the
                  * article's letters, so a page that is one long paragraph really does get a middle.
                  */}
                <Chip label="La început" active={false} onPress={() => changeSelectedMedia((doc, id) => placeMediaBlockAtFraction(doc, id, 0))} />
                <Chip label="La mijloc" active={false} onPress={() => changeSelectedMedia((doc, id) => placeMediaBlockAtFraction(doc, id, 0.5))} />
                <Chip label="La sfârșit" active={false} onPress={() => changeSelectedMedia((doc, id) => placeMediaBlockAtFraction(doc, id, 1))} />
              </View>
              <View style={styles.chipRow}>
                <Chip
                  label="Scoate din pagină"
                  active={false}
                  onPress={() => removeMediaFromPage(selectedMedia)}
                />
              </View>
            </View>
          ) : null}

          {selectedText ? (
            <View style={styles.chipRow}>
              <Chip
                label={selectedText.type === 'heading' ? 'Titlu: da' : 'Fă titlu'}
                active={selectedText.type === 'heading'}
                onPress={() => changeSelectedMedia((doc, id) => toggleHeadingBlock(doc, id))}
              />
            </View>
          ) : null}

          {history.current.length ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Anulează ultima aranjare" onPress={undoLayout} hitSlop={8}>
              <Text style={styles.gestureReset}>Anulează ultima aranjare</Text>
            </Pressable>
          ) : null}
          {overLimit ? <Text style={styles.counterOver}>{`Textul depășește ${TEXT_MAX_CHARS} de caractere.`}</Text> : null}
        </View>

        <Text style={styles.sectionLabel}>ATAȘAMENTE</Text>
        <View style={styles.chipRow}>
          <Chip
            label={mediaBusy ? 'Se deschide galeria…' : '+ Fotografie'}
            active={false}
            onPress={() => { if (!mediaBusy) void chooseAttachments('image'); }}
          />
          <Chip
            label="+ Clip video"
            active={false}
            onPress={() => { if (!mediaBusy) void chooseAttachments('video'); }}
          />
        </View>
        <Text style={styles.attachmentHint}>
          Text + fotografii rămâne o postare, nu un Reel. Formate: JPEG, PNG, WebP, MP4, WebM. GIF nu este acceptat de serverul media.
        </Text>
        {draft.attachments.length ? (
          <View style={styles.attachments}>
            {draft.attachments.map((item, index) => (
              <View key={item.uri} style={styles.attachment}>
                {item.kind === 'video' ? (
                  <View style={styles.attachmentVideo}>
                    <Text style={styles.attachmentVideoText}>CLIP</Text>
                  </View>
                ) : (
                  <Image source={{ uri: item.uri }} style={styles.attachmentImage} resizeMode="cover" accessibilityLabel={`Fotografia ${index + 1}`} />
                )}
                <Text style={styles.attachmentName} numberOfLines={1}>{item.name}</Text>
                <View style={styles.attachmentActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Înlocuiește atașamentul ${index + 1}`}
                    onPress={() => { if (!mediaBusy) void chooseAttachments(item.kind, index); }}
                    style={styles.attachmentAction}
                  >
                    <Text style={styles.attachmentActionText}>Înlocuiește</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Șterge atașamentul ${index + 1}`}
                    onPress={() => removeAttachment(item.uri)}
                    style={styles.attachmentAction}
                  >
                    <Text style={[styles.attachmentActionText, styles.attachmentRemove]}>Șterge</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/**
          * The face, the measure and the emoji live in the toolbar pinned under the composer (`TextToolbar`),
          * one thumb away from the words — not in three sections of the scroll the author had to walk past the
          * page, the layout card and the attachments to reach.
          */}

        <Text style={styles.sectionLabel}>CINE VEDE</Text>
        <Segment
          label="Cine poate citi pagina"
          value={draft.visibility}
          options={visibilityChoices.map((choice) => ({ id: choice.id, label: choice.label }))}
          onChange={(value) => edit({ visibility: value })}
        />
        {visibilityNote ? <Text style={styles.controlNote}>{visibilityNote}</Text> : null}

        <Text style={styles.sectionLabel}>PROVENIENȚĂ</Text>
        <Segment
          label="Cum a fost făcută pagina"
          value={draft.provenance}
          options={PROVENANCE_CHOICES.map((choice) => ({ id: choice.id, label: choice.label }))}
          onChange={(value) => edit({ provenance: value })}
          scroll
        />
        <Text style={styles.controlNote}>{PROVENANCE_LABELS[draft.provenance]}</Text>

        <Text style={styles.sectionLabel}>DETALII DE PUBLICARE</Text>
        <View style={styles.settingsCard}>
          <Field
            label="Titlu"
            value={draft.publishing.title}
            maxLength={PUBLISHING_LIMITS.title}
            placeholder="Titlul paginii (opțional)"
            onChangeText={(value) => edit({ publishing: { ...draft.publishing, title: value } })}
          />
          {/**
            * The place, detected instead of typed.
            *
            * The phone's own receiver names the place through the server's geocoder, and the page keeps the
            * name only — no coordinate is ever written into the draft. The X empties the field the publish
            * sends; the row that follows a refusal says what happened and how to ask again, and none of the
            * states below can block Publică.
            */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Locație</Text>
            {place.status === 'found' ? (
              <View style={styles.placeRow}>
                <Text style={styles.placeText} numberOfLines={2}>{place.label}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Scoate locația din postare"
                  accessibilityHint="Postarea se publică fără locație."
                  onPress={removePlace}
                  style={styles.placeRemove}
                  hitSlop={10}
                >
                  <Text style={styles.placeRemoveText}>×</Text>
                </Pressable>
              </View>
            ) : place.status === 'checking' ? (
              <View style={styles.placeRow}>
                <ActivityIndicator color="#8c97a3" />
                <Text style={styles.placeNote}>Se citește locația telefonului…</Text>
              </View>
            ) : place.status === 'denied' ? (
              <View style={styles.placeRow}>
                <Text style={styles.placeNote}>
                  Locația este oprită pentru Jungle Book. Poți publica fără ea.
                </Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Încearcă locația din nou" onPress={() => { void askPlace(true); }}>
                  <Text style={styles.placeRetry}>Încearcă</Text>
                </Pressable>
              </View>
            ) : place.status === 'unavailable' ? (
              <View style={styles.placeRow}>
                <Text style={styles.placeNote}>{place.note}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Încearcă locația din nou" onPress={() => { void askPlace(true); }}>
                  <Text style={styles.placeRetry}>Încearcă</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.placeRow}>
                <Text style={styles.placeNote}>
                  Pagina poate spune unde ai scris-o. Jungle Book cere locația telefonului doar pentru asta și
                  păstrează numele locului, nu coordonatele.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Folosește locația telefonului"
                  onPress={() => { void askPlace(true); }}
                >
                  <Text style={styles.placeRetry}>Folosește</Text>
                </Pressable>
              </View>
            )}
          </View>
          <Field
            label="Link"
            value={draft.publishing.link}
            maxLength={PUBLISHING_LIMITS.link}
            placeholder="https://…"
            autoCapitalize="none"
            keyboardType="url"
            onChangeText={(value) => edit({ publishing: { ...draft.publishing, link: value } })}
          />
          <Toggle
            label="Permite comentarii"
            value={draft.publishing.allowComments}
            onChange={(value) => edit({ publishing: { ...draft.publishing, allowComments: value } })}
          />
          <Toggle
            label="Permite distribuire"
            value={draft.publishing.allowRepost}
            onChange={(value) => edit({ publishing: { ...draft.publishing, allowRepost: value } })}
          />
        </View>

        <Text style={[styles.accountNote, identityError && styles.accountNoteError]}>{accountNote}</Text>
        {mediaProgress ? <Text style={styles.progress} accessibilityLiveRegion="polite">{mediaProgress}</Text> : null}
        {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
        {body.trim() || draft.attachments.length ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Șterge ciorna"
            onPress={() => Alert.alert('Ștergi ciorna?', 'Textul și stilul ales se pierd.', [
              { text: 'Renunță', style: 'cancel' },
              { text: 'Șterge', style: 'destructive', onPress: () => {
                discardTextDraft();
                publishKey.current = publishIntentKey();
                setDraft(emptyTextDraft());
                setError(null);
              } },
            ])}
            style={styles.discard}
          >
            <Text style={styles.discardText}>Șterge ciorna</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/**
       * There is no second preview modal any more: the page above *is* the preview, and it is also the
       * editor. A modal that showed the same page again was the duplication the owner asked to remove.
       *
       * The toolbar is the one control that does not scroll with the page: the face, the measure and the
       * picker are wanted *while* writing, so they stay under the thumb. „Tastatură" closes the panel and
       * gives the field back its keyboard.
       */}
      <View style={{ paddingBottom: insets.bottom }}>
        <TextToolbar
          panel={panel}
          onPanelChange={changePanel}
          onEmoji={insertEmoji}
          font={draft.style.font}
          onFont={(next) => applyStyle({ font: next })}
          measure={draft.document.typography ?? 'auto'}
          onMeasure={(next) => applyDocument(setDocumentTypography(draft.document, next), true)}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * A segmented control: one track, one position per choice, and exactly one of them chosen.
 *
 * The three doors of a page and the four declarations of provenance are the same kind of question — "which
 * one of these?" — so they are answered by the same control instead of by two rows of loose chips where
 * every option looked pressed. The track is a single rounded shape on the composer's own dark chrome, the
 * chosen segment is the paper pill the app already uses for an active chip (`chipActive`), and each segment
 * is 44 dp tall, which is the smallest thing a thumb hits reliably.
 *
 * More than three positions (`scroll`) are laid out in a horizontally scrollable track: a provenance label
 * squeezed into a third of the width is a label nobody can read, and reading it is the whole point of
 * declaring it.
 */
function Segment<T extends string>({
  label, value, options, onChange, scroll = false,
}: {
  label: string;
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (value: T) => void;
  scroll?: boolean;
}) {
  const segments = options.map((option) => {
    const active = option.id === value;
    return (
      <Pressable
        key={option.id}
        accessibilityRole="radio"
        accessibilityState={{ selected: active, checked: active }}
        accessibilityLabel={`${label}: ${option.label}`}
        onPress={() => { if (!active) onChange(option.id); }}
        style={[scroll ? styles.segmentScroll : styles.segment, active && styles.segmentActive]}
      >
        <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
          {option.label}
        </Text>
      </Pressable>
    );
  });
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {scroll ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.segmentTrackScroll}
        >
          {segments}
        </ScrollView>
      ) : (
        <View style={styles.segmentTrack}>{segments}</View>
      )}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Field({
  label, value, onChangeText, placeholder, maxLength, autoCapitalize, keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  maxLength: number;
  autoCapitalize?: 'none' | 'sentences';
  keyboardType?: 'default' | 'url';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6f7a70"
        maxLength={maxLength}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        keyboardType={keyboardType}
        style={styles.fieldInput}
      />
    </View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#39414d', true: '#ff315f' }}
        thumbColor="#f6f8fb"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#07090d' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ffffff1a',
  },
  headerSide: { minWidth: 72, alignItems: 'center' },
  headerAction: { color: '#ff315f', fontWeight: '700', fontSize: 15 },
  headerActionOff: { color: '#5c636e' },
  headerTitle: { color: '#f6f8fb', fontWeight: '800', fontSize: 13, letterSpacing: 3 },
  scroll: { flex: 1 },
  scrollBody: { paddingHorizontal: 24, paddingTop: 22, gap: 10 },
  preview: { alignItems: 'center', marginBottom: 10, width: '100%' },
  pageShell: { borderRadius: 20, overflow: 'hidden' },
  pageFooter: { alignSelf: 'flex-end', color: '#6f7a70', fontSize: 9, letterSpacing: 1.2, marginTop: 4 },
  layoutCard: {
    width: '100%', maxWidth: 380, marginTop: 10, padding: 12, gap: 10,
    borderRadius: 14, borderWidth: 1, borderColor: '#ffffff1a', backgroundColor: '#0f141a',
  },
  layoutTitle: { color: '#8c97a3', fontSize: 10, letterSpacing: 1.8, fontWeight: '700' },
  gestureRow: {
    width: '100%', maxWidth: 380, marginTop: 8, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  gestureHint: { color: '#8c97a3', fontSize: 11, lineHeight: 16, flexShrink: 1 },
  gestureReset: { color: '#ff315f', fontSize: 11, fontWeight: '700' },
  progress: { color: blackSilver.silver, fontSize: 12, marginTop: 8 },
  attachmentHint: { color: '#6f7a70', fontSize: 11, lineHeight: 16, marginTop: 6 },
  attachments: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  attachment: {
    width: 104, borderRadius: 12, overflow: 'hidden', backgroundColor: '#12161c',
    borderWidth: 1, borderColor: '#ffffff1f', padding: 6, gap: 6,
  },
  attachmentImage: { width: '100%', height: 72, borderRadius: 8, backgroundColor: '#0a0b0e' },
  attachmentVideo: {
    width: '100%', height: 72, borderRadius: 8, backgroundColor: '#0a0b0e',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ffffff1f',
  },
  attachmentVideoText: { color: '#f6f8fb', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  attachmentName: { color: '#9aa4af', fontSize: 10 },
  attachmentActions: { flexDirection: 'row', gap: 8 },
  attachmentAction: { paddingVertical: 2 },
  attachmentActionText: { color: '#c8d0d8', fontSize: 10, fontWeight: '700' },
  attachmentRemove: { color: '#ff7a90' },
  counterOver: { color: '#ff7a90', fontSize: 12, marginTop: 8 },
  sectionLabel: { color: '#8c97a3', fontSize: 11, letterSpacing: 2, marginTop: 18, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  /**
   * The segmented track: one shape, four points of padding, and a pill for the chosen position. It is painted
   * on the composer's dark chrome, so the chosen segment is the app's paper white (`chipActive`) and the rest
   * stay a step above the track — one choice is obvious at a glance and the others are still readable.
   */
  segmentTrack: {
    flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4,
    borderRadius: 99, borderWidth: 1, borderColor: '#ffffff14', backgroundColor: '#12161c',
  },
  segmentTrackScroll: {
    flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4,
    borderRadius: 99, borderWidth: 1, borderColor: '#ffffff14', backgroundColor: '#12161c',
  },
  segment: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 99, paddingHorizontal: 8 },
  segmentScroll: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 99, paddingHorizontal: 16 },
  segmentActive: { backgroundColor: '#f6f8fb' },
  segmentText: { color: '#c8d0d8', fontSize: 13, fontWeight: '700' },
  segmentTextActive: { color: '#0b0e12' },
  /** What the chosen position actually means, in a sentence: a label is a word, a door is a rule. */
  controlNote: { color: '#8c97a3', fontSize: 12, lineHeight: 17, marginTop: 6 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  placeText: { flex: 1, color: '#eef1f4', fontSize: 15, lineHeight: 20 },
  placeNote: { flex: 1, color: '#8c97a3', fontSize: 12, lineHeight: 17 },
  placeRetry: { color: '#ff315f', fontSize: 13, fontWeight: '700', paddingVertical: 8 },
  /** A 44 dp X: removing the place is a decision, and it must be as easy to press as to make. */
  placeRemove: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1b2027', borderWidth: 1, borderColor: '#ffffff1f',
  },
  placeRemoveText: { color: '#eef1f4', fontSize: 20, lineHeight: 22 },
  chip: { borderRadius: 99, borderWidth: 1, borderColor: '#ffffff24', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#12161c' },
  chipActive: { backgroundColor: '#f6f8fb', borderColor: '#f6f8fb' },
  chipText: { color: '#c8d0d8', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#0b0e12' },
  settingsCard: { backgroundColor: '#12161c', borderRadius: 16, borderWidth: 1, borderColor: '#ffffff14', padding: 14, gap: 14 },
  field: { gap: 6 },
  fieldLabel: { color: '#8c97a3', fontSize: 12, letterSpacing: 0.4 },
  fieldInput: {
    color: '#eef1f4', fontSize: 15, borderWidth: 1, borderColor: '#ffffff1f',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  toggleLabel: { color: '#eef1f4', fontSize: 14 },
  accountNote: { color: '#8c97a3', fontSize: 12, marginTop: 16 },
  accountNoteError: { color: '#ff7a90' },
  error: { color: '#ff7a90', fontSize: 14, lineHeight: 20, marginTop: 6 },
  discard: { alignSelf: 'flex-start', marginTop: 18, paddingVertical: 8 },
  discardText: { color: '#8c97a3', fontSize: 13, textDecorationLine: 'underline' },
  publishedCard: { marginHorizontal: 24, backgroundColor: '#12161c', borderRadius: 18, borderWidth: 1, borderColor: '#ffffff14', padding: 22, gap: 12 },
  publishedMark: { color: blackSilver.silver, fontSize: 11, letterSpacing: 2.4, fontWeight: '700' },
  publishedTitle: { color: '#f6f8fb', fontSize: 22, fontWeight: '700' },
  publishedBody: { color: '#aab4be', fontSize: 14, lineHeight: 21 },
  primary: { backgroundColor: '#ff315f', borderRadius: 99, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

