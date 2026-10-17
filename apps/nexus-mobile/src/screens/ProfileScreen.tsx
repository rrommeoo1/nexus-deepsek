import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { nexusApi } from '../lib/nexusApi';
import { rememberPayload, subscribeRelations, useRelation } from '../lib/relations';
import type { ProfileResponse, ProfileView } from '../lib/socialTypes';
import {
  CONTENT_FILTERS, CONTENT_READING_LABELS, CONTENT_TAB_GLYPHS, CONTENT_TAB_LABELS, CONTENT_TAB_ORDER,
  archiveBands, archiveKey, archiveNodes, contentOfTab, orderArchive, profileArchive, profileMomentShelf,
  type ArchiveBand, type ArchiveNode, type ArchivePost, type ContentReading, type ContentTab,
} from '../lib/profileContent';
import { ProfileBand } from '../components/ProfileBand';
import { ProfileEditSheet } from '../components/ProfileEditSheet';
import { ProfileEmptyState } from '../components/ProfileEmptyState';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileMenuSheet } from '../components/ProfileMenuSheet';
import type { ProfileSwitchOption } from '../lib/profileMenu';
import { ProfileMomentsShelf } from '../components/ProfileMomentsShelf';
import { ProfileSharedReplyCard, ProfileWhisperCard } from '../components/ProfileWhisperCard';
import { ProfileTile } from '../components/ProfileTile';
import type { TickerDoor } from '../components/ProfileTicker';
import { socialTokens } from '../theme/social';

/**
 * The five content tabs, as the web prints them: `CONTENT_TAB_GLYPHS` of `profile-experience.js:16`
 * (`{ flow:'≡', reels:'▶', shots:'▦', whispers:'❝', moments:'✦' }`), one sign per tab, and the word for each
 * one lives only in its label (`CONTENT_TAB_LABELS`, the `profile.tab*` names of the ro-RO bundle).
 */
const TABS = CONTENT_TAB_ORDER.map((id) => ({ id, label: CONTENT_TAB_LABELS[id], glyph: CONTENT_TAB_GLYPHS[id] }));

/** `CONTENT_FILTERS` (`profile-experience.js:22`) with the labels `profile.filterNewest|Popular|Relevant`. */
const READINGS = CONTENT_FILTERS.map((id) => ({ id, label: CONTENT_READING_LABELS[id] }));

type TabId = ContentTab;
type ReadingId = ContentReading;

/**
 * `profilePresenceDot` of the web (`profile-experience.js:61-65`): a presence is a dot and three states. A
 * record whose presence this reader may not see prints nothing at all, one whose owner is there now is
 * `online`, and one whose owner is away is `away`. The words live in the dot's accessible name and never
 * in the row, because a name line that also prints "Online" spends its one row on two facts.
 */
export function profilePresence(profile?: ProfileView | null): 'online' | 'away' | '' {
  const presence = profile?.presence;
  if (presence?.visible !== true) return '';
  return presence.online === true ? 'online' : 'away';
}

/** `profile.presenceOnline` / `profile.presenceAway` of the ro-RO bundle: the two words the dot is read as. */
export const PRESENCE_WORDS: Record<'online' | 'away', string> = {
  online: 'Online',
  away: 'Nu este online acum',
};

/**
 * The word the lock stands for. The web prints the label of `visibilityLabelKey` (`onboarding.js:33`), and
 * that key falls back to the public one for a value it does not recognise — so an unknown setting reads as
 * `Public` while the chip still shows the closed padlock (`profile-experience.js:180-185`).
 */
export function visibilityWord(visibility?: string | null): string {
  if (visibility === 'friends') return 'Prieteni';
  if (visibility === 'private') return 'Privat';
  return 'Public';
}

/** `profileMenu.open` of the ro-RO bundle, in the one place the sheet reads it (`lib/profileMenu.ts`). */
export { PROFILE_MENU_WORD } from '../lib/profileMenu';


