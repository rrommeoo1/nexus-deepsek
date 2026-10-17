import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { HEADER_WORDS, deriveRelationUi, type RelationTarget, type RelationView } from '../lib/relations';
import { initialsFor, mediaSourceForPath, type ProfileView } from '../lib/socialTypes';
import { socialTokens } from '../theme/social';
import { MessageButton, RelationButton, RelationMenuButton } from './RelationButton';
import { RemoteImageSource } from './PostMedia';
import type { TickerDoor } from './ProfileTicker';

/**
 * The profile header, rebuilt by the owner's decision (`docs/PARITY-MATRIX.md` — „decizie de design a
 * proprietarului", `MIGRATION.md` §19.2). It is deliberately **not** a copy of the web hero:
 *
 *   * the cover band is gone — no picture, no reserved space (the editor no longer offers it either);
 *   * the top row is the reader's: the drawer's bars on my own record, the back arrow and the share on
 *     somebody else's;
 *   * the identity is a block of two columns: the name large and bold, the `@handle` under it, the three
 *     fixed counters under that — and the big circle (~92dp) on the right, with the story ring when the
 *     record has a story this reader has not seen;
 *   * the row of full-width buttons under it: the relation button (what `deriveRelationUi` says), `Mesaj`,
 *     and the round entry that holds the relations menu — or, on my own record, the editor and the share.
 *
 * The description, the place and the age used to stand under the buttons; they left this header with the
 * band that now carries them (`MIGRATION.md` §20.1), so every reading of a record is printed once in the
 * column. Nothing here decides a relation: the button reads the store (`lib/relations.ts`), which is the
 * app's one answer for the same pair of accounts on every screen.
 */
