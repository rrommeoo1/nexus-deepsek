import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { newMutationKey } from '../lib/idempotency';
import { NexusApiError, nexusApi } from '../lib/nexusApi';
import { formatJbc, parseJbc, supportErrorMessage } from '../lib/pricing';
import { serverErrorWords } from '../lib/serverErrors';
import { jungle } from '../theme/jungle';
import { JungleBackdrop } from '../components/JungleBackdrop';

/**
 * `Portofel` (`MONETIZATION-SPEC.md` §2, §4.3).
 *
 * Everything on this screen is the server's arithmetic: `GET /api/creator/ledger` returns the account,
 * the entries and the totals, and the balance is the sum of the entries — never a counter kept here.
 * A withdrawal is `POST /api/creator/payouts` with a key minted once per press, so a retry on a slow
 * network replays the first claim instead of writing a second one.
 *
 * A deposit has no route (`depositTreasury` is a function on the server), so it is drawn as
 * `Indisponibil` rather than as a form that would always fail.
 */
type LedgerEntry = { id: number; settlement_id: string; direction: 'debit' | 'credit'; amount_cents: number; created_at: number };
type Settlement = { id: string; gross_cents: number; creator_share_cents: number; status: string; posted_at: number };
type Payout = { id: string; amount_cents: number; status: string; created_at: number };

type LedgerResponse = {
  entries: LedgerEntry[];
  settlements: Settlement[];
  totals: { available_cents: number; earned_cents: number; paid_out_cents: number; currency: string };
};

