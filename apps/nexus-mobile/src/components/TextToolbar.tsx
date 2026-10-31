/**
 * The type toolbar of the TEXT composer: one row of four doors, and one panel at a time above it.
 *
 * The composer used to carry three separate sections in the middle of its scroll — a strip of emoji, six
 * letter chips, five measure chips — and the two problems the owner reported came from exactly that shape:
 *
 * 1. **The emoji rebuilt the page.** An emoji was a whole-page operation (`applyPlainText` on the committed
 *    article), so pressing one while a paragraph was open in the field put the *previous* words back. Here
 *    an emoji is a keystroke: it travels to the composer as `onEmoji`, which asks the field to type it
 *    (`insertRequest` in `EditorialPage`), and the page is only written on `Gata`.
 * 2. **The controls were far from the words.** Choosing a face meant scrolling past the page, the layout
 *    card and the attachments. The toolbar is pinned under the composer instead, one thumb away, and each
 *    door says what it currently is („Literă · Serif").
 *
 * The panel is drawn *above* the row, so opening „Emoji" moves nothing but the panel and the row stays
 * under the same thumb. Every letter chip is set in its own family, because a menu of face names is a menu
 * nobody can choose from — the author has to see the letter.
 */

import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { nextEditorialTypography, type EditorialTypography } from '../lib/editorialDocument';
import { TEXT_EMOJI_GROUPS, TEXT_FONTS, fontFamilyFor, type TextFontId } from '../lib/textStyle';

/**
 * Which panel is open above the row; `null` is the row alone, i.e. the page and the keyboard.
 *
 * `measure` stays in the list because `door()` names its four controls by it, but it is the one id that
 * no longer opens a panel: since round 47 the measure door is a **cycle** (`nextEditorialTypography`).
 */
export type TextToolbarPanel = 'emoji' | 'face' | 'measure' | null;

const MEASURE_LABELS: Record<EditorialTypography, string> = {
  auto: 'Auto',
  small: 'Mic',
  medium: 'Mediu',
  large: 'Mare',
  xlarge: 'Foarte mare',
};

export type TextToolbarProps = {
  panel: TextToolbarPanel;
  onPanelChange: (panel: TextToolbarPanel) => void;
  /** A pressed emoji. The composer types it into the paragraph that is open, never into the page. */
  onEmoji: (emoji: string) => void;
  font: TextFontId;
  onFont: (font: TextFontId) => void;
  measure: EditorialTypography;
  onMeasure: (measure: EditorialTypography) => void;
};

