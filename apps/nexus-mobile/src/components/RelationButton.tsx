import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, StyleSheet, Text, View,
  type StyleProp, type ViewStyle,
} from 'react-native';
import {
  RELATION_WORDS, cancelFollowRequest, decideFollowRequest, deriveRelationUi, relationErrorMessage,
  relationMenu, resolveRelation, setBlocked, setFollowing, setMuted, useRelationResolving,
  type RelationActionId, type RelationMenuItem, type RelationTarget, type RelationView,
} from '../lib/relations';
import { jungle } from '../theme/jungle';
import { socialTokens } from '../theme/social';

/**
 * The one relation control of the app. It draws what `deriveRelationUi` says — never a rule of its own — so
 * the profile header, a feed card, a comments row, a search result and a conversation all answer with the
 * same word, the same ink and the same action for the same pair of accounts.
 *
 * Three shapes, one logic:
 *
 *   * `wide` — the header's full-width button, ~38dp tall and fully round (the owner's measurement);
 *   * `compact` — the same word in a list row: ~32dp tall, same ink and same tokens;
 *   * `RelationMenuButton` — the round entry beside the primary, holding only what the server can really
 *     perform (`relationMenu`): the two answers to a request, mute/unmute and block/unblock.
 *
 * Every press is one `mutateRelation` call: the record is written under the finger, the server's answer
 * replaces it, and a refusal puts the old record back and prints the sentence `relationErrorMessage`
 * returns. While that call is in flight the record carries `busy`, so the button is disabled and a double
 * tap cannot become two requests.
 */
export type RelationButtonVariant = 'wide' | 'compact';

