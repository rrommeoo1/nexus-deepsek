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
 * - the look is chosen from the six themes of `lib/textStyle.ts`, but a theme is **not a page**: every
 *   page is the same warm e-paper (`pagePaletteOf`), and a theme only marks it — the accent of the
 *   hairline and of the article's head rule — beside the face, the measure and the alignment. The
 *   swatches of the chooser are that same paper with the theme's accent dot, so what the author picks is
 *   what the reader prints. The stored `background`/`text` pair is still the theme's own (the server
 *   refuses any other pair, so the composer can never send a look the publish would reject), but it is
 *   never painted: the colours of a page come from the palette, at paint time.
 *
 * The publishing details travel *inside the request body* (`visibility`, `publishing`), not as
 * client-side flags: `/api/posts` is the one authority that writes them. The draft is local and separate
 * from the camera's media manifest (`lib/textDraft.ts`); it survives a refusal and a cold start, and it
 * is removed only by a confirmed publish or an explicit discard.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch,
  Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialPage, type EditorialSelection } from '../components/EditorialPage';
import { requirePageCapabilities } from '../lib/backendVersion';
import { loadEditorIdentity, type EditorIdentity } from '../lib/capturePublish';
import {
  appendMediaBlock, applyPlainText, documentCharCount, documentPlainText, placeMediaBlockAtFraction, remapMediaIndexes,
  removeEditorialBlock, setDocumentTypography, setMediaPlacement, setMediaWidth, setMediaWrap,
  toggleHeadingBlock, type EditorialDocument, type EditorialMediaBlock, type EditorialPlacement, type EditorialTypography,
} from '../lib/editorialDocument';
import { editorialMediaForAttachments } from '../lib/editorialPost';
import { PUBLISHING_LIMITS } from '../lib/publishing';
import {
  CONTENT_PROVENANCE, PROVENANCE_LABELS, VISIBILITY_LABELS, POST_VISIBILITIES,
  publishErrorMessage, publishIntentKey, publishPost,
  type MediaRef, type PostVisibility,
} from '../lib/publishClient';
import { pickTextAttachments, uploadTextAttachments } from '../lib/textAttachments';
import {
  MAX_TEXT_ATTACHMENTS, discardTextDraft, emptyTextDraft, loadTextDraft, saveTextDraft, touchTextDraft,
  type TextAttachment, type TextDraft,
} from '../lib/textDraft';
import {
  TEXT_ALIGNS, TEXT_EMOJI, TEXT_FONTS, TEXT_MAX_CHARS, TEXT_THEMES,
  pagePaletteOf, readTextStyle, themeOf, type TextStyle,
} from '../lib/textStyle';

/** The four placements the media toolbar offers; the engine's ids are also the spoken names. */
const PLACEMENTS: readonly { id: EditorialPlacement; label: string }[] = [
  { id: 'left', label: 'Stânga' },
  { id: 'right', label: 'Dreapta' },
  { id: 'center', label: 'Centru' },
  { id: 'full', label: 'Toată lățimea' },
];

const TYPOGRAPHY_CHOICES: readonly { id: EditorialTypography; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'small', label: 'Mic' },
  { id: 'medium', label: 'Mediu' },
  { id: 'large', label: 'Mare' },
];

