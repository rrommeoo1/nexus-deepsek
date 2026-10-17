import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { confirmationFor, type ActionKey, type PricingView } from '../lib/creatorPricing';
import { formatJbc } from '../lib/pricing';

/**
 * The one confirmation a spending tap goes through (`MONETIZATION-SPEC.md` §5.1, §5.2 rule 2).
 *
 * It prints only what the server said — the price, the platform's fee, what the creator receives —
 * next to the two numbers the reader owns: the balance and the session budget. When one of them
 * cannot cover the action, the reason is on the sheet and the button is disabled, so the request is
 * never sent to be refused.
 */
export type SupportConfirmSheetProps = {
  visible: boolean;
  view: PricingView | null;
  action: ActionKey;
  /** `null` means "not read yet"; the sheet then says so instead of pretending a zero balance. */
  balanceCents?: number | null;
  sessionBudgetCents?: number | null;
  sessionSpentCents?: number;
  busy?: boolean;
  result?: string;
  error?: string;
  /** Present on a real charge; absent when the sheet is only the fan preview. */
  onConfirm?: () => void;
  onClose: () => void;
};

export function SupportConfirmSheet({
  visible, view, action, balanceCents = null, sessionBudgetCents = null, sessionSpentCents = 0,
  busy = false, result = '', error = '', onConfirm, onClose,
}: SupportConfirmSheetProps) {
  const confirmation = confirmationFor(view, action, { balanceCents, sessionBudgetCents, sessionSpentCents });
  const title = onConfirm
    ? `Confirmă ${confirmation.label.toLowerCase()}`
    : `Cum vede fanul ${confirmation.label.toLowerCase()}`;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{title}</Text>
          <ScrollView contentContainerStyle={styles.body}>
            <Row label="Preț" value={formatJbc(confirmation.price_cents)} strong />
            <Row label="Comision platformă" value={formatJbc(confirmation.fee_cents)} />
            <Row label="Creatorul primește" value={formatJbc(confirmation.creator_cents)} />
            <Row label="Sold disponibil" value={balanceCents === null ? '—' : formatJbc(balanceCents)} />
            <Row
              label="Buget de sesiune rămas"
              value={confirmation.budget_left_cents === null ? '—' : formatJbc(confirmation.budget_left_cents)}
            />
            {confirmation.demo_unpaid ? (
              <Text style={styles.demo}>
                Demonstrativ: pe această instalare nu se mișcă niciun sold. Prețul și împărțirea sunt cele
                pe care le-a salvat creatorul.
              </Text>
            ) : null}
            {confirmation.blockers.map((blocker) => (
              <Text key={blocker} style={styles.error}>{blocker}</Text>
            ))}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {result ? <Text style={styles.result}>{result}</Text> : null}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Renunță"
              onPress={onClose}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryLabel}>{onConfirm && !result ? 'Renunță' : 'Închide'}</Text>
            </Pressable>
            {onConfirm && !result ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={confirmation.confirm_label}
                accessibilityState={{ busy, disabled: busy || confirmation.disabled }}
                disabled={busy || confirmation.disabled}
                onPress={onConfirm}
                style={({ pressed }) => [styles.primary, (busy || confirmation.disabled) && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={styles.primaryLabel}>{busy ? 'Se trimite…' : confirmation.confirm_label}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowValueStrong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: '#08131a', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 26, maxHeight: '82%' },
  grabber: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#26343f', marginTop: 10, marginBottom: 8 },
  title: { color: '#eaf6ff', fontSize: 17, fontWeight: '800', paddingHorizontal: 18, paddingBottom: 6 },
  body: { paddingHorizontal: 18, paddingBottom: 8, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowLabel: { color: '#8fa3b4', fontSize: 13 },
  rowValue: { color: '#eaf6ff', fontSize: 15, fontWeight: '700' },
  rowValueStrong: { color: '#5cf6e7' },
  demo: { marginTop: 6, color: '#8fa3b4', fontSize: 12, lineHeight: 17 },
  error: { marginTop: 4, color: '#ff9a9a', fontSize: 12, lineHeight: 17 },
  result: { marginTop: 4, color: '#5cf6e7', fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingTop: 12 },
  secondary: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: '#243441' },
  secondaryLabel: { color: '#cfe0ee', fontSize: 15, fontWeight: '700' },
  primary: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#5cf6e7' },
  primaryLabel: { color: '#02150d', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});

