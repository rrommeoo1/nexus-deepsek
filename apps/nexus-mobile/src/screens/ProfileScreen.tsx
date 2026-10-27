import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, PanResponder, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { nexusApi } from '../lib/nexusApi';
import { subscribeImpressionDelivery } from '../lib/impressions';
import { rememberPayload, subscribeRelations, useRelation } from '../lib/relations';
import type { ProfileResponse, ProfileView } from '../lib/socialTypes';
import {
  CONTENT_FILTERS, CONTENT_READING_LABELS, CONTENT_TAB_GLYPHS, CONTENT_TAB_LABELS, CONTENT_TAB_ORDER,
  archiveBands, archiveKey, archiveNodes, contentOfTab, orderArchive, profileArchive, profileMomentShelf, tileBands,
  type ArchiveBand, type ArchiveNode, type ArchivePost, type ContentReading, type ContentTab,
} from '../lib/profileContent';
import { useNavReserve } from '../components/AppNav';
import { ProfileBand } from '../components/ProfileBand';
import { ProfileEditSheet } from '../components/ProfileEditSheet';
import { ProfileEmptyState } from '../components/ProfileEmptyState';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileMenuSheet } from '../components/ProfileMenuSheet';
import type { ProfileSwitchOption } from '../lib/profileMenu';
import { ProfileMomentsShelf } from '../components/ProfileMomentsShelf';
import { ProfileSharedReplyCard } from '../components/ProfileWhisperCard';
import { ProfileTile } from '../components/ProfileTile';
import {
  GRID_COLUMNS, GRID_GAP, arrangementMap, arrangementRank, gridSlot, gridTarget, isOwnPost, manageActions,
  moveWithin, nearestPlaceable, optimisticArrangement, orderEntries, pinnedCount as countPinned, placeableIds,
  tileId, tileSize,
  type Arrangement,
} from '../lib/profileGrid';
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
  const navReserve = useNavReserve();
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
  /**
   * The owner's arrangement of the grid (`lib/profileGrid.ts`).
   *
   * `managing` is the second mode of the grid a press held for a second opens; `arranged` is the order a
   * drag has just made, held here only until the server answers (`POST /api/posts/order`), because the
   * payload's own `grid_position` is what reopens the profile in that order. `gesture` is the finger
   * while it is moving a cell: which cell, by how much, and which place it is standing over.
   */
  const [managing, setManaging] = useState(false);
  const [arranged, setArranged] = useState<number[] | null>(null);
  const [manageBusy, setManageBusy] = useState('');
  const [manageNote, setManageNote] = useState('');
  const [gesture, setGesture] = useState<{ index: number; dx: number; dy: number; target: number } | null>(null);
  /** The post whose deletion is waiting for its confirmation, and the one being pinned or removed. */
  const [confirmDelete, setConfirmDelete] = useState<ArchivePost | null>(null);
  const [gridWidth, setGridWidth] = useState(0);
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

  /**
   * The same read without the pull and without the spinner: `data` is replaced while the scroller stays
   * mounted, so the wall keeps its place, and a silent read that fails leaves the last good surface alone
   * instead of turning it into an error.
   */
  const reloadQuietly = useCallback(() => {
    nexusApi<ProfileResponse>(address)
      .then((result) => { rememberPayload(result); setData(result); setError(''); })
      .catch(() => { /* a background read is not an error the reader has to meet */ });
  }, [address]);

  /**
   * A view that landed while this wall was open moves the count on it: the phone reports its own readings
   * (`lib/impressions.ts`), and once the server has accepted them the tiles are read again. The profile stays
   * mounted under the `/post/[id]` reader, so the number is already right when that door closes.
   */
  useEffect(() => subscribeImpressionDelivery(() => reloadQuietly()), [reloadQuietly]);

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
   * Flow weaves every node into one timeline by its reading — the tiles in rows of three, the words as
   * cards between them — and the collection tabs read one kind in rows of three. `moments` is not a kind
   * of post at all — its shelf answers in the panel above these bands.
   *
   * The collection tabs read *every* node of their tab as a tile (`tileBands`), the words included: a
   * text post on the Șoapte tab is the same 9:16 typographic miniature the grid draws for it, because a
   * thumbnail that takes the width of the screen is not a thumbnail.
   */
  /**
   * The places the grid draws with: the payload's own `grid_position`, or the order a drag has just made
   * while that order is travelling to the server. `arranged` is an overlay and never a rewrite of what
   * the server said, so a refused write costs the overlay and nothing else.
   */
  const arrangement = useMemo<Arrangement>(
    () => (arranged ? optimisticArrangement(arranged) : arrangementMap(archive.posts)),
    [archive.posts, arranged],
  );
  const bands = useMemo<ArchiveBand[] | null>(() => {
    if (tab === 'moments') return null;
    const reading = readings[tab];
    /** A whisper is a post: on the Flow it is a 9:16 cell like every other one, never a full-width card. */
    if (tab === 'flow') return whisperTiles(archiveBands(archiveNodes(archive, reading, { hoistPins: true, arrangement })));
    return tileBands(nodesOfTab(archive.posts, tab, reading, arrangement), { columns: socialTokens.archive.gridColumns });
  }, [archive, readings, tab, arrangement]);
  /**
   * `const hoistPins = kind === 'reels' || kind === 'shots'` (`profile-experience.js:518`) became "every
   * tab" on the phone (owner's rule, 26 October 2026): a pin shown as a thin ring while the pinned post
   * stayed third was a control whose promise the next row contradicted. The ring stays, and the post it
   * marks now really is the first thing the grid draws.
   */
  const hoistPins = true;

  /**
   * The posts the grid draws, in the order it draws them: the bands flattened, minus the shared replies
   * (a reply is a comment that was shared, not a post, so it can be neither placed, pinned nor deleted).
   * The arrangement and the pager both read this one list, so what the owner drags is exactly what a
   * vertical swipe walks.
   */
  const gridPosts = useMemo<ArchivePost[]>(() => {
    const list: ArchivePost[] = [];
    for (const band of bands ?? []) {
      if (band.kind === 'tiles') list.push(...band.posts);
      else if (band.kind === 'whisper') list.push(band.post);
    }
    return list;
  }, [bands]);
  /** Where a cell stands in that list: a repost and the post it carries are two different cells. */
  const placeOf = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    gridPosts.forEach((post, index) => { map[archiveKey(post)] = index; });
    return map;
  }, [gridPosts]);
  /** Only the owner arranges, pins or deletes an archive, and the server refuses anyone else anyway. */
  const isOwner = data?.profile?.is_self === true;
  /**
   * The account whose work the grid may rearrange. A reposted cell shows somebody else's post, and the
   * server refuses both a place and a deletion for it (`repo.setProfileGridOrder`, `repo.withdrawPost`),
   * so ownership is a number the screen compares rather than a wish it acts on.
   */
  const ownerId = Number(data?.profile?.user_id) || null;
  const pinnedNow = useMemo(() => countPinned(gridPosts), [gridPosts]);
  const geometry = useMemo(() => tileSize(gridWidth, GRID_COLUMNS, GRID_GAP), [gridWidth]);

  const endManaging = useCallback(() => {
    setManaging(false);
    setGesture(null);
    setManageBusy('');
    setManageNote('');
    setArranged(null);
  }, []);

  /** The scroller and the place the grid starts in it, so opening the arrangement can show it. */
  const scrollRef = useRef<ScrollView>(null);
  const gridTop = useRef(0);
  const revealGrid = useCallback(() => {
    /** The bar and the first rows: the mode is about the wall, so the wall is what the phone shows. */
    scrollRef.current?.scrollTo({ y: Math.max(0, gridTop.current - 132), animated: true });
  }, []);

  const beginManaging = useCallback(() => {
    setManageNote('');
    setManageBusy('');
    setArranged(null);
    setManaging(true);
    /** A long press on a cell already shows the wall; the bar's own button may be pressed from above it. */
    setTimeout(revealGrid, 0);
  }, [revealGrid]);

  /**
   * The order the finger made, written down (`POST /api/posts/order`). The grid already draws it: the
   * optimistic list is what the screen reads until the answer lands, and the payload's own
   * `grid_position` is what reopens the profile in that order. A refusal takes the overlay back and
   * says why, and it never touches an existing post.
   *
   * The body names every tile: a post tile as `{ post_id }`, a repost tile as `{ share_id }`. Both live in
   * one arrangement, which is what lets an original and a repost interleave.
   */
  const persistOrder = useCallback(async (ids: number[]) => {
    const entries = orderEntries(ids);
    if (!entries.length) {
      setArranged(null);
      setManageNote('Grila poate fi aranjată doar din postările tale.');
      return;
    }
    setManageBusy('Se salvează ordinea…');
    setManageNote('');
    try {
      await nexusApi<{ ok: true; order: number[]; entries?: unknown[] }>('/api/posts/order', {
        method: 'POST',
        body: JSON.stringify({ order: entries }),
      });
      setManageNote('Ordinea a fost salvată.');
      setArranged(null);
      reloadQuietly();
    } catch (cause) {
      setArranged(null);
      setManageNote(describe(cause));
    } finally {
      setManageBusy('');
    }
  }, [describe, reloadQuietly]);

  const togglePin = useCallback(async (post: ArchivePost, next: boolean) => {
    setManageBusy(next ? 'Se fixează…' : 'Se scoate din fixate…');
    setManageNote('');
    try {
      await nexusApi(`/api/posts/${Number(post.id)}/pin`, { method: 'POST', body: JSON.stringify({ pinned: next }) });
      setManageNote(next ? 'Postarea stă acum în fruntea grilei.' : 'Postarea nu mai este fixată.');
      reloadQuietly();
    } catch (cause) {
      setManageNote(describe(cause));
    } finally {
      setManageBusy('');
    }
  }, [describe, reloadQuietly]);

  /**
   * Deleting is the only action here that removes something, so it waits for its own confirmation, and
   * the confirmation is the only caller: `Cancel` closes the sheet and changes nothing at all.
   */
  const deleteConfirmed = useCallback(async (post: ArchivePost) => {
    setConfirmDelete(null);
    setManageBusy('Se șterge…');
    setManageNote('');
    try {
      await nexusApi(`/api/posts/${Number(post.id)}`, { method: 'DELETE' });
      setManageNote('Postarea a fost ștearsă.');
      reloadQuietly();
    } catch (cause) {
      setManageNote(describe(cause));
    } finally {
      setManageBusy('');
    }
  }, [describe, reloadQuietly]);

  /** The finger while it moves a cell: the tile follows it, and the place it stands over is lit. */
  const finger = useRef<{ index: number; dx: number; dy: number; target: number } | null>(null);
  const responders = useMemo(() => gridPosts.map((_, index) => PanResponder.create({
    /** A tap is a tap: the cell only takes the gesture once the finger has actually moved. */
    onMoveShouldSetPanResponder: (_event, move) => Math.abs(move.dx) > 4 || Math.abs(move.dy) > 4,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_event, move) => {
      if (!geometry.width) return;
      /**
       * The indicator is shown on the nearest place the server will actually accept: every cell of the
       * owner's archive is arrangeable (their posts and their reposts alike), so this is normally the cell
       * under the finger.
       */
      const nearest = gridTarget({ index, dx: move.dx, dy: move.dy, count: gridPosts.length, geometry });
      const target = nearestPlaceable(gridPosts, nearest, ownerId);
      finger.current = { index, dx: move.dx, dy: move.dy, target };
      setGesture(finger.current);
    },
    onPanResponderRelease: () => {
      const state = finger.current;
      finger.current = null;
      setGesture(null);
      if (!state || state.target === state.index) return;
      // The list moves by tile identity, not by post id: a repost and the post it carries are two cells.
      const reordered = moveWithin(gridPosts.map(tileId), state.index, state.target);
      setArranged(reordered);
      /** Only the cells this account owns are named: the route refuses the rest, whole. */
      void persistOrder(placeableIds(
        reordered.map((id) => gridPosts.find((post) => tileId(post) === id) ?? { id }),
        ownerId,
      ));
    },
    onPanResponderTerminate: () => {
      finger.current = null;
      setGesture(null);
    },
  })), [geometry, gridPosts, ownerId, persistOrder]);

  /** The rows the arranged grid draws, in threes, exactly as the archive draws them. */
  const manageRows = useMemo<ArchivePost[][]>(() => {
    const rows: ArchivePost[][] = [];
    for (let index = 0; index < gridPosts.length; index += GRID_COLUMNS) rows.push(gridPosts.slice(index, index + GRID_COLUMNS));
    return rows;
  }, [gridPosts]);

  /**
   * A development-only reading of the grid, so a phone can be asked what it actually drew instead of
   * being believed. It is the same numbers the cells were laid out from (`gridSlot`, `tileSize`) plus the
   * server's own view counts and places, and it is written on every render of the region. `__DEV__` is
   * false in a release build, so nothing ships with it.
   */
  useEffect(() => {
    if (!__DEV__) return;
    const registry = globalThis as unknown as Record<string, unknown>;
    registry.__PROFILE_GRID = {
      handle,
      tab,
      reading: readings[tab],
      managing,
      busy: manageBusy,
      note: manageNote,
      isOwner,
      width: gridWidth,
      geometry,
      posts: gridPosts.map((post, index) => ({
        index,
        id: Number(post.id),
        // The identity a drag writes: positive for a post, negative for a repost share. The device probe
        // reads this to tell an original from a repost without guessing from the caption.
        tile: tileId(post),
        kind: post.__repost ? 'repost' : 'post',
        share_id: Number(post.__repost?.id) || null,
        key: archiveKey(post),
        place: arrangementRank(post, arrangement),
        pinned: Number(post.pinned_at || 0) > 0,
        own: isOwnPost(post, ownerId),
        media: post.media_list?.[0]?.kind ?? post.media?.kind ?? 'text',
        viewers: Number(post.view_stats?.viewers || 0),
        slot: geometry.width ? gridSlot(index, geometry) : null,
      })),
      gesture,
    };
  }, [handle, tab, readings, managing, manageBusy, manageNote, isOwner, ownerId, gridWidth, geometry, gridPosts, arrangement, gesture]);

  if (attempted !== key && !data) {
    return <View style={styles.screen}><ActivityIndicator color={socialTokens.colors.white} style={styles.loader} /></View>;
  }

  const profile = data?.profile ?? null;
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
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: navReserve + 18 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={socialTokens.colors.white} />}
      scrollEnabled={!managing}
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
          <>
            {/**
             * The owner's own door into the grid: a press held for a second opens the arrangement, and
             * this bar is where that mode says so, what it offers and what became of the last action. It
             * is never drawn on somebody else's profile.
             */}
            {isOwner ? (
              <View style={styles.manageBar} accessibilityLabel="Aranjarea grilei">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={managing ? 'Gata, păstrează ordinea' : 'Aranjează grila'}
                  onPress={managing ? endManaging : beginManaging}
                  style={[styles.manageBarButton, managing && styles.manageBarButtonOn]}
                >
                  <Text style={[styles.manageBarText, managing && styles.manageBarTextOn]}>
                    {managing ? 'Gata' : 'Aranjează grila'}
                  </Text>
                </Pressable>
                <Text style={styles.manageBarHint} accessibilityLiveRegion="polite">
                  {manageBusy || manageNote || (managing
                    ? 'Ține apăsată o postare și trage-o. 📌 o fixează în frunte, 🗑️ o șterge.'
                    : 'Ține apăsată o postare pentru a o muta, a o fixa sau a o șterge.')}
                </Text>
              </View>
            ) : null}
            {managing ? (
              <View
                style={[styles.grid, styles.manageGrid]}
                onLayout={(event) => { gridTop.current = event.nativeEvent.layout.y; setGridWidth(event.nativeEvent.layout.width); }}
                accessibilityLabel="Grila de aranjat"
              >
                {manageRows.map((row, rowIndex) => (
                  <View key={`manage-row-${rowIndex}`} style={styles.tileRow}>
                    {row.map((post) => {
                      const index = placeOf[archiveKey(post)] ?? 0;
                      const lifted = gesture !== null && gesture.index === index;
                      const actions = manageActions(post, { isOwner, pinnedCount: pinnedNow, ownerId });
                      const pinnedHere = Number(post.pinned_at || 0) > 0;
                      return (
                        <ProfileTile
                          key={archiveKey(post)}
                          post={post}
                          pinnedFirst={pinnedHere}
                          manage={{
                            pinned: pinnedHere,
                            canPin: actions.canPin,
                            canDelete: actions.canDelete,
                            pinWord: actions.pinWord,
                            busy: Boolean(manageBusy),
                            onPin: () => { void togglePin(post, !pinnedHere); },
                            onDelete: () => setConfirmDelete(post),
                          }}
                          lift={lifted && gesture ? { dx: gesture.dx, dy: gesture.dy } : null}
                          /**
                           * A repost is draggable like the owner's own posts: what moves is the owner's entry
                           * on their own grid (`post_shares.grid_position`), never the post inside it.
                           */
                          handlers={actions.canPlace ? responders[index]?.panHandlers : undefined}
                        />
                      );
                    })}
                    {Array.from({ length: Math.max(0, GRID_COLUMNS - row.length) }).map((_, spacer) => (
                      <View key={`manage-spacer-${spacer}`} accessible={false} style={styles.tileSpacer} />
                    ))}
                  </View>
                ))}
                {/**
                 * The place under the finger, lit: two points of accent on the edge the cell would take.
                 * It never takes a touch and it says its own place to a screen reader, so the drop is
                 * legible with and without a picture of the screen.
                 */}
                {gesture && geometry.width ? (
                  <View
                    pointerEvents="none"
                    accessibilityLabel={`Poziția ${gesture.target + 1} din ${gridPosts.length}`}
                    style={[styles.dropLine, {
                      left: gridSlot(gesture.target, geometry).left + geometry.width - 2,
                      top: gridSlot(gesture.target, geometry).top,
                      height: geometry.height,
                    }]}
                  />
                ) : null}
              </View>
            ) : (
          /**
           * The two containers of the region, each with the web's own measurements: the Flow is a grid of
           * three columns whose rows hold tiles and whose cards take the whole width
           * (`.ownerFlowStream{grid-template-columns:repeat(3,1fr);gap:2px;background:#060b11}`), and every
           * other tab is that grid without the cards (`.ownerPostGrid`), the words included.
           *
           * The width is measured here because the arrangement's arithmetic needs the cell it really got:
           * `lib/profileGrid.ts` turns the width into one 9:16 cell and the place a drag is standing over,
           * so the indicator the finger sees and the index the drop writes are the same number.
           */
          <View
            style={tab === 'flow' ? styles.flowStream : styles.grid}
            onLayout={(event) => { gridTop.current = event.nativeEvent.layout.y; setGridWidth(event.nativeEvent.layout.width); }}
          >
            {bands.map((band) => (band.kind === 'tiles' ? (
              <View key={band.key} style={styles.tileRow}>
                {band.posts.map((post) => (
                  <ProfileTile
                    key={archiveKey(post)}
                    post={post}
                    pinnedFirst={hoistPins && Number(post.pinned_at || 0) > 0}
                    door={{ handle: String(profile?.handle || handle), tab, reading: readings[tab], index: placeOf[archiveKey(post)] ?? 0 }}
                    onManage={isOwner ? beginManaging : undefined}
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
              /**
               * A whisper can still reach this row from a stream that was built elsewhere: it is drawn as
               * the grid's own cell, exactly like a text post on the Șoapte tab — never as a banner.
               */
              <View key={band.key} style={styles.tileRow}>
                <ProfileTile
                  post={band.post}
                  door={{ handle: String(profile?.handle || handle), tab, reading: readings[tab], index: placeOf[archiveKey(band.post)] ?? 0 }}
                  onManage={isOwner ? beginManaging : undefined}
                />
                {Array.from({ length: Math.max(0, socialTokens.archive.gridColumns - 1) }).map((_, index) => (
                  <View key={`spacer-${index}`} accessible={false} style={styles.tileSpacer} />
                ))}
              </View>
            ) : (
              <ProfileSharedReplyCard key={band.key} reply={band.reply} woven={tab === 'flow'} />
            )))}
          </View>
            )}
          </>
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
    {/**
     * Deleting is the only action of this screen that removes something, so it asks first. `Anulează`
     * closes the sheet and touches nothing at all; `Șterge` withdraws this one post, and the server
     * accepts it only from the account that wrote it (`DELETE /api/posts/:id`, `repo.deletePost`).
     */}
    <Modal visible={confirmDelete !== null} transparent animationType="fade" onRequestClose={() => setConfirmDelete(null)}>
      <View style={styles.confirmBackdrop}>
        <View style={styles.confirmCard} accessibilityLabel="Confirmarea ștergerii">
          <Text style={styles.confirmTitle}>Ștergi postarea?</Text>
          <Text style={styles.confirmDetail}>
            {confirmDelete
              ? `Postarea ${Number(confirmDelete.id)} dispare din profil și din flux. Nu poate fi recuperată.`
              : ''}
          </Text>
          <View style={styles.confirmRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Anulează ștergerea"
              onPress={() => setConfirmDelete(null)}
              style={[styles.confirmButton, styles.confirmCancel]}
            >
              <Text style={styles.confirmCancelText}>Anulează</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Șterge postarea ${confirmDelete ? Number(confirmDelete.id) : ''}`}
              onPress={() => { if (confirmDelete) void deleteConfirmed(confirmDelete); }}
              style={[styles.confirmButton, styles.confirmDelete]}
            >
              <Text style={styles.confirmDeleteText}>Șterge</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>

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
        monetize: onMonetize,
        share: onShare ? onShare : shareProfile,
        wallet: onWallet,
        settings: onSettings,
        newPost: onNewPost,
        income: onIncome,
        spending: onSpending,
        notifications: onNotifications,
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
function nodesOfTab(posts: ArchivePost[], tab: ContentTab, reading: ContentReading, arrangement?: Arrangement | null): ArchiveNode[] {
  const content = contentOfTab(orderArchive(posts, reading, { hoistPins: true, arrangement }), tab);
  return [
    ...content.tiles.map((post): ArchiveNode => ({ key: archiveKey(post), kind: 'tile', post })),
    ...content.whispers.map((post): ArchiveNode => ({ key: archiveKey(post), kind: 'whisper', post })),
  ];
}

/**
 * The Flow draws a whisper as a full-width card; a *profile* reads its posts as cells. This gathers the
 * whispers of a stream into rows of three 9:16 cells and leaves every other band where it was, so the Flow
 * is the same wall of miniatures the collection tabs draw — text posts included. The band builder itself
 * (`archiveBands`) is untouched, so the web-parity suite still reads the same buckets.
 */
function whisperTiles(bands: ArchiveBand[]): ArchiveBand[] {
  const columns = Math.max(1, socialTokens.archive.gridColumns);
  /**
   * The wall is filled first and the cards follow it.
   *
   * A card (a shared reply) used to flush the row it interrupted, which left a row of one or two cells
   * and two empty thirds beside it - the "unexplained gap" the owner saw on the phone. The cells of the
   * Flow are therefore gathered by their own order across the cards and cut into full rows of three; the
   * cards keep their own order and stand after the wall, where they have the width they were drawn for.
   */
  const posts: ArchivePost[] = [];
  const cards: ArchiveBand[] = [];
  for (const band of bands) {
    if (band.kind === 'tiles') posts.push(...band.posts);
    else if (band.kind === 'whisper') posts.push(band.post);
    else cards.push(band);
  }
  const rows: ArchiveBand[] = [];
  for (let index = 0; index < posts.length; index += columns) {
    const slice = posts.slice(index, index + columns);
    rows.push({ key: `whisper-row-${archiveKey(slice[0])}`, kind: 'tiles', posts: slice });
  }
  return [...rows, ...cards];
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
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
   * The content region under the tabs, in the web's own two shapes:
   *
   *   `.ownerFlowStream{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;background:#060b11}` — the
   *   Flow, whose rows of tiles hold the cards that were woven between them at their own margins;
   *   `.ownerPostGrid{...;min-height:210px}` — the same grid for Reels, Fotografii and Șoapte, tall
   *   enough to be a region even when it is nearly empty.
   *
   * The whisper list (`.ownerWhisperList{display:grid;gap:10px;padding:12px 12px 0}`) is gone from this
   * screen with the full-width card a text post used to take: the words are tiles on every tab that is
   * not the Flow (`tileBands`), and the Flow still prints them as cards inside its own stream.
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
  tileSpacer: { flexGrow: 1, flexBasis: 0, aspectRatio: socialTokens.archive.tileAspect },
  /**
   * The owner's bar above the grid: one button and one line that says what the mode offers, what it is
   * doing and what became of the last action. It sits on the archive's own surface, so the grid still
   * starts where it started.
   */
  manageBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: socialTokens.archive.gridSurface, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1d2b34',
  },
  manageBarButton: {
    minHeight: 44, justifyContent: 'center', paddingHorizontal: 14,
    borderWidth: 1, borderColor: socialTokens.colors.markBorder, borderRadius: 14,
  },
  manageBarButtonOn: { borderColor: socialTokens.archive.tilePinnedFirstEdge, backgroundColor: '#0d2a2c' },
  manageBarText: { color: socialTokens.colors.white, fontSize: 13, fontWeight: '700' },
  manageBarTextOn: { color: '#dff9f6' },
  manageBarHint: { flexShrink: 1, color: socialTokens.colors.muted, fontSize: 12, lineHeight: 17 },
  /** The arranged grid: the archive's own three columns, with room under the last row for a lifted cell. */
  manageGrid: { paddingBottom: socialTokens.archive.gridGap },
  /**
   * The place under the finger: a 2dp rule the height of a cell, on the edge the dragged cell would
   * take. It is the insertion indicator, and it is drawn where `gridSlot` says the target stands, so
   * what the eye sees and what the drop does are the same number.
   */
  dropLine: {
    position: 'absolute', width: 3, borderRadius: 2,
    backgroundColor: socialTokens.archive.tilePinnedFirstEdge,
  },
  confirmBackdrop: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24,
    backgroundColor: 'rgba(3,6,9,0.72)',
  },
  confirmCard: {
    width: '100%', maxWidth: 360, gap: 12, padding: 18, borderRadius: 20,
    backgroundColor: '#0b151d', borderWidth: 1, borderColor: '#26343d',
  },
  confirmTitle: { color: socialTokens.colors.white, fontSize: 17, fontWeight: '800' },
  confirmDetail: { color: socialTokens.colors.muted, fontSize: 13, lineHeight: 19 },
  confirmRow: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  confirmButton: { minHeight: 44, minWidth: 104, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 14, borderWidth: 1 },
  confirmCancel: { borderColor: '#26343d', backgroundColor: '#0f1a23' },
  confirmCancelText: { color: '#9fb2bb', fontSize: 13, fontWeight: '700' },
  confirmDelete: { borderColor: 'rgba(255,90,110,0.6)', backgroundColor: '#2a0f14' },
  confirmDeleteText: { color: '#ff8a9b', fontSize: 13, fontWeight: '800' },
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