/**
 * The owner profile, drawn with the values of profile-experience.css (.ownerCover 72px,
 * .ownerAvatar 78px with the monochrome Social border, .ownerHero on black) and filled from the
 * endpoint the web reads (`GET /api/profiles/:handle?persona=social`). The five content tabs are real
 * filters over the payload the server returns, so no tab is a button that pretends to do something.
 */
export function ProfileScreen({ handle, reloadKey = 0, onDoor, onBack, onShare, onMessage, onMonetize, onWallet, onIncome, onSpending, onNewPost, onNotifications, onSettings, onLogout, onSwitchProfile, profiles = [], version = '', build = '', viewerUserId, onRelationChanged }: {
  handle: string;
  reloadKey?: number;
  onDoor?: (door: TickerDoor, arg: string) => void;
  /** A visitor's header opens with the arrow back to the screen the reader came from. */
  onBack?: () => void;
  /** `Distribuie profilul`. Without one the screen falls back to the platform's own share sheet. */
  onShare?: () => void;
  /** `Mesaj Jungle Book`: the inbox owns conversations, and only a host that can open one hands this in. */
  onMessage?: () => void;
  /**
   * The owner's own doors, handed in by the shell that owns those screens. They are the rows of the
   * profile menu (`lib/profileMenu.ts`), which the three bars open; a door without a screen behind it is
   * not drawn (`profileMenuFor`), so this screen never paints a row that opens nothing.
   */
  onMonetize?: () => void;
  onWallet?: () => void;
  /** The two halves of the ledger, opened on their own tab of the wallet. */
  onIncome?: () => void;
  onSpending?: () => void;
  /** `Postare nouă`: the camera, the same door the bottom bar's own mark opens. */
  onNewPost?: () => void;
  /** The account's activity, which is the inbox's own activity box (`ActivityCenter`). */
  onNotifications?: () => void;
  onSettings?: () => void;
  /** `Ieși din cont`: the drawer's old last row, now the menu's own. */
  onLogout?: () => void;
  /**
   * The five profiles, as chips at the top of the menu (`ProfileSwitchOption`), and the switch itself.
   * Without the handler the chips are not drawn.
   */
  profiles?: ProfileSwitchOption[];
  onSwitchProfile?: (persona: string) => void;
  /** The two foot lines the drawer used to print: app version + backend, and the JS build stamp. */
  version?: string;
  build?: string;
  /** Who is reading: the relation store needs it to recognise the reader's own record. */
  viewerUserId?: number | null;
  /** Anything that depends on a relation reloads through here after a change lands (`MIGRATION.md` §19.4). */
  onRelationChanged?: () => void;
}) {
  const address = `/api/profiles/${encodeURIComponent(handle)}?persona=social`;
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [tab, setTab] = useState<TabId>('flow');
  /** The web keeps one reading per tab (`readings` map of profile-experience.js:169). */
  const [readings, setReadings] = useState<Record<TabId, ReadingId>>({ flow: 'newest', reels: 'newest', shots: 'newest', whispers: 'newest', moments: 'newest' });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  /** The editor the pencil opens: the whole header at once (`ProfileEditSheet`). */
  const [editOpen, setEditOpen] = useState(false);
  /** The profile menu of the three bars: the owner's doors, never the drawer (`ProfileMenuSheet`). */
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const [attempted, setAttempted] = useState('');
  const key = `${address}#${reloadKey}#${pending}`;

  const describe = useCallback((cause: unknown) => (cause instanceof Error ? cause.message : 'Conexiunea nu este disponibilă.'), []);

  useEffect(() => {
    let cancelled = false;
    nexusApi<ProfileResponse>(address)
      .then((result) => {
        if (cancelled) return;
        /** The header's own payload feeds the one relation store (`lib/relations.ts`). */
        rememberPayload(result);
        setData(result);
        setError('');
        setAttempted(key);
      })
      .catch((cause) => {
        if (cancelled) return;
        setError(describe(cause));
        setAttempted(key);
      });
    return () => { cancelled = true; };
  }, [address, describe, key]);

  /**
   * A relation this screen shows is the store's, not the screen's: `RelationButton` reads the same record as
   * the feed, a list row and a conversation, so a change here is already a change there.
   */
  const relation = useRelation(data?.profile?.user_id);

  /**
   * After a change lands, whatever depends on a relation is reloaded by the host — the feed, the story rail,
   * the lists, the inbox — without this screen throwing away the reader's place, because the host's reload
   * keeps this scroller mounted.
   */
  useEffect(() => subscribeRelations(() => onRelationChanged?.()), [onRelationChanged]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    nexusApi<ProfileResponse>(address)
      .then((result) => { rememberPayload(result); setData(result); setError(''); })
      .catch((cause) => setError(describe(cause)))
      .finally(() => setRefreshing(false));
  }, [address, describe]);

  const onRetry = useCallback(() => {
    setError('');
    setAttempted('');
    setPending((value) => value + 1);
  }, []);

  /**
   * `profileArchive` (`profile-experience.js:186-224`): the posts, the reposts and the shared replies, read
   * the way the web reads them. The posts and the reposts are one archive — a repost is stamped with when it
   * was shared, so the two sort by one rule and nothing is counted twice — and the shared replies are the
   * second kind of internal share, kept beside the whispers because they are not posts.
   */
  const archive = useMemo(() => profileArchive(data), [data]);
  /** The shelf of the Momente tab: the saved-story albums, or the profile's active stories when there are none. */
  const shelf = useMemo(() => profileMomentShelf(data?.profile, data?.stories), [data]);
  /**
   * The one region under the tabs (`syncContentTab` + `applyOrder`, `profile-experience.js:516-555`): the
   * Flow weaves every node into one timeline by its reading, the two grid tabs read one kind in rows of
   * three, the whisper reads the words as cards, and a tab with nothing in it answers with its own state.
   * `moments` is not a kind of post at all — its shelf answers in the panel above these bands.
   */
  const bands = useMemo<ArchiveBand[] | null>(() => {
    if (tab === 'moments') return null;
    const reading = readings[tab];
    const nodes = tab === 'flow' ? archiveNodes(archive, reading) : nodesOfTab(archive.posts, tab, reading);
    return archiveBands(nodes);
  }, [archive, readings, tab]);
  /**
   * The gallery a tile hands the full-screen reader: the media of the tab the reader is on, in the order it
   * shows them — the `posts` list the web walks in `onOpenPost` (`app.js:9313`).
   */
  const tileGallery = useMemo(
    () => (bands ?? []).flatMap((band) => (band.kind === 'tiles' ? band.posts : [])),
    [bands],
  );
  /** `const hoistPins = kind === 'reels' || kind === 'shots'` (`profile-experience.js:518`). */
  const hoistPins = tab === 'reels' || tab === 'shots';

  if (attempted !== key && !data) {
    return <View style={styles.screen}><ActivityIndicator color={socialTokens.colors.white} style={styles.loader} /></View>;
  }

  const profile = data?.profile ?? null;
  /**
   * The identity a whisper card's head prints: the profile's own name, handle and portrait, which is what
   * the web's `whisperCards` reuse from its own hero (`profile-experience.js:188-204`, `:276-278`).
   */
  const whisperAuthor = { name: profile?.name, handle: profile?.handle || handle, avatar: profile?.avatar ?? null };
  const readingLabel = READINGS.find((entry) => entry.id === readings[tab])?.label || READINGS[0].label;
  /** `const presenceTone = profilePresenceDot(profile)` (`profile-experience.js:206`). */
  const presenceTone = profilePresence(profile);
  /**
   * `visibilityBadge` (`profile-experience.js:180-185`): the owner reads the sign of their own setting, and a
   * visitor reads it only while the record is not public, because a badge that says "public" on somebody
   * else's name line is noise while a lock is information.
   *
   * One honest difference, and it is written down rather than hidden: on the web the owner's chip is the
   * control that opens the visibility panel, and this app has no such panel yet, so the phone prints the sign
   * as a reading whose word is its accessible name. A chip that opened nothing would be a door painted on a
   * wall, which is the one thing this header refuses to draw.
   */
  const visibilityLocked = Boolean(profile?.visibility) && profile?.visibility !== 'public';
  const visibilityWordText = visibilityWord(profile?.visibility);
  const visibilitySign: 'locked' | 'open' | '' = profile?.is_self || visibilityLocked ? (visibilityLocked ? 'locked' : 'open') : '';

  /** Any active story of this record this reader has not seen: the ring the big circle wears (`viewed_by_me`). */
  const hasUnseenStory = (data?.stories ?? []).some((story) => Number(story.user_id) === Number(profile?.user_id) && story.viewed_by_me !== true);

  /**
   * `Distribuie profilul`: the platform's own share sheet with the app's own route for this record
   * (`expo-linking`), because the web has no per-profile address to copy — there is no `shareProfile` or
   * profile URL in `apps/nexus-web/public` (`MIGRATION.md` §19.1).
   */
  const shareProfile = () => {
    const who = String(profile?.handle || handle || '').trim();
    if (!who) return;
    const link = Linking.createURL(`/profile/${encodeURIComponent(who)}`);
    void Share.share({ message: `@${who} · ${link}` }).catch(() => undefined);
  };

  return (
    <>
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={socialTokens.colors.white} />}
    >
      {/**
       * The header the owner asked for (`docs/PARITY-MATRIX.md`): no cover band, the identity a block of two
       * columns, the big circle on the right, and the row of full-width buttons under it. Everything it prints
       * is a value the payload really carries, and its relation button is the store's own record.
       */}
      <ProfileHeader
        profile={profile}
        relation={relation}
        viewerUserId={viewerUserId}
        hasUnseenStory={hasUnseenStory}
        presence={presenceTone}
        visibility={visibilitySign}
        visibilityWord={visibilityWordText}
        onBack={onBack}
        onShare={onShare ? onShare : shareProfile}
        onEditProfile={() => setEditOpen(true)}
        onProfileMenu={() => setMenuOpen(true)}
        onMonetize={onMonetize}
        menuOpen={menuOpen}
        onMessage={onMessage}
        onDoor={onDoor}
      />

      {/**
       * The band, directly under the header's buttons (`MIGRATION.md` §20.1). It carries the description,
       * the place, the month the account was created, the age and the kind of account — the readings the
       * header no longer prints — on one line that drifts leftwards in a loop, and it opens the sheet with
       * the same five facts when it is touched. With nothing to carry it draws nothing at all.
       */}
      {profile ? <ProfileBand profile={profile} /> : null}

      {/**
       * `.ownerTabsRegion` + `nav.ownerContentTabs[role=tablist][aria-label="Conținut profil"]`: the bar
       * holds five icons and ends in the arrow that opens the readings of the tab the reader is on
       * (`profile-experience.js:443-453`).
       */}
      <View style={styles.tabsBlock}>
        <View style={styles.tabsRegion}>
          <View accessibilityRole="tablist" accessibilityLabel="Conținut profil" style={styles.tabs}>
            {TABS.map((entry) => (
              <Pressable
                key={entry.id}
                accessibilityRole="tab"
                accessibilityLabel={entry.label}
                accessibilityState={{ selected: tab === entry.id }}
                onPress={() => { setTab(entry.id); setFiltersOpen(false); }}
                style={[styles.tab, tab === entry.id && styles.tabOn]}
              >
                <Text accessible={false} style={[styles.tabGlyph, tab === entry.id && styles.tabGlyphOn]}>{entry.glyph}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Mod de citire: ${readingLabel}`}
            accessibilityState={{ expanded: filtersOpen }}
            onPress={() => setFiltersOpen((open) => !open)}
            style={styles.filtersToggle}
          >
            <Text style={[styles.filtersToggleGlyph, readings[tab] !== 'newest' && styles.filtersToggleOn]}>▾</Text>
          </Pressable>
        </View>

        {filtersOpen ? (
          <View accessibilityLabel="Filtre" style={styles.filters}>
            {READINGS.map((reading) => (
              <Pressable
                key={reading.id}
                accessibilityRole="button"
                accessibilityLabel={reading.label}
                accessibilityState={{ selected: readings[tab] === reading.id }}
                onPress={() => { setReadings((previous) => ({ ...previous, [tab]: reading.id })); setFiltersOpen(false); }}
                style={[styles.filterChip, readings[tab] === reading.id && styles.filterChipOn]}
              >
                <Text style={[styles.filterChipText, readings[tab] === reading.id && styles.filterChipTextOn]}>{reading.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>Profilul nu poate fi încărcat</Text>
          <Text style={styles.errorDetail}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
            <Text style={styles.retryText}>Reîncearcă</Text>
          </Pressable>
        </View>
      ) : null}

      {data?.locked && !error ? (
        <Text style={styles.locked}>
          {`@${profile?.handle || handle} are profilul restricționat (${profile?.visibility || 'privat'}).`}
        </Text>
      ) : null}

      {!error && !data?.locked ? (
        tab === 'moments' ? (
          /**
           * The shelf answers the Momente tab, and the web draws it even when it holds nothing: the panel's
           * header is there, its row is empty, and the tab's own empty state follows it
           * (`docs/web-ref/profile/tab-4.dom.json`: `.ownerMomentsPanel` at y=315 and the empty block at
           * y=418, both in view).
           */
          <>
            <ProfileMomentsShelf shelf={shelf} />
            {shelf.tiles.length ? null : <ProfileEmptyState tab="moments" />}
          </>
        ) : bands && bands.length ? (
          /**
           * The three containers of the region, each with the web's own measurements: the Flow is a grid of
           * three columns whose rows hold tiles and whose cards take the whole width
           * (`.ownerFlowStream{grid-template-columns:repeat(3,1fr);gap:2px;background:#060b11}`), the two
           * grid tabs are that grid without the cards (`.ownerPostGrid`), and the whisper is the list of
           * cards (`.ownerWhisperList{gap:10px;padding:12px 12px 0}`).
           */
          <View style={tab === 'flow' ? styles.flowStream : tab === 'whispers' ? styles.whisperList : styles.grid}>
            {bands.map((band) => (band.kind === 'tiles' ? (
              <View key={band.key} style={styles.tileRow}>
                {band.posts.map((post) => (
                  <ProfileTile
                    key={archiveKey(post)}
                    post={post}
                    gallery={tileGallery}
                    pinnedFirst={hoistPins && Number(post.pinned_at || 0) > 0}
                  />
                ))}
                {/**
                 * `grid-template-columns:repeat(3,1fr)` keeps a tile at a third of its row even when the row
                 * is not full: the cells it did not fill are held open, so a last row of two tiles is never
                 * stretched across half the width each.
                 */}
                {Array.from({ length: Math.max(0, socialTokens.archive.gridColumns - band.posts.length) }).map((_, index) => (
                  <View key={`spacer-${index}`} accessible={false} style={styles.tileSpacer} />
                ))}
              </View>
            ) : band.kind === 'whisper' ? (
              <ProfileWhisperCard key={band.key} post={band.post} author={whisperAuthor} woven={tab === 'flow'} />
            ) : (
              <ProfileSharedReplyCard key={band.key} reply={band.reply} woven={tab === 'flow'} />
            )))}
          </View>
        ) : (
          <ProfileEmptyState tab={tab} />
        )
      ) : null}
    </ScrollView>

    {/**
     * The editor itself: one card, every field of the header, one save. What it hands back is merged into
     * the profile this screen already holds - the name line, the band, the cover and the disc show the
     * stored values at once, with nothing to refresh by hand.
     */}
    <ProfileEditSheet
      visible={editOpen && Boolean(profile?.is_self)}
      profile={profile}
      persona={String(profile?.persona ?? 'social')}
      onClose={() => setEditOpen(false)}
      onSaved={(patch) => setData((previous) => (previous ? { ...previous, profile: { ...previous.profile, ...patch } } : previous))}
    />

    {/**
     * The profile menu (`lib/profileMenu.ts`): the owner's doors in the owner's order, one row each. It is a
     * sheet over the screen and not a dropdown inside the header — the measured reason is in
     * `ProfileMenuSheet`. The drawer is not here: its own words never enter this list.
     */}
    <ProfileMenuSheet
      open={menuOpen}
      onClose={() => setMenuOpen(false)}
      profiles={profiles}
      activePersona={String(profile?.persona ?? '')}
      onSwitchProfile={onSwitchProfile}
      version={version}
      build={build}
      handlers={{
        newPost: onNewPost,
        wallet: onWallet,
        income: onIncome,
        spending: onSpending,
        notifications: onNotifications,
        monetize: onMonetize,
        settings: onSettings,
        logout: onLogout,
      }}
    />
    </>
  );
}