export default function TextComposer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [draft, setDraft] = useState<TextDraft>(() => loadTextDraft());
  const [identity, setIdentity] = useState<EditorIdentity | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedId, setPublishedId] = useState<number | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaProgress, setMediaProgress] = useState<string | null>(null);
  const [selected, setSelected] = useState<EditorialSelection | null>(null);
  /** The last thirty layouts, so a dragged picture can be put back where it was. */
  const history = useRef<EditorialDocument[]>([]);
  /** One key per intent: an answer lost on a bad connection is replayed, not written twice. */
  const publishKey = useRef(publishIntentKey());

  const body = draft.body;
  /**
   * The words, counted the way the server counts them: paragraph separators are furniture of the page,
   * not characters of the article. Arranging a picture splits a paragraph in two, and a counter that
   * jumped by one on a layout gesture would look like lost text.
   */
  const characters = documentCharCount(draft.document);
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

  /** The local draft is written a little after the last keystroke, never on every character. */
  useEffect(() => {
    if (publishedId !== null) return;
    const timer = setTimeout(() => {
      try { saveTextDraft(draft); } catch { /* a full disk must not close the composer */ }
    }, 400);
    return () => clearTimeout(timer);
  }, [draft, publishedId]);

  function applyStyle(patch: Partial<TextStyle>) {
    // `readTextStyle` is tolerant and always keeps the theme's own colour pair, because the server
    // validates and stores that pair on publish. The pair is never painted — the page's colours come
    // from `pagePaletteOf` — so a theme change repaints only the accent, the face, the measure or the
    // alignment.
    edit({ style: readTextStyle({ ...draft.style, ...patch }) });
  }

  function insertEmoji(emoji: string) {
    if (characters >= TEXT_MAX_CHARS) return;
    const next = `${body}${body && !body.endsWith(' ') ? ' ' : ''}${emoji}`;
    applyDocument(applyPlainText(draft.document, next));
  }

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
      const picked = await pickTextAttachments(kind, remaining);
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
        try { saveTextDraft(draft); } catch { /* best effort: the composer still closes */ }
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
      await requirePageCapabilities();
      /** The page's files are uploaded now, in order, and the post references them as `media_items`. */
      let mediaItems: MediaRef[] = [];
      if (draft.attachments.length) {
        setMediaProgress(`Se încarcă atașamentul 1 din ${draft.attachments.length}…`);
        mediaItems = await uploadTextAttachments(owner, draft.attachments, (progress) => {
          setMediaProgress(`Se încarcă atașamentul ${progress.index + 1} din ${progress.total}… ${progress.percent}%`);
        });
      }
      setMediaProgress('Se scrie postarea…');
      const result = await publishPost({
        key: publishKey.current,
        userId: owner.userId,
        intent: {
          persona: owner.persona,
          caption: body,
          visibility: draft.visibility,
          provenance: draft.provenance,
          publishing: draft.publishing,
          textStyle: { ...draft.style, document: draft.document },
          media: null,
          mediaItems,
          kind: mediaItems.length ? draft.attachments[0].kind : null,
        },
      });
      try { discardTextDraft(); } catch { /* the post is live even if the local file lingers */ }
      setPublishedId(result.id);
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

  const theme = themeOf(draft.style.theme);
  const accountNote = identity
    ? `Publici ca @${identity.persona}.`
    : identityError ?? 'Se citește contul…';

  if (publishedId !== null) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.publishedCard}>
          <Text style={styles.publishedMark}>PUBLICAT</Text>
          <Text style={styles.publishedTitle}>Pagina ta este în feed.</Text>
          <Text style={styles.publishedBody}>
            {`Postarea #${publishedId} a fost scrisă cu tema „${theme.label}”. Pagina ei este hârtie, cu accentul temei; rămâne o pagină în feed, nu un Reel.`}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Închide compozitorul" style={styles.primary} onPress={() => router.back()}>
            <Text style={styles.primaryText}>Închide</Text>
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
                  onPress={() => {
                    applyDocument(removeEditorialBlock(draft.document, selectedMedia.id), true);
                    setSelected(null);
                  }}
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

        <Text style={styles.sectionLabel}>EMOJI</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiRow} keyboardShouldPersistTaps="handled">
          {TEXT_EMOJI.map((emoji) => (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={`Adaugă ${emoji}`}
              onPress={() => insertEmoji(emoji)}
              style={styles.emoji}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.sectionLabel}>TEMĂ</Text>
        <View style={styles.themeRow}>
          {TEXT_THEMES.map((item) => {
            const active = item.id === draft.style.theme;
            /**
             * Every swatch is the *same* paper with the theme's accent dot, because that is what a theme
             * still changes: the hairline a page is marked with. Painting each swatch in its own
             * background (`item.background`) would promise a coloured page the reader no longer prints —
             * the page under this chooser is paper whichever theme is picked.
             */
            const swatch = pagePaletteOf({ theme: item.id });
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Tema ${item.label}`}
                onPress={() => applyStyle({ theme: item.id })}
                style={[styles.theme, { backgroundColor: swatch.background, borderColor: active ? '#f6f8fb' : '#ffffff22' }]}
              >
                <View style={[styles.themeDot, { backgroundColor: swatch.accent }]} />
                <Text style={[styles.themeText, { color: swatch.text }]} numberOfLines={1}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>LITERĂ</Text>
        <View style={styles.chipRow}>
          {TEXT_FONTS.map((item) => (
            <Chip key={item.id} label={item.label} active={draft.style.font === item.id} onPress={() => applyStyle({ font: item.id })} />
          ))}
        </View>

        <Text style={styles.sectionLabel}>MĂRIME</Text>
        <View style={styles.chipRow}>
          {TYPOGRAPHY_CHOICES.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              active={(draft.document.typography ?? 'auto') === item.id}
              onPress={() => applyDocument(setDocumentTypography(draft.document, item.id), true)}
            />
          ))}
        </View>

        <Text style={styles.sectionLabel}>ALINIERE</Text>
        <View style={styles.chipRow}>
          {TEXT_ALIGNS.map((item) => (
            <Chip key={item.id} label={item.label} active={draft.style.align === item.id} onPress={() => applyStyle({ align: item.id })} />
          ))}
        </View>

        <Text style={styles.sectionLabel}>CINE VEDE</Text>
        <View style={styles.chipRow}>
          {POST_VISIBILITIES.map((value) => (
            <Chip
              key={value}
              label={VISIBILITY_LABELS[value]}
              active={draft.visibility === value}
              onPress={() => edit({ visibility: value as PostVisibility })}
            />
          ))}
        </View>

        <Text style={styles.sectionLabel}>PROVENIENȚĂ</Text>
        <View style={styles.chipRow}>
          {CONTENT_PROVENANCE.map((value) => (
            <Chip
              key={value}
              label={PROVENANCE_LABELS[value]}
              active={draft.provenance === value}
              onPress={() => edit({ provenance: value })}
            />
          ))}
        </View>

        <Text style={styles.sectionLabel}>DETALII DE PUBLICARE</Text>
        <View style={styles.settingsCard}>
          <Field
            label="Titlu"
            value={draft.publishing.title}
            maxLength={PUBLISHING_LIMITS.title}
            placeholder="Titlul paginii (opțional)"
            onChangeText={(value) => edit({ publishing: { ...draft.publishing, title: value } })}
          />
          <Field
            label="Locație"
            value={draft.publishing.location}
            maxLength={PUBLISHING_LIMITS.location}
            placeholder="Unde ai scris (opțional)"
            onChangeText={(value) => edit({ publishing: { ...draft.publishing, location: value } })}
          />
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
       */}
    </KeyboardAvoidingView>
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
  progress: { color: '#9ccb6e', fontSize: 12, marginTop: 8 },
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
  emojiRow: { gap: 8, paddingVertical: 2 },
  emoji: { backgroundColor: '#12161c', borderRadius: 12, borderWidth: 1, borderColor: '#ffffff14', paddingHorizontal: 10, paddingVertical: 6 },
  emojiText: { fontSize: 20 },
  themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  theme: { width: 104, borderRadius: 12, borderWidth: 1.5, padding: 10, gap: 8 },
  themeDot: { width: 12, height: 12, borderRadius: 6 },
  themeText: { fontSize: 12, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  publishedMark: { color: '#9ccb6e', fontSize: 11, letterSpacing: 2.4, fontWeight: '700' },
  publishedTitle: { color: '#f6f8fb', fontSize: 22, fontWeight: '700' },
  publishedBody: { color: '#aab4be', fontSize: 14, lineHeight: 21 },
  primary: { backgroundColor: '#ff315f', borderRadius: 99, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

