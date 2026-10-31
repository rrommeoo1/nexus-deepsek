import * as DocumentPicker from 'expo-document-picker';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  audioUploadMime, backupCapture, captureDraftId, captureFlowErrorMessage, captureUploadMime,
  catalogAudioSelected, loadEditorIdentity, publishCapture,
  type CaptureFlowProgress, type EditorIdentity,
} from '../lib/capturePublish';
import { deleteCreatorDraft, draftMutationKey, fetchCreatorDrafts } from '../lib/draftsClient';
import {
  discardCapture, loadDraft, persistLocalAudio, saveDraft, touchDraft,
  type LocalCapture, type LocalDraft, type LocalSticker,
} from '../lib/localCapture';
import { nexusApi } from '../lib/nexusApi';
import { publishIntentKey } from '../lib/publishClient';
import { PublishPanel } from './PublishPanel';
import { PostCanvas, type PostChromeMeasure } from './PostCanvas';
import { PostOverlay } from './PostOverlay';
import { PostRail, RAIL_FOOT } from './PostRail';
import { mediaContentRect, overlayPercent } from '../lib/overlayFrame';
import {
  decorationSpot, fractionOfFrame, freeSpots, guideLabelPlacement, previewSafeZones, zonesAt,
  type GuideRect, type SafeZone, type SafeZoneId,
} from '../lib/previewSafety';

import { postPageTopInset } from '../lib/postChrome';
import { profileReaderBottomInset } from '../lib/readerBar';
import { studioDecorations } from '../lib/studioManifest';
import type { MeResponse, SocialPost } from '../lib/socialTypes';

type JamendoTrack = {
  id: string; name: string; artist: string; audio_url: string;
  attribution: string; selection_token: string;
};
const EMOJI = ['❤️', '😍', '😂', '🔥', '✨', '🥰', '👏', '🎉', '😊', '😭', '💯', '😎', '💜', '⭐', '🥹', '🤩'];

function stickerLabel(sticker: LocalSticker, now: number): string {
  if (sticker.type === 'LOCATION') return sticker.text;
  if (!now) return '…';
  try {
    return new Intl.DateTimeFormat('ro-RO', sticker.type === 'TIME'
      ? { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: sticker.timezone }
      : { day: '2-digit', month: '2-digit', timeZone: sticker.timezone }).format(new Date(now));
  } catch { return sticker.type === 'TIME' ? 'Ora indisponibilă' : 'Data indisponibilă'; }
}

/**
 * Urma pe care o raportează un `onLayout`, în punctele părintelui (aici: ecranul, pentru că previzualizarea
 * este `absoluteFill` pe el).
 */
function boxOf(event: LayoutChangeEvent): GuideRect {
  const { x, y, width, height } = event.nativeEvent.layout;
  return {
    left: Math.max(0, Math.round(x)),
    top: Math.max(0, Math.round(y)),
    width: Math.max(0, Math.round(width)),
    height: Math.max(0, Math.round(height)),
  };
}

/** Două urme egale nu trebuie să schimbe starea: un `onLayout` care raportează la fel la fiecare cadru ar
 *  randa editorul la infinit. */
function sameBox(a: GuideRect | null, b: GuideRect | null): boolean {
  if (!a || !b) return a === b;
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
}

/** Ce scrie pe ghidaj despre o etichetă: textul ei, scurtat, ori felul ștampilei când nu are text. */
function decorationLabel(decoration: { type: string; text: string }): string {
  const text = (decoration.text ?? '').trim();
  if (text) return text.length > 24 ? `${text.slice(0, 24)}…` : text;
  if (decoration.type === 'TIME') return 'Ora';
  if (decoration.type === 'DATE') return 'Data';
  if (decoration.type === 'LOCATION') return 'Locul';
  return 'Textul';
}

/**
 * Culoarea unui ghidaj, după banda pe care o apără. Nimic nu este o a doua paletă: capul poartă rozul
 * paginii (cuvântul cel mai des verificat), descrierea argintiul deschis, reacțiile argintiul de mijloc, iar
 * benzile care nu se publică rămân gri stins. Nuanțele verzi și aurii sunt interzise în cod (auditul din
 * `test-black-silver.cjs`), deci un ghidaj nu are voie să inventeze una.
 */
function guideZoneStyle(id: SafeZoneId): { borderColor: string } {
  if (id === 'head') return { borderColor: 'rgba(255,49,95,0.85)' };
  if (id === 'description') return { borderColor: 'rgba(255,255,255,0.66)' };
  if (id === 'rail') return { borderColor: 'rgba(214,219,228,0.7)' };
  if (id === 'tool') return { borderColor: 'rgba(170,176,186,0.7)' };
  return { borderColor: 'rgba(255,255,255,0.3)' };
}

/** Sub asta, o bandă nu încape cu eticheta în ea: coloana de reacții are 44 dp, uneltele 53 dp. */

/**
 * The clip of the capture, drawn in the rectangle the published page will draw it in.
 *
 * `fit` is not a taste: the reader draws a clip `portrait-cover` (`PostMedia`), i.e. a vertical clip is
 * cropped to fill the page and a landscape one keeps its whole frame. The editor used to letterbox every
 * clip inside a centred 9:16 box, so a text dragged to the upper third of what the author saw landed in
 * the middle of what the reader saw. It now reports the clip's own orientation (`onPortrait`) for the same
 * decision, and the caller measures the content rectangle from it (`lib/overlayFrame.ts`).
 */
function VideoPreview({ uri, muteOriginal, fit = 'cover', onPortrait, clock }: {
  uri: string;
  muteOriginal: boolean;
  fit?: 'cover' | 'contain';
  onPortrait?: (portrait: boolean) => void;
  /** The canvas's own reporter (`PostCanvas.mediaClock`): the preview's clock reaches the published bar. */
  clock?: { current: ((fraction: number, position: number, duration: number) => void) | null };
}) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = muteOriginal;
    instance.play();
    /** Four samples a second, exactly what a published clip gives the bar (`PostMedia`). */
    instance.timeUpdateEventInterval = 0.25;
  });
  /**
   * The clip's own clock, for the page it is about to become (round 42). `timeUpdate` is the same event
   * `PostMedia` listens to, so the preview's bar, its two times and the reader's are the same numbers from
   * the same kind of sample — the preview simply had nobody listening before.
   */
  useEffect(() => {
    const subscription = player.addListener('timeUpdate', ({ currentTime }) => {
      const total = player.duration || 0;
      const fraction = total > 0 ? Math.max(0, Math.min(1, currentTime / total)) : 0;
      clock?.current?.(fraction, Math.max(0, currentTime), total);
    });
    return () => subscription.remove();
  }, [clock, player]);
  useEffect(() => {
    const read = (tracks: typeof player.availableVideoTracks) => {
      const size = tracks.find((track) => track.size.width > 0 && track.size.height > 0)?.size;
      if (size) onPortrait?.(size.height >= size.width);
    };
    read(player.availableVideoTracks);
    const loaded = player.addListener('sourceLoad', ({ availableVideoTracks }) => read(availableVideoTracks));
    const changed = player.addListener('videoTrackChange', ({ videoTrack }) => {
      if (videoTrack?.size) read([videoTrack]);
    });
    return () => { loaded.remove(); changed.remove(); };
  }, [onPortrait, player]);
  /**
   * A `textureView`, not the default surface: the editor draws the author's head, the caption and the
   * draggable words **over** the clip, and a plain `SurfaceView` is composited by Android in its own layer
   * above every sibling view — the preview showed a video with the post's chrome hidden behind it (seen on
   * the phone, round 41). A texture view costs a copy per frame and is the only surface a view can be
   * drawn over; the reader keeps the cheaper one (`PostMedia`), because there the chrome lives *outside*
   * the video's rectangle.
   */
  return <VideoView style={StyleSheet.absoluteFill} player={player} contentFit={fit} nativeControls={false} surfaceType="textureView" />;
}