export function WalletScreen({ onClose, initialSheet = 'income' }: {
  onClose: () => void;
  /** Which half of the ledger the screen opens on: the profile menu has a row for each (`lib/profileMenu.ts`). */
  initialSheet?: 'income' | 'spending';
}) {
  const insets = useSafeAreaInsets();
  const [ledger, setLedger] = useState<LedgerResponse | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<'income' | 'spending'>(initialSheet);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [book, history] = await Promise.all([
        nexusApi<LedgerResponse>('/api/creator/ledger'),
        nexusApi<{ payouts: Payout[] }>('/api/creator/payouts'),
      ]);
      setLedger(book);
      setPayouts(history.payouts ?? []);
    } catch (cause) {
      setError(serverErrorWords(cause, 'Portofelul nu este disponibil.', 'Portofelul nu este încă activat pe server.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const available = Number(ledger?.totals?.available_cents ?? 0);
  const cents = parseJbc(amount);
  const rows = useMemo(() => {
    const entries = ledger?.entries ?? [];
    return entries.filter((entry) => (sheet === 'income' ? entry.direction === 'credit' : entry.direction === 'debit')).slice(-30).reverse();
  }, [ledger?.entries, sheet]);

  const withdraw = async () => {
    setError('');
    setNotice('');
    if (!cents) {
      setError('Scrie o sumă între 1 JUNGLE și soldul disponibil, cu cel mult două zecimale.');
      return;
    }
    setBusy(true);
    // One key per press: a second tap of the same button is a new intent, a retry of this one is not.
    const key = newMutationKey('wallet-payout');
    try {
      await nexusApi('/api/creator/payouts', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify({ amount_cents: cents }),
      });
      setNotice(`Cererea de retragere pentru ${formatJbc(cents)} a fost înregistrată.`);
      setAmount('');
      await load();
    } catch (cause) {
      const code = cause instanceof NexusApiError ? cause.code : undefined;
      setError(supportErrorMessage(code, cause instanceof Error ? cause.message : 'Cererea nu a putut fi trimisă.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <JungleBackdrop />
      <View style={styles.bar}>
        <Text style={styles.barTitle}>Portofel</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Închide portofelul" onPress={onClose} hitSlop={8} style={styles.close}>
          <Text style={styles.closeGlyph}>✕</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {loading ? <ActivityIndicator color="#5cf6e7" style={styles.spinner} /> : null}
        {error ? (
          <View style={styles.errorRow}>
            <Text style={styles.error}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reîncearcă încărcarea portofelului"
              onPress={() => void load()}
              style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
            >
              <Text style={styles.retryLabel}>Reîncearcă</Text>
            </Pressable>
          </View>
        ) : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Disponibil</Text>
          <Text style={styles.heroValue}>{formatJbc(available)}</Text>
          <Text style={styles.heroHint}>
            încasat {formatJbc(ledger?.totals?.earned_cents ?? 0)} · retras {formatJbc(ledger?.totals?.paid_out_cents ?? 0)}
          </Text>
        </View>

        <Text style={styles.section}>Retragere</Text>
        <View style={styles.row}>
          <TextInput
            accessibilityLabel="Suma de retras în JUNGLE"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="1"
            placeholderTextColor="#5b6b78"
            style={styles.input}
          />
          <Text style={styles.price}>{cents ? formatJbc(cents) : '—'}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cere retragerea"
          accessibilityState={{ busy, disabled: busy || !cents }}
          disabled={busy || !cents}
          onPress={() => { void withdraw(); }}
          style={({ pressed }) => [styles.primary, (busy || !cents) && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={styles.primaryLabel}>{busy ? 'Se trimite…' : 'Cere retragerea'}</Text>
        </Pressable>

        <View style={styles.row}>
          <View style={styles.rowWords}>
            <Text style={styles.rowTitle}>Depunere</Text>
            <Text style={styles.rowHint}>Trezoreria se alimentează pe server, nu din aplicație.</Text>
          </View>
          <View style={styles.chip}><Text style={styles.chipWord}>Indisponibil</Text></View>
        </View>
        <Text style={styles.unavailable}>Ruta de depunere nu există: depositTreasury este o funcție a serverului. Un formular aici ar eșua mereu.</Text>

        <Text style={styles.section}>Istoric</Text>
        <View style={styles.tabs}>
          {(['income', 'spending'] as const).map((id) => (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected: sheet === id }}
              onPress={() => setSheet(id)}
              style={[styles.tab, sheet === id && styles.tabOn]}
            >
              <Text style={[styles.tabLabel, sheet === id && styles.tabLabelOn]}>{id === 'income' ? 'Încasări' : 'Cheltuieli'}</Text>
            </Pressable>
          ))}
        </View>
        {rows.length === 0 ? <Text style={styles.rowHint}>Nicio intrare în această parte a registrului.</Text> : rows.map((entry) => (
          <View key={entry.id} style={styles.entry}>
            <View style={styles.rowWords}>
              <Text style={styles.rowTitle}>{entry.settlement_id}</Text>
              <Text style={styles.rowHint}>{new Date(Number(entry.created_at) * 1000).toLocaleString('ro-RO')}</Text>
            </View>
            <Text style={[styles.price, entry.direction === 'debit' && styles.debit]}>
              {entry.direction === 'debit' ? '−' : '+'}{formatJbc(entry.amount_cents)}
            </Text>
          </View>
        ))}


        <Text style={styles.section}>Cereri de retragere</Text>
        {payouts.length === 0 ? <Text style={styles.rowHint}>Nicio cerere încă.</Text> : payouts.map((payout) => (
          <View key={payout.id} style={styles.entry}>
            <View style={styles.rowWords}>
              <Text style={styles.rowTitle}>{formatJbc(payout.amount_cents)}</Text>
              <Text style={styles.rowHint}>{new Date(Number(payout.created_at) * 1000).toLocaleString('ro-RO')} · {payout.status}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.section}>Venituri</Text>
        {(ledger?.settlements ?? []).slice(0, 10).map((settlement) => (
          <View key={settlement.id} style={styles.entry}>
            <View style={styles.rowWords}>
              <Text style={styles.rowTitle}>{settlement.id}</Text>
              <Text style={styles.rowHint}>{settlement.status} · brut {formatJbc(settlement.gross_cents)}</Text>
            </View>
            <Text style={styles.price}>{formatJbc(settlement.creator_share_cents)}</Text>
          </View>
        ))}
        {(ledger?.settlements ?? []).length === 0 ? (
          <Text style={styles.rowHint}>Niciun decont încă: nimic din ce este aici nu este inventat.</Text>
        ) : null}
        <Text style={styles.footnote}>Demonstrativ, fără bani reali. Soldul este suma intrărilor din registru, nu un contor.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: jungle.canvas },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  barTitle: { color: '#eaf6ff', fontSize: 18, fontWeight: '800' },
  close: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#101b24' },
  closeGlyph: { color: '#9fb3c4', fontSize: 15 },
  body: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },
  spinner: { marginVertical: 12 },
  error: { color: '#ff9a9a', fontSize: 13, lineHeight: 18 },
  /** The same shape as the monetisation screen: the words, then the one button that tries again. */
  errorRow: { gap: 8, alignItems: 'flex-start' },
  retry: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: jungle.border,
    backgroundColor: jungle.surfaceRaised,
  },
  retryLabel: { color: '#eaf6ff', fontSize: 13, fontWeight: '800' },
  notice: { color: '#5cf6e7', fontSize: 13, lineHeight: 18 },
  hero: { padding: 16, borderRadius: 18, backgroundColor: jungle.surface, borderWidth: 1, borderColor: jungle.border, gap: 4 },
  heroLabel: { color: '#8fa3b4', fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  heroValue: { color: jungle.text, fontSize: 28, fontWeight: '900' },
  heroHint: { color: '#8fa3b4', fontSize: 12 },
  section: { marginTop: 14, color: '#9fb3c4', fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowWords: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { color: '#eaf6ff', fontSize: 14, fontWeight: '700' },
  rowHint: { color: '#8fa3b4', fontSize: 12, lineHeight: 16 },
  price: { color: '#eaf6ff', fontSize: 14, fontWeight: '700' },
  debit: { color: '#ffb4a8' },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: '#1b2733' },
  chipWord: { color: '#8fa3b4', fontSize: 11, fontWeight: '700' },
  unavailable: { color: '#6f8494', fontSize: 11, lineHeight: 15, marginTop: -4 },
  input: { flex: 1, minHeight: 40, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#1c2a36', backgroundColor: '#0a121a', color: '#eaf6ff', fontSize: 15 },
  primary: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: jungle.primary },
  primaryLabel: { color: jungle.primaryInk, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#0a121a', borderWidth: 1, borderColor: '#1c2a36' },
  tabOn: { borderColor: jungle.primary },
  tabLabel: { color: '#8fa3b4', fontSize: 13, fontWeight: '700' },
  tabLabelOn: { color: jungle.primary },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#101b24' },
  footnote: { marginTop: 16, color: '#6f8494', fontSize: 11, lineHeight: 16 },
});

