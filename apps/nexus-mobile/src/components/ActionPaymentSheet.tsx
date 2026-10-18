import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  confirmLabel, failureCode, intentFromFailure, intentIsPaid, paymentBlockers, paymentKeyRotates,
  paymentSentence, paymentTitle, paymentWarnings, quoteFromFailure, quoteLines, readActionQuote,
  readPaymentIntent, type ActionQuote, type PaidAction, type PaymentIntent, type QuoteLine,
} from '../lib/actionPayments';
import { newMutationKey } from '../lib/idempotency';
import { fetchActionQuote, payForAction } from '../lib/postInteractions';
import { jungle } from '../theme/jungle';
import { JungleBackdrop } from './JungleBackdrop';

/**
 * The one confirmation a paid appreciation or comment goes through.
 *
 * Nothing on this sheet is computed by the phone: the price, the EGLD amount, the network fee, the
 * devnet balance and the faucet all arrive in the quote the write route refused with
 * (`402 PAYMENT_REQUIRED`, `detail.quote` — `lib/action-payments.js` `quoteAction`). The sheet re-reads
 * the same quote on open so the balance it prints is the balance in force now, and the approval is a
 * single `POST /api/posts/:id/action-payment` whose answer is the ledger row the write then carries as
 * `payment_intent_id`.
 *
 * The idempotency key belongs to one approval: it is minted when the sheet opens and kept across
 * retries, so a dropped connection replays the first transfer instead of paying twice. It is replaced
 * only when the server has closed the key's ledger row (a failed or refused transfer, a spent key —
 * `paymentKeyRotates`), so the next attempt is a genuinely new payment rather than a replay of a
 * failure. A reader who tops up from the faucet therefore pays on the second tap.
 */
export type ActionPaymentSheetProps = {
  visible: boolean;
  postId: number;
  action: PaidAction;
  /** The quote the server refused the write with; refreshed from the API as soon as the sheet opens. */
  quote?: ActionQuote | null;
  /** Called once the ledger row exists; the caller then re-sends the write with `intent.id`. */
  onPaid: (intent: PaymentIntent) => void;
  onClose: () => void;
};

