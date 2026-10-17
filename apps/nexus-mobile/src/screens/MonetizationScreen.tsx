import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NexusApiError, nexusApi } from '../lib/nexusApi';
import {
  PRESET_LABELS, formatJbc, parseJbc, presetPrices, supportErrorMessage, type PresetId,
} from '../lib/pricing';

/**
 * `Monetizează profilul` (`MONETIZATION-SPEC.md` §2, §3.5).
 *
 * What this screen may honestly offer is decided by the routes that exist, not by the drawing:
 *
 *   * `POST /api/creator/products` really creates a support product, so the tip price is real and the
 *     button that saves it calls the server;
 *   * `GET /api/creator/catalog` and `GET /api/creator/dashboard` really answer, so the preview and the
 *     product list are the server's own numbers;
 *   * there is **no** route for a per-action price (appreciation, comment, distribution), none for the
 *     "everything free" switch, none for caps and none for the advanced mode — each of those is drawn
 *     as a row with the `Indisponibil` chip and says why. A switch that cannot be saved would be a lie
 *     with a thumb on it.
 */
type SupportProduct = {
  id: number;
  kind: 'tip' | 'membership';
  title: string;
  price_cents: number;
  status: string;
  split_version?: string;
};

type DashboardResponse = {
  dashboard: { products: SupportProduct[]; totals: { creator_available_cents?: number; currency?: string } };
};

type CatalogResponse = { catalog: { products: SupportProduct[] } };

const PRICE_ROWS = [
  { key: 'appreciation', label: 'Apreciere', hint: 'inima de pe o postare' },
  { key: 'comment', label: 'Comentariu', hint: 'un comentariu scris de un fan' },
  { key: 'share', label: 'Distribuire', hint: 'o redistribuire a postării' },
] as const;

const PRICE_ROW_ORDER = ['appreciation', 'comment', 'share'] as const;

export function MonetizationScreen({ handle, onClose }: { handle: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [dashboard, setDashboard] = useState<DashboardResponse['dashboard'] | null>(null);
  const [catalog, setCatalog] = useState<CatalogResponse['catalog'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preset, setPreset] = useState<PresetId>('prietenos');
  const [prices, setPrices] = useState(() => presetPrices('prietenos'));
  const [tipText, setTipText] = useState('2');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [board, catalogue] = await Promise.all([
        nexusApi<DashboardResponse>('/api/creator/dashboard'),
        nexusApi<CatalogResponse>(`/api/creator/catalog?username=${encodeURIComponent(handle)}`),
      ]);
      setDashboard(board.dashboard);
      setCatalog(catalogue.catalog);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Datele creatorului nu sunt disponibile.');
    } finally {
      setLoading(false);
    }
  }, [handle]);

  useEffect(() => { void load(); }, [load]);

  const products = dashboard?.products ?? [];
  const activeProducts = useMemo(() => products.filter((item) => item.status === 'active'), [products]);
  const everythingFree = activeProducts.length === 0;
  const tipCents = parseJbc(tipText);

  const choosePreset = (id: PresetId) => {
    setPreset(id);
    setPrices(presetPrices(id));
  };

  const saveTip = async () => {
    setNotice('');
    setError('');
    if (!tipCents) {
      setError('Scrie un preț între 1 și 1.000.000 JB, cu cel mult două zecimale.');
      return;
    }
    setSaving(true);
    try {
      await nexusApi('/api/creator/products', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'tip',
          title: `Susținere ${formatJbc(tipCents)}`,
          price_cents: tipCents,
          interval_days: null,
        }),
      });
      setNotice(`Produsul de susținere a fost creat: ${formatJbc(tipCents)}.`);
      await load();
    } catch (cause) {
      const code = cause instanceof NexusApiError ? cause.code : undefined;
      setError(supportErrorMessage(code, cause instanceof Error ? cause.message : 'Produsul nu a putut fi salvat.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Text style={styles.barTitle}>Monetizează profilul</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Închide monetizarea" onPress={onClose} hitSlop={8} style={styles.close}>
          <Text style={styles.closeGlyph}>✕</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {loading ? <ActivityIndicator color="#5cf6e7" style={styles.spinner} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}


        <View style={styles.row}>
          <View style={styles.rowWords}>
            <Text style={styles.rowTitle}>Totul gratuit</Text>
            <Text style={styles.rowHint}>Nimeni nu plătește nimic până nu pornești un preț.</Text>
          </View>
          <View style={[styles.switchTrack, everythingFree && styles.switchTrackOn]}>
            <View style={[styles.switchThumb, everythingFree && styles.switchThumbOn]} />
          </View>
        </View>
        <Unavailable note="Comutatorul nu are endpoint: serverul nu poate salva starea «totul gratuit»." />

        <Text style={styles.section}>Prețuri pe tip</Text>
        <View style={styles.presets}>
          {(Object.keys(PRESET_LABELS) as PresetId[]).map((id) => (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected: preset === id }}
              onPress={() => choosePreset(id)}
              style={[styles.preset, preset === id && styles.presetOn]}
            >
              <Text style={[styles.presetLabel, preset === id && styles.presetLabelOn]}>{PRESET_LABELS[id]}</Text>
              <Text style={styles.presetHint}>
                {formatJbc(PRICE_ROW_ORDER.reduce((sum, key) => sum + presetPrices(id)[key], 0))} total
              </Text>
            </Pressable>
          ))}
        </View>

        {PRICE_ROWS.map((row) => (
          <View key={row.key} style={styles.priceRow}>
            <View style={styles.rowWords}>
              <Text style={styles.rowTitle}>{row.label}</Text>
              <Text style={styles.rowHint}>{row.hint}</Text>
            </View>
            <Text style={styles.price}>{formatJbc(prices[row.key])}</Text>
            <Chip word="Indisponibil" />
          </View>
        ))}
        <Unavailable note="Aprecierea, comentariul și distribuirea nu au încă o rută de preț: serverul cunoaște doar produsele de susținere (tip, membership)." />

        <Text style={styles.section}>Susținere (are endpoint)</Text>
        <View style={styles.row}>
          <TextInput
            accessibilityLabel="Prețul susținerii în JB"
            value={tipText}
            onChangeText={setTipText}
            keyboardType="decimal-pad"
            style={styles.input}
            placeholder="2"
            placeholderTextColor="#5b6b78"
          />
          <Text style={styles.price}>{tipCents ? formatJbc(tipCents) : '—'}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Salvează prețul susținerii"
          accessibilityState={{ busy: saving, disabled: saving || !tipCents }}
          disabled={saving || !tipCents}
          onPress={() => { void saveTip(); }}
          style={({ pressed }) => [styles.primary, (saving || !tipCents) && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={styles.primaryLabel}>{saving ? 'Se salvează…' : 'Salvează prețul susținerii'}</Text>
        </Pressable>
        {activeProducts.length > 0 ? (
          <Text style={styles.rowHint}>
            Produse active: {activeProducts.map((item) => `${item.title} (${formatJbc(item.price_cents)})`).join(', ')}.
          </Text>
        ) : (
          <Text style={styles.rowHint}>Niciun produs activ: nimeni nu poate trimite bani acestui profil.</Text>
        )}


        <Text style={styles.section}>Mod avansat și plafoane</Text>
        {[
          { label: 'Mod avansat', hint: 'prețuri diferite pe fiecare tip de conținut' },
          { label: 'Plafon pe fan / lună', hint: 'cât poate cheltui un singur fan' },
          { label: 'Plafon pe postare', hint: 'cât se poate strânge pe o postare' },
        ].map((row) => (
          <View key={row.label} style={styles.priceRow}>
            <View style={styles.rowWords}>
              <Text style={styles.rowTitle}>{row.label}</Text>
              <Text style={styles.rowHint}>{row.hint}</Text>
            </View>
            <Chip word="Indisponibil" />
          </View>
        ))}
        <Unavailable note="Nicio rută nu primește plafoane sau mod avansat; serverul le-ar ignora, deci nu se trimit." />

        <Text style={styles.section}>Cum văd fanii</Text>
        {catalog?.products?.length ? catalog.products.map((item) => (
          <View key={item.id} style={styles.fanRow}>
            <View style={styles.rowWords}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowHint}>{item.kind === 'tip' ? 'susținere unică' : 'abonament'}</Text>
            </View>
            <Text style={styles.price}>{formatJbc(item.price_cents)}</Text>
          </View>
        )) : <Text style={styles.rowHint}>Catalogul este gol: fanii nu văd niciun buton de susținere.</Text>}
        <Text style={styles.footnote}>Demonstrativ, fără bani reali. Prețul și împărțirea vin de la server; aplicația nu le calculează.</Text>
      </ScrollView>
    </View>
  );
}