export function ProfileHeader({
  profile, relation, viewerUserId, hasUnseenStory = false, onBack, onShare, onEditProfile, onMenu, menuOpen, onMessage, onDoor,
  presence = '', visibility = '', visibilityWord: visibilitySay = '', style,
}: {
  profile?: ProfileView | null;
  /** The record from `useRelation` — the same object every other screen prints. */
  relation?: RelationView | undefined;
  viewerUserId?: number | null;
  /** Any active story of this record whose `viewed_by_me` is false. */
  hasUnseenStory?: boolean;
  /** A visitor's own top row: the arrow back to where the reader came from. */
  onBack?: () => void;
  /** `Distribuie profilul`: the platform's own share sheet, no server call and no new dependency. */
  onShare?: () => void;
  onEditProfile?: () => void;
  /** My own record's round entry opens the app's index of doors (the drawer, the web's profile menu). */
  onMenu?: () => void;
  menuOpen?: boolean;
  onMessage?: () => void;
  /** The counters that lead somewhere: `following` and `followers` open their lists (`api.js:4537`). */
  onDoor?: (door: TickerDoor, arg: string) => void;
  /** `profilePresenceDot`: the dot the name line carries, with the word in its accessible name. */
  presence?: 'online' | 'away' | '';
  /** `visibilityBadge`: the sign of who may read the record, printed as a reading (the shell has no panel). */
  visibility?: 'locked' | 'open' | '';
  visibilityWord?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const target: RelationTarget = useMemo(() => ({
    userId: profile?.user_id ?? null,
    handle: profile?.handle ?? null,
    persona: profile?.persona ?? 'social',
    name: profile?.name ?? null,
  }), [profile?.handle, profile?.name, profile?.persona, profile?.user_id]);
  const ui = useMemo(() => deriveRelationUi(relation, target, { userId: viewerUserId }), [relation, target, viewerUserId]);
  const isSelf = ui.kind === 'self';

  /** The counters come from the store first: a follow anywhere in the app already moved them. */
  const counts = relation?.counts ?? profile?.counts ?? {};
  type StatKey = 'following' | 'followers' | 'posts';
  const stats = useMemo<{ key: StatKey; count?: number; label: string; door: boolean }[]>(() => ([
    { key: 'following', count: counts.following, label: HEADER_WORDS.following, door: true },
    { key: 'followers', count: counts.followers, label: HEADER_WORDS.followers, door: true },
    /**
     * The third counter is `counts.posts` — what the payload really counts (`api.js:3026`). The server has no
     * total-likes field, so the reference's third column is the post count, exactly as the owner asked, and it
     * leads nowhere because no route lists a profile's own posts as a surface of their own.
     */
    { key: 'posts', count: counts.posts, label: HEADER_WORDS.posts, door: false },
  ]), [counts.followers, counts.following, counts.posts]);

  /** Only the two lists the server really has are doors (`GET /api/social/relations`, `api.js:4537`). */
  const openStat = useCallback((stat: { key: StatKey }) => {
    if (!onDoor) return;
    if (stat.key === 'following' || stat.key === 'followers') onDoor(stat.key, '');
  }, [onDoor]);

  const avatar = mediaSourceForPath(profile?.avatar);
  const handle = String(profile?.handle ?? '').trim();
  const name = String(profile?.name || handle || '').trim();

  return (
    <View style={[styles.header, style]}>
      {/**
       * The top row. A visitor gets the arrow back and the share; my own record gets the three bars, because
       * the account screen wears no bar of the shell and those bars are its only door to the drawer
       * (`profile-experience.js:372`).
       *
       * There is no bell here: notifications are an account-wide list (`GET /api/notifications`,
       * `api.js:5619`) with no per-account route, so a bell on this row would open nothing (`MIGRATION.md`
       * §19.1). It is not drawn rather than drawn empty.
       */}
      <View style={styles.topRow}>
        {isSelf ? (
          onMenu ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Deschide meniul de setări"
              accessibilityState={{ expanded: Boolean(menuOpen) }}
              onPress={onMenu}
              style={({ pressed }) => [styles.icon, (pressed || menuOpen) && styles.iconOn]}
            >
              <View accessible={false} style={styles.bars}>
                <View style={styles.bar} />
                <View style={styles.bar} />
                <View style={styles.bar} />
              </View>
            </Pressable>
          ) : null
        ) : (
          <View style={styles.topRowEnds}>
            {onBack ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Înapoi" onPress={onBack} style={styles.icon}>
                <Text style={styles.iconGlyph}>←</Text>
              </Pressable>
            ) : <View style={styles.icon} />}
            {onShare ? (
              <Pressable accessibilityRole="button" accessibilityLabel={HEADER_WORDS.share} onPress={onShare} style={styles.icon}>
                <Text style={styles.iconGlyph}>⇪</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>

      {/**
       * The identity: the words on the left, the big circle on the right. The circle is the reference's, and
       * the ring around it is the story ring — the accent when there is something unseen, a quiet edge when
       * there is not. The white 2dp edge and the small 78dp disc of the web hero are gone with the cover.
       */}
      <View style={styles.identity}>
        <View style={styles.words}>
          <View style={styles.nameRow}>
            {/** The presence dot, first on the line, as the web's own row puts it (`profile-experience.js:352`). */}
            {presence ? (
              <View
                accessible
                accessibilityRole="image"
                accessibilityLabel={presence === 'online' ? 'Online' : 'Nu este online acum'}
                style={styles.presence}
              >
                <View style={[styles.presenceDot, presence === 'away' && styles.presenceDotAway]} />
              </View>
            ) : null}
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
          </View>
          <View style={styles.handleRow}>
            {/**
             * The handle under the name, with the sign of who may read the record after it. The server's
             * profile payload has no verification field (`api.js:2989-3030`), so no badge is drawn: a badge that
             * is always on is not a badge.
             */}
            {handle ? <Text style={styles.handle} numberOfLines={1}>{`@${handle}`}</Text> : null}
            {visibility ? (
              <View
                accessible
                accessibilityRole="image"
                accessibilityLabel={visibility === 'locked' ? `🔒 ${visibilitySay || 'Privat'}` : visibilitySay}
                style={styles.visibility}
              >
                <Text accessible={false} style={styles.visibilityGlyph}>{visibility === 'locked' ? '🔒' : '🔓'}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.stats}>
            {stats.map((stat) => (
              <Pressable
                key={stat.key}
                accessibilityRole={stat.door ? 'button' : 'text'}
                accessibilityLabel={`${stat.label}: ${Number(stat.count ?? 0).toLocaleString('ro-RO')}`}
                disabled={!stat.door || !onDoor}
                onPress={stat.door && onDoor ? () => openStat(stat) : undefined}
                style={({ pressed }) => [styles.stat, pressed && stat.door && styles.statPressed]}
              >
                <Text style={styles.statCount}>{Number(stat.count ?? 0).toLocaleString('ro-RO')}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={[styles.avatarRing, hasUnseenStory && styles.avatarRingUnseen]}>
          <View style={styles.avatar}>
            {avatar ? (
              <RemoteImageSource source={avatar} fit="cover" style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitials}>{initialsFor(profile?.name, profile?.handle)}</Text>
            )}
          </View>
        </View>
      </View>

      {/**
       * The row of buttons, on the whole width: the relation button takes what is left besides `Mesaj` and the
       * round entry. On my own record the two wide buttons are the editor and the share, and the round entry
       * opens the drawer. A record with no relation to offer (blocked, unavailable) keeps no row at all.
       */}
      {!isSelf && ui.primary.action !== 'none' ? (
        <View style={styles.buttons}>
          <RelationButton
            target={target}
            relation={relation}
            viewerUserId={viewerUserId}
            onEditProfile={onEditProfile}
            style={styles.buttonFill}
          />
          {ui.message.enabled || ui.message.reason ? (
            <MessageButton
              label={ui.message.label}
              enabled={ui.message.enabled}
              reason={ui.message.reason}
              onPress={onMessage}
              style={styles.buttonFill}
            />
          ) : null}
          <RelationMenuButton target={target} relation={relation} />
        </View>
      ) : null}

      {isSelf ? (
        <View style={styles.buttons}>
          <RelationButton
            target={target}
            relation={relation}
            viewerUserId={viewerUserId}
            onEditProfile={onEditProfile}
            style={styles.buttonFill}
          />
          {onShare ? (
            <MessageButton label={HEADER_WORDS.share} enabled onPress={onShare} style={styles.buttonFill} />
          ) : null}
          <RelationMenuButton target={target} relation={relation} />
        </View>
      ) : null}

      {/**
       * Nothing else is printed here. The description, the place and the age left the header with the
       * band that carries them under the button row (`ProfileBand`, `MIGRATION.md` §20.1): one reading,
       * one place, so the column never prints the same words twice.
       */}
    </View>
  );
}

const styles = StyleSheet.create({
  /** `.ownerHero{padding:12px 14px 0}` on black — the header keeps the hero's own inset and surface. */
  header: {
    paddingTop: socialTokens.identity.paddingTop,
    paddingHorizontal: socialTokens.identity.paddingHorizontal,
    paddingBottom: socialTokens.identity.paddingBottom,
    backgroundColor: '#000000',
  },
  /** The reader's row: the arrow on the left, the share on the right, both 44dp aims. */
  topRow: { minHeight: socialTokens.identity.topRowHeight, flexDirection: 'row', alignItems: 'center' },
  topRowEnds: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  icon: {
    width: socialTokens.identity.minTarget,
    height: socialTokens.identity.minTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  /** `.ownerMenuButton[aria-expanded=true]` on the shell: `border-color:rgba(255,255,255,.34);background:#0a0b0d`. */
  iconOn: { borderWidth: 1, borderColor: socialTokens.hero.menuOpenBorder, backgroundColor: socialTokens.hero.menuOpenSurface },
  iconGlyph: { color: '#ffffff', fontSize: socialTokens.identity.iconSize, lineHeight: 26 },
  /** `.ownerMenuBars{width:20px;gap:4px}` with three `b` of `height:2px;border-radius:2px`. */
  bars: { width: socialTokens.hero.barsWidth, gap: socialTokens.hero.barsGap },
  bar: { height: socialTokens.hero.barHeight, borderRadius: socialTokens.hero.barRadius, backgroundColor: socialTokens.hero.menuInk },
  /** The two columns: the words take what is left, the circle keeps its own size. */
  identity: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: socialTokens.identity.identityGap,
    paddingTop: socialTokens.identity.paddingTop,
  },
  words: { flex: 1, minWidth: 0, paddingTop: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  /** `.ownerPresence i{width:9px;height:9px;background:#39e58e;box-shadow:0 0 8px #39e58e}` */
  presence: { width: socialTokens.hero.presenceSize, justifyContent: 'center', marginRight: socialTokens.hero.presenceMarginEnd },
  presenceDot: {
    width: socialTokens.hero.presenceDot,
    height: socialTokens.hero.presenceDot,
    borderRadius: socialTokens.hero.presenceDot / 2,
    backgroundColor: socialTokens.hero.presenceOnline,
  },
  presenceDotAway: { backgroundColor: socialTokens.hero.presenceAway },
  handleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  /** `button.ownerVisibility{width:26px;height:26px;border-radius:9px}` — the sign, as a reading. */
  visibility: {
    width: socialTokens.hero.visibilitySize,
    height: socialTokens.hero.visibilitySize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: socialTokens.hero.visibilityRadius,
  },
  visibilityGlyph: { fontSize: socialTokens.hero.visibilityGlyphSize, color: socialTokens.hero.visibilityInk },
  name: {
    color: '#ffffff',
    fontSize: socialTokens.identity.nameSize,
    lineHeight: socialTokens.identity.nameSize * socialTokens.identity.lineHeightRatio,
    fontWeight: '700',
  },
  handle: { marginTop: 2, color: socialTokens.identity.statLabelInk, fontSize: socialTokens.identity.handleSize },
  /** The fixed counters: a row of equal aims, each one a number over its own word. */
  stats: { flexDirection: 'row', gap: socialTokens.identity.statGap, marginTop: socialTokens.identity.wordsTopGap + 4 },
  stat: { minWidth: 44, minHeight: socialTokens.identity.minTarget, justifyContent: 'center' },
  statPressed: { opacity: 0.7 },
  statCount: { color: socialTokens.identity.statCountInk, fontSize: socialTokens.identity.statCountSize, fontWeight: '700' },
  statLabel: { color: socialTokens.identity.statLabelInk, fontSize: socialTokens.identity.statLabelSize },
  /** The story ring: the accent while something is unseen, a quiet edge otherwise. */
  avatarRing: {
    padding: socialTokens.identity.storyRingWidth,
    borderRadius: (socialTokens.identity.avatarSize + socialTokens.identity.storyRingWidth * 2) / 2,
    borderWidth: socialTokens.identity.storyRingWidth,
    borderColor: socialTokens.identity.storyRingIdle,
  },
  avatarRingUnseen: { borderColor: socialTokens.identity.storyRingUnseen },
  avatar: {
    width: socialTokens.identity.avatarSize,
    height: socialTokens.identity.avatarSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: socialTokens.identity.avatarSize / 2,
    backgroundColor: '#090a0c',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: socialTokens.identity.avatarSize / 2 },
  avatarInitials: { color: '#ffffff', fontSize: 30, fontWeight: '600' },
  /** The row of buttons: the two wide ones share the width, the round entry keeps its 38dp. */
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: socialTokens.relations.buttonGap,
    marginTop: socialTokens.identity.buttonTopGap,
  },
  buttonFill: { flex: 1, minWidth: 0 },
});