export function ActionPaymentSheet({ visible, postId, action, quote: seed = null, onPaid, onClose }: ActionPaymentSheetProps) {
  const [quote, setQuote] = useState<ActionQuote | null>(seed);
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const key = useRef(newMutationKey('action-payment'));
  const openFor = useRef('');
  const alive = useRef(true);
  const seedRef = useRef<ActionQuote | null>(seed);
  seedRef.current = seed;

  useEffect(() => () => { alive.current = false; }, []);

  /**
   * The same read the sheet opened with, on demand: devnet's answer is only true for the moment it was
   * fetched, and a reader who just took EGLD from the faucet must not have to close the sheet to be told
   * the wallet can pay now. The approval key is untouched — a refresh is not a payment.
   */
  const refresh = useCallback(() => {
    fetchActionQuote(postId, action)
      .then((payload) => {
        const fresh = readActionQuote(payload);
        if (alive.current && fresh) setQuote(fresh);
      })
      .catch(() => undefined);
  }, [postId, action]);

  useEffect(() => {
    if (!visible) { openFor.current = ''; return; }
    const marker = `${postId}:${action}`;
    // Only a fresh opening (or another post) restarts the payment; a quote arriving later never does.
    if (openFor.current === marker) return;
    openFor.current = marker;
    key.current = newMutationKey('action-payment');
    setIntent(null);
    setError('');
    setQuote(seedRef.current);
    refresh();
  }, [visible, postId, action, refresh]);

  async function confirm() {
    if (busy || !quote) return;
    setBusy(true);
    setError('');
    try {
      const answer = await payForAction(postId, action, key.current);
      const settled = readPaymentIntent(answer);
      if (!settled) {
        setError('Serverul a răspuns fără rândul plății. Reîncarcă și încearcă din nou.');
        return;
      }
      setIntent(settled);
      onPaid(settled);
    } catch (cause) {
      const code = failureCode(cause);
      const fresh = quoteFromFailure(cause);
      if (fresh) setQuote(fresh);
      const existing = intentFromFailure(cause);
      setIntent(existing && existing.status !== 'failed' ? existing : null);
      setError(paymentSentence(code, cause instanceof Error ? cause.message : ''));
      if (paymentKeyRotates(code)) key.current = newMutationKey('action-payment');
    } finally {
      setBusy(false);
    }
  }

  const paid = intentIsPaid(intent);
  const blockers = quote ? paymentBlockers(quote) : [];
  const warnings = quote ? paymentWarnings(quote) : [];
  const faucet = quote?.chain?.faucet_url ?? null;
  // A wallet that cannot cover the transfer is the one blocker the reader can fix from here.
  const needsFunds = quote?.chain?.can_afford === false;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <JungleBackdrop opacity={0.07} anchor="bottom" />
          <View style={styles.grabber} />
          <Text style={styles.title}>{paymentTitle(action, intent)}</Text>
          <ScrollView contentContainerStyle={styles.body}>
            {!quote && !error ? <Text style={styles.muted}>Se citește prețul…</Text> : null}
            {quote ? quoteLines(quote).map((line) => <Row key={line.label} line={line} />) : null}
            {quote?.creator_handle ? <Text style={styles.muted}>{`Creatorul: @${quote.creator_handle}.`}</Text> : null}
            {warnings.map((warning) => <Text key={warning} style={styles.muted}>{warning}</Text>)}
            {blockers.map((blocker) => <Text key={blocker} style={styles.error}>{blocker}</Text>)}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {paid ? (
              <View style={styles.receipt}>
                <Text style={styles.receiptLabel}>
                  {intent?.chain_mode === 'devnet'
                    ? 'Transfer trimis pe devnet'
                    : 'Plată înregistrată fără transfer (mod demonstrativ)'}
                </Text>
                {intent?.tx_hash ? <Text style={styles.hash} numberOfLines={1} ellipsizeMode="middle">{intent.tx_hash}</Text> : null}
                {intent?.explorer_url ? (
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="Deschide tranzacția în explorer"
                    onPress={() => { Linking.openURL(String(intent.explorer_url)).catch(() => undefined); }}
                  >
                    <Text style={styles.link}>Vezi tranzacția în explorer</Text>
                  </Pressable>
                ) : null}
                {intent?.failure ? <Text style={styles.muted}>{`Nota serverului: ${intent.failure}`}</Text> : null}
              </View>
            ) : null}
            {faucet && !paid ? (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Cere EGLD de devnet din faucet"
                onPress={() => { Linking.openURL(faucet).catch(() => undefined); }}
              >
                <Text style={styles.link}>Cere EGLD de devnet din faucet</Text>
              </Pressable>
            ) : null}
            {needsFunds && !paid ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Verifică din nou soldul devnet"
                accessibilityState={{ busy, disabled: busy }}
                disabled={busy}
                onPress={refresh}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <Text style={[styles.link, busy && styles.disabled]}>Am primit EGLD · verifică din nou</Text>
              </Pressable>
            ) : null}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={paid ? 'Închide' : 'Renunță la plată'}
              onPress={onClose}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryLabel}>{paid ? 'Închide' : 'Renunță'}</Text>
            </Pressable>
            {paid ? null : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={quote ? confirmLabel(quote) : 'Aprobă plata'}
                accessibilityState={{ busy, disabled: busy || !quote || blockers.length > 0 }}
                disabled={busy || !quote || blockers.length > 0}
                onPress={confirm}
                style={({ pressed }) => [styles.primary, (busy || !quote || blockers.length > 0) && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={styles.primaryLabel} numberOfLines={1}>
                  {busy ? 'Se semnează…' : quote ? confirmLabel(quote) : 'Se citește prețul…'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Row({ line }: { line: QuoteLine }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{line.label}</Text>
      <Text style={[styles.rowValue, line.strong && styles.rowValueStrong]}>{line.value}</Text>
    </View>
  );
}


const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: jungle.sheet, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 26, maxHeight: '82%' },
  grabber: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#26343f', marginTop: 10, marginBottom: 8 },
  title: { color: '#eaf6ff', fontSize: 17, fontWeight: '800', paddingHorizontal: 18, paddingBottom: 6 },
  body: { paddingHorizontal: 18, paddingBottom: 8, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowLabel: { color: '#8fa3b4', fontSize: 13 },
  rowValue: { color: '#eaf6ff', fontSize: 15, fontWeight: '700' },
  rowValueStrong: { color: jungle.primary },
  muted: { marginTop: 4, color: '#8fa3b4', fontSize: 12, lineHeight: 17 },
  error: { marginTop: 4, color: '#ff9a9a', fontSize: 12, lineHeight: 17 },
  link: { marginTop: 6, color: jungle.primary, fontSize: 12, fontWeight: '800' },
  receipt: { marginTop: 8, gap: 4, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(139,208,74,0.35)' },
  receiptLabel: { color: jungle.primary, fontSize: 13, fontWeight: '800' },
  /** A transaction hash is 64 hex characters: one line, cut in the middle, never wrapped into noise. */
  hash: { color: '#cfe0ee', fontSize: 11, fontFamily: 'monospace' },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingTop: 12 },
  secondary: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: '#243441' },
  secondaryLabel: { color: '#cfe0ee', fontSize: 15, fontWeight: '700' },
  primary: { flex: 1.4, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: jungle.primary, paddingHorizontal: 10 },
  primaryLabel: { color: jungle.primaryInk, fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});