export function TextToolbar({ panel, onPanelChange, onEmoji, font, onFont, measure, onMeasure }: TextToolbarProps) {
  /** The emoji group on show. Local state: which tab of the picker is open is not part of the draft. */
  const [groupId, setGroupId] = useState<string>(TEXT_EMOJI_GROUPS[0].id);
  const group = TEXT_EMOJI_GROUPS.find((entry) => entry.id === groupId) ?? TEXT_EMOJI_GROUPS[0];
  const fontLabel = TEXT_FONTS.find((entry) => entry.id === font)?.label ?? 'Serif';

  /**
   * One door of the row: the same shape for all four, so the row reads as one control.
   *
   * Three doors open a panel; the measure door is a **cycle** (runda 47). Ownerul a cerut „mereu trei
   * mărimi, iar a patra atingere se întoarce la prima", deci din ea nu se deschide nimic: fiecare atingere
   * trece la pasul următor (Mic → Mediu → Mare → Mic), exact ciclul pe care îl au textul peste poză,
   * stickerele și emoji-urile (`lib/overlayPresets.ts`). Eticheta porții spune unde ești, deci ciclul nu
   * are nevoie de un panou care să-l repete.
   */
  function door(id: Exclude<TextToolbarPanel, null>, label: string, value?: string, cycle?: () => void) {
    const active = panel === id;
    return (
      <Pressable
        key={id}
        accessibilityRole="button"
        accessibilityState={{ selected: active, expanded: active }}
        accessibilityLabel={value ? `${label}: ${value}` : label}
        accessibilityHint={cycle
          ? 'Trece la mărimea următoare: Mic, Mediu, Mare, apoi iar Mic.'
          : active ? 'Închide panoul.' : 'Deschide panoul.'}
        onPress={cycle ?? (() => onPanelChange(active ? null : id))}
        style={[styles.door, active && styles.doorActive]}
      >
        <Text style={[styles.doorLabel, active && styles.doorLabelActive]} numberOfLines={1}>
          {value ? `${label} · ${value}` : label}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.bar}>
      {panel === 'emoji' ? (
        <View style={styles.panel} accessibilityLabel="Emoji">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={styles.groups}>
            {TEXT_EMOJI_GROUPS.map((entry) => {
              const active = entry.id === group.id;
              return (
                <Pressable
                  key={entry.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={entry.label}
                  onPress={() => setGroupId(entry.id)}
                  style={[styles.group, active && styles.groupActive]}
                >
                  <Text style={[styles.groupText, active && styles.groupTextActive]}>{entry.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {/**
            * `always` and not `handled`: the keyboard is up while the author types, and the first tap on an
            * emoji must type it rather than merely put the keyboard away.
            */}
          <ScrollView keyboardShouldPersistTaps="always" nestedScrollEnabled style={styles.gridScroll} contentContainerStyle={styles.grid}>
            {group.emoji.map((emoji) => (
              <Pressable
                key={emoji}
                accessibilityRole="button"
                accessibilityLabel={`Adaugă ${emoji}`}
                onPress={() => onEmoji(emoji)}
                style={styles.emoji}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {panel === 'face' ? (
        <View style={styles.panel} accessibilityLabel="Litera paginii">
          <ScrollView keyboardShouldPersistTaps="always" nestedScrollEnabled contentContainerStyle={styles.chips}>
            {TEXT_FONTS.map((entry) => {
              const active = entry.id === font;
              return (
                <Pressable
                  key={entry.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active, checked: active }}
                  accessibilityLabel={`Litera: ${entry.label}`}
                  onPress={() => onFont(entry.id)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive, { fontFamily: fontFamilyFor(entry.id, Platform.OS) }]}>
                    {entry.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/**
       * The measure panel is gone (runda 47). It used to be five chips — `auto`, `small`, `medium`,
       * `large`, `xlarge` — i.e. four sizes and a default, while the owner asked for **three** sizes
       * everywhere. The door above is now the cycle itself: one press, one step, Mic → Mediu → Mare → Mic.
       */}

      <View style={styles.row}>
        {door('face', 'Literă', fontLabel)}
        {door('measure', 'Mărime', MEASURE_LABELS[measure], () => onMeasure(nextEditorialTypography(measure)))}
        {door('emoji', 'Emoji')}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: panel === null }}
          accessibilityLabel="Tastatură"
          accessibilityHint="Închide panoul și readuce tastatura în paragraf."
          onPress={() => onPanelChange(null)}
          style={[styles.door, panel === null && styles.doorActive]}
        >
          <Text style={[styles.doorLabel, panel === null && styles.doorLabelActive]} numberOfLines={1}>
            Tastatură
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * The bar sits on the composer's dark chrome, not on the paper: it is furniture of the desk, not of the
   * page, and a paper-coloured bar under a paper page would read as part of the article.
   */
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ffffff1f',
    backgroundColor: '#07090d',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  door: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffffff14',
    backgroundColor: '#12161c',
  },
  doorActive: { backgroundColor: '#f6f8fb', borderColor: '#f6f8fb' },
  doorLabel: { color: '#c8d0d8', fontSize: 12, fontWeight: '700' },
  doorLabelActive: { color: '#07090d' },
  panel: {
    maxHeight: 232,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ffffff14',
  },
  /** The group tabs of the picker, painted as the smallest readable pills. */
  groups: { gap: 6, paddingHorizontal: 10 },
  group: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#12161c', borderWidth: 1, borderColor: '#ffffff14' },
  groupActive: { backgroundColor: '#f6f8fb', borderColor: '#f6f8fb' },
  groupText: { color: '#9aa4af', fontSize: 11, fontWeight: '700' },
  groupTextActive: { color: '#07090d' },
  /**
   * The grid is a wrap of 44 dp tiles: the smallest square a fingertip hits without aiming, and the size the
   * system keyboard uses for the same job. It scrolls inside the panel, so the page above it never moves while
   * the author looks for an emoji.
   */
  gridScroll: { flexGrow: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingBottom: 6 },
  emoji: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 26 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 10, paddingBottom: 4 },
  chip: {
    borderRadius: 99, borderWidth: 1, borderColor: '#ffffff24', paddingHorizontal: 14, minHeight: 40,
    justifyContent: 'center', backgroundColor: '#12161c',
  },
  chipActive: { backgroundColor: '#f6f8fb', borderColor: '#f6f8fb' },
  chipText: { color: '#c8d0d8', fontSize: 15 },
  chipTextActive: { color: '#07090d', fontWeight: '700' },
});
