import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SupportConfirmSheet } from '../components/SupportConfirmSheet';
import {
  ACTION_HINTS, ACTION_KEYS, FREE_LABEL, SESSION_BUDGET_CENTS, UNAVAILABLE_LABEL,
  draftFromPreset, draftFromView, fanPreview, loadOwnPricing, presetOfDraft, pricingErrorWords,
  saveOwnPricing, validateDraft,
  type ActionKey, type PricingDraft, type PricingView,
} from '../lib/creatorPricing';
import { NexusApiError, nexusApi } from '../lib/nexusApi';
import { PRESET_LABELS, formatJbc, type PresetId } from '../lib/pricing';

/**
 * `Monetizează profilul` (`MONETIZATION-SPEC.md` §3.5, §5.1).
 *
 * Every number on this screen comes from `GET /api/creator/pricing` and every change goes back
 * through `PUT /api/creator/pricing`, so the price the owner edits is the price a fan is quoted —
 * the same tip product, the same split. `Totul gratuit` is the default state of a profile with no
 * priced action, the two presets are the server's own 2/3/3 and 3/5/5, and the advanced mode only
 * changes how the same three fields are typed.
 *
 * An action the server did not price stays disabled and labelled `Indisponibil`; the preview at the
 * bottom is the reader's exact view of the same rows, confirmation sheet included.
 */
type CatalogProduct = { id: number; kind: string; title: string; price_cents: number; status: string };

