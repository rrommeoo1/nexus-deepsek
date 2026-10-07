import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { InboxBox, InboxFilter } from '../lib/messageSearch';

/**
 * The two `details` plates the web puts between the ends of `.messengerTopbar` (`messenger-shell.js:34-43`),
 * drawn with the phone shell's own values:
 *
 *   grid             `112px 1fr 1fr 44px` (messenger-spaces.css:3) — the two plates are the middle columns
 *   summary          min-height 44, padding 0 9, border 1px rgba(255,255,255,.22), radius 16, #090a0c,
 *                    #f7f7f7, 14px, `justify-content:space-between;gap:3px` (messenger-spaces.css:7,
 *                    feed-surface.css:903-911)
 *   the menu         `position:absolute;inset-inline-end:0;top:50px;width:210px;padding:6px;border:1px solid
 *                    rgba(255,255,255,.2);border-radius:18px;background:#08090b` (messenger-spaces.css:8,
 *                    feed-surface.css:913-916)
 *   a menu button    44px tall, full width, 16px, radius 12, `text-align:start`; pressed = white plate with
 *                    `#050608` ink (messenger-spaces.css:9, feed-surface.css:918-921)
 *   `.inboxBoxes`    the box row inside the second plate: `display:flex;gap:6px;overflow-x:auto` with
 *                    `white-space:nowrap` chips (social-human-ux.css:200)
 *
 * The module plate names the active module (`messages.filtersLabel` is its accessible name); the tools plate
 * prints the box the list is on, which is what `#inbox-filter-label` prints (`messenger-shell.js:35`).
 */

/** `[data-inbox-persona]` of `messenger-shell.js:29` — the six modules, in the web's own order. */
export const INBOX_MODULES = [
  { id: 'all', label: 'Toate mesajele' },
  { id: 'social', label: 'Social' },
  { id: 'dating', label: 'Dating' },
  { id: 'work', label: 'Work' },
  { id: 'travel', label: 'Travel' },
  { id: 'market', label: 'Market' },
] as const;

/** `.inboxBoxes` of `messenger-shell.js:36-42` — the three filters and the two boxes, verbatim. */
export const INBOX_BOXES = [
  { key: 'all', label: 'Toate', kind: 'filter', value: 'all' },
  { key: 'unread', label: 'Necitite', kind: 'filter', value: 'unread' },
  { key: 'group', label: 'Grup', kind: 'filter', value: 'group' },
  { key: 'requests', label: 'Cereri', kind: 'box', value: 'requests' },
  { key: 'activity', label: 'Activitate', kind: 'box', value: 'activity' },
] as const;

/** `messages.filtersLabel` (`interface-locale.js:281`) — the name of the module plate. */
export const FILTERS_LABEL = 'Filtre după profil';
/** `messenger.options` (`interface-locale.js:15`) — the name of the tools plate. */
export const OPTIONS_LABEL = 'Opțiuni';
/** `messages.boxesLabel` (`interface-locale.js:281`) — the name of the box row. */
export const BOXES_LABEL = 'Secțiuni inbox';