export function RelationButton({
  target, relation, viewerUserId, variant = 'wide', onEditProfile, style,
}: {
  target: RelationTarget;
  relation?: RelationView | undefined;
  viewerUserId?: number | null;
  variant?: RelationButtonVariant;
  /** What the owner's own primary button opens: the editor, exactly as the pencil did. */
  onEditProfile?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const [error, setError] = useState('');
  const ui = useMemo(() => deriveRelationUi(relation, target, { userId: viewerUserId }), [relation, target, viewerUserId]);
  const persona = target.persona ?? 'social';
  /**
   * A face whose follow side is unknown is read once (`resolveRelation`): one request per account, deduplicated,
   * and the button shows the read instead of a word the server never said. A hidden record is never drawn.
   */
  const unresolved = ui.kind === 'unresolved';
  const reading = useRelationResolving(unresolved ? target.handle : null, persona);
  useEffect(() => {
    if (!unresolved || !target.handle) return;
    void resolveRelation(target.handle, persona);
  }, [persona, target.handle, unresolved]);
  const busy = (relation?.busy !== null && relation?.busy !== undefined) || reading;
  const compact = variant === 'compact';

  const press = useCallback(() => {
    setError('');
    const run = async () => {
      try {
        if (ui.primary.action === 'edit_profile') { onEditProfile?.(); return; }
        if (ui.primary.action === 'none') return;
        const persona = target.persona ?? 'social';
        const userId = Number(target.userId);
        if (ui.primary.action === 'follow' || ui.primary.action === 'request') await setFollowing({ userId, persona }, true);
        else if (ui.primary.action === 'unfollow' || ui.primary.action === 'cancel_request') await cancelFollowRequest({ userId, persona });
        else if (ui.primary.action === 'unblock') await setBlocked({ userId, persona }, false);
      } catch (cause) {
        setError(relationErrorMessage(cause));
      }
    };
    void run();
  }, [onEditProfile, target.persona, target.userId, ui.primary.action]);

  /**
   * The confirmation the web has: an unfollow or a cancelled request takes something away, so the wide
   * button asks first and the compact one (a list of hundreds of rows) does not. `Alert` is the platform's
   * own dialog and needs no dependency.
   */
  const confirmAndPress = useCallback(() => {
    if (!ui.primary.confirm) { press(); return; }
    Alert.alert(ui.primary.confirm, `${ui.primary.label} · ${String(target.name || target.handle || '')}`.trim(), [
      { text: 'Renunță', style: 'cancel' },
      { text: ui.primary.confirm, style: 'destructive', onPress: press },
    ]);
  }, [press, target.handle, target.name, ui.primary.confirm, ui.primary.label]);

  const tone = ui.primary.tone === 'accent';
  const disabled = ui.primary.action === 'none' || busy;

  return (
    <View style={[styles.column, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ui.primary.accessibilityLabel}
        accessibilityState={{ disabled, busy }}
        disabled={disabled}
        onPress={compact ? press : confirmAndPress}
        style={({ pressed }) => [
          compact ? styles.compact : styles.wide,
          tone ? styles.accent : styles.neutral,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={tone ? socialTokens.relations.accentInk : socialTokens.relations.busyInk} />
        ) : (
          <Text
            numberOfLines={1}
            style={[compact ? styles.compactLabel : styles.label, tone ? styles.accentLabel : styles.neutralLabel]}
          >
            {ui.primary.label}
          </Text>
        )}
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

/** The `Mesaj` half of the row: the same shape as the primary, in the quiet ink (`publicProfile.message`). */
export function MessageButton({ label, enabled, reason, onPress, style }: {
  label: string;
  enabled: boolean;
  reason?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.column, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={reason ? `${label} · ${reason}` : label}
        accessibilityState={{ disabled: !enabled }}
        disabled={!enabled}
        onPress={onPress}
        style={({ pressed }) => [styles.wide, styles.neutral, !enabled && styles.disabled, pressed && enabled && styles.pressed]}
      >
        <Text numberOfLines={1} style={[styles.label, styles.neutralLabel]}>{label}</Text>
      </Pressable>
      {!enabled && reason ? <Text style={styles.error}>{reason}</Text> : null}
    </View>
  );
}

/**
 * The round entry beside the primary. It holds the menu `relationMenu` returns and performs it: a mute is
 * `POST /api/profile/mute`, a block is `POST /api/profile/block` (`api.js:4257`, `:4627`). Entries the server
 * does not offer — removing a follower, reporting an account — are not drawn at all.
 */
export function RelationMenuButton({
  target, relation, onError, decide, style,
}: {
  target: RelationTarget;
  relation?: RelationView | undefined;
  onError?: (message: string) => void;
  /** A waiting request that came in: the two answers the server knows (`accept` / `decline`). */
  decide?: { requestId: number };
  style?: StyleProp<ViewStyle>;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const entries = useMemo<RelationMenuItem[]>(() => {
    const menu = relationMenu(relation);
    if (!decide) return menu;
    return [
      { id: 'accept', label: RELATION_WORDS.accept, active: false },
      { id: 'decline', label: RELATION_WORDS.decline, active: false },
      ...menu,
    ];
  }, [decide, relation]);
  const disabled = entries.length === 0;

  const run = useCallback((id: RelationActionId) => {
    setOpen(false);
    setMessage('');
    const fail = (cause: unknown) => {
      const sentence = relationErrorMessage(cause);
      setMessage(sentence);
      onError?.(sentence);
    };
    const persona = target.persona ?? 'social';
    const userId = Number(target.userId);
    if (id === 'accept' && decide) { void decideFollowRequest({ requestId: decide.requestId, userId, persona }, 'accept').catch(fail); return; }
    if (id === 'decline' && decide) { void decideFollowRequest({ requestId: decide.requestId, userId, persona }, 'decline').catch(fail); return; }
    if (id === 'mute' || id === 'unmute') { void setMuted({ userId, persona }, id === 'mute').catch(fail); return; }
    if (id === 'block' || id === 'unblock') { void setBlocked({ userId, persona }, id === 'block').catch(fail); return; }
  }, [decide, onError, target.persona, target.userId]);

  return (
    <View style={[styles.column, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={RELATION_WORDS.options}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => setOpen((value) => !value)}
        hitSlop={6}
        style={({ pressed }) => [styles.round, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
      >
        <Text style={styles.roundGlyph}>⋯</Text>
      </Pressable>
      {open ? (
        <View style={styles.menu}>
          {entries.map((entry) => (
            <Pressable
              key={entry.id}
              accessibilityRole="menuitem"
              accessibilityLabel={entry.label}
              accessibilityState={{ selected: entry.active === true }}
              onPress={() => run(entry.id)}
              style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowOn]}
            >
              <Text style={[styles.menuLabel, entry.destructive === true && styles.menuLabelDanger]}>{entry.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {message ? <Text style={styles.error}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /** A button and its own sentence, so an error never moves the row it belongs to. */
  column: { minWidth: 0 },
  wide: {
    minHeight: socialTokens.relations.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: socialTokens.relations.buttonRadius,
    borderWidth: 1,
  },
  compact: {
    minHeight: socialTokens.relations.compactHeight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: socialTokens.relations.compactPaddingInline,
    borderRadius: socialTokens.relations.compactRadius,
    borderWidth: 1,
  },
  /** The primary action of the product: kiwi green with the field as its ink (`theme/jungle.ts`). */
  accent: { backgroundColor: jungle.primary, borderColor: jungle.primary },
  neutral: { backgroundColor: socialTokens.relations.neutralSurface, borderColor: socialTokens.relations.neutralBorder },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.82 },
  label: { fontSize: socialTokens.relations.labelSize, fontWeight: '700' },
  compactLabel: { fontSize: socialTokens.relations.compactLabelSize, fontWeight: '700' },
  accentLabel: { color: jungle.primaryInk },
  neutralLabel: { color: socialTokens.relations.neutralInk },
  round: {
    width: socialTokens.relations.roundSize,
    height: socialTokens.relations.roundSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: socialTokens.relations.roundSize / 2,
    borderWidth: 1,
    borderColor: socialTokens.relations.neutralBorder,
    backgroundColor: socialTokens.relations.neutralSurface,
  },
  roundGlyph: { color: socialTokens.relations.neutralInk, fontSize: 16, lineHeight: 18 },
  menu: {
    position: 'absolute',
    zIndex: 9,
    top: socialTokens.relations.roundSize + 6,
    right: 0,
    minWidth: socialTokens.relations.menuWidth,
    padding: socialTokens.relations.menuPadding,
    gap: socialTokens.relations.menuPadding,
    borderWidth: 1,
    borderColor: socialTokens.relations.menuBorder,
    borderRadius: socialTokens.relations.menuRadius,
    backgroundColor: socialTokens.relations.menuSurface,
  },
  menuRow: {
    minHeight: socialTokens.relations.menuRowHeight,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  menuRowOn: { backgroundColor: '#12222c' },
  menuLabel: { color: socialTokens.relations.neutralInk, fontSize: socialTokens.relations.menuLabelSize, fontWeight: '600' },
  menuLabelDanger: { color: socialTokens.relations.dangerInk },
  error: { marginTop: 6, color: socialTokens.relations.errorInk, fontSize: socialTokens.relations.errorSize, lineHeight: 16 },
});
