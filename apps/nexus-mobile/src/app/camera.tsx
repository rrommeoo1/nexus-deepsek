import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevices, useCameraPermission } from 'react-native-vision-camera';

type Framing = '9:16' | '3:4';
type Facing = 'back' | 'front';

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const permission = useCameraPermission();
  const devices = useCameraDevices();
  const [framing, setFraming] = useState<Framing>('9:16');
  const [facing, setFacing] = useState<Facing>('back');
  const [previewReady, setPreviewReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

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

  function changeFraming() {
    setPreviewReady(false);
    setFraming((current) => current === '9:16' ? '3:4' : '9:16');
  }

  function flipCamera() {
    setPreviewReady(false);
    setFacing((current) => current === 'back' ? 'front' : 'back');
  }

  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      {permission.hasPermission && device ? (
        <View style={framing === '9:16' ? styles.fullFrame : styles.threeFourFrame}>
          <Camera
            key={`${device.id}-${framing}`}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive
            zoom={zoom}
            resizeMode="cover"
            onPreviewStarted={() => { setPreviewReady(true); setCameraError(null); }}
            onError={(error) => { setPreviewReady(false); setCameraError(error.message); }}
          />
        </View>
      ) : null}
      <View style={[styles.top, { paddingTop: Math.max(insets.top, 18) + 10 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Închide camera" style={styles.roundButton} onPress={() => router.back()}>
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
      {(!permission.hasPermission || !device || cameraError) ? (
        <View style={styles.centerMessage}>
          <Text style={styles.centerTitle}>{cameraError ? 'Camera nu a pornit' : !permission.hasPermission ? 'Acces la cameră' : 'Niciun obiectiv disponibil'}</Text>
          <Text style={styles.centerText}>{cameraError ?? (!permission.hasPermission ? 'Acordă permisiunea pentru a compara încadrarea pe telefon.' : 'Verifică permisiunile și conectarea camerei.')}</Text>
          {!permission.hasPermission && permission.canRequestPermission ? (
            <Pressable accessibilityRole="button" style={styles.permissionButton} onPress={() => void permission.requestPermission()}>
              <Text style={styles.permissionText}>Permite camera</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 16) + 20 }]}>
        <Text style={styles.state}>{previewReady ? 'Preview activ · numai test de încadrare' : 'Camera pornește…'}</Text>
        <View style={styles.modes}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: framing === '9:16' }} style={[styles.mode, framing === '9:16' && styles.selectedMode]} onPress={() => framing !== '9:16' && changeFraming()}>
            <Text style={[styles.modeText, framing === '9:16' && styles.selectedModeText]}>9:16 · {wideZoomAvailable ? '0,7×' : '1×'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: framing === '3:4' }} style={[styles.mode, framing === '3:4' && styles.selectedMode]} onPress={() => framing !== '3:4' && changeFraming()}>
            <Text style={[styles.modeText, framing === '3:4' && styles.selectedModeText]}>3:4 · 1×</Text>
          </Pressable>
        </View>
        <Text style={styles.note}>Foto/video și editorul urmează după validarea cadrului pe Xiaomi.</Text>
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
  centerMessage: { position: 'absolute', left: 20, right: 20, top: '38%', backgroundColor: '#111e', padding: 22, borderRadius: 22, alignItems: 'center', gap: 12 },
  centerTitle: { color: '#fff', fontSize: 19, fontWeight: '800' },
  centerText: { color: '#d1d5db', textAlign: 'center', lineHeight: 21 },
  permissionButton: { backgroundColor: '#f83d69', paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14 },
  permissionText: { color: '#fff', fontWeight: '800' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 18, backgroundColor: '#000b', gap: 15 },
  state: { color: '#d9e1e8', fontSize: 12, textAlign: 'center' },
  modes: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  mode: { borderColor: '#fff8', borderWidth: 1, borderRadius: 99, paddingHorizontal: 17, paddingVertical: 10 },
  selectedMode: { backgroundColor: '#fff', borderColor: '#fff' },
  modeText: { color: '#fff', fontWeight: '700' },
  selectedModeText: { color: '#111' },
  note: { color: '#b9c2cc', textAlign: 'center', fontSize: 12 },
});
