import { router } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera, CommonResolutions, type CameraRef, type Constraint, type Recorder, useCameraDevices,
  useCameraPermission, useMicrophonePermission, usePhotoOutput, useVideoOutput,
} from 'react-native-vision-camera';
import { CaptureEditor } from '../components/CaptureEditor';
import {
  type CaptureFraming, type LocalCapture, loadDraft, loadLatestCapture, persistCapture,
  persistImportedCapture, saveDraft, touchDraft,
} from '../lib/localCapture';
import { nexusApi } from '../lib/nexusApi';

type CaptureMode = 'photo' | 'video';
type Facing = 'back' | 'front';
type JamendoTrack = {
  id: string; name: string; artist: string; audio_url: string;
  attribution: string; selection_token: string;
};

async function waitForOutput(output: { readonly currentResolution?: { width: number; height: number } }) {
  const deadline = Date.now() + 5000;
  while (!output.currentResolution && Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
  // The native capture call remains the source of truth if the readiness event
  // or resolution property is unavailable after Fast Refresh.
}

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const cameraPermission = useCameraPermission();
  const microphonePermission = useMicrophonePermission();
  const devices = useCameraDevices();
  const [framing, setFraming] = useState<CaptureFraming>('9:16');
  const [mode, setMode] = useState<CaptureMode>('photo');
  const [facing, setFacing] = useState<Facing>('back');
  const [lightOn, setLightOn] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState<0 | 3 | 10>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [soundOpen, setSoundOpen] = useState(false);
  const [soundQuery, setSoundQuery] = useState('');
  const [soundTracks, setSoundTracks] = useState<JamendoTrack[]>([]);
  const [soundBusy, setSoundBusy] = useState(false);
  const [soundError, setSoundError] = useState('');
  const [selectedSound, setSelectedSound] = useState<JamendoTrack | null>(null);
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number | null>(null);
  const [restartCount, setRestartCount] = useState(0);
  const [previewStartedFor, setPreviewStartedFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<LocalCapture | null>(null);
  const [latest, setLatest] = useState<LocalCapture | null>(() => {
    try { return loadLatestCapture(); }
    catch { return null; }
  });
  const recorderRef = useRef<Recorder | null>(null);
  const cameraRef = useRef<CameraRef>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownGenerationRef = useRef(0);
  const soundRequestRef = useRef<AbortController | null>(null);
  const soundPlayer = useAudioPlayer(null);
  const soundPlayerStatus = useAudioPlayerStatus(soundPlayer);

  useEffect(() => () => {
    countdownGenerationRef.current += 1;
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    soundRequestRef.current?.abort();
    soundPlayer.pause();
  }, [soundPlayer]);

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const interval = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - started) / 1000)), 250);
    return () => clearInterval(interval);
  }, [recording]);

  const device = useMemo(() => {
    const candidates = devices.filter((item) => item.position === facing);
    if (facing === 'front') return candidates.find((item) => item.type === 'wide-angle') ?? candidates[0];
    return candidates.find((item) => item.isVirtualDevice && item.minZoom <= 0.7 && item.maxZoom >= 1)
      ?? candidates.find((item) => item.type === 'wide-angle')
      ?? candidates[0];
  }, [devices, facing]);

  useEffect(() => {
    if (__DEV__) console.info('[Nexus camera] available devices', JSON.stringify(devices.map((item) => ({
      id: item.id, position: item.position, type: item.type, name: item.localizedName,
      virtual: item.isVirtualDevice, minZoom: item.minZoom, maxZoom: item.maxZoom,
      focalLength: item.focalLength,
      exposureBias: item.supportsExposureBias ? [item.minExposureBias, item.maxExposureBias] : null,
      lowLightBoost: item.supportsLowLightBoost,
      videoDynamicRanges: item.supportedVideoDynamicRanges,
      physical: item.physicalDevices.map((lens) => ({ id: lens.id, type: lens.type, focalLength: lens.focalLength })),
    }))));
  }, [devices]);

  const wideZoomAvailable = facing === 'back' && device != null && device.minZoom <= 0.7;
  const requestedZoom = framing === '9:16' && wideZoomAvailable ? 0.7 : 1;
  const zoom = device == null ? 1 : Math.min(Math.max(currentZoom ?? requestedZoom, device.minZoom), device.maxZoom);
  // Prefer the sensor's multi-frame HDR path for difficult scenes (bright TV,
  // dark room), but do not request a feature the selected lens lacks.
  const photoConstraints = useMemo<Constraint[]>(
    () => mode === 'photo' && device?.supportsPhotoHDR ? [{ photoHDR: true }] : [],
    [mode, device?.supportsPhotoHDR],
  );
  const cameraKey = `${device?.id ?? 'none'}-${framing}-${mode}-${microphonePermission.hasPermission}-${restartCount}`;
  const photoOutput = usePhotoOutput({
    targetResolution: framing === '9:16' ? CommonResolutions.UHD_16_9 : CommonResolutions.UHD_4_3,
    containerFormat: 'jpeg', quality: 1.0, qualityPrioritization: 'quality',
  });
  const videoOutput = useVideoOutput({
    targetResolution: framing === '9:16' ? CommonResolutions.FHD_16_9 : CommonResolutions.FHD_4_3,
    enableAudio: microphonePermission.hasPermission,
  });
  const outputs = useMemo(() => mode === 'photo' ? [photoOutput] : [videoOutput], [mode, photoOutput, videoOutput]);
  const canAttemptCapture = !busy && countdown === null && !soundOpen && !cameraError && cameraPermission.hasPermission && !!device;

  useEffect(() => {
    if (captured || !cameraPermission.hasPermission || !device || previewStartedFor === cameraKey || cameraError) return;
    const timeout = setTimeout(() => setCameraError('Camera nu a pornit. Reîncearcă.'), 8000);
    return () => clearTimeout(timeout);
  }, [cameraKey, captured, cameraError, cameraPermission.hasPermission, device, previewStartedFor]);

  useEffect(() => {
    if (captured || previewStartedFor !== cameraKey) return;
    // The native pinch gesture owns zoom. Read its value for the small on-screen
    // indicator and to preserve the user's choice when switching photo/video.
    const interval = setInterval(() => {
      const value = cameraRef.current?.controller?.zoom;
      if (typeof value === 'number' && Number.isFinite(value)) {
        setCurrentZoom((previous) => previous != null && Math.abs(previous - value) < 0.05 ? previous : value);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [cameraKey, captured, previewStartedFor]);

  function resetReady() {
    setPreviewStartedFor(null);
    setCameraError(null);
  }

  function retryCamera() {
    if (busy || recording) return;
    resetReady();
    setRestartCount((count) => count + 1);
  }

  function handleCameraError(message: string) {
    // CameraX may cancel an early zoom while a session is starting or stopping.
    // It is not a capture failure and must not replace the camera with a stack trace.
    if (/OperationCanceledException|Camera is not active/i.test(message)) return;
    if (/torch|flash/i.test(message)) {
      setLightOn(false);
      Alert.alert('Lumină indisponibilă', 'Lanterna acestui obiectiv nu a putut fi pornită.');
      return;
    }
    setCameraError('Camera nu este disponibilă acum. Reîncearcă.');
  }

  function cancelCountdown() {
    countdownGenerationRef.current += 1;
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    countdownTimerRef.current = null;
    setCountdown(null);
  }

  function changeFraming(next: CaptureFraming) {
    if (recording || busy || soundOpen) return;
    cancelCountdown();
    if (framing === next) return;
    resetReady();
    setCurrentZoom(null);
    setFraming(next);
  }

  function flipCamera() {
    if (recording || busy || soundOpen) return;
    cancelCountdown();
    resetReady();
    setCurrentZoom(null);
    setLightOn(false);
    setFacing((current) => current === 'back' ? 'front' : 'back');
  }

  function changeZoom(direction: -1 | 0 | 1) {
    const controller = cameraRef.current?.controller;
    if (!controller || previewStartedFor !== cameraKey || !device) return;
    const baseline = controller.zoom;
    const step = baseline < 1 ? 0.1 : baseline < 2 ? 0.25 : 0.5;
    const target = direction === 0 ? requestedZoom : baseline + direction * step;
    const next = Math.min(Math.max(Math.round(target * 10) / 10, device.minZoom), device.maxZoom);
    setCurrentZoom(next);
    void controller.setZoom(next).catch((error) => handleCameraError(String(error)));
  }

  function changeMode(next: CaptureMode) {
    if (recording || busy || soundOpen || mode === next) return;
    cancelCountdown();
    resetReady();
    setMode(next);
    if (next === 'video' && !microphonePermission.hasPermission && microphonePermission.canRequestPermission) {
      void microphonePermission.requestPermission();
    }
  }

  async function takePhoto() {
    if (!canAttemptCapture) return;
    setBusy(true);
    try {
      await waitForOutput(photoOutput);
      const result = await photoOutput.capturePhotoToFile({
        flashMode: lightOn && device?.hasFlash && !device.hasTorch ? 'on' : 'off',
        enableDistortionCorrection: false,
      }, {});
      const saved = await persistCapture(result.filePath, 'photo', framing);
      openSavedCapture(saved);
    } catch (error) {
      setCameraError(`Fotografia nu a fost salvată: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function importFromDevice() {
    if (recording || busy || soundOpen) return;
    cancelCountdown();
    setBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'], allowsEditing: false, quality: 1, selectionLimit: 1,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const kind = asset.type === 'video' ? 'video' : 'photo';
      const saved = await persistImportedCapture(asset.uri, kind, framing, asset.mimeType);
      openSavedCapture(saved);
    } catch (error) {
      Alert.alert('Import nereușit', `Fișierul nu a putut fi adăugat: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function startVideo() {
    if (!canAttemptCapture) return;
    if (!microphonePermission.hasPermission) {
      if (microphonePermission.canRequestPermission) void microphonePermission.requestPermission();
      else setCameraError('Microfonul este blocat. Activează permisiunea din setările telefonului.');
      return;
    }
    setBusy(true);
    setElapsedSeconds(0);
    try {
      await waitForOutput(videoOutput);
      const recorder = await videoOutput.createRecorder({ maxDuration: 120 });
      recorderRef.current = recorder;
      await recorder.startRecording(
        (filePath) => { void finishVideo(filePath); },
        (error) => {
          recorderRef.current = null;
          setRecording(false);
          setBusy(false);
          setCameraError(`Înregistrarea a eșuat: ${error.message}`);
        },
      );
      setRecording(true);
    } catch (error) {
      recorderRef.current = null;
      setCameraError(`Înregistrarea nu a pornit: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function finishVideo(temporaryPath: string) {
    try {
      const saved = await persistCapture(temporaryPath, 'video', framing);
      openSavedCapture(saved);
    } catch (error) {
      setCameraError(`Clipul nu a putut fi salvat: ${String(error)}`);
    } finally {
      recorderRef.current = null;
      setRecording(false);
      setBusy(false);
    }
  }

  async function stopVideo() {
    const recorder = recorderRef.current;
    if (!recorder || busy) return;
    setBusy(true);
    try { await recorder.stopRecording(); }
    catch (error) {
      setBusy(false);
      setCameraError(`Oprirea înregistrării a eșuat: ${String(error)}`);
    }
  }

  function openSavedCapture(saved: LocalCapture) {
    if (selectedSound) {
      try {
        const draft = loadDraft(saved);
        saveDraft(saved, touchDraft({
          ...draft, audioUri: undefined, audioName: `${selectedSound.name} — ${selectedSound.artist}`,
          jamendoTrackId: selectedSound.id, jamendoAudioUrl: selectedSound.audio_url,
          jamendoSelectionToken: selectedSound.selection_token,
          jamendoAttribution: selectedSound.attribution,
        }));
      } catch (error) {
        Alert.alert('Muzica nu a fost salvată', `Captura este păstrată, dar alegerea melodiei trebuie repetată în editor: ${String(error)}`);
      }
    }
    soundPlayer.pause();
    setLightOn(false);
    setCaptured(saved);
    setLatest(saved);
  }

  function pressShutter() {
    if (recording) { void stopVideo(); return; }
    if (countdownTimerRef.current) { cancelCountdown(); return; }
    if (!canAttemptCapture) return;
    const capture = mode === 'photo' ? takePhoto : startVideo;
    if (!timerSeconds) { void capture(); return; }
    const generation = ++countdownGenerationRef.current;
    let remaining = timerSeconds;
    setCountdown(remaining);
    const tick = () => {
      if (generation !== countdownGenerationRef.current) return;
      remaining -= 1;
      if (remaining === 0) {
        countdownTimerRef.current = null;
        setCountdown(null);
        void capture();
      } else {
        setCountdown(remaining);
        countdownTimerRef.current = setTimeout(tick, 1000);
      }
    };
    countdownTimerRef.current = setTimeout(tick, 1000);
  }

  function toggleLight() {
    if (busy || recording || soundOpen || !device || previewStartedFor !== cameraKey) return;
    if (!device.hasTorch && !(mode === 'photo' && device.hasFlash)) {
      Alert.alert('Lumină indisponibilă', 'Acest obiectiv nu oferă bliț sau lanternă.');
      return;
    }
    cancelCountdown();
    setLightOn((value) => !value);
  }

  async function searchSounds(query = soundQuery) {
    soundRequestRef.current?.abort();
    const controller = new AbortController();
    soundRequestRef.current = controller;
    setSoundBusy(true);
    setSoundError('');
    try {
      const result = await nexusApi<{ ok: true; tracks: JamendoTrack[] }>(
        `/api/reels/sound-suggestions?duration=30&q=${encodeURIComponent(query.trim())}`,
        { signal: controller.signal },
      );
      if (!controller.signal.aborted) setSoundTracks(result.tracks ?? []);
    } catch (error) {
      if (!controller.signal.aborted) {
        setSoundTracks([]);
        setSoundError(error instanceof Error ? error.message : 'Catalogul Jamendo nu este disponibil.');
      }
    } finally {
      if (!controller.signal.aborted) setSoundBusy(false);
    }
  }

  function closeSounds() {
    soundRequestRef.current?.abort();
    soundPlayer.pause();
    setPreviewTrackId(null);
    setSoundOpen(false);
  }

  function previewSound(track: JamendoTrack) {
    if (previewTrackId === track.id && soundPlayerStatus.playing) {
      soundPlayer.pause();
      return;
    }
    try {
      soundPlayer.pause();
      soundPlayer.replace(track.audio_url);
      soundPlayer.play();
      setPreviewTrackId(track.id);
      setSoundError('');
    } catch (error) {
      setPreviewTrackId(null);
      setSoundError(`Previzualizarea nu a pornit: ${String(error)}`);
    }
  }

  function closeCamera() {
    if (soundOpen) { closeSounds(); return; }
    if (busy) {
      Alert.alert('Se salvează', 'Așteaptă până când captura este păstrată local.');
      return;
    }
    if (recording) {
      Alert.alert('Înregistrare în curs', 'Oprește și salvează clipul înainte de a ieși.', [
        { text: 'Rămâi', style: 'cancel' },
        { text: 'Oprește', onPress: () => { void stopVideo(); } },
      ]);
      return;
    }
    cancelCountdown();
    closeSounds();
    router.back();
  }

  if (captured) {
    return <CaptureEditor key={captured.name} capture={captured} onExit={() => { setLatest(loadLatestCapture()); setCaptured(null); resetReady(); router.back(); }} />;
  }

  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      {cameraPermission.hasPermission && device ? (
        <View style={framing === '9:16' ? styles.fullFrame : styles.threeFourFrame}>
          <Camera
            key={cameraKey}
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive
            torchMode={lightOn && device.hasTorch ? 'on' : 'off'}
            enableNativeZoomGesture
            outputs={outputs}
            constraints={photoConstraints}
            resizeMode="cover"
            onSessionConfigSelected={(config) => {
              if (__DEV__) console.info('[Nexus camera] photo HDR', {
                device: device.id,
                supported: device.supportsPhotoHDR,
                selected: config.isPhotoHDREnabled,
              });
            }}
            onPreviewStarted={() => {
              setPreviewStartedFor(cameraKey);
              setCameraError(null);
              if (mode === 'video' && device.supportsLowLightBoost) {
                void cameraRef.current?.controller?.configure({ enableLowLightBoost: true })
                  .then(() => { if (__DEV__) console.info('[Nexus camera] video low-light boost enabled'); })
                  .catch((error) => {
                    // Low-light boost is an optional quality enhancement; a
                    // device-specific failure must not block capture itself.
                    if (__DEV__) console.warn('[Nexus camera] video low-light boost unavailable', String(error));
                  });
              }
              if (__DEV__) console.info('[Nexus camera] optics', {
                device: device.id,
                minZoom: device.minZoom,
                activeMinZoom: cameraRef.current?.controller?.minZoom,
                lensSwitches: device.zoomLensSwitchFactors,
                physical: device.physicalDevices.map((lens) => ({ id: lens.id, type: lens.type, minZoom: lens.minZoom })),
                requestedZoom: zoom,
                exposureBias: cameraRef.current?.controller?.exposureBias,
              });
              // CameraX is active now; the initial 0.7x/1x request is safe.
              void cameraRef.current?.controller?.setZoom(zoom)
                .then(() => { if (__DEV__) console.info('[Nexus camera] applied zoom', cameraRef.current?.controller?.zoom); })
                .catch((error) => handleCameraError(String(error)));
            }}
            onError={(error) => handleCameraError(error.message)}
          />
        </View>
      ) : null}
      <View style={[styles.top, { paddingTop: Math.max(insets.top, 18) + 10 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Închide camera" style={styles.roundButton} onPress={closeCamera}>
          <Text style={styles.icon}>×</Text>
        </Pressable>
        <Text style={styles.topTitle}>JUNGLE BOOK</Text>
        <View style={styles.topSpacer} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={selectedSound ? `Schimbă melodia: ${selectedSound.name}` : 'Adaugă melodie din Jamendo'}
        disabled={recording || busy}
        style={[styles.soundButton, { top: Math.max(insets.top, 18) + 62 }]}
        onPress={() => { cancelCountdown(); setSoundOpen(true); void searchSounds(); }}
      >
        <Text style={styles.soundButtonText} numberOfLines={1}>♫  {selectedSound ? selectedSound.name : 'Add sound'}</Text>
      </Pressable>
      <View style={[styles.sideTools, { top: Math.max(insets.top, 18) + 102 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={framing === '9:16' ? 'Schimbă la cadrul mediu 3:4' : 'Schimbă la ecran plin 9:16'} disabled={recording || busy || soundOpen} style={styles.sideTool} onPress={() => changeFraming(framing === '9:16' ? '3:4' : '9:16')}>
          <Text style={styles.sideToolIcon}>⤢</Text>
          <Text style={styles.sideToolText}>{framing === '9:16' ? '3:4' : '9:16'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={facing === 'back' ? 'Comută la camera selfie' : 'Comută la camera din spate'} disabled={recording || busy || soundOpen} style={styles.sideTool} onPress={flipCamera}>
          <Text style={styles.sideToolIcon}>↻</Text>
          <Text style={styles.sideToolText}>{facing === 'back' ? 'Selfie' : 'Spate'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={lightOn ? 'Oprește lumina' : 'Pornește lumina'} accessibilityState={{ selected: lightOn }} disabled={busy || recording || soundOpen} style={[styles.sideTool, lightOn && styles.activeSideTool]} onPress={toggleLight}>
          <Text style={styles.sideToolIcon}>ϟ</Text>
          <Text style={styles.sideToolText}>{lightOn ? 'Pornit' : 'Flash'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Temporizator: ${timerSeconds ? `${timerSeconds} secunde` : 'oprit'}. Apasă pentru următoarea opțiune.`} disabled={busy || recording || soundOpen} style={[styles.sideTool, timerSeconds > 0 && styles.activeSideTool]} onPress={() => { cancelCountdown(); setTimerSeconds((value) => value === 0 ? 3 : value === 3 ? 10 : 0); }}>
          <Text style={styles.sideToolIcon}>◴</Text>
          <Text style={styles.sideToolText}>{timerSeconds ? `${timerSeconds}s` : 'Timer'}</Text>
        </Pressable>
      </View>
      {countdown !== null ? <Text accessibilityRole="timer" style={styles.countdown}>{countdown}</Text> : null}
      {(!cameraPermission.hasPermission || !device || cameraError) ? (
        <View style={styles.centerMessage}>
          <Text style={styles.centerTitle}>{cameraError ? 'Camera nu a pornit' : !cameraPermission.hasPermission ? 'Acces la cameră' : 'Niciun obiectiv disponibil'}</Text>
          <Text style={styles.centerText}>{cameraError ?? (!cameraPermission.hasPermission ? 'Acordă permisiunea pentru cameră.' : 'Verifică permisiunile și camera.')}</Text>
          {!cameraPermission.hasPermission && cameraPermission.canRequestPermission ? (
            <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => void cameraPermission.requestPermission()}>
              <Text style={styles.primaryText}>Permite camera</Text>
            </Pressable>
          ) : null}
          {cameraError ? (
            <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={retryCamera}>
              <Text style={styles.primaryText}>Reîncearcă</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 16) + 20 }]}>
        {recording || busy || previewStartedFor !== cameraKey || countdown !== null ? (
          <Text style={styles.state}>{recording ? `Se înregistrează · ${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(elapsedSeconds % 60).padStart(2, '0')}` : countdown !== null ? 'Apasă din nou pentru anulare' : busy ? 'Se salvează…' : 'Camera pornește…'}</Text>
        ) : null}
        <View style={styles.zoomControls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Micșorează zoomul" disabled={previewStartedFor !== cameraKey || zoom <= (device?.minZoom ?? 1)} style={styles.zoomButton} onPress={() => changeZoom(-1)}>
            <Text style={styles.zoomButtonText}>−</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Revino la zoomul implicit" disabled={previewStartedFor !== cameraKey} style={styles.zoomValue} onPress={() => changeZoom(0)}>
            <Text style={styles.zoomValueText}>{zoom.toFixed(1).replace('.', ',')}×</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Mărește zoomul" disabled={previewStartedFor !== cameraKey || zoom >= (device?.maxZoom ?? 1)} style={styles.zoomButton} onPress={() => changeZoom(1)}>
            <Text style={styles.zoomButtonText}>+</Text>
          </Pressable>
        </View>
        <View style={styles.modes}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === 'photo' }} style={[styles.mode, mode === 'photo' && styles.selectedMode]} onPress={() => changeMode('photo')}>
            <Text style={[styles.modeText, mode === 'photo' && styles.selectedModeText]}>PHOTO</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === 'video' }} style={[styles.mode, mode === 'video' && styles.selectedMode]} onPress={() => changeMode('video')}>
            <Text style={[styles.modeText, mode === 'video' && styles.selectedModeText]}>VIDEO</Text>
          </Pressable>
        </View>
        <View style={styles.captureRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Adaugă fotografie sau video de pe telefon" disabled={recording || busy || soundOpen} style={styles.lastCapture} onPress={() => void importFromDevice()}>
            <Text style={styles.galleryIcon}>▧</Text><Text style={styles.lastCaptureText}>Galerie</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={recording ? 'Oprește și salvează video' : countdown !== null ? 'Anulează temporizatorul' : mode === 'photo' ? 'Fă fotografie' : 'Înregistrează video'}
            accessibilityState={{ disabled: !recording && countdown === null && !canAttemptCapture }}
            style={[styles.shutter, recording && styles.recordingShutter, !recording && countdown === null && !canAttemptCapture && styles.disabledShutter]}
            onPress={pressShutter}
          ><View style={recording ? styles.stopIcon : styles.shutterInner} /></Pressable>
          {latest ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Deschide ultima captură" style={styles.lastCapture} onPress={() => { if (!recording && !busy && !soundOpen) { cancelCountdown(); setCaptured(latest); } }}>
              <Text style={styles.lastCaptureText}>Ultima{'\n'}captură</Text>
            </Pressable>
          ) : <View style={styles.lastCapture} />}
        </View>
      </View>
      {soundOpen ? (
        <View style={[styles.soundSheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
          <View style={styles.soundSheetHeader}>
            <Text style={styles.soundSheetTitle}>Adaugă melodie · Jamendo</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Închide melodiile" onPress={closeSounds}><Text style={styles.soundClose}>×</Text></Pressable>
          </View>
          <View style={styles.soundSearchRow}>
            <TextInput accessibilityLabel="Caută piesă sau artist" placeholder="Caută piesă sau artist" placeholderTextColor="#a9aeb8" value={soundQuery} maxLength={80} onChangeText={setSoundQuery} onSubmitEditing={() => void searchSounds()} style={styles.soundInput} />
            <Pressable accessibilityRole="button" accessibilityLabel="Caută în Jamendo" style={styles.soundSearchButton} onPress={() => void searchSounds()}><Text style={styles.soundSearchText}>Caută</Text></Pressable>
          </View>
          {soundBusy ? <Text style={styles.soundInfo}>Se caută sunete…</Text> : null}
          {soundError ? <Text style={styles.soundError}>{soundError}</Text> : null}
          {!soundBusy && !soundError && !soundTracks.length ? <Text style={styles.soundInfo}>Nu am găsit sunete.</Text> : null}
          <ScrollView style={styles.soundList} keyboardShouldPersistTaps="handled">
            {soundTracks.map((track) => (
              <View key={track.id} style={[styles.soundRow, selectedSound?.id === track.id && styles.selectedSoundRow]}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Previzualizează ${track.name}`} style={styles.soundPreview} onPress={() => previewSound(track)}><Text style={styles.soundPreviewText}>{previewTrackId === track.id && soundPlayerStatus.playing ? 'Ⅱ' : '▶'}</Text></Pressable>
                <View style={styles.soundDetails}><Text style={styles.soundName} numberOfLines={1}>{track.name}</Text><Text style={styles.soundArtist} numberOfLines={1}>{track.artist}</Text></View>
                <Pressable accessibilityRole="button" accessibilityLabel={`Alege ${track.name}`} style={styles.soundChoose} onPress={() => { setSelectedSound(track); closeSounds(); }}><Text style={styles.soundChooseText}>{selectedSound?.id === track.id ? 'Ales' : 'Alege'}</Text></Pressable>
              </View>
            ))}
          </ScrollView>
          {selectedSound ? <Pressable accessibilityRole="button" accessibilityLabel="Elimină melodia aleasă" onPress={() => { setSelectedSound(null); closeSounds(); }}><Text style={styles.removeSound}>Fără melodie</Text></Pressable> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#050507' },
  fullFrame: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  threeFourFrame: { position: 'absolute', width: '100%', aspectRatio: 3 / 4, alignSelf: 'center', top: '16%' },
  top: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { color: '#fff', fontSize: 12, letterSpacing: 2, fontWeight: '800', textShadowColor: '#000', textShadowRadius: 7 },
  topSpacer: { width: 44, height: 44 },
  soundButton: { position: 'absolute', alignSelf: 'center', maxWidth: '62%', minHeight: 38, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#0009', alignItems: 'center', justifyContent: 'center' },
  soundButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  sideTools: { position: 'absolute', right: 18, alignItems: 'flex-end', gap: 8 },
  sideTool: { width: 54, minHeight: 54, backgroundColor: '#0009', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  activeSideTool: { borderWidth: 1, borderColor: '#fff' },
  sideToolIcon: { color: '#fff', fontSize: 24, lineHeight: 28 },
  sideToolText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  countdown: { position: 'absolute', top: '43%', alignSelf: 'center', color: '#fff', fontSize: 92, fontWeight: '800', textShadowColor: '#000', textShadowRadius: 12 },
  roundButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0009', alignItems: 'center', justifyContent: 'center' },
  icon: { color: '#fff', fontSize: 30, lineHeight: 34 },
  centerMessage: { position: 'absolute', left: 20, right: 20, top: '36%', backgroundColor: '#111e', padding: 22, borderRadius: 22, alignItems: 'center', gap: 12 },
  centerTitle: { color: '#fff', fontSize: 19, fontWeight: '800' },
  centerText: { color: '#d1d5db', textAlign: 'center', lineHeight: 21 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 14, gap: 11 },
  state: { color: '#fff', fontSize: 12, textAlign: 'center', textShadowColor: '#000', textShadowRadius: 8 },
  zoomControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  zoomButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0009', alignItems: 'center', justifyContent: 'center' },
  zoomButtonText: { color: '#fff', fontSize: 25, lineHeight: 29, fontWeight: '600' },
  zoomValue: { minWidth: 66, height: 40, borderRadius: 20, backgroundColor: '#000b', alignItems: 'center', justifyContent: 'center' },
  zoomValueText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  modes: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  mode: { borderColor: '#fff8', borderWidth: 1, borderRadius: 99, paddingHorizontal: 17, paddingVertical: 9, backgroundColor: '#0008' },
  selectedMode: { backgroundColor: '#fff', borderColor: '#fff' },
  modeText: { color: '#fff', fontWeight: '700' },
  selectedModeText: { color: '#111' },
  captureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  shutter: { width: 82, height: 82, borderRadius: 41, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#fff' },
  recordingShutter: { borderColor: '#ff315f' },
  disabledShutter: { opacity: 0.55 },
  stopIcon: { width: 31, height: 31, borderRadius: 7, backgroundColor: '#ff315f' },
  lastCapture: { width: 70, alignItems: 'center', justifyContent: 'center' },
  lastCaptureText: { color: '#fff', fontSize: 12, textAlign: 'center', fontWeight: '700' },
  galleryIcon: { color: '#fff', fontSize: 28, lineHeight: 32 },
  primaryButton: { backgroundColor: '#f83d69', paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800' },
  soundSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '64%', backgroundColor: '#12151ef2', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderColor: '#ffffff33', paddingHorizontal: 20, paddingTop: 16 },
  soundSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  soundSheetTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  soundClose: { color: '#fff', fontSize: 30, lineHeight: 34 },
  soundSearchRow: { flexDirection: 'row', gap: 8 },
  soundInput: { flex: 1, color: '#fff', backgroundColor: '#0008', borderWidth: 1, borderColor: '#ffffff33', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9 },
  soundSearchButton: { paddingHorizontal: 12, borderRadius: 11, backgroundColor: '#ffffff12', alignItems: 'center', justifyContent: 'center' },
  soundSearchText: { color: '#fff', fontWeight: '700' },
  soundInfo: { color: '#dce2e9', marginTop: 14 },
  soundError: { color: '#ffbdc9', marginTop: 14 },
  soundList: { flex: 1, marginTop: 10 },
  soundRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderColor: '#ffffff22' },
  selectedSoundRow: { backgroundColor: '#ffffff12' },
  soundPreview: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffffff22', alignItems: 'center', justifyContent: 'center' },
  soundPreviewText: { color: '#fff', fontSize: 16 },
  soundDetails: { flex: 1 },
  soundName: { color: '#fff', fontWeight: '700' },
  soundArtist: { color: '#dce2e9', fontSize: 12 },
  soundChoose: { backgroundColor: '#ffffff12', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 11 },
  soundChooseText: { color: '#fff', fontWeight: '700' },
  removeSound: { color: '#dce2e9', textAlign: 'center', paddingTop: 12 },
});