function Chip({ word }: { word: string }) {
  return (
    <View style={styles.chip}><Text style={styles.chipWord}>{word}</Text></View>
  );
}

function Unavailable({ note }: { note: string }) {
  return <Text style={styles.unavailable}>{note}</Text>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#04080c' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  barTitle: { color: '#eaf6ff', fontSize: 18, fontWeight: '800' },
  close: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#101b24' },
  closeGlyph: { color: '#9fb3c4', fontSize: 15 },
  body: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },
  spinner: { marginVertical: 12 },
  error: { color: '#ff9a9a', fontSize: 13, lineHeight: 18 },
  notice: { color: '#5cf6e7', fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowWords: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { color: '#eaf6ff', fontSize: 14, fontWeight: '700' },
  rowHint: { color: '#8fa3b4', fontSize: 12, lineHeight: 16 },
  switchTrack: { width: 46, height: 26, borderRadius: 13, backgroundColor: '#1b2733', padding: 3, justifyContent: 'center' },
  switchTrackOn: { backgroundColor: '#0f4a44' },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#7b8a97' },
  switchThumbOn: { alignSelf: 'flex-end', backgroundColor: '#5cf6e7' },
  section: { marginTop: 14, color: '#9fb3c4', fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  presets: { flexDirection: 'row', gap: 8 },
  preset: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: '#1c2a36', backgroundColor: '#0a121a', gap: 2 },
  presetOn: { borderColor: '#5cf6e7', backgroundColor: '#08201f' },
  presetLabel: { color: '#cfe0ee', fontSize: 14, fontWeight: '700' },
  presetLabelOn: { color: '#5cf6e7' },
  presetHint: { color: '#8fa3b4', fontSize: 11 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#101b24' },
  fanRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  price: { color: '#eaf6ff', fontSize: 14, fontWeight: '700' },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: '#1b2733' },
  chipWord: { color: '#8fa3b4', fontSize: 11, fontWeight: '700' },
  unavailable: { color: '#6f8494', fontSize: 11, lineHeight: 15, marginTop: -4 },
  input: { flex: 1, minHeight: 40, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#1c2a36', backgroundColor: '#0a121a', color: '#eaf6ff', fontSize: 15 },
  primary: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#5cf6e7' },
  primaryLabel: { color: '#02150d', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  footnote: { marginTop: 16, color: '#6f8494', fontSize: 11, lineHeight: 16 },
});

