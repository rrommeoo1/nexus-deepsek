import { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  activePageMode, PAGE_MODES, setReaderPageMode, subscribePageMode, type PageMode,
} from '../lib/pageMode';

/**
 * Modul de citire al cititorului, ca valoare vie.
 *
 * `lib/pageMode.ts` ține răspunsul și își anunță abonații; acest cârlig este ce face ca o pagină deschisă
 * să își schimbe hârtia în negru **fără remontare** și fără o a doua stare în fiecare ecran.
 */
export function usePageMode(): PageMode {
  return useSyncExternalStore(subscribePageMode, activePageMode, activePageMode);
}

/**
 * Comutatorul Hârtie / Noapte al unei pagini de cuvinte (runda 46).
 *
 * Stă în capul paginii, **imediat înaintea** porții autorului (`Urmărește`, `Editează profilul`) — locul
 * cerut de owner — și este un segmentat cu două fețe: soarele pentru hârtie, luna pentru noapte. Semnele
 * sunt singurul lucru desenat, fiindcă un cap de pagină nu are loc pentru două cuvinte întregi; cuvintele
 * sunt în `accessibilityLabel`, iar starea aleasă în `accessibilityState` — deci un cititor de ecran aude
 * „Aspectul paginii, Hârtie, selectat".
 *
 * `ink` și `ground` sunt cerneala și hârtia paginii pe care stă: controlul se desenează din ele, nu dintr-o
 * temă a aplicației, ca să rămână lizibil pe hârtie caldă **și** pe negru mat fără o a doua paletă.
 */
export function PageModeToggle({ ink, ground }: {
  /** Cerneala paginii (`pagePalette.text`). */
  ink: string;
  /** Hârtia paginii (`pagePalette.background`), pentru semnul selectat. */
  ground: string;
}) {
  const mode = usePageMode();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Aspectul paginii"
      style={[styles.group, { borderColor: withAlpha(ink, 0.28), backgroundColor: withAlpha(ink, 0.08) }]}
    >
      {PAGE_MODES.map((option) => {
        const on = option.id === mode;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${option.label}${on ? ', selectat' : ''}`}
            accessibilityHint={option.hint}
            onPress={() => setReaderPageMode(option.id)}
            hitSlop={6}
            style={[styles.option, on && { backgroundColor: ink }]}
          >
            <Text
              allowFontScaling={false}
              style={[styles.glyph, { color: on ? ground : ink, opacity: on ? 1 : 0.72 }]}
            >
              {option.glyph}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Lățimea controlului, în puncte: două semne de 26 și un chenar de 1.
 *
 * Este numărul pe care `lib/postChrome.ts::postHeadArrangement` îl scade din locul capului, ca poarta
 * autorului să cadă pe rândul doi **înainte** să se atingă de comutator, nu după.
 */
export const PAGE_MODE_TOGGLE_WIDTH = 60;

/** O culoare `#rrggbb` cu opacitate, fără o a doua bibliotecă de culori. */
function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  if (value.length !== 6) return hex;
  const mixed = Math.max(0, Math.min(1, alpha));
  return `rgba(${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}, ${mixed})`;
}

const styles = StyleSheet.create({
  /** Un chenar subțire, două celule de 26: nu mai înalt decât o poartă de autor. */
  group: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 2,
  },
  option: { width: 26, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  glyph: { fontSize: 13, lineHeight: 15, fontWeight: '800' },
});
