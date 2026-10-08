import * as DocumentPicker from 'expo-document-picker';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Image, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
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
import { creatorTokens } from '../theme/creator';

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

function VideoPreview({ uri, muteOriginal }: { uri: string; muteOriginal: boolean }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = muteOriginal;
    instance.play();
  });
  return <VideoView style={StyleSheet.absoluteFill} player={player} contentFit="contain" nativeControls={false} />;
}

function MovableText({
  text, x, y, width, height, onMove, stickerType,
}: {
  text: string; x: number; y: number; width: number; height: number;
  onMove: (x: number, y: number) => void;
  stickerType?: LocalSticker['type'];
}) {
  const [drag, setDrag] = useState({ dx: 0, dy: 0 });
  const [labelSize, setLabelSize] = useState({ width: 0, height: 0 });
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gesture) => setDrag({ dx: gesture.dx, dy: gesture.dy }),
    onPanResponderRelease: (_, gesture) => {
      setDrag({ dx: 0, dy: 0 });
      if (!width || !height) return;
      onMove(
        Math.max(0.08, Math.min(0.92, x + gesture.dx / width)),
        Math.max(0.08, Math.min(0.92, y + gesture.dy / height)),
      );
    },
  }), [height, onMove, width, x, y]);
  return (
    <View {...pan.panHandlers} onLayout={(event) => {
      const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
      setLabelSize((previous) => previous.width === nextWidth && previous.height === nextHeight ? previous : { width: nextWidth, height: nextHeight });
    }} style={[styles.movable, stickerType && styles.stickerMovable, stickerType === 'LOCATION' && styles.locationMovable,
      (stickerType === 'TIME' || stickerType === 'DATE') && styles.clockMovable, {
      left: `${x * 100}%`, top: `${y * 100}%`,
      transform: [{ translateX: -labelSize.width / 2 + drag.dx }, { translateY: -labelSize.height / 2 + drag.dy }],
    }]}>
      <Text style={[styles.overlayText, stickerType && styles.stickerText, stickerType && {
        fontSize: stickerType === 'LOCATION'
          ? Math.min(creatorTokens.decoration.locationMaxFontSize, Math.max(creatorTokens.decoration.locationMinFontSize, width * creatorTokens.decoration.locationViewportFontRatio))
          : Math.min(creatorTokens.decoration.maxFontSize, Math.max(creatorTokens.decoration.minFontSize, width * creatorTokens.decoration.viewportFontRatio)),
      }, stickerType === 'LOCATION' && styles.locationText]}>{text}</Text>
    </View>
  );
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
  const [mediaSize, setMediaSize] = useState({ width: 0, height: 0 });
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
  const publishKey = useRef<string | null>(null);
  const audioPlayer = useAudioPlayer(draft.audioUri ?? draft.jamendoAudioUrl ?? null);
  const audioStatus = useAudioPlayerStatus(audioPlayer);
  const mediaAspect = capture.framing === '9:16' ? 9 / 16 : 3 / 4;
  const frameWidth = Math.min(screenSize.width, screenSize.height * mediaAspect);
  const frameHeight = frameWidth / mediaAspect;

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

  // The web offers automatic music for a fresh capture. Request the same real Railway catalog once
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
      <View style={[styles.mediaFrame, {
        width: frameWidth, height: frameHeight,
        left: (screenSize.width - frameWidth) / 2,
        top: (screenSize.height - frameHeight) / 2,
      }]} onLayout={(event) => setMediaSize(event.nativeEvent.layout)}>
        {capture.kind === 'photo' ? <Image source={{ uri: capture.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" /> : <VideoPreview key={draft.audioUri || draft.jamendoAudioUrl ? 'with-music' : 'original-audio'} uri={capture.uri} muteOriginal={!!(draft.audioUri || draft.jamendoAudioUrl)} />}
        {draft.overlayText ? <MovableText text={draft.overlayText} x={draft.overlayX} y={draft.overlayY} width={mediaSize.width} height={mediaSize.height} onMove={(overlayX, overlayY) => updateDraft({ overlayX, overlayY })} /> : null}
        {(draft.stickers ?? []).map((sticker) => <MovableText
          key={sticker.id} stickerType={sticker.type} text={stickerLabel(sticker, now)}
          x={sticker.x} y={sticker.y} width={mediaSize.width} height={mediaSize.height}
          onMove={(x, y) => updateDraft({ stickers: (draftRef.current.stickers ?? []).map((entry) => entry.id === sticker.id ? { ...entry, x, y } : entry) })}
        />)}
      </View>
      <View style={[styles.header, styles.editorHeader, { paddingTop: Math.max(insets.top, 18) + 10 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Închide editorul" onPress={confirmExit} style={styles.headerButton}><Text style={styles.headerIcon}>×</Text></Pressable>
        <Text style={styles.heading}>Previzualizare</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Continuă la detalii" onPress={() => setPage('details')} style={styles.nextButton}><Text style={styles.nextText}>Next</Text></Pressable>
      </View>
      <View style={[styles.toolRail, { top: Math.max(insets.top, 18) + 78 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Adaugă text" onPress={() => { setMusicOpen(false); setEmojiOpen(false); setStickersOpen(false); setTextOpen(true); }} style={styles.tool}><Text style={styles.toolIcon}>Aa</Text><Text style={styles.toolLabel}>Text</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Adaugă stickere" onPress={() => { setMusicOpen(false); setEmojiOpen(false); setTextOpen(false); setStickersOpen(true); }} style={styles.tool}><Text style={styles.toolIcon}>✦</Text><Text style={styles.toolLabel}>Stickere</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Adaugă emoji" onPress={() => { setMusicOpen(false); setStickersOpen(false); setTextOpen(false); setEmojiOpen(true); }} style={styles.tool}><Text style={styles.toolIcon}>☺</Text><Text style={styles.toolLabel}>Emoji</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Alege muzică" onPress={() => { setStickersOpen(false); setEmojiOpen(false); setTextOpen(false); setMusicOpen(true); }} style={styles.tool}><Text style={styles.toolIcon}>♫</Text><Text style={styles.toolLabel}>Muzică</Text></Pressable>
      </View>
      {musicOpen ? (
        <View style={[styles.musicPanel, { bottom: Math.max(insets.bottom, 16) + 14 }]}>
          <View style={styles.textActions}><Text style={styles.label}>Muzică Nexus</Text><Pressable accessibilityRole="button" onPress={() => setMusicOpen(false)}><Text style={styles.doneText}>Închide</Text></Pressable></View>
          <TextInput accessibilityLabel="Caută melodii" value={musicQuery} onChangeText={setMusicQuery} placeholder="Caută melodii" placeholderTextColor="#84909b" style={styles.input} onSubmitEditing={() => void searchMusic()} />
          <Pressable accessibilityRole="button" disabled={musicBusy} onPress={() => void searchMusic()} style={styles.audioButton}><Text style={styles.audioButtonText}>{musicBusy ? 'Se caută…' : 'Caută în catalog'}</Text></Pressable>
          {musicError ? <Text style={styles.error}>{musicError}</Text> : null}
          <ScrollView style={styles.trackList} keyboardShouldPersistTaps="handled">
            {musicTracks.map((track) => <Pressable key={track.id} accessibilityRole="button" onPress={() => selectMusic(track)} style={styles.track}><Text style={styles.previewTitle}>{track.name}</Text><Text style={styles.muted}>{track.artist} · CC BY</Text></Pressable>)}
          </ScrollView>
          <Pressable accessibilityRole="button" disabled={audioBusy} onPress={() => void chooseMusic().then(() => setMusicOpen(false))}><Text style={styles.doneText}>Alege fișier audio de pe telefon</Text></Pressable>
          <Text style={styles.muted}>Melodiile Jamendo se publică prin selecția semnată de Railway, valabilă două ore. Un fișier de pe telefon necesită declararea dreptului de folosire în Detalii.</Text>
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
        <View style={[styles.editorBottom, { paddingBottom: Math.max(insets.bottom, 16) + 14 }]}>
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
  screen: { flex: 1, backgroundColor: '#050507' },
  mediaFrame: { position: 'absolute', overflow: 'hidden' },
  movable: { position: 'absolute', maxWidth: '78%', padding: 8, borderRadius: 8, backgroundColor: '#0005' },
  stickerMovable: { backgroundColor: 'transparent', paddingHorizontal: creatorTokens.decoration.horizontalPadding, paddingVertical: creatorTokens.decoration.verticalPadding },
  clockMovable: { paddingHorizontal: creatorTokens.decoration.timeHorizontalPadding, paddingVertical: creatorTokens.decoration.timeVerticalPadding },
  locationMovable: { maxWidth: '86%', backgroundColor: '#ffffff', borderRadius: creatorTokens.decoration.locationRadius },
  overlayText: { color: '#fff', fontSize: 27, fontWeight: '800', textShadowColor: '#000', textShadowRadius: 6, textAlign: 'center' },
  stickerText: { fontWeight: '800', letterSpacing: creatorTokens.decoration.timeLetterSpacing },
  locationText: { color: '#111111', textShadowRadius: 0, letterSpacing: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  editorHeader: { position: 'absolute', left: 0, right: 0 },
  headerButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0009', alignItems: 'center', justifyContent: 'center' },
  headerIcon: { color: '#fff', fontSize: 29, lineHeight: 32 },
  heading: { color: '#fff', fontWeight: '800', fontSize: 17, textShadowColor: '#000', textShadowRadius: 6 },
  nextButton: { backgroundColor: '#ff315f', paddingHorizontal: 17, paddingVertical: 10, borderRadius: 20 },
  nextText: { color: '#fff', fontWeight: '800' },
  toolRail: { position: 'absolute', right: 16, gap: 12 },
  tool: { alignItems: 'center', backgroundColor: '#0009', borderRadius: 15, padding: 8, minWidth: 50 },
  toolIcon: { color: '#fff', fontSize: 24, fontWeight: '800' },
  toolLabel: { color: '#fff', fontSize: 11 },
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
