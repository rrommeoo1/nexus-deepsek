import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PostCard } from '../../components/PostCard';
import { ReelPage } from '../../components/ReelsReader';
import { SystemNavBand } from '../../components/SystemNavBand';
import { usePostImpression } from '../../lib/impressions';
import { nexusApi } from '../../lib/nexusApi';
import {
  profileArchive, walkAnchor, wallBands, wallPosts,
  type ArchivePost, type ContentReading, type ContentTab,
} from '../../lib/profileContent';
import { arrangementMap } from '../../lib/profileGrid';
import { hasVisualMedia, isAuthoredArticle, readsAsPage } from '../../lib/postPresentation';
import { POST_HEADER, postHeaderHeight, postPageTopInset } from '../../lib/postChrome';
import {
  READER_BAR, profileReaderBottomInset, readerBarHeight, readerDoorShown, readerPageTopInset,
} from '../../lib/readerBar';
import { folioRow } from '../../lib/textPage';
import type { ProfileResponse, SocialPost } from '../../lib/socialTypes';
import { editorial, editorialType } from '../../theme/editorial';
import { blackSilver } from '../../theme/blackSilver';

/**
 * The profile grid's door: one post, on the whole screen.
 *
 * This is not a second reader. It asks `GET /api/posts/:id` for the exact record that was tapped and
 * mounts the established full-screen composition: `ReelPage` for a picture or a clip, `PostCard` for
 * an authored article or a page of words. The same rail, comment sheet, reaction palette and payment
 * sheet therefore work here exactly as they do in the feed.
 *
 * When the grid that opened it also named its order (`profile`, `tab`, `reading`) and *which cell* was
 * pressed (`key`), this route draws the whole archive instead of one page: the same list the grid drew —
 * same tab, same reading, same owner arrangement — in a vertical pager, so a swipe up is the next post of
 * *this profile* rather than the next post of some other feed. The page is `ReelPage` or `PostCard` per
 * post, exactly as the single page was, and the pager only takes vertical swipes: a horizontal gesture
 * inside an authored page still belongs to the page that has pages of its own.
 *
 * The id and the cell key arrive as route parameters, so no "first item in the feed" fallback can open the
 * wrong post — and the page is found by that key (`walkAnchor`), never by a place the wall computed, because
 * this route fetches the archive again and the wall's places are facts about the payload it was drawn from.
 * A cell the archive no longer holds opens alone rather than opening its neighbour.
 * `router.back()` returns to the profile it came from, which the stack keeps mounted with its scroll
 * position, so the way back lands on the cell that was pressed.
 */
