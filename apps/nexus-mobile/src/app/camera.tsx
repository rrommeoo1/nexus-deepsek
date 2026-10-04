import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera, CommonResolutions, type Recorder, useCameraDevices,
  useCameraPermission, useMicrophonePermission, usePhotoOutput, useVideoOutput,
} from 'react-native-vision-camera';
import { type CaptureFraming, type LocalCapture, loadLatestCapture, persistCapture } from '../lib/localCapture';

type CaptureMode = 'photo' | 'video';
type Facing = 'back' | 'front';

async function waitForOutput(output: { readonly currentResolution?: { width: number; height: number } }) {
  const deadline = Date.now() + 5000;
  while (!output.currentResolution && Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
  // The native capture call remains the source of truth if the readiness event
  // or resolution property is unavailable after Fast Refresh.
}

function VideoPlayback({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.play();
  });
  return <VideoView style={StyleSheet.absoluteFill} player={player} contentFit="cover" nativeControls={false} />;
}

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const cameraPermission = useCameraPermission();
  const microphonePermission = useMicrophonePermission();
  const devices = useCameraDevices();
  const [framing, setFraming] = useState<CaptureFraming>('9:16');
  const [mode, setMode] = useState<CaptureMode>('photo');
  const [facing, setFacing] = useState<Facing>('back');
  const [outputReadyFor, setOutputReadyFor] = useState<string | null>(null);
  const [connectedOutputFor, setConnectedOutputFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<LocalCapture | null>(null);
  const [latest, setLatest] = useState<LocalCapture | null>(() => {
    try { return loadLatestCapture(); }
    catch { return null; }
  });
  const [photoDimensions, setPhotoDimensions] = useState<string | null>(null);
  const recorderRef = useRef<Recorder | null>(null);

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const interval = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - started) / 1000)), 250);
    return () => clearInterval(interval);
  }, [recording]);

  useEffect(() => {
    if (captured?.kind !== 'photo') return;
    Image.getSize(captured.uri, (width, height) => setPhotoDimensions(`${width} × ${height} px`));
  }, [captured]);

  const device = useMemo(() => {
    const candidates = devices.filter((item) => item.position === facing);
    if (facing === 'front') return candidates.find((item) => item.type === 'wide-angle') ?? candidates[0];
    return candidates.find((item) => item.isVirtualDevice && item.minZoom <= 0.7 && item.maxZoom >= 1)
      ?? candidates.find((item) => item.type === 'wide-angle')
      ?? candidates[0];
  }, [devices, facing]);

  const wideZoomAvailable = facing === 'back' && device != null && device.minZoom <= 0.7;
  const requestedZoom = framing === '9:16' && wideZoomAvailable ? 0.7 : 1;
  const zoom = device == null ? 1 : Math.min(Math.max(requestedZoom, device.minZoom), device.maxZoom);
  const cameraKey = `${device?.id ?? 'none'}-${framing}-${mode}-${microphonePermission.hasPermission}`;
  const photoOutput = usePhotoOutput({
    targetResolution: framing === '9:16' ? CommonResolutions.UHD_16_9 : CommonResolutions.UHD_4_3,
    containerFormat: 'jpeg', quality: 0.95, qualityPrioritization: 'quality',
  });
  const videoOutput = useVideoOutput({
    targetResolution: framing === '9:16' ? CommonResolutions.FHD_16_9 : CommonResolutions.FHD_4_3,
    enableAudio: microphonePermission.hasPermission,
  });
  const outputs = useMemo(() => mode === 'photo' ? [photoOutput] : [videoOutput], [mode, photoOutput, videoOutput]);
  const nativeReady = outputReadyFor === cameraKey || connectedOutputFor === cameraKey;
  const canAttemptCapture = !busy && !cameraError && cameraPermission.hasPermission && !!device;

  useEffect(() => {
    if (captured || !device) return;
    const output = mode === 'photo' ? photoOutput : videoOutput;
    const checkConnection = () => {
      if (output.currentResolution) {
        setConnectedOutputFor(cameraKey);
        clearInterval(interval);
      }
    };
    const interval = setInterval(checkConnection, 200);
    checkConnection();
    return () => clearInterval(interval);
  }, [cameraKey, captured, device, mode, photoOutput, videoOutput]);

  function resetReady() {
    setOutputReadyFor(null);
    setConnectedOutputFor(null);
    setCameraError(null);
  }

  function changeFraming() {
    if (recording || busy) return;
    resetReady();
    setFraming((current) => current === '9:16' ? '3:4' : '9:16');
  }

  function flipCamera() {
    if (recording || busy) return;
    resetReady();
    setFacing((current) => current === 'back' ? 'front' : 'back');
  }

  function changeMode(next: CaptureMode) {
    if (recording || busy || mode === next) return;
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
      const result = await photoOutput.capturePhotoToFile({ flashMode: 'off', enableDistortionCorrection: false }, {});
      const saved = await persistCapture(result.filePath, 'photo', framing);
      setPhotoDimensions(null);
      setCaptured(saved);
      setLatest(saved);
    } catch (error) {
      setCameraError(`Fotografia nu a fost salvată: ${String(error)}`);
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
      setPhotoDimensions(null);
      setCaptured(saved);
      setLatest(saved);
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

  function closeCamera() {
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
    if (captured) {
      Alert.alert('Ieși din cameră?', 'Captura este deja salvată local și va fi disponibilă la revenire.', [
        { text: 'Rămâi', style: 'cancel' },
        { text: 'Ieși', onPress: () => router.back() },
      ]);
      return;
    }
    router.back();
  }

  if (captured) {
    return (
      <View style={styles.screen}>
        <StatusBar hidden />
        <View style={captured.framing === '9:16' ? styles.fullFrame : styles.threeFourFrame}>
          {captured.kind === 'photo' ? (
            <Image source={{ uri: captured.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : <VideoPlayback uri={captured.uri} />}
        </View>
        <View style={[styles.top, { paddingTop: Math.max(insets.top, 18) + 10 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Închide preview" style={styles.roundButton} onPress={closeCamera}>
            <Text style={styles.icon}>×</Text>
          </Pressable>
          <Text style={styles.topTitle}>PREVIEW · FIȘIER SALVAT</Text>
          <View style={styles.roundButton} />
        </View>
        <View style={styles.diagnostic}>
          <Text style={styles.diagnosticTitle}>{captured.kind === 'photo' ? 'Fotografie' : 'Video'} · {captured.framing}</Text>
          <Text style={styles.diagnosticText}>{photoDimensions ?? `${(captured.size / 1024 / 1024).toFixed(1)} MB`} · salvat local</Text>
        </View>
        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 16) + 20 }]}>
          <Text style={styles.state}>Compară acest cadru cu imaginea văzută înainte de captură.</Text>
          <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => { setCaptured(null); setPhotoDimensions(null); resetReady(); }}>
            <Text style={styles.primaryText}>Înapoi la cameră</Text>
          </Pressable>
          <Text style={styles.note}>Fișierul rămâne în aplicație. Editorul și publicarea urmează separat.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      {cameraPermission.hasPermission && device ? (
        <View style={framing === '9:16' ? styles.fullFrame : styles.threeFourFrame}>
          <Camera
            key={cameraKey}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive
            zoom={zoom}
            outputs={outputs}
            resizeMode="cover"
            onConfigured={() => setOutputReadyFor(cameraKey)}
            onPreviewStarted={() => setCameraError(null)}
            onError={(error) => { resetReady(); setCameraError(error.message); }}
          />
        </View>
      ) : null}
      <View style={[styles.top, { paddingTop: Math.max(insets.top, 18) + 10 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Închide camera" style={styles.roundButton} onPress={closeCamera}>
          <Text style={styles.icon}>×</Text>
        </Pressable>
        <Text style={styles.topTitle}>NEXUS · CAMERA TEST</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Întoarce camera" style={styles.roundButton} onPress={flipCamera}>
          <Text style={styles.icon}>↻</Text>
        </Pressable>
      </View>
      <View style={styles.diagnostic}>
        <Text style={styles.diagnosticTitle}>{framing} · {zoom.toFixed(1).replace('.', ',')}×</Text>
        <Text style={styles.diagnosticText}>
          {device ? `${device.localizedName} · ${device.isVirtualDevice ? 'obiectiv multiplu' : device.type}` : 'Se caută obiectivul'}
        </Text>
        {framing === '9:16' && !wideZoomAvailable ? (
          <Text style={styles.warning}>0,7× nu este expus acestei aplicații. Se folosește 1×, fără zoom digital.</Text>
        ) : null}
      </View>
      {(!cameraPermission.hasPermission || !device || cameraError) ? (
        <View style={styles.centerMessage}>
          <Text style={styles.centerTitle}>{cameraError ? 'Verifică testul' : !cameraPermission.hasPermission ? 'Acces la cameră' : 'Niciun obiectiv disponibil'}</Text>
          <Text style={styles.centerText}>{cameraError ?? (!cameraPermission.hasPermission ? 'Acordă permisiunea pentru captură pe telefon.' : 'Verifică permisiunile și camera.')}</Text>
          {!cameraPermission.hasPermission && cameraPermission.canRequestPermission ? (
            <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => void cameraPermission.requestPermission()}>
              <Text style={styles.primaryText}>Permite camera</Text>
            </Pressable>
          ) : null}
          {cameraError ? (
            <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => setCameraError(null)}>
              <Text style={styles.secondaryText}>Închide mesajul</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 16) + 20 }]}>
        <Text style={styles.state}>{recording ? `Se înregistrează · ${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(elapsedSeconds % 60).padStart(2, '0')}` : busy ? 'Se pregătește captura…' : nativeReady ? 'Camera pregătită pentru test' : 'Camera pornește… · poți apăsa declanșatorul'}</Text>
        <View style={styles.modes}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === 'photo' }} style={[styles.mode, mode === 'photo' && styles.selectedMode]} onPress={() => changeMode('photo')}>
            <Text style={[styles.modeText, mode === 'photo' && styles.selectedModeText]}>PHOTO</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === 'video' }} style={[styles.mode, mode === 'video' && styles.selectedMode]} onPress={() => changeMode('video')}>
            <Text style={[styles.modeText, mode === 'video' && styles.selectedModeText]}>VIDEO</Text>
          </Pressable>
        </View>
        <View style={styles.captureRow}>
          {latest ? (
            <Pressable accessibilityRole="button" style={styles.lastCapture} onPress={() => { if (!recording && !busy) { setPhotoDimensions(null); setCaptured(latest); } }}>
              <Text style={styles.lastCaptureText}>Ultimul{'\n'}test</Text>
            </Pressable>
          ) : <View style={styles.lastCapture} />}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={recording ? 'Oprește și salvează video' : mode === 'photo' ? 'Fă fotografie' : 'Înregistrează video'}
            accessibilityState={{ disabled: !recording && !canAttemptCapture }}
            style={[styles.shutter, recording && styles.recordingShutter, !recording && !canAttemptCapture && styles.disabledShutter]}
            onPress={() => { if (recording) void stopVideo(); else if (mode === 'photo') void takePhoto(); else void startVideo(); }}
          ><View style={recording ? styles.stopIcon : styles.shutterInner} /></Pressable>
          <View style={styles.lastCapture} />
        </View>
        <View style={styles.modes}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: framing === '9:16' }} style={[styles.mode, framing === '9:16' && styles.selectedMode]} onPress={() => framing !== '9:16' && changeFraming()}>
            <Text style={[styles.modeText, framing === '9:16' && styles.selectedModeText]}>9:16 · {wideZoomAvailable ? '0,7×' : '1×'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: framing === '3:4' }} style={[styles.mode, framing === '3:4' && styles.selectedMode]} onPress={() => framing !== '3:4' && changeFraming()}>
            <Text style={[styles.modeText, framing === '3:4' && styles.selectedModeText]}>3:4 · 1×</Text>
          </Pressable>
        </View>
        <Text style={styles.note}>Test: video maximum 2 minute; fișierele sunt păstrate local, nu publicate.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#050507' },
  fullFrame: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  threeFourFrame: { position: 'absolute', width: '100%', aspectRatio: 3 / 4, alignSelf: 'center', top: '16%' },
  top: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { color: '#fff', fontSize: 12, letterSpacing: 2, fontWeight: '800', textShadowColor: '#000', textShadowRadius: 7 },
  roundButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0009', alignItems: 'center', justifyContent: 'center' },
  icon: { color: '#fff', fontSize: 30, lineHeight: 34 },
  diagnostic: { position: 'absolute', top: 100, left: 18, right: 18, padding: 12, borderRadius: 14, backgroundColor: '#000a', gap: 3 },
  diagnosticTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  diagnosticText: { color: '#d9e1e8', fontSize: 12 },
  warning: { color: '#ffd695', fontSize: 12, lineHeight: 17, marginTop: 3 },
  centerMessage: { position: 'absolute', left: 20, right: 20, top: '36%', backgroundColor: '#111e', padding: 22, borderRadius: 22, alignItems: 'center', gap: 12 },
  centerTitle: { color: '#fff', fontSize: 19, fontWeight: '800' },
  centerText: { color: '#d1d5db', textAlign: 'center', lineHeight: 21 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 14, gap: 11 },
  state: { color: '#fff', fontSize: 12, textAlign: 'center', textShadowColor: '#000', textShadowRadius: 8 },
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
  note: { color: '#fff', textAlign: 'center', fontSize: 11, textShadowColor: '#000', textShadowRadius: 8 },
  primaryButton: { backgroundColor: '#f83d69', paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondaryButton: { paddingVertical: 8 },
  secondaryText: { color: '#fff' },
});