export function InboxModulePlate({ module, onSelect }: {
  /** The module the account is on; the plate names it, the way the web names the selected one. */
  module: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = INBOX_MODULES.find((entry) => entry.id === module) ?? INBOX_MODULES[1];
  return (
    <View style={styles.plate}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={FILTERS_LABEL}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={styles.summary}
      >
        <Text style={styles.summaryLabel} numberOfLines={1}>{selected.label}</Text>
        <Text accessible={false} style={styles.caret}>⌄</Text>
      </Pressable>
      {open ? (
        <View style={styles.menu}>
          {INBOX_MODULES.map((entry) => (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              accessibilityLabel={entry.label}
              accessibilityState={{ selected: entry.id === module }}
              onPress={() => { setOpen(false); onSelect(entry.id); }}
              style={[styles.menuItem, entry.id === module && styles.menuItemOn]}
            >
              <Text style={[styles.menuText, entry.id === module && styles.menuTextOn]}>{entry.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function InboxToolsPlate({ box, filter, onBox, onFilter }: {
  /** The box the list is on; `inbox` with a filter is what the web calls `all`. */
  box: InboxBox;
  filter: InboxFilter;
  onBox: (next: InboxBox) => void;
  onFilter: (next: InboxFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  /** `#inbox-filter-label` (`messenger-shell.js:35`): `messages.requests` when the box is requests, else `messages.all`. */
  const label = box === 'requests' ? 'Cereri' : box === 'activity' ? 'Activitate' : 'Toate';
  const pressed = (entry: typeof INBOX_BOXES[number]) => (entry.kind === 'filter'
    ? box === 'inbox' && filter === entry.value
    : box === entry.value);
  return (
    <View style={styles.plate}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={OPTIONS_LABEL}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={styles.summary}
      >
        <Text style={styles.summaryLabel} numberOfLines={1}>{label}</Text>
        <Text accessible={false} style={styles.caret}>⌄</Text>
      </Pressable>
      {open ? (
        <View style={styles.menu}>
          <View accessibilityLabel={BOXES_LABEL}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.boxRow}>
              {INBOX_BOXES.map((entry) => (
                <Pressable
                  key={entry.key}
                  accessibilityRole="button"
                  accessibilityLabel={entry.label}
                  accessibilityState={{ selected: pressed(entry) }}
                  onPress={() => {
                    setOpen(false);
                    if (entry.kind === 'filter') onFilter(entry.value as InboxFilter);
                    else onBox(entry.value as InboxBox);
                  }}
                  style={[styles.chip, pressed(entry) && styles.chipOn]}
                >
                  <Text style={[styles.chipText, pressed(entry) && styles.chipTextOn]}>{entry.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /** `.messengerTopbar details{position:relative;min-width:0}` — one of the two middle grid columns. */
  plate: { flexGrow: 1, flexBasis: 0, minWidth: 0, justifyContent: 'center' },
  /** `summary{min-height:44px;padding:0 9px;border:1px solid rgba(255,255,255,.22);border-radius:16px;background:#090a0c;color:#f7f7f7;font-size:14px}` */
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 3,
    minHeight: 44,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 16,
    backgroundColor: '#090a0c',
  },
  summaryLabel: { color: '#f7f7f7', fontSize: 14, flexShrink: 1 },
  caret: { color: '#f7f7f7', fontSize: 14 },
  /** `details>div{inset-inline-end:0;top:50px;width:210px;padding:6px;border:1px solid rgba(255,255,255,.2);border-radius:18px;background:#08090b}` */
  menu: {
    position: 'absolute',
    right: 0,
    top: 50,
    zIndex: 8,
    width: 210,
    maxWidth: 240,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 18,
    backgroundColor: '#08090b',
  },
  /** `.inboxBoxes{display:flex;gap:6px;overflow-x:auto}` — the chips scroll when they do not fit. */
  boxRow: { gap: 6, paddingRight: 2 },
  /** `.inboxBoxes button{min-height:44px;font-size:14px;white-space:nowrap}` on the phone's #090a0c plate. */
  chip: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 12,
    backgroundColor: '#090a0c',
  },
  /** `[aria-pressed=true]{border-color:#fff;background:#fff;color:#050608}` */
  chipOn: { borderColor: '#ffffff', backgroundColor: '#ffffff' },
  chipText: { color: '#f7f7f7', fontSize: 14 },
  chipTextOn: { color: '#050608' },
  /** `details button{min-height:44px;width:100%;padding:10px 12px;border-radius:12px;font-size:16px;text-align:start}` */
  menuItem: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12 },
  menuItemOn: { backgroundColor: '#ffffff' },
  menuText: { color: '#efffff', fontSize: 16 },
  menuTextOn: { color: '#050608' },
});