export default function PostReaderRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; profile?: string; tab?: string; reading?: string; key?: string }>();
  const pick = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value) ?? '';
  const id = Number(pick(params.id));
  const handle = pick(params.profile).trim();
  const tab = ((pick(params.tab) || 'flow') as ContentTab);
  const reading = ((pick(params.reading) || 'newest') as ContentReading);
  /**
   * Which cell of the wall was pressed, as the wall names it (`archiveKey`): `post-11` is the post itself and
   * `repost-41` is the share of it, two cells that carry the same `id` and can never be told apart by one.
   */
  const cellKey = pick(params.key).trim();
  /**
   * Whether a **profile** opened this reader.
   *
   * The wall sends `profile`, `tab`, `reading` and `key` when a cell is pressed (`ProfileTile`), and it is
   * that parameter — not a flag of our own, not a guess from the stack — that says where the page came
   * from. Everything round 32 changes hangs off this one number: the foot's door is the phone's own Back
   * here, the folio is printed in the paper the door gave back, and the system's controls get a plate of
   * metal to stand on. The composer's receipt (`/post/[id]` with an `id` alone) and every page of media
   * keep exactly what they had.
   */
  const profileOrigin = handle.length > 0;
  const walkMode = profileOrigin;

  const [post, setPost] = useState<SocialPost | null>(null);
  const [walk, setWalk] = useState<ArchivePost[] | null>(null);
  const [error, setError] = useState('');
  const [height, setHeight] = useState(0);
  const [muted, setMuted] = useState(true);
  const [at, setAt] = useState(0);
  /**
   * The page's reaction panel is open (round 42).
   *
   * The feed has stopped its pager for this since round 9 (`FeedScreen.scrollEnabled`) because the panel
   * is chosen by *dragging* along its row, and a native pager takes that drag before any JavaScript can
   * refuse it (`ReactionControl`'s own comment, 19 October 2026). This route — the walk a profile cell
   * opens, and the only surface search has for a post — never did: its `FlatList` kept turning under the
   * reader's thumb, so the same gesture that works in the feed lost the panel here. One flag, one rule,
   * both pagers.
   */
  const [paletteOpen, setPaletteOpen] = useState(false);
  /**
   * The page the pager opens on: the pressed cell's own place in the archive, found by `walkAnchor` when the
   * archive arrives — never a place the wall passed in. A drag, a pin, a deletion or a post written from
   * another device moves every place between the wall's fetch and this route's, and a place is then a number
   * about a list that no longer exists.
   */
  const [startIndex, setStartIndex] = useState(0);
  const listRef = useRef<FlatList<ArchivePost>>(null);

  const load = useCallback(async () => {
    if (!Number.isSafeInteger(id) || id < 1) {
      setError('Postarea cerută nu există.');
      return;
    }
    setError('');
    try {
      const answer = await nexusApi<{ ok: true; post: SocialPost }>(`/api/posts/${id}`);
      setPost(answer.post ?? null);
      if (!answer.post) setError('Postarea nu a putut fi citită.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Postarea nu a putut fi citită.');
    }
  }, [id]);

  /**
   * The list the grid drew, rebuilt from the same payload with the same rules (`profileContent` +
   * `lib/profileGrid`): the tab's own kind of post, the reading the tab was on, the owner's pins first
   * and the owner's arrangement inside that. A swipe therefore walks what the grid showed, in the order
   * it showed it, and not a neighbouring feed's idea of what comes next.
   *
   * The page it opens on is decided by the pressed *cell* (`walkAnchor`), not by the place that cell had on
   * the wall: this is a second fetch of the same archive, and the wall's number is only correct for the
   * payload the wall was drawn from. A cell this archive no longer holds is not a place to start a walk
   * from at all — the post that was pressed is then opened alone, below, so a tap can never land on the
   * post that took its place.
   */
  const loadWalk = useCallback(async () => {
    if (!handle) return;
    setError('');
    try {
      const answer = await nexusApi<ProfileResponse>(`/api/profiles/${encodeURIComponent(handle)}?persona=social`);
      const archive = profileArchive(answer);
      /**
       * The wall's own bands, from the wall's own function (`wallBands`) and the archive's own places
       * (`arrangementMap(archive.posts)`) — the same two calls `ProfileScreen` makes. The arrangement used to
       * be read from the payload's raw `posts`, which do not hold the reposts, so a repost had no place at all
       * and sorted above every placed cell: the reader opened on the right post and then walked the wall
       * backwards. The cells of the wall are `wallPosts(bands)` — the reply cards are not posts to open.
       */
      const list: ArchivePost[] = wallPosts(
        wallBands(archive, tab, reading, { arrangement: arrangementMap(archive.posts) }),
      );
      const anchor = walkAnchor(list, { key: cellKey, id });
      /** An archive that does not hold the pressed cell is no pager for it: `walk` stays null and one page draws. */
      setWalk(anchor >= 0 ? list : null);
      if (anchor >= 0) {
        setStartIndex(anchor);
        setAt(anchor);
        return;
      }
      if (list.length) void load();
      else setError('Profilul nu are postări de citit.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Postarea nu a putut fi citită.');
    }
  }, [cellKey, handle, id, load, reading, tab]);

  useEffect(() => {
    if (walkMode) void loadWalk();
    else void load();
  }, [walkMode, loadWalk, load]);

  const list = walk ?? [];
  const current = walkMode ? list[Math.min(at, Math.max(0, list.length - 1))] ?? null : post;
  /** The page a reader is looking at is the reading the wall counts (`lib/impressions.ts`). */
  usePostImpression(current?.id);

  /**
   * Back is one decision with two honest answers.
   *
   * Inside the app the stack is the truth — the profile the reader came from is still mounted under this
   * route, with its scroll position — so `router.back()` is the only correct return. A route opened from
   * a link has no stack behind it, and sending that reader to the feed (what the old fallback did) leaves
   * the profile they came to read; when the walk knows its profile, that profile is the answer, and only
   * an entry that knows nothing at all falls back to the feed.
   */
  const close = () => {
    if (router.canGoBack()) { router.back(); return; }
    /**
     * No stack behind this route: a link opened it. Sending that reader to the feed — what the old
     * fallback did — loses the profile they came to read, so the profile the walk belongs to is the
     * answer, replaced rather than pushed (a pushed profile would make Back return to this page again).
     */
    if (handle) { router.replace({ pathname: '/profile/[handle]', params: { handle } }); return; }
    router.replace('/');
  };

  /**
   * The name and the handle the header prints.
   *
   * Round 31 (owner, 31 October 2026): the header is the *chrome of a route*, and it is drawn only over
   * the pages that carry no head of their own — a photograph, a clip, a quote. A page of words prints its
   * author on its own paper (the canvas's `wordPage`), so drawing the header over it printed the same
   * name and the same `@handle` twice, one above the other, on the very screen the owner opened to read.
   */
  const headerTitle = String(current?.author?.display_name || current?.author?.handle || '').trim();
  const headerMeta = String(current?.author?.handle || '').trim();
  /**
   * Whether the page on screen is a page of words: the one composition that needs no chrome above it and
   * keeps its one door at its foot (`lib/readerBar.ts`).
   */
  const wordPage = current ? readsAsPage(current) : false;
  /**
   * Whether the page on screen is a page of **media** — a picture, a clip, a carousel — the composition
   * that has carried its own head since round 41 (round 31 left it out).
   *
   * A profile reel opened here used to print the author twice: once in the route's 52dp chrome and once
   * in the composition itself. The owner read the top band as „un al doilea antet, cu același nume" and
   * asked for the reel to be read exactly like a text post opened from the same profile. `ReelPage` now
   * takes `layout="post"` (the author at the top of the frame, the caption at the foot, the relation
   * door beside the name), so the page carries its own head and the route draws no chrome over it —
   * the same rule round 31 gave a page of words.
   */
  const mediaPage = current ? hasVisualMedia(current) && !isAuthoredArticle(current) : false;
  /**
   * Does the page print an author's head of its own? If it does, the route must not print a second one:
   * a page of words prints it on its paper, a page of media prints it over the picture, and only a quote
   * — a conversation on a dark plate, whose panels carry other people's names — has none, so only a
   * quote keeps the route's chrome (and with it the one door that reads it as a page of the walk).
   */
  const ownsHead = (entry: SocialPost) => readsAsPage(entry) || (hasVisualMedia(entry) && !isAuthoredArticle(entry));
  const pageOwnHead = current ? ownsHead(current) : false;
  /**
   * Whether this page still prints the foot's door (round 32).
   *
   * A page of words opened from a profile does not: the phone's own Back stands in the navigation bar
   * under it, returns to the same profile, and a second disc on the paper is the redundancy the owner
   * asked to remove. The rule itself lives in `lib/readerBar.ts::readerDoorShown`, together with its one
   * exception — an entry with no app history behind it (a `nexusdev://post/<id>` link), whose system Back
   * would leave the app, so the door stays and still leads to the profile the walk belongs to.
   */
  const showReaderDoor = readerDoorShown({
    wordPage,
    profileOrigin,
    canGoBack: router.canGoBack(),
  });
  /**
   * Whether the phone's own navigation controls need a ground under them: a page opened from a profile.
   *
   * Round 32 asked this for a page of words, where the paper is cream and the system's glyphs are drawn
   * light by the app's own default (`app.json`, `style: "light"`). Round 41 asks it for the reel beside it
   * too: the owner's „footer gri" is this plate, and a profile reel that ended on bare video while the
   * post above it ended on metal was the one visible difference left between the two after the headers
   * were unified. `SystemNavBand` paints the device's inset in Mercury's silver, asks for dark glyphs, and
   * hands both back when it unmounts.
   */
  const systemNavPlate = profileOrigin;
  /**
   * A development-only reading of the route, so a phone can be asked whether it was opened as one page or
   * as the profile's own order. `__DEV__` is false in a release build.
   *
   * It is declared *below* the foot's decisions (round 32) because it reports them, and a `const` read by
   * an effect's dependency list on the same render is read before it exists.
   */
  useEffect(() => {
    if (!__DEV__) return;
    (globalThis as unknown as Record<string, unknown>).__POST_ROUTE = {
      walkMode, handle, tab, reading, at, count: list.length, id: current?.id ?? null, startIndex, cell: cellKey,
      /** Round 32: where the page came from, and what its foot prints because of it. */
      profileOrigin, wordPage, mediaPage, head: pageOwnHead, door: showReaderDoor, navPlate: systemNavPlate,
    };
  }, [walkMode, handle, tab, reading, at, list.length, current?.id, startIndex, cellKey, profileOrigin, wordPage, mediaPage, pageOwnHead, showReaderDoor, systemNavPlate]);
  /**
   * The insets a page is handed, decided by what kind of page it is — and, for a page of words, by where it
   * was opened from.
   *
   * A page of words starts in the notification band — no header stands above it, and `postPageTopInset`
   * would print the paper 52dp too low, leaving an empty strip of cream under the status clock. It ends
   * above the foot's door (`readerBarHeight`), which is the room the door stands in, so the last line of
   * the article and the Back disc can never meet. A picture, a clip or a quote keeps the header's band at
   * the top and the device's own inset at the foot, exactly as before.
   *
   * Round 32: a page of words opened **from a profile** has no door (`readerDoorShown`), so it stops
   * reserving the door's 48dp band and ends `PROFILE_READER_FOOT.air` above the device's inset instead
   * (`profileReaderBottomInset`). That single number is what carries the counter, the last line of the
   * article and the rail's presses down the page; the device's inset itself is never borrowed, because the
   * plate of metal that carries the system's own controls (`SystemNavBand`) stands in exactly that room.
   */
  const topInsetFor = (entry: SocialPost) => (
    ownsHead(entry) ? readerPageTopInset(insets.top) : postPageTopInset(insets.top)
  );
  const bottomInsetFor = (entry: SocialPost) => {
    /**
     * Round 41: a page opened from a **profile** keeps the same foot whatever it carries — a text post
     * and a reel both end `PROFILE_READER_FOOT.air` above the device's inset, in the room the plate of
     * metal (`SystemNavBand`) no longer needs — because the two are now read as the same page seen twice.
     * A media page anywhere else keeps the device's own inset; a page of words anywhere else keeps the
     * band its foot door stands in.
     */
    if (profileOrigin) return profileReaderBottomInset(insets.bottom);
    if (!readsAsPage(entry)) return insets.bottom;
    return readerBarHeight(insets.bottom);
  };
  /**
   * The row the folio is printed in: the page's own on every surface, the profile's shorter row on a page
   * opened from a profile. A page of media never prints a folio, so the number is read and ignored there.
   */
  const folioFor = (entry: SocialPost) => folioRow(readsAsPage(entry) && profileOrigin);

  const page = (entry: SocialPost, active: boolean) => (
    hasVisualMedia(entry) && !isAuthoredArticle(entry) ? (
      <ReelPage
        post={entry}
        height={height}
        /**
         * No tab bar on this route, and no header above the page any more (round 41): the reel prints its
         * own head, exactly as the page of words beside it does, so the foot is the device's, plus the
         * strip of air a profile page keeps above it (`profileReaderBottomInset`).
         */
        overlayBottom={0}
        topInset={topInsetFor(entry)}
        bottomInset={bottomInsetFor(entry)}
        layout="post"
        follow
        active={active}
        muted={muted}
        onToggleMute={() => setMuted((value) => !value)}
        onPanelChange={setPaletteOpen}
      />
    ) : (
      <PostCard
        post={entry}
        height={height}
        topInset={topInsetFor(entry)}
        bottomInset={bottomInsetFor(entry)}
        folio={folioFor(entry)}
        active={active}
        onPanelChange={setPaletteOpen}
      />
    )
  );

  return (
    <View style={styles.screen} onLayout={(event) => setHeight(event.nativeEvent.layout.height)}>
      {!current && !error ? (
        <View style={styles.center}>
          <ActivityIndicator color={editorial.leaf} />
          <Text style={styles.stateText}>Se deschide postarea…</Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reîncearcă"
            onPress={() => { if (walkMode) void loadWalk(); else void load(); }}
            style={styles.retry}
          >
            <Text style={styles.retryText}>Reîncearcă</Text>
          </Pressable>
        </View>
      ) : null}
      {walkMode && height > 0 && list.length ? (
        <FlatList
          ref={listRef}
          data={list}
          keyExtractor={(entry, index) => `${Number(entry.id)}-${index}`}
          /**
           * One page per screen, vertically: a swipe up is the next post of this archive and a swipe down
           * the previous one. `pagingEnabled` keeps a page from standing half-way, and the inner reader
           * keeps its own horizontal swipes (an authored page has pages of its own).
           */
          pagingEnabled
          /**
           * Round 42: the walk stops while a reaction panel is open, exactly as the feed does. The panel is
           * dragged along its own row, and this pager would otherwise take that drag at the native level
           * before JavaScript could refuse it — the reason the same gesture worked on a text page in the
           * feed and failed on the same reel opened from a profile.
           */
          scrollEnabled={!paletteOpen}
          showsVerticalScrollIndicator={false}
          initialScrollIndex={Math.min(startIndex, list.length - 1)}
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
          /**
           * Round 42: the walk renders pages the way the feed does — one at a time, a couple of pages
           * ahead — and not the twenty-one a `FlatList` mounts by default.
           *
           * Every page of media creates a real player (`PostMedia`'s `useVideoPlayer`), and a decoder is
           * the largest thing this app holds. A walk of twenty-one pages therefore held up to twenty-one
           * video players: on the owner's phone the app aborted with `OutOfMemoryError` inside
           * `MediaCodecRenderer` a few minutes after a reel was opened from a profile (tombstones of
           * 09:53 and 10:28, 31 October 2026). The numbers are the feed's own (`FeedScreen`), because the
           * walk and the feed are the same page seen twice.
           */
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          onLayout={() => {
            const first = Math.min(startIndex, list.length - 1);
            setAt(first);
            if (first > 0) listRef.current?.scrollToIndex({ index: first, animated: false });
          }}
          onMomentumScrollEnd={(event) => {
            const next = Math.round(event.nativeEvent.contentOffset.y / Math.max(1, height));
            setAt(Math.max(0, Math.min(list.length - 1, next)));
          }}
          renderItem={({ item, index }) => (
            <View style={{ height }}>{page(item, index === at)}</View>
          )}
        />
      ) : null}
      {!walkMode && current && height > 0 ? page(current, true) : null}
      {/**
        * A walk that could not find the pressed cell leaves `walk` null (`loadWalk`): the post that was
        * pressed then opens as one page, which is what the tap promised. It never opens the post that took
        * its place in the archive.
        */}
      {walkMode && !walk && current && height > 0 ? page(current, true) : null}

      {/**
        * The header of the route — the chrome of a page that carries no head of its own.
        *
        * Round 30 (owner, 30 October 2026) gave it a real row instead of two things floating over the
        * page: the header owns `postHeaderHeight(insets.top)` (the status clock plus a 52dp band) and the
        * page under it starts at exactly that number (`postPageTopInset`), so no name can be printed
        * under a button at any font scale or cutout.
        *
        * Round 31 (owner, 31 October 2026) takes it off the one page that never needed it. A page of
        * words prints its author's head on its own paper (`readsAsPage`), so this row printed the same
        * name and the same `@handle` twice, one above the other — and its counter, `1/22`, counted the
        * *posts of the walk*, not the pages of the document, on a screen whose own foot said `1/3`. A page
        * of words therefore gets no header at all, the walk keeps no post counter anywhere (what the
        * route promises is a post; the only number a reader needs is the page's own folio), and the way
        * out moves to the foot, where the page has reserved it (`lib/readerBar.ts`).
        */}
      {/**
       * ... and round 41 gives the same answer to the page of **media** beside it: a profile reel now
       * prints the author's head over the picture (`ReelPage layout="post"`), so this row was printing the
       * same name twice there as well. Only a page that carries no head of its own — a quote — keeps the
       * chrome.
       */}
      {!pageOwnHead ? (
        <View
          accessibilityRole="header"
          style={[styles.header, { paddingTop: insets.top, height: postHeaderHeight(insets.top) }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={handle ? `Înapoi la profilul lui @${handle}` : 'Înapoi'}
            accessibilityHint="Revine la ecranul de unde ai deschis postarea."
            onPress={close}
            hitSlop={8}
            style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
          >
            <View style={styles.backDisc}>
              <Text style={styles.backGlyph}>‹</Text>
            </View>
          </Pressable>
          <View style={styles.headerWords}>
            <Text style={styles.headerName} numberOfLines={1}>
              {headerTitle || 'Postare'}
            </Text>
            {headerMeta && headerMeta !== headerTitle ? (
              <Text style={styles.headerMeta} numberOfLines={1}>{`@${headerMeta}`}</Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {/**
        * The foot of a page of words: the one door back to the profile, in the band the page gave up for it.
        *
        * The page is told about the band *before* it is drawn (`readerBarHeight` reaches `PostCard` as its
        * bottom inset), so the room is reserved paper and not paper covered afterwards: the last line of
        * the article ends above it, the rail's five presses climb by it, and the folio keeps its own row
        * above both. The bar itself paints nothing — the cream under it is the page's own paper — so the
        * door reads as a control printed on the page, not as a bar of chrome hung under it. It is the same
        * `close` the header pressed: history first, then the profile the walk belongs to, then the feed.
        *
        * Round 32: a page opened from a profile prints no door at all (`readerDoorShown`) — the phone's own
        * Back is that door, and the band it stood in goes back to the page. A page opened from the
        * composer's receipt, and a linked entry with no history behind it, keep it.
        */}
      {showReaderDoor ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.readerBar,
            { height: readerBarHeight(insets.bottom), paddingBottom: insets.bottom, paddingLeft: READER_BAR.inline },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={handle ? `Înapoi la profilul lui @${handle}` : 'Înapoi'}
            accessibilityHint="Revine la ecranul de unde ai deschis postarea."
            onPress={close}
            hitSlop={8}
            style={({ pressed }) => [styles.readerDoor, pressed && styles.backPressed]}
          >
            <View style={styles.readerDisc}>
              <Text allowFontScaling={false} style={styles.readerGlyph}>‹</Text>
            </View>
          </Pressable>
        </View>
      ) : null}

      {/**
        * The phone's own navigation controls, on a plate of metal (round 32).
        *
        * The reader is edge to edge, so Android draws Back, Home and Overview *over* the page — and on a
        * page of words that page is cream, while the app asks the system for light glyphs (`app.json`,
        * `style: "light"`, which is right on every dark screen in the product). White on cream is the
        * owner's „abia se văd". This plate is the device's inset exactly, in Mercury's silver, with dark
        * glyphs asked for while it is mounted and the app's own default restored when it unmounts — it is
        * drawn here, for this one screen, and no other surface of the app can see it.
        *
        * It is mounted *after* the page and the door, so it covers the last inset of whatever they painted;
        * `pointerEvents: none` inside the component keeps the system's own buttons untouchable by React.
        */}
      {systemNavPlate ? <SystemNavBand height={insets.bottom} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: editorial.fieldDeep },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  stateText: { color: editorial.inkMuted, fontSize: 13 },
  errorText: { color: editorial.ink, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  retry: {
    minHeight: 44, justifyContent: 'center', paddingHorizontal: 18,
    borderRadius: 14, borderWidth: 1, borderColor: editorial.hairline,
  },
  retryText: { color: editorial.ink, fontSize: 13, fontWeight: '700' },
  /**
   * The route's own header: a full-width band under the status clock, its own charcoal over whatever the
   * page draws, one hairline at its foot. `row` and `flex: 1` on the words are what make the layout hold
   * at every width — the Back disc keeps its 44dp and the name takes what is left, on one line, with an
   * honest ellipsis. It is drawn only over a page that carries no head of its own (`!wordPage`).
   */
  header: {
    position: 'absolute', left: 0, right: 0, top: 0, zIndex: 20,
    flexDirection: 'row', alignItems: 'center', gap: POST_HEADER.gap,
    paddingHorizontal: POST_HEADER.inline,
    backgroundColor: 'rgba(8,10,13,0.82)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: editorial.hairlineSoft,
  },
  /** The Back target: the whole 44dp is the press; the disc inside it is the drawing. */
  back: { width: POST_HEADER.button, height: POST_HEADER.button, alignItems: 'center', justifyContent: 'center' },
  backPressed: { opacity: 0.72 },
  backDisc: {
    width: POST_HEADER.disc, height: POST_HEADER.disc, borderRadius: POST_HEADER.disc / 2,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(8,10,13,0.62)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)',
  },
  backGlyph: { color: '#ffffff', fontSize: 24, lineHeight: 26, marginTop: -2 },
  headerWords: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 1 },
  headerName: {
    color: editorial.ink, fontFamily: editorialType.serif, fontSize: POST_HEADER.titleSize, fontWeight: '700',
  },
  headerMeta: { color: editorial.inkMuted, fontSize: 11 },
  /**
   * The foot of a page of words (`lib/readerBar.ts`): a band the page gave up before it was drawn, one
   * door at its left margin, nothing else.
   *
   * It paints no plate at all — the cream under it is the page's own paper, and a bar of chrome hung under
   * a page of paper was the "footer" the owner rejected (20 October 2026). `alignItems: 'center'` centres
   * the door in the band *above* the device's inset: the inset is part of the bar's height, not of the
   * room the door stands in.
   */
  readerBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20,
    flexDirection: 'row', alignItems: 'center',
  },
  /** The Back target of the foot: 44dp of press, the disc drawn inside it. */
  readerDoor: { width: READER_BAR.button, height: READER_BAR.button, alignItems: 'center', justifyContent: 'center' },
  /**
   * The disc: matte black on cream with one hairline of metal — the identity's own door, and the page's
   * only piece of chrome. A silver plate would have read as a *plate of the identity* instead of a way out
   * of the page, and on cream it would have measured 1.5:1 against its own paper.
   */
  readerDisc: {
    width: READER_BAR.disc, height: READER_BAR.disc, borderRadius: READER_BAR.disc / 2,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: blackSilver.matteBlack,
    borderWidth: 1, borderColor: blackSilver.edge,
  },
  readerGlyph: {
    color: blackSilver.bright, fontSize: READER_BAR.glyph, lineHeight: READER_BAR.glyph + 2, marginTop: -2,
  },
});