export function CaptureEditor({ capture, onExit }: { capture: LocalCapture; onExit: () => void }) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<LocalDraft>(() => loadDraft(capture));
  const draftRef = useRef(draft);
  const [page, setPage] = useState<'edit' | 'details'>('edit');
  const [textOpen, setTextOpen] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [locationText, setLocationText] = useState('');
  const [stickerError, setStickerError] = useState('');
  const [now, setNow] = useState(0);
  const [screenSize, setScreenSize] = useState({ width: 0, height: 0 });
  /**
   * Is the clip of this capture taller than it is wide? The reader draws a vertical clip `cover` and a
   * landscape one `contain` (`PostMedia`'s `portrait-cover`), so the preview must know before it can put a
   * dragged text where the reader will print it. A still picture is always `cover`.
   *
   * Until the clip's own track says otherwise the answer is "not portrait": a landscape file must not be
   * cropped for the first frames of its own preview (round 42).
   */
  const [portraitVideo, setPortraitVideo] = useState(false);
  /**
   * The author this draft will be published as, read from `/api/me` for the preview's head only. The
   * publish path keeps its own reading (`loadEditorIdentity`), so a preview that could not be read never
   * holds a publish back.
   */
  const [me, setMe] = useState<MeResponse['user'] | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [audioBusy, setAudioBusy] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [musicQuery, setMusicQuery] = useState('');
  const [musicTracks, setMusicTracks] = useState<JamendoTrack[]>([]);
  const [musicError, setMusicError] = useState('');
  const [musicBusy, setMusicBusy] = useState(false);
  // The account copy of this capture and the flow that writes it: `identity` is read once when the
  // editor opens, `publishedId` freezes the editor once the post is live.
  const [identity, setIdentity] = useState<EditorIdentity | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [accountCopy, setAccountCopy] = useState<'checking' | 'none' | 'saved' | 'stale'>('checking');
  const [flowBusy, setFlowBusy] = useState<'backup' | 'publish' | null>(null);
  const [flowProgress, setFlowProgress] = useState<CaptureFlowProgress | null>(null);
  const [flowNote, setFlowNote] = useState<string | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [publishedId, setPublishedId] = useState<number | null>(null);
  /**
   * How tall the editor's own foot is (the hint lines and the `Next` button), measured rather than
   * assumed. The preview is the *published* page, so its caption and its rail must stand above whatever
   * the editor has put at the foot of the screen — the editor's bar plays the part the device's inset
   * plays on the reader's phone. Measured with `onLayout`, so a longer hint or a second button line moves
   * the page instead of covering it (owner's „nu văd unde ajunge descrierea", round 41).
   */
  const [editorFoot, setEditorFoot] = useState(0);
  /**
   * Cât loc iau, în puncte de cadru, benzile de cuvinte ale paginii **publicate**: marginile capului și
   * înălțimea blocului de descriere, raportate de compoziție (`PostCanvas.onChromeMeasure`, adică din
   * `onLayout`, nu din stiluri). Ghidajele de zonă sigură se desenează pe aceste numere — un ghidaj socotit
   * separat ar arăta o bandă pe care pagina nu o are (owner, runda 43: „previzualizarea să fie exact ce se
   * publică").
   */
  const [previewChrome, setPreviewChrome] = useState<PostChromeMeasure>({ head: 0, description: 0 });
  const measureChrome = useCallback((measure: PostChromeMeasure) => {
    setPreviewChrome((previous) => (
      previous.head === measure.head && previous.description === measure.description ? previous : measure
    ));
  }, []);
  /** Ghidajele sunt o unealtă a compozitorului, nu parte din poză: se pot stinge, și nu se publică. */
  const [guidesOn, setGuidesOn] = useState(true);
  /** Urma măsurată a coloanei de reacții (`PostRail.onLayout`) — coloana își știe propria înălțime. */
  const [railBox, setRailBox] = useState<GuideRect | null>(null);
  /** Urma măsurată a uneltelor editorului: fură loc din poză cât se compune, deci intră în ghidaje. */
  const [toolBox, setToolBox] = useState<GuideRect | null>(null);
  const publishKey = useRef<string | null>(null);
  /**
   * The preview clip's clock, handed to the canvas and filled by the canvas (`PostCanvas.mediaClock`):
   * the editor's own player writes into it, and the page's bar and times read it. One handle, because a
   * file on this phone is not a `RemoteVideo` and the canvas owns the only bar there is.
   */
  const previewClock = useRef<((fraction: number, position: number, duration: number) => void) | null>(null);
  const audioPlayer = useAudioPlayer(draft.audioUri ?? draft.jamendoAudioUrl ?? null);
  const audioStatus = useAudioPlayerStatus(audioPlayer);
  /** The aspect the manifest publishes (`studioManifestFor`: `VERTICAL_9_16` or `ORIGINAL`). */
  const mediaAspect = capture.framing === '9:16' ? 9 / 16 : 3 / 4;
  /**
   * The band the preview page gives up at its foot: the device's own inset plus the strip of air a page
   * opened from a profile keeps (`profileReaderBottomInset`), and never less than the editor's own bar —
   * which is what the reader's device inset becomes inside this screen.
   */
  const pageFoot = Math.max(profileReaderBottomInset(insets.bottom), editorFoot);
  /**
   * The rule the reader will draw this file with: a still picture covers the page, and so does a vertical
   * clip; a landscape clip keeps its whole frame (`PostMedia`'s `portrait-cover`).
   *
   * Round 42 aligns the *unknown* case with the reader's: `portraitVideo` starts `false` for a clip, so a
   * landscape file is letterboxed from the first frame instead of being cropped until its track arrives
   * and then jumping to `contain` — the "wrong framing before the orientation is resolved" the owner
   * reported. The reader resolves the same unknown the same way (`displayedPortraitByHash` defaults to
   * `false`), so both surfaces guess identically, which is the only thing a guess may do.
   */
  const previewFit: 'cover' | 'contain' = capture.kind === 'photo' || portraitVideo ? 'cover' : 'contain';
  /**
   * The rectangle the picture **really** occupies, measured against the whole preview surface — the same
   * rectangle the reader measures on the published page (`lib/overlayFrame.ts::mediaContentRect`). It is
   * larger than the screen on the short side when the media is cropped, which is exactly why the composer
   * must not measure its texts against a smaller, centred box.
   */
  const previewRect = mediaContentRect({
    width: screenSize.width, height: screenSize.height, ratio: mediaAspect, fit: previewFit,
  });
  /**
   * What this draft will publish, over the picture: the manifest's own decorations, not a second drawing
   * of them (`studioDecorations`). A text that is still being typed is here as it will be sent.
   */
  const previewDecorations = useMemo(() => {
    try { return studioDecorations(capture, draft); } catch { return []; }
  }, [capture, draft]);
  /**
   * The clock of the preview, read **once**: `created_at` says „acum" on the head, and a `Date.now()` inside
   * the memo below would be an impure call during render (eslint's `react-hooks/purity` refuses it, rightly —
   * the record would change identity on every re-render).
   */
  const [previewCreatedAt] = useState(() => Date.now());
  /**
   * The post this capture is about to become, as the reader will receive it: the same `SocialPost` fields
   * `PostCanvas` reads (author, caption, place, time, the media kind that decides the composition). It is
   * not stored anywhere and its id is negative — a preview is a drawing, not a record.
   */
  const previewPost = useMemo<SocialPost>(() => ({
    id: -1,
    kind: capture.kind === 'video' ? 'video' : 'image',
    caption: draft.description,
    created_at: previewCreatedAt,
    persona: identity?.persona ?? 'social',
    /**
     * The media record, in the shape the reader's own classifier reads. `hash` and `ext` are what make a
     * post a *media* post at all (`lib/postPresentation.ts::mediaOf` and `socialTypes.postMediaItems` both
     * require them — the second one wants a 64-character hash), and they are the reason the preview is a
     * reel and not a page of words: without them the canvas drew the **paper** composition over the clip,
     * with the author's name in the paper's dark ink (seen on the phone, round 41). No byte is ever fetched
     * for them: the picture itself comes from this phone (`mediaOverride`), so the canvas never mounts its
     * own `RemoteImage`/`RemoteVideo` for this record.
     */
    media: {
      hash: '0000000000000000000000000000000000000000000000000000000000000000',
      ext: capture.kind === 'video' ? 'mp4' : 'jpg',
      mime: capture.kind === 'video' ? 'video/mp4' : 'image/jpeg',
      kind: capture.kind === 'video' ? 'video' : 'image',
    },
    publishing: { location: draft.publishing.location, locationPrecision: draft.publishing.locationPrecision, title: draft.publishing.title },
    author: me ? { id: me.id, handle: me.handle, display_name: me.display_name, avatar: me.avatar } : null,
  }), [capture.kind, draft.description, draft.publishing.location, draft.publishing.locationPrecision, draft.publishing.title, identity?.persona, me, previewCreatedAt]);
  /**
   * A dragged label writes the number the manifest stores: the fraction of the **content rectangle** it
   * was dropped at (`lib/overlayFrame.ts::overlayPercent`), for the placed text and for a sticker alike.
   * Declared below `updateDraft` (it is the write itself), never above it.
   */

  useEffect(() => {
    if (!(draft.stickers ?? []).some((item) => item.type === 'TIME' || item.type === 'DATE')) return;
    const first = setTimeout(() => setNow(Date.now()), 0);
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [draft.stickers]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void (async () => {
      let me: EditorIdentity;
      try {
        me = await loadEditorIdentity();
      } catch (error) {
        if (!active) return;
        setIdentityError(captureFlowErrorMessage(error));
        setAccountCopy('none');
        return;
      }
      if (!active) return;
      setIdentity(me);
      const id = captureDraftId(capture);
      try {
        const drafts = await fetchCreatorDrafts(me, { signal: controller.signal });
        if (!active) return;
        setAccountCopy(id && drafts.some((row) => row.id === id) ? 'saved' : 'none');
      } catch {
        if (!active) return;
        // The list is only used to describe the account copy: an unreadable list must not stop the
        // user from saving or publishing, so it is reported as a note rather than as an error.
        setAccountCopy('none');
        setFlowNote('Lista drafturilor din cont nu a putut fi citită; poți salva în cont și publica oricum.');
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [capture]);

  const updateDraft = useCallback((patch: Partial<LocalDraft>) => {
    // `touchDraft` moves the manifest's edit stamp, so the backup key changes per edit: a second "save
    // in account" writes the account copy instead of replaying the previous answer.
    const next = touchDraft({ ...draftRef.current, ...patch });
    draftRef.current = next;
    setDraft(next);
    // What the server reads has just changed: the account copy is now behind the phone, and the next
    // publish is a new intent, so it gets a fresh idempotency key.
    publishKey.current = null;
    setAccountCopy((current) => (current === 'saved' ? 'stale' : current));
    try {
      saveDraft(capture, next);
      setSaveError(null);
    } catch (error) {
      setSaveError(`Draftul nu a putut fi salvat: ${String(error)}`);
    }
  }, [capture]);

  /**
   * The author of the preview. One read of `/api/me`, for the head of the page the editor shows; a
   * refusal leaves the head to the canvas's own fallback (`BrandAvatar`, the `nexus` handle) and changes
   * nothing about publishing, which reads the account through `loadEditorIdentity`.
   */
  useEffect(() => {
    let alive = true;
    void nexusApi<MeResponse>('/api/me')
      .then((answer) => { if (alive) setMe(answer?.user ?? null); })
      .catch(() => { if (alive) setMe(null); });
    return () => { alive = false; };
  }, []);

  /**
   * A dragged label writes the number the manifest stores: the fraction of the **content rectangle** it
   * was dropped at (`lib/overlayFrame.ts::overlayPercent`), for the placed text and for a sticker alike.
   */
  const moveDecoration = useCallback((id: string, x: number, y: number) => {
    if (id.startsWith('text-')) { updateDraft({ overlayX: x, overlayY: y }); return; }
    updateDraft({ stickers: (draftRef.current.stickers ?? []).map((entry) => (entry.id === id ? { ...entry, x, y } : entry)) });
  }, [updateDraft]);

  /**
   * Benzile de zonă sigură, pe măsurători: capul și descrierea vin din compoziție (`previewChrome`), bara
   * de la poale din `pageFoot` (insetul telefonului ori bara editorului), iar reacțiile și uneltele din
   * propriile lor `onLayout`. Toate dreptunghiurile sunt în punctele ecranului, pentru că previzualizarea
   * este `absoluteFill` pe el.
   */
  const guideZones = useMemo<SafeZone[]>(() => {
    if (screenSize.width <= 0 || screenSize.height <= 0) return [];
    const measured = [
      railBox ? { id: 'rail' as const, label: 'Reacțiile', rect: railBox } : null,
      toolBox ? { id: 'tool' as const, label: 'Uneltele editorului', published: false, rect: toolBox } : null,
    ].filter((band): band is NonNullable<typeof band> => band !== null);
    return previewSafeZones({
      width: screenSize.width,
      height: screenSize.height,
      head: previewChrome.head,
      description: previewChrome.description,
      foot: pageFoot,
      systemTop: insets.top,
      systemBottom: insets.bottom,
      measured,
    });
  }, [insets.bottom, insets.top, pageFoot, previewChrome.description, previewChrome.head, railBox, screenSize.height, screenSize.width, toolBox]);

  /**
   * Etichetele care cad peste o bandă cu cuvinte sau butoane, grupate pe bandă.
   *
   * Punctul fiecărei etichete este cel pe care îl desenează `PostOverlay`: fracția din dreptunghiul de
   * conținut, dusă în punctele cadrului (`frameSpotOf`). Nimic nu este estimat — dacă o etichetă este sub
   * numele autorului, apare aici.
   */
  const guideHits = useMemo(() => {
    if (previewRect.width <= 0) return [] as { zone: SafeZone; labels: string[]; ids: string[] }[];
    const byZone = new Map<string, { zone: SafeZone; labels: string[]; ids: string[] }>();
    for (const decoration of previewDecorations) {
      /**
       * Poziția etichetei, citită din manifest (`x`/`y` sunt **procente** 0–100, nu fracții): conversia o
       * face `decorationSpot`, într-un singur loc. Înainte, procentul intra direct în `frameSpotOf`, era
       * limitat la 1 și fiecare etichetă cădea în colțul de jos — de aceea avertismentul nu se vedea.
       */
      const spot = decorationSpot(previewRect, decoration);
      for (const zone of zonesAt(guideZones, spot)) {
        const entry = byZone.get(zone.id) ?? { zone, labels: [], ids: [] };
        if (entry.ids.includes(decoration.id)) continue;
        entry.ids.push(decoration.id);
        const label = decorationLabel(decoration);
        if (!entry.labels.includes(label)) entry.labels.push(label);
        byZone.set(zone.id, entry);
      }
    }
    return [...byZone.values()];
  }, [guideZones, previewDecorations, previewRect]);

  /**
   * Mută etichetele care intră în benzi în locurile libere din cadru, ca autorul să nu fie obligat să
   * ghicească: `freeSpots` așază un punct pentru fiecare, iar fracția scrisă în draft este cea a
   * dreptunghiului de conținut (`overlayPercent`), adică exact ce va citi reader-ul.
   */
  const moveLabelsToSafeArea = useCallback(() => {
    const ids = [...new Set(guideHits.flatMap((hit) => hit.ids))];
    if (!ids.length || previewRect.width <= 0) return;
    const spots = freeSpots(guideZones, { width: screenSize.width, height: screenSize.height, count: ids.length });
    if (!spots.length) return;
    ids.forEach((id, index) => {
      const fraction = fractionOfFrame({ rect: previewRect, point: spots[index] });
      moveDecoration(id, overlayPercent(fraction.x) / 100, overlayPercent(fraction.y) / 100);
    });
  }, [guideHits, guideZones, moveDecoration, previewRect, screenSize.height, screenSize.width]);

  const measureRail = useCallback((event: LayoutChangeEvent) => {
    const next = boxOf(event);
    setRailBox((previous) => (sameBox(previous, next) ? previous : next));
  }, []);
  const measureTools = useCallback((event: LayoutChangeEvent) => {
    const next = boxOf(event);
    setToolBox((previous) => (sameBox(previous, next) ? previous : next));
  }, []);

  function addSticker(type: LocalSticker['type']) {
    const current = draftRef.current;
    if ((current.stickers?.length ?? 0) + (current.overlayText.trim() ? 1 : 0) >= 12) {
      setStickerError('Poți adăuga cel mult 12 texte și stickere pe o captură.');
      return;
    }
    const place = locationText.normalize('NFKC').trim().slice(0, 116);
    if (type === 'LOCATION' && !place) {
      setStickerError('Scrie numele real al locului înainte să adaugi stickerul.');
      return;
    }
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const sticker: LocalSticker = {
      id: `${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type, text: type === 'LOCATION' ? `📍 ${place}` : '',
      x: 0.5, y: 0.48, timezone,
    };
    updateDraft({ stickers: [...(current.stickers ?? []), sticker] });
    setStickerError('');
    setStickersOpen(false);
  }

  // The web offers automatic music for a fresh capture. Request the same real catalog once
  // when this editor opens; never replace a track/file the author already chose or invent a fallback.
  useEffect(() => {
    if (draftRef.current.audioUri || draftRef.current.jamendoAudioUrl) return;
    let cancelled = false;
    void nexusApi<{ ok: true; tracks: JamendoTrack[] }>('/api/reels/sound-suggestions?duration=30')
      .then((result) => {
        if (cancelled || draftRef.current.audioUri || draftRef.current.jamendoAudioUrl) return;
        const track = result.tracks?.[0];
        if (!track) {
          setMusicError('Catalogul Jamendo nu a returnat melodii. Poți continua fără muzică.');
          return;
        }
        updateDraft({
          audioUri: undefined, audioName: `${track.name} — ${track.artist}`,
          jamendoTrackId: track.id, jamendoAudioUrl: track.audio_url,
          jamendoSelectionToken: track.selection_token, jamendoAttribution: track.attribution,
        });
        setMusicTracks(result.tracks);
        setMusicError('');
      })
      .catch((error) => {
        if (!cancelled) setMusicError(error instanceof Error ? error.message : 'Catalogul Jamendo nu este disponibil.');
      });
    return () => { cancelled = true; };
  }, [updateDraft]);

  function confirmExit() {
    Alert.alert('Închizi editorul?', 'Poți continua sau păstra draftul. Ștergerea elimină doar această captură locală.', [
      { text: 'Continuă editarea', style: 'cancel' },
      { text: 'Salvează draft', onPress: () => {
        try { saveDraft(capture, draft); onExit(); }
        catch (error) { setSaveError(`Draftul nu a putut fi salvat: ${String(error)}`); }
      } },
      { text: 'Șterge captura', style: 'destructive', onPress: () => {
        try { discardCapture(capture); onExit(); }
        catch (error) { setSaveError(`Captura nu a putut fi ștearsă: ${String(error)}`); }
      } },
    ]);
  }

  async function chooseMusic() {
    if (audioBusy) return;
    setAudioBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const saved = await persistLocalAudio(asset.uri, capture, asset.name, asset.mimeType);
      audioPlayer.pause();
      audioPlayer.replace(saved.uri);
      updateDraft({ audioUri: saved.uri, audioName: saved.name, jamendoTrackId: undefined, jamendoAudioUrl: undefined, jamendoSelectionToken: undefined, jamendoAttribution: undefined });
    } catch (error) {
      Alert.alert('Muzica nu a fost adăugată', String(error));
    } finally {
      setAudioBusy(false);
    }
  }

  function removeMusic() {
    audioPlayer.pause();
    audioPlayer.replace(null);
    updateDraft({ audioUri: undefined, audioName: undefined, jamendoTrackId: undefined, jamendoAudioUrl: undefined, jamendoSelectionToken: undefined, jamendoAttribution: undefined });
  }

  async function searchMusic() {
    if (musicBusy) return;
    setMusicBusy(true);
    setMusicError('');
    try {
      const query = musicQuery.trim();
      const result = await nexusApi<{ ok: true; tracks: JamendoTrack[] }>(`/api/reels/sound-suggestions?duration=30&q=${encodeURIComponent(query)}`);
      setMusicTracks(result.tracks || []);
    } catch (error) {
      setMusicTracks([]);
      setMusicError(error instanceof Error ? error.message : 'Catalogul muzical nu este disponibil.');
    } finally { setMusicBusy(false); }
  }

  function selectMusic(track: JamendoTrack) {
    audioPlayer.pause();
    audioPlayer.replace(track.audio_url);
    updateDraft({ audioUri: undefined, audioName: `${track.name} — ${track.artist}`, jamendoTrackId: track.id, jamendoAudioUrl: track.audio_url, jamendoSelectionToken: track.selection_token, jamendoAttribution: track.attribution });
    setMusicError('');
    setMusicOpen(false);
  }

  /** Saves locally and closes, the plain "Doar pe telefon" path — no network is touched. */
  function saveAndExit() {
    try { saveDraft(capture, draft); onExit(); }
    catch (error) { setSaveError(`Draftul nu a putut fi salvat: ${String(error)}`); }
  }

  /** After a published post the local file has served its purpose, so it is removed before leaving. */
  function closePublished() {
    try { discardCapture(capture); }
    catch (error) { setSaveError(`Captura a rămas pe telefon: ${captureFlowErrorMessage(error)}`); }
    onExit();
  }

  async function runBackup() {
    if (!identity || flowBusy || publishedId !== null) return;
    const id = captureDraftId(capture);
    if (!id) { setFlowError('Captura nu are un nume din care să se formeze un identificator de draft.'); return; }
    setFlowBusy('backup');
    setFlowProgress(null);
    setFlowError(null);
    setFlowNote(null);
    try {
      const backup = await backupCapture({
        identity,
        capture,
        draft,
        key: draftMutationKey(id, draft.updatedAt),
        onProgress: setFlowProgress,
      });
      setAccountCopy('saved');
      setFlowNote(`Draftul este salvat în cont, cu ${backup.media.length} fișiere atașate.`);
    } catch (error) {
      setFlowError(captureFlowErrorMessage(error));
    } finally {
      setFlowBusy(null);
      setFlowProgress(null);
    }
  }

  async function runPublish() {
    if (!identity || flowBusy || publishedId !== null) return;
    // One key per intent: kept across retries so the server replays a written post instead of writing
    // a second one, and dropped by `updateDraft` as soon as something is edited.
    const key = publishKey.current ?? publishIntentKey();
    publishKey.current = key;
    setFlowBusy('publish');
    setFlowProgress(null);
    setFlowError(null);
    setFlowNote(null);
    try {
      const post = await publishCapture({ identity, capture, draft, key, onProgress: setFlowProgress });
      publishKey.current = null;
      setPublishedId(post.id);
      const id = captureDraftId(capture);
      if (id && accountCopy !== 'none') {
        // The post is live; a leftover account copy is reported, never shown as a failed publication.
        const removed = await deleteCreatorDraft(id, identity);
        setAccountCopy(removed ? 'none' : 'saved');
        if (!removed) setFlowNote(`Postarea #${post.id} este publicată. Copia din cont a draftului a rămas; o poți șterge din profil.`);
      }
    } catch (error) {
      setFlowError(captureFlowErrorMessage(error));
    } finally {
      setFlowBusy(null);
      setFlowProgress(null);
    }
  }

  const accountNote = identityError
    ?? (accountCopy === 'checking'
      ? 'Se verifică dacă această captură are deja o copie în cont…'
      : accountCopy === 'saved'
        ? 'O copie a acestui draft este salvată în contul tău.'
        : accountCopy === 'stale'
          ? 'Ai modificat draftul după ultima salvare în cont, deci copia din cont este mai veche.'
          : 'Această captură nu are încă o copie în cont.');

  if (page === 'details') {
    return (
      <View style={[styles.detailsScreen, { paddingTop: Math.max(insets.top, 18) + 12, paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Înapoi la editare" onPress={() => setPage('edit')} style={styles.headerButton}><Text style={styles.headerIcon}>‹</Text></Pressable>
          <Text style={styles.heading}>Detalii postare</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Închide editorul" onPress={confirmExit} style={styles.headerButton}><Text style={styles.headerIcon}>×</Text></Pressable>
        </View>
        <PublishPanel
          accountNote={accountNote}
          accountReady={identity !== null && identityError === null}
          audioMime={audioUploadMime(draft)}
          busy={flowBusy !== null}
          capture={capture}
          captureMime={captureUploadMime(capture)}
          catalogAudio={catalogAudioSelected(draft)}
          draft={draft}
          error={flowError}
          note={flowNote}
          onBackup={() => void runBackup()}
          onChange={updateDraft}
          onClose={closePublished}
          onPublish={() => void runPublish()}
          onSaveDraft={saveAndExit}
          progress={flowProgress}
          publishedId={publishedId}
        />
        {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.screen} onLayout={(event) => setScreenSize(event.nativeEvent.layout)}>
      {/**
       * The page this capture is about to become, drawn by the component that will draw it after the
       * publish: `PostCanvas` — the same head, the same caption block, the same foot, the same 9:16
       * geometry — around the file this phone holds (`mediaOverride`). The editor used to draw its own
       * approximation of a reel (a centred box, `contain`, a fixed 27-point text in a dark pill), which is
       * why the owner saw the text "become too large and stand somewhere else" after publishing.
       *
       * `mediaOverlay` carries the words over the picture, drawn by the reader's own layer (`PostOverlay`)
       * in the same content rectangle and at the same type, with the one difference the editor is allowed:
       * they can be dragged (`onMove` writes the fraction the manifest stores). Being handed to the canvas
       * also gives the preview the published paint order — picture, then what was written on it, then the
       * author's head and the caption.
       */}
      <View style={StyleSheet.absoluteFill}>
        <PostCanvas
          post={previewPost}
          variant="feed"
          layout="post"
          page
          /**
           * Round 42: the page starts under the editor's own row, exactly as it starts under the route's
           * header (`postPageTopInset`). Before it, the canvas began at the status clock while the editor
           * drew its `×` and `Next` at `inset + 10` — over the author's avatar and his Follow door.
           */
          topInset={postPageTopInset(insets.top)}
          bottomInset={pageFoot}
          /** Cât loc iau capul și descrierea publicate: ghidajele se desenează pe aceste numere. */
          onChromeMeasure={measureChrome}
          mediaClock={previewClock}
          mediaOverride={previewRect.width > 0 ? (
            <View style={{
              position: 'absolute', left: previewRect.left, top: previewRect.top,
              width: previewRect.width, height: previewRect.height,
            }}>
              {capture.kind === 'photo'
                ? <Image source={{ uri: capture.uri }} style={StyleSheet.absoluteFill} resizeMode={previewFit} />
                : (
                  <VideoPreview
                    key={draft.audioUri || draft.jamendoAudioUrl ? 'with-music' : 'original-audio'}
                    uri={capture.uri}
                    muteOriginal={!!(draft.audioUri || draft.jamendoAudioUrl)}
                    fit={previewFit}
                    onPortrait={setPortraitVideo}
                    clock={previewClock}
                  />
                )}
            </View>
          ) : null}
          mediaOverlay={(
            <PostOverlay
              decorations={previewDecorations}
              bounds={screenSize}
              ratio={mediaAspect}
              fit={previewFit}
              now={now}
              onMove={moveDecoration}
            />
          )}
        />
        {/**
         * The rail of the page the capture becomes: the same column of presses the reader will put over the
         * picture, at the same distance from the foot (`RAIL_FOOT` plus the page's own bottom inset), with
         * the soundtrack's disc on a clip. It is drawn so the preview can be trusted about *where the
         * buttons stand* — that was the owner's question — but every press is inert here: this is a
         * drawing of the post, not the post.
         */}
        <PostRail
          bottom={RAIL_FOOT + pageFoot}
          onLayout={measureRail}
          summary={null}
          comments={0}
          reposts={0}
          saved={false}
          reposted={false}
          heart="emoji"
          sound={capture.kind === 'video' ? { muted: false, label: 'Oprește sunetul', onToggle: () => {} } : null}
          onReact={() => {}}
          onOpenComments={() => {}}
          onToggleSaved={() => {}}
          onShare={() => {}}
        />
        {/**
         * Benzile de zonă sigură, desenate pe măsurătorile de mai sus: capul paginii, descrierea, bara
         * telefonului, coloana de reacții și uneltele editorului. Ele sunt o unealtă a compozitorului — nu
         * se publică, nu primesc atingerea (`pointerEvents="none"`, ca trasul etichetelor să meargă prin
         * ele) și se pot stinge din `Ghidaje`.
         */}
        {guidesOn && guideZones.length ? (
          <>
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {guideZones.map((zone) => (
                <View
                  key={zone.id}
                  style={[
                    styles.guideZone,
                    guideZoneStyle(zone.id),
                    !zone.published && styles.guideZoneDraft,
                    { left: zone.rect.left, top: zone.rect.top, width: zone.rect.width, height: zone.rect.height },
                  ]}
                />
              ))}
            </View>
            {/**
             * Etichetele stau într-un strat al lor, peste tot cadrul: un copil absolut poziționat este măsurat
             * în lățimea părintelui, iar părintele unei benzi înguste (44 dp de reacții, 53 dp de unelte) nu
             * are loc pentru un cuvânt — de aceea eticheta ieșea „Uneltele …ui".
             */}
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {guideZones.map((zone) => (
                <Text
                  key={zone.id}
                  numberOfLines={1}
                  style={[styles.guideLabel, guideLabelPlacement(zone.rect, screenSize.width)]}
                >
                  {zone.label}
                </Text>
              ))}
            </View>
          </>
        ) : null}
      </View>
      <View style={[styles.header, styles.editorHeader, { paddingTop: insets.top, height: postPageTopInset(insets.top) }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Închide editorul" onPress={confirmExit} style={styles.headerButton}><Text style={styles.headerIcon}>×</Text></Pressable>
        <View style={styles.headerSpacer} />
        <Pressable accessibilityRole="button" accessibilityLabel="Continuă la detalii" onPress={() => setPage('details')} style={styles.nextButton}><Text style={styles.nextText}>Next</Text></Pressable>
      </View>
      <View style={[styles.toolRail, { top: postPageTopInset(insets.top) + 8 }]} onLayout={measureTools}>
        <Pressable accessibilityRole="button" accessibilityLabel="Adaugă text" onPress={() => { setMusicOpen(false); setEmojiOpen(false); setStickersOpen(false); setTextOpen(true); }} style={styles.tool}><Text style={styles.toolIcon}>Aa</Text><Text style={styles.toolLabel}>Text</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Adaugă stickere" onPress={() => { setMusicOpen(false); setEmojiOpen(false); setTextOpen(false); setStickersOpen(true); }} style={styles.tool}><Text style={styles.toolIcon}>✦</Text><Text style={styles.toolLabel}>Stickere</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Adaugă emoji" onPress={() => { setMusicOpen(false); setStickersOpen(false); setTextOpen(false); setEmojiOpen(true); }} style={styles.tool}><Text style={styles.toolIcon}>☺</Text><Text style={styles.toolLabel}>Emoji</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Alege muzică" onPress={() => { setStickersOpen(false); setEmojiOpen(false); setTextOpen(false); setMusicOpen(true); }} style={styles.tool}><Text style={styles.toolIcon}>♫</Text><Text style={styles.toolLabel}>Muzică</Text></Pressable>
        {/** Ghidajele se pot stinge: sunt o unealtă, iar un autor care vrea să vadă doar fotografia trebuie
         *  să poată. Starea se spune și în etichetă („Arată"/„Ascunde"), nu doar prin culoare. */}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: guidesOn }}
          accessibilityLabel={guidesOn ? 'Ascunde ghidajele de zonă sigură' : 'Arată ghidajele de zonă sigură'}
          onPress={() => setGuidesOn((previous) => !previous)}
          style={[styles.tool, guidesOn && styles.toolOn]}
        >
          <Text style={styles.toolIcon}>⌗</Text>
          <Text style={styles.toolLabel}>{guidesOn ? 'Ascunde' : 'Ghidaje'}</Text>
        </Pressable>
      </View>
      {musicOpen ? (
        <View style={[styles.musicPanel, { bottom: Math.max(insets.bottom, 16) + 14 }]}>
          <View style={styles.textActions}><Text style={styles.label}>Muzică Jungle Book</Text><Pressable accessibilityRole="button" onPress={() => setMusicOpen(false)}><Text style={styles.doneText}>Închide</Text></Pressable></View>
          <TextInput accessibilityLabel="Caută melodii" value={musicQuery} onChangeText={setMusicQuery} placeholder="Caută melodii" placeholderTextColor="#84909b" style={styles.input} onSubmitEditing={() => void searchMusic()} />
          <Pressable accessibilityRole="button" disabled={musicBusy} onPress={() => void searchMusic()} style={styles.audioButton}><Text style={styles.audioButtonText}>{musicBusy ? 'Se caută…' : 'Caută în catalog'}</Text></Pressable>
          {musicError ? <Text style={styles.error}>{musicError}</Text> : null}
          <ScrollView style={styles.trackList} keyboardShouldPersistTaps="handled">
            {musicTracks.map((track) => <Pressable key={track.id} accessibilityRole="button" onPress={() => selectMusic(track)} style={styles.track}><Text style={styles.previewTitle}>{track.name}</Text><Text style={styles.muted}>{track.artist} · CC BY</Text></Pressable>)}
          </ScrollView>
          <Pressable accessibilityRole="button" disabled={audioBusy} onPress={() => void chooseMusic().then(() => setMusicOpen(false))}><Text style={styles.doneText}>Alege fișier audio de pe telefon</Text></Pressable>
          <Text style={styles.muted}>Melodiile Jamendo se publică prin selecția semnată de server, valabilă două ore. Un fișier de pe telefon necesită declararea dreptului de folosire în Detalii.</Text>
        </View>
      ) : stickersOpen ? (
        <View style={[styles.textPanel, { bottom: Math.max(insets.bottom, 16) + 18 }]}>
          <View style={styles.textActions}><Text style={styles.label}>Stickere pe captură</Text><Pressable accessibilityRole="button" onPress={() => setStickersOpen(false)}><Text style={styles.doneText}>Gata</Text></Pressable></View>
          <View style={styles.stickerChoices}>
            <Pressable accessibilityRole="button" accessibilityLabel="Adaugă ora" onPress={() => addSticker('TIME')} style={styles.audioButton}><Text style={styles.audioButtonText}>◷ Ora</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Adaugă data" onPress={() => addSticker('DATE')} style={styles.audioButton}><Text style={styles.audioButtonText}>▦ Data</Text></Pressable>
          </View>
          <TextInput accessibilityLabel="Numele locației pentru sticker" value={locationText} onChangeText={setLocationText} placeholder="Locație" placeholderTextColor="#84909b" maxLength={116} style={styles.input} />
          <Pressable accessibilityRole="button" accessibilityLabel="Adaugă locația scrisă" onPress={() => addSticker('LOCATION')} style={styles.audioButton}><Text style={styles.audioButtonText}>⌖ Adaugă locația</Text></Pressable>
          {stickerError ? <Text style={styles.error}>{stickerError}</Text> : null}
          <ScrollView style={styles.stickerList} keyboardShouldPersistTaps="handled">
            {(draft.stickers ?? []).map((sticker) => <View key={sticker.id} style={styles.stickerRow}>
              <Text style={styles.stickerRowLabel} numberOfLines={1}>{stickerLabel(sticker, now)}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Elimină stickerul ${stickerLabel(sticker, now)}`} onPress={() => updateDraft({ stickers: (draftRef.current.stickers ?? []).filter((item) => item.id !== sticker.id) })}><Text style={styles.doneText}>Elimină</Text></Pressable>
            </View>)}
          </ScrollView>
          <Text style={styles.muted}>Trage stickerul peste imagine pentru a-l muta. Locația este introdusă de tine, fără GPS.</Text>
        </View>
      ) : emojiOpen ? (
        <View style={[styles.textPanel, { bottom: Math.max(insets.bottom, 16) + 18 }]}>
          <View style={styles.textActions}><Text style={styles.label}>Emoji pe imagine</Text><Pressable accessibilityRole="button" onPress={() => setEmojiOpen(false)}><Text style={styles.doneText}>Gata</Text></Pressable></View>
          <View style={styles.emojiGrid}>{EMOJI.map((emoji) => <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`Adaugă ${emoji}`} onPress={() => updateDraft({ overlayText: `${draft.overlayText}${emoji}` })} style={styles.emojiButton}><Text style={styles.emojiText}>{emoji}</Text></Pressable>)}</View>
          <Text style={styles.muted}>Poți muta textul și emoji-urile prin tragere.</Text>
        </View>
      ) : textOpen ? (
        <View style={[styles.textPanel, { bottom: Math.max(insets.bottom, 16) + 18 }]}>
          <TextInput accessibilityLabel="Text pe captură" autoFocus value={draft.overlayText} onChangeText={(overlayText) => updateDraft({ overlayText })} placeholder="Scrie pe fotografie sau video" placeholderTextColor="#84909b" maxLength={120} style={styles.input} />
          <View style={styles.textActions}>
            <Pressable accessibilityRole="button" onPress={() => updateDraft({ overlayText: '' })}><Text style={styles.muted}>Șterge textul</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => setTextOpen(false)}><Text style={styles.doneText}>Gata</Text></Pressable>
          </View>
        </View>
      ) : (
        <View
          style={[styles.editorBottom, { paddingBottom: Math.max(insets.bottom, 16) + 14 }]}
          onLayout={(event) => {
            const height = Math.round(event.nativeEvent.layout.height);
            setEditorFoot((previous) => (previous === height ? previous : height));
          }}
        >
          {/**
           * Ce intră sub cuvinte: benzile pe care textul atinge cuvântul paginii, spuse în cuvinte, plus un
           * drum de ieșire (`Mută în zona liberă`). Editorul nu mută nimic singur — o etichetă este a
           * autorului —, dar nici nu-l lasă să creadă că e în regulă.
           */}
          {guidesOn && guideHits.length ? (
            <View style={styles.guideWarn}>
              {guideHits.map((hit) => (
                <Text key={hit.zone.id} style={styles.guideWarnText} numberOfLines={2}>
                  {`„${hit.labels.join('”, „')}” intră ${hit.zone.id === 'head' ? 'sub capul paginii' : hit.zone.id === 'description' ? 'sub descriere' : hit.zone.id === 'rail' ? 'peste reacții' : hit.zone.id === 'tool' ? 'sub uneltele editorului' : 'peste poalele paginii'}`}
                </Text>
              ))}
              <Pressable accessibilityRole="button" accessibilityLabel="Mută etichetele în zona liberă" onPress={moveLabelsToSafeArea} style={styles.guideWarnAction}>
                <Text style={styles.guideWarnActionText}>Mută în zona liberă</Text>
              </Pressable>
            </View>
          ) : null}
          {draft.audioUri || draft.jamendoAudioUrl ? (
            <View style={styles.audioControls}>
              <Pressable accessibilityRole="button" accessibilityLabel={audioStatus.playing ? 'Oprește muzica' : 'Ascultă muzica'} style={styles.audioButton} onPress={() => audioStatus.playing ? audioPlayer.pause() : audioPlayer.play()}><Text style={styles.audioButtonText}>{audioStatus.playing ? 'Pauză' : 'Ascultă'}</Text></Pressable>
              <Text numberOfLines={1} style={styles.audioName}>{draft.audioName}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Elimină muzica" style={styles.audioButton} onPress={removeMusic}><Text style={styles.audioButtonText}>×</Text></Pressable>
            </View>
          ) : null}
          {musicError && !draft.audioUri && !draft.jamendoAudioUrl ? <Text style={styles.error}>{musicError}</Text> : null}
          <Text style={styles.hint}>Trage textul pentru a-l muta. Muzica și postarea se verifică în Detalii.</Text>
          {saveError ? <Text style={styles.error}>{saveError}</Text> : <Text style={styles.hint}>Modificările sunt salvate local automat.</Text>}
          <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => setPage('details')}><Text style={styles.primaryText}>Next</Text></Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * The room the preview is drawn in. `overflow: 'hidden'` is the page's own edge: the content rectangle
   * of a cropped picture is wider than the phone (`lib/overlayFrame.ts`), exactly as it is on the
   * published page, and only the part inside the screen can be seen.
   */
  screen: { flex: 1, backgroundColor: '#050507', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  /**
   * The title used to stand here, and on a full-screen preview it landed on the author's name — the one
   * piece of the page the owner checks first (round 41). The screen is the preview; the two doors at its
   * ends say what it is, so the row keeps the room and drops the words.
   */
  headerSpacer: { flex: 1 },
  editorHeader: { position: 'absolute', left: 0, right: 0, top: 0 },
  headerButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0009', alignItems: 'center', justifyContent: 'center' },
  headerIcon: { color: '#fff', fontSize: 29, lineHeight: 32 },
  heading: { color: '#fff', fontWeight: '800', fontSize: 17, textShadowColor: '#000', textShadowRadius: 6 },
  nextButton: { backgroundColor: '#ff315f', paddingHorizontal: 17, paddingVertical: 10, borderRadius: 20 },
  nextText: { color: '#fff', fontWeight: '800' },
  toolRail: { position: 'absolute', right: 16, gap: 12 },
  tool: { alignItems: 'center', backgroundColor: '#0009', borderRadius: 15, padding: 8, minWidth: 50 },
  toolIcon: { color: '#fff', fontSize: 24, fontWeight: '800' },
  toolLabel: { color: '#fff', fontSize: 11 },
  /** Uneltele aprinse (ghidajele arătate): o urmă în culoarea paginii, nu o a doua culoare. */
  toolOn: { backgroundColor: 'rgba(255,49,95,0.42)', borderWidth: 1, borderColor: 'rgba(255,49,95,0.85)' },
  /**
   * Un ghidaj de zonă sigură: un dreptunghi punctat, fără umplere (fotografia rămâne vizibilă sub el) și
   * fără atingere — trasul etichetelor trece prin el. Culoarea vine din `guideZoneStyle`, după bandă.
   */
  guideZone: { position: 'absolute', borderWidth: 1, borderStyle: 'dashed', borderRadius: 8 },
  /** Benzile care nu se publică (uneltele editorului) se desenează mai stins: nu fac parte din poză. */
  guideZoneDraft: { borderStyle: 'dotted', opacity: 0.72 },
  /**
   * Eticheta benzii: o pastilă întunecată, ca să se citească și pe o poză albă (o umbră singură nu ajunge
   * peste zăpadă). Unde stă — în bandă, deasupra ei sau în stânga, când banda e prea îngustă pentru un
   * cuvânt — se hotărăște în `guideLabelPlacement`, pe măsurătoarea benzii, nu aici.
   */
  guideLabel: {
    position: 'absolute', fontSize: 10, fontWeight: '800',
    color: 'rgba(255,255,255,0.96)', backgroundColor: 'rgba(6,6,8,0.74)',
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6, overflow: 'hidden',
    textShadowColor: '#000', textShadowRadius: 6,
  },
  /** Avertismentul locurilor ocupate: o bandă, nu un dialog — autorul trebuie să vadă în continuare poza. */
  guideWarn: {
    gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14,
    backgroundColor: 'rgba(10,10,12,0.86)', borderWidth: 1, borderColor: 'rgba(255,49,95,0.55)',
  },
  guideWarnText: { color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  guideWarnAction: {
    alignSelf: 'center', paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,49,95,0.9)', backgroundColor: 'rgba(255,49,95,0.18)',
  },
  guideWarnActionText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  editorBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, gap: 10 },
  audioControls: { flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 14, backgroundColor: '#000b', padding: 7 },
  audioButton: { borderRadius: 10, backgroundColor: '#ffffff26', paddingHorizontal: 10, paddingVertical: 8 },
  audioButtonText: { color: '#fff', fontWeight: '700' },
  audioName: { color: '#fff', flex: 1, fontSize: 12 },
  hint: { color: '#fff', fontSize: 12, textAlign: 'center', textShadowColor: '#000', textShadowRadius: 7 },
  textPanel: { position: 'absolute', left: 16, right: 16, backgroundColor: '#111c', padding: 14, borderRadius: 18, gap: 12, maxHeight: '70%' },
  textActions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  doneText: { color: '#ff6384', fontWeight: '800' },
  musicPanel: { position: 'absolute', left: 12, right: 12, backgroundColor: '#111e', padding: 16, borderRadius: 18, gap: 10, maxHeight: '70%' },
  trackList: { maxHeight: 200 },
  track: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#454b54' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  emojiButton: { width: '23%', paddingVertical: 8, alignItems: 'center' },
  emojiText: { fontSize: 28 },
  stickerChoices: { flexDirection: 'row', gap: 10 },
  stickerList: { maxHeight: 180 },
  stickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  stickerRowLabel: { color: '#ffffff', flex: 1, fontSize: 13 },
  detailsScreen: { flex: 1, backgroundColor: '#101318', paddingHorizontal: 16, gap: 16 },
  previewTitle: { color: '#fff', fontWeight: '800' },
  muted: { color: '#aab5c2', fontSize: 12, lineHeight: 18 },
  label: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 8 },
  input: { color: '#fff', backgroundColor: '#1c222b', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  error: { color: '#ff9b9b', fontSize: 12, textAlign: 'center' },
  primaryButton: { backgroundColor: '#ff315f', borderRadius: 14, padding: 15, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