export function MonetizationScreen({ handle, onClose }: { handle: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<PricingView | null>(null);
  const [draft, setDraft] = useState<PricingDraft>({ free: true, appreciation: '', comment: '', share: '' });
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [preview, setPreview] = useState<ActionKey | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const pricing = await loadOwnPricing(nexusApi);
      setView(pricing);
      setDraft(draftFromView(pricing));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Prețurile profilului nu sunt disponibile.');
    } finally {
      setLoading(false);
    }
    // The catalog is a second read and never blocks the prices: a missing catalog only hides the list.
    try {
      const catalogue = await nexusApi<{ catalog: { products: CatalogProduct[] } }>(
        `/api/creator/catalog?username=${encodeURIComponent(handle)}`,
      );
      setProducts(catalogue.catalog?.products ?? []);
    } catch {
      setProducts([]);
    }
  }, [handle]);

  useEffect(() => { void load(); }, [load]);

  const locked = !view || !view.available || !view.can_edit;
  const savedPreset = view ? presetOfDraft(draft, view) : null;
  const dirty = useMemo(() => {
    if (!view) return false;
    if (draft.free !== view.free) return true;
    if (draft.free) return false;
    const saved = draftFromView(view);
    return ACTION_KEYS.some((key) => draft[key] !== saved[key]);
  }, [draft, view]);
  const previewRows = useMemo(
    () => fanPreview(view, { sessionBudgetCents: SESSION_BUDGET_CENTS }),
    [view],
  );

  const persist = useCallback(async (next: PricingDraft) => {
    if (!view) return;
    const decision = validateDraft(next, view);
    if (!decision.ok) {
      setError(decision.message);
      setNotice('');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const saved = await saveOwnPricing(nexusApi, { free: decision.free, prices: decision.prices });
      setView(saved);
      setDraft(draftFromView(saved));
      setNotice(saved.free
        ? 'Salvat: totul gratuit. Niciun fan nu plătește nimic.'
        : `Salvat: apreciere ${formatJbc(saved.actions.appreciation.price_cents)}, comentariu ${formatJbc(saved.actions.comment.price_cents)}, distribuire ${formatJbc(saved.actions.share.price_cents)}.`);
    } catch (cause) {
      const code = cause instanceof NexusApiError ? cause.code : undefined;
      setError(pricingErrorWords(code, cause instanceof Error ? cause.message : 'Prețurile nu au putut fi salvate.'));
    } finally {
      setSaving(false);
    }
  }, [view]);

  const toggleFree = () => {
    if (locked || saving) return;
    if (!draft.free) {
      void persist({ ...draft, free: true });
      return;
    }
    // Leaving `Totul gratuit` needs three prices, so it starts from the friendlier preset instead of
    // saving a half-written policy.
    setDraft(view ? draftFromPreset(view.presets.prietenos) : draft);
    setAdvanced(true);
    setNotice('Alege prețurile, apoi salvează: un profil plătit are nevoie de toate trei.');
  };

  const choosePreset = (id: PresetId) => {
    if (locked || !view) return;
    setDraft(draftFromPreset(view.presets[id]));
    setNotice('');
    setError('');
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

        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={FREE_LABEL}
          accessibilityState={{ checked: draft.free, disabled: locked || saving }}
          disabled={locked || saving}
          onPress={toggleFree}
          style={({ pressed }) => [styles.row, (locked || saving) && styles.disabledRow, pressed && styles.pressed]}
        >
          <View style={styles.rowWords}>
            <Text style={styles.rowTitle}>{FREE_LABEL}</Text>
            <Text style={styles.rowHint}>Nimeni nu plătește nimic până nu pornești un preț.</Text>
          </View>
          <View style={[styles.switchTrack, draft.free && styles.switchTrackOn]}>
            <View style={[styles.switchThumb, draft.free && styles.switchThumbOn]} />
          </View>
        </Pressable>
        {locked && view ? <Unavailable note="Serverul nu permite editarea prețurilor acestui profil." /> : null}

        <Text style={styles.section}>Prețuri pe acțiune</Text>
        <View style={styles.presets}>
          {(Object.keys(PRESET_LABELS) as PresetId[]).map((id) => (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected: savedPreset === id, disabled: locked }}
              accessibilityLabel={`Presetarea ${PRESET_LABELS[id]}`}
              disabled={locked}
              onPress={() => choosePreset(id)}
              style={[styles.preset, savedPreset === id && styles.presetOn]}
            >
              <Text style={[styles.presetLabel, savedPreset === id && styles.presetLabelOn]}>{PRESET_LABELS[id]}</Text>
              <Text style={styles.presetHint}>
                {view
                  ? `${formatJbc(view.presets[id].appreciation)} · ${formatJbc(view.presets[id].comment)} · ${formatJbc(view.presets[id].share)}`
                  : '—'}
              </Text>
            </Pressable>
          ))}
        </View>

        {ACTION_KEYS.map((key) => {
          const quote = view?.actions[key];
          const unavailable = !quote || !quote.chargeable;
          const value = draft[key];
          return (
            <View key={key} style={styles.priceRow}>
              <View style={styles.rowWords}>
                <Text style={styles.rowTitle}>{quote?.label ?? key}</Text>
                <Text style={styles.rowHint}>{ACTION_HINTS[key]}</Text>
              </View>
              {advanced && !unavailable ? (
                <TextInput
                  accessibilityLabel={`Prețul pentru ${key}`}
                  value={value}
                  onChangeText={(text) => setDraft((current) => ({ ...current, [key]: text }))}
                  editable={!locked && !saving}
                  keyboardType="decimal-pad"
                  placeholder="2"
                  placeholderTextColor="#5b6b78"
                  style={styles.input}
                />
              ) : (
                <Text style={styles.price}>{unavailable ? '—' : draft.free ? 'Gratuit' : formatJbc(quote.price_cents)}</Text>
              )}
              {unavailable ? <Chip word={UNAVAILABLE_LABEL} /> : null}
            </View>
          );
        })}
        {view && !view.free && ACTION_KEYS.some((key) => !view.actions[key]?.chargeable) ? (
          <Unavailable note="O acțiune fără preț pe server rămâne oprită și spune «Indisponibil»: un buton care ar eșua la atingere ar fi o minciună." />
        ) : null}

        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="Mod avansat"
          accessibilityState={{ checked: advanced, disabled: locked }}
          disabled={locked}
          onPress={() => setAdvanced((current) => !current)}
          style={({ pressed }) => [styles.row, (locked) && styles.disabledRow, pressed && styles.pressed]}
        >
          <View style={styles.rowWords}>
            <Text style={styles.rowTitle}>Mod avansat</Text>
            <Text style={styles.rowHint}>Scrie separat prețul fiecărei acțiuni, cu cel mult două zecimale.</Text>
          </View>
          <View style={[styles.switchTrack, advanced && styles.switchTrackOn]}>
            <View style={[styles.switchThumb, advanced && styles.switchThumbOn]} />
          </View>
        </Pressable>

        {view ? (
          <View style={styles.caps}>
            <Text style={styles.rowHint}>Prag minim {formatJbc(view.floor_cents)} · plafon {formatJbc(view.max_price_cents)}</Text>
            <Text style={styles.rowHint}>Împărțirea {view.split_version || '—'} vine de la server; aplicația nu o calculează.</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Salvează prețurile"
          accessibilityState={{ busy: saving, disabled: locked || saving || !dirty }}
          disabled={locked || saving || !dirty}
          onPress={() => { void persist(draft); }}
          style={({ pressed }) => [styles.primary, (locked || saving || !dirty) && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={styles.primaryLabel}>{saving ? 'Se salvează…' : 'Salvează prețurile'}</Text>
        </Pressable>

        <Text style={styles.section}>Cum văd fanii</Text>
        {previewRows.map((row) => (
          <Pressable
            key={row.action}
            accessibilityRole="button"
            accessibilityLabel={`Previzualizează ${row.label}`}
            accessibilityState={{ disabled: row.disabled }}
            disabled={row.disabled}
            onPress={() => setPreview(row.action)}
            style={({ pressed }) => [styles.priceRow, row.disabled && styles.disabledRow, pressed && styles.pressed]}
          >
            <View style={styles.rowWords}>
              <Text style={styles.rowTitle}>{row.label}</Text>
              <Text style={styles.rowHint}>{row.note}</Text>
            </View>
            <Text style={styles.price}>{row.price_cents > 0 ? formatJbc(row.price_cents) : 'Gratuit'}</Text>
            {row.chip ? <Chip word={row.chip} /> : null}
          </Pressable>
        ))}
        <Unavailable note="Atinge o acțiune ca să vezi confirmarea fanului: prețul, comisionul, soldul și bugetul de sesiune." />

        {products.length > 0 ? (
          <>
            <Text style={styles.section}>Catalogul citit de server</Text>
            {products.map((item) => (
              <View key={item.id} style={styles.fanRow}>
                <View style={styles.rowWords}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowHint}>{item.kind === 'tip' ? 'susținere unică' : 'abonament'} · {item.status}</Text>
                </View>
                <Text style={styles.price}>{formatJbc(item.price_cents)}</Text>
              </View>
            ))}
          </>
        ) : null}

        <Text style={styles.footnote}>
          Demonstrativ, fără bani reali. Prețul și împărțirea vin de la server; aplicația nu le calculează.
        </Text>
      </ScrollView>
      <SupportConfirmSheet
        visible={preview !== null}
        view={view}
        action={preview ?? 'appreciation'}
        sessionBudgetCents={SESSION_BUDGET_CENTS}
        onClose={() => setPreview(null)}
      />
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
  input: { width: 92, minHeight: 40, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: '#1c2a36', backgroundColor: '#0a121a', color: '#eaf6ff', fontSize: 15, textAlign: 'right' },
  caps: { gap: 2, paddingVertical: 4 },
  primary: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#5cf6e7' },
  primaryLabel: { color: '#02150d', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  disabledRow: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
  footnote: { marginTop: 16, color: '#6f8494', fontSize: 11, lineHeight: 16 },
});