/**
 * The nodes a collection tab reads (`syncContentTab` + `applyOrder`, `profile-experience.js:516-555`): its
 * own kind of post, ordered by the reader's reading with the owner's pins hoisted first because a tab that
 * reads as a collection is an arrangement the owner made (`profile-experience.js:503-512`, `:518`). A tab
 * whose kind is `text` reads the whispers, a tab whose kind is `video` or `image` reads the tiles, and both
 * come back as the node list the Flow uses, so the two regions share one vocabulary.
 */
function nodesOfTab(posts: ArchivePost[], tab: ContentTab, reading: ContentReading): ArchiveNode[] {
  const content = contentOfTab(orderArchive(posts, reading, { hoistPins: true }), tab);
  return [
    ...content.tiles.map((post): ArchiveNode => ({ key: archiveKey(post), kind: 'tile', post })),
    ...content.whispers.map((post): ArchiveNode => ({ key: archiveKey(post), kind: 'whisper', post })),
  ];
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  content: { paddingBottom: 18 },
  loader: { marginTop: 80 },
  /**
   * The cover band, the 78dp disc, the presence dot and the chip of the web hero used to be described here.
   * The owner moved the whole identity into `ProfileHeader` — no cover, a ~92dp circle, the three counters in
   * a fixed row, the button row under it, and the band below (`MIGRATION.md` §19.2, §20) — so those rules live
   * there and this screen keeps only the tab bar and the content region. The band's own row left with the
   * duplication it caused: the header prints every reading the band used to carry.
   */
  sub: { color: '#9eacb5', fontSize: 12, lineHeight: 16 },
  /**
   * The bar and the arrow are one region (`.ownerTabsRegion`), and the readings open anchored under them.
   * The region carries no margin of its own: it begins where the header ends, and on the web the band's row
   * ends exactly where the tabs begin — `ownerTickerRow` bottom 268 = `ownerTabsRegion` top 268 in
   * `docs/web-ref/profile/own-0.dom.json`.
   */
  tabsBlock: { position: 'relative', backgroundColor: '#000000' },
  tabsRegion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.16)',
  },
  /** `.ownerContentTabs{display:grid;grid-template-columns:repeat(5,1fr);background:#000}` */
  tabs: { flex: 1, minWidth: 0, flexDirection: 'row' },
  /** `.ownerContentTabs button{min-height:46px;border-bottom:2px solid transparent;color:rgba(255,255,255,.62)}` */
  tab: {
    minHeight: 46,
    flexGrow: 1,
    flexBasis: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  /** `.ownerContentTabs button[aria-selected=true]{border-color:#fff;color:#fff}` */
  tabOn: { borderBottomColor: '#ffffff' },
  /** `.ownerContentTabs button i{font-style:normal;font-size:17px;line-height:1}` — the tab is an icon. */
  tabGlyph: { color: 'rgba(255,255,255,0.62)', fontSize: 17, lineHeight: 19 },
  tabGlyphOn: { color: '#ffffff' },
  /** `.ownerFiltersToggle{flex:0 0 44px;min-height:46px;color:#9fb2bb;font-size:13px}` */
  filtersToggle: { flexGrow: 0, flexBasis: 44, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  filtersToggleGlyph: { color: '#9fb2bb', fontSize: 13, lineHeight: 15 },
  /** `[aria-expanded=true],[data-reading=popular|relevant]{color:#67f5ed}` */
  filtersToggleOn: { color: '#67f5ed' },
  /** `.ownerContentFilters{top:100%;left:8px;flex-direction:column;gap:6px;min-width:190px;padding:8px;border:1px solid #26343d;border-radius:16px;background:#0b151d}` */
  filters: {
    position: 'absolute',
    zIndex: 6,
    top: '100%',
    right: 8,
    gap: 6,
    minWidth: 190,
    padding: 8,
    borderWidth: 1,
    borderColor: '#26343d',
    borderRadius: 16,
    backgroundColor: '#0b151d',
  },
  /** `.ownerContentFilters button{min-height:38px;padding:0 12px;border:1px solid #26343d;border-radius:14px;background:#0f1a23;color:#9fb2bb;font-size:12.5px}` */
  filterChip: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#26343d',
    borderRadius: 14,
    backgroundColor: '#0f1a23',
  },
  /** `button[aria-pressed=true]{border-color:#2fbdb3;background:#0d2a2c;color:#dff9f6}` */
  filterChipOn: { borderColor: '#2fbdb3', backgroundColor: '#0d2a2c' },
  filterChipText: { color: '#9fb2bb', fontSize: 12.5 },
  filterChipTextOn: { color: '#dff9f6' },
  /**
   * The content region under the tabs, in the web's own three shapes:
   *
   *   `.ownerFlowStream{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;background:#060b11}` — the
   *   Flow, whose rows of tiles hold the cards that were woven between them at their own margins;
   *   `.ownerPostGrid{...;min-height:210px}` — the same grid for Reels and Fotografii, tall enough to be a
   *   region even when it is nearly empty;
   *   `.ownerWhisperList{display:grid;gap:10px;padding:12px 12px 0;background:#060b11}` — the words.
   *
   * Cells are laid out as a row of equal thirds rather than with `flexGrow`, because the cells the last row
   * did not fill must stay open: a spacer keeps the third a tile would have taken.
   */
  flowStream: { backgroundColor: socialTokens.archive.gridSurface, gap: socialTokens.archive.gridGap },
  grid: {
    minHeight: socialTokens.archive.gridMinHeight,
    backgroundColor: socialTokens.archive.gridSurface,
    gap: socialTokens.archive.gridGap,
  },
  tileRow: { flexDirection: 'row', gap: socialTokens.archive.gridGap },
  tileSpacer: { flexGrow: 1, flexBasis: 0, aspectRatio: 1 },
  whisperList: {
    gap: socialTokens.archive.listGap,
    paddingTop: socialTokens.archive.listPaddingTop,
    paddingHorizontal: socialTokens.archive.listPaddingHorizontal,
    backgroundColor: socialTokens.archive.gridSurface,
  },
  locked: { color: socialTokens.colors.muted, fontSize: 13, lineHeight: 19, padding: 18 },
  errorBox: { alignItems: 'center', gap: 10, paddingVertical: 40, paddingHorizontal: 24 },
  error: { color: socialTokens.colors.text, fontSize: 15, fontWeight: '700' },
  errorDetail: { color: socialTokens.colors.muted, fontSize: 13, textAlign: 'center' },
  retry: {
    minHeight: 44, justifyContent: 'center', paddingHorizontal: 16,
    borderWidth: 1, borderColor: socialTokens.colors.markBorder, borderRadius: 14,
  },
  retryText: { color: socialTokens.colors.white, fontWeight: '700', fontSize: 13 },
});

