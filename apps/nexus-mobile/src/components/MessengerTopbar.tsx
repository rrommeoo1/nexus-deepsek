import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { NexusWordmark } from './NexusWordmark';

/**
 * The topbar and the quick search of the inbox, at the measurements of the web
 * (`docs/web-ref/messages/inbox-0.dom.json`, `messenger-spaces.css:2-12`, `feed-surface.css:894-925`):
 *
 *   `.messengerTopbar`       437x66 at y=16, gap 6, grid `112px 1fr 1fr 44px`
 *   `#inbox-home`            112x64: the wordmark (112 wide, `height:auto` of a 132x34 drawing) over
 *                            `small` "MESSAGES" (10px, letter-spacing 3, padding-inline-start 2)
 *   `#new-conversation`      44x44 `iconBtn`, the `compose` mark 24x24 centred
 *   `#message-search`        437x46 at y=82, radius 18, border 1px, `margin:0 0 6px`
 *   `#conversation-search`   flex 1, 8px padding, 16px type, `min-height:44px`
 *   `.inboxSearch button`    44x44, the `search` mark 24x24
 *
 * Phone shell (`feed-surface.css:894-925`): the bar is plain black with no line, the wordmark is
 * painted in one white ink (`:is(text,circle){fill:#fff}`, `stop{stop-color:#fff}`,
 * `path{stroke:#fff}` — the substitution `NexusWordmark` already performs), `small` drops to
 * `rgba(255,255,255,.68)` and both marks sit white on `#050608`.
 *
 * The web's four-column grid carries two `details` plates between the ends — the module dropdown
 * ("Social") and the box dropdown ("Toate"). This app prints neither: the row keeps the two ends and
 * the space between them, and nothing is drawn where the web draws a menu it does not have.
 */

/** `messenger-shell.js:108-114` — a 24x24 frame, no fill, `stroke:currentColor`, width 1.8, round caps. */
const STROKES = {
  search: 'm16 16 5 5',
  compose: 'M12 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7M14 4l3-3 5 5-3 3-9 9-5 1 1-5Z',
} as const;

function Mark({ kind, ink, size = 24 }: { kind: keyof typeof STROKES; ink: string; size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={ink}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === 'search' ? <Circle cx={10.5} cy={10.5} r={6.5} /> : null}
      <Path d={STROKES[kind]} />
    </Svg>
  );
}

/** `header.home` (`interface-locale.js:31`) — the accessible name of the wordmark door. */
const HOME_LABEL = 'Nexus Home · revino la prima pagină';
/** `messages.newConversation` (`interface-locale.js:280`) — `#new-conversation`. */
const NEW_CONVERSATION_LABEL = 'Conversație nouă';
/** `messenger.search` (`interface-locale.js:15`) — the placeholder and the name of both search halves. */
const SEARCH_LABEL = 'Caută conversații';

export function MessengerTopbar({ onHome, onNewConversation }: {
  /** `#inbox-home` is the way home (`app.js:7752` binds it to `goHome`). */
  onHome: () => void;
  /** `#new-conversation` opens the conversation creator (`app.js:7810`). */
  onNewConversation: () => void;
}) {
  return (
    <View style={styles.topbar}>
      <Pressable accessibilityRole="button" accessibilityLabel={HOME_LABEL} onPress={onHome} style={styles.home}>
        <NexusWordmark width={112} ink="#ffffff" />
        <Text style={styles.homeSmall}>MESSAGES</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={NEW_CONVERSATION_LABEL}
        onPress={onNewConversation}
        style={styles.iconBtn}
      >
        <Mark kind="compose" ink="#ffffff" />
      </Pressable>
    </View>
  );
}

export function MessengerSearch({ value, onChangeText, onSubmit }: {
  value: string;
  onChangeText: (next: string) => void;
  onSubmit: () => void;
}) {
  return (
    <View style={styles.search}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        /** The web clears the field on Escape (`messenger-shell.js:66-68`), keydown on the input itself. */
        onKeyPress={(event) => { if (event.nativeEvent.key === 'Escape') onChangeText(''); }}
        placeholder={SEARCH_LABEL}
        placeholderTextColor="#8e9ca5"
        accessibilityLabel={SEARCH_LABEL}
        maxLength={80}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        style={styles.searchInput}
      />
      <Pressable accessibilityRole="button" accessibilityLabel={SEARCH_LABEL} onPress={onSubmit} style={styles.iconBtn}>
        <Mark kind="search" ink="#ffffff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * `.messengerTopbar{display:grid;grid-template-columns:112px minmax(0,1fr) minmax(0,1fr) 44px;
   * align-items:center;gap:6px;min-height:66px}` (`messenger-spaces.css:3`). The phone shell paints it
   * `rgba(1,5,3,.96)` and hands it the quiet-green edge colour (`feed-surface.css:1666-1672`), but the
   * measured border is `0px none rgba(112,164,130,.16)` (`docs/web-ref/messages/inbox-0.dom.json`,
   * `header.messengerTopbar`) — the colour is set with no line to draw, so none is drawn here either.
   * The measured y=16 is the page inset the list already carries, so the bar itself has no padding
   * (`p: "0px"` in the same measurement), and the two middle columns stay empty because their plates
   * are not printed.
   */
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    minHeight: 66,
    backgroundColor: 'rgba(1,5,3,0.96)',
  },
  /** `.messengerHome{min-height:44px;width:100%}` in the grid's 112px column (measured 112x64). */
  home: { width: 112, minHeight: 64, justifyContent: 'center', gap: 4 },
  /** `.messengerHome small{font-size:10px;letter-spacing:3px;padding-inline-start:2px}` — white 68% on the phone. */
  homeSmall: { color: 'rgba(255,255,255,0.68)', fontSize: 10, letterSpacing: 3, paddingStart: 2 },
  /** `.messengerScreen .iconBtn{width:44px;height:44px;display:grid;place-items:center}` — `#fff` on `#050608` on the phone. */
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#050608' },
  /** `.inboxSearch{display:flex;align-items:center;margin:0 0 6px;border-radius:18px}` — `#090a0c` + `rgba(255,255,255,.22)` on the phone. */
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 18,
    backgroundColor: '#090a0c',
    overflow: 'hidden',
  },
  /** `.inboxSearch input{width:0;flex:1;border:0;background:none;padding:8px;font-size:16px;min-height:44px}` */
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 0,
    color: '#f7f7f7',
    fontSize: 16,
  },
});
