import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { PostRail, PostDistributePanel, RAIL_FOOT } from './PostRail';
import { SolidViewerIcon } from './SolidViewerIcon';
import { PostDecorations } from './PostDecorations';
import { PostCanvas, PostStage } from './PostCanvas';
import { PostSheets } from './PostSheets';
import { RelationButton } from './RelationButton';
import { useRelation } from '../lib/relations';
import { usePostEngagement } from '../lib/postEngagement';
import {
  audioAttributionFor, mediaKindOf, postMediaItems,
  type MediaItem, type SocialPost,
} from '../lib/socialTypes';
import { MAX_MEDIA, stageFor } from '../lib/postPresentation';
import { openSocialProfile } from '../lib/profileNavigation';
import { previewRoomOf } from '../lib/sheetPreview';
import { useSheetPreview } from '../lib/useSheetPreview';
import { commentsPreviewFrameOf } from '../lib/commentsPreview';
import type { PostCanvasLayout } from './PostCanvas';

/**
 * One page with media, drawn to the values the web uses for its own immersive presentation:
 *
 *   feed-surface.css:474-521  one post with a picture owns the whole viewport, media edge-to-edge,
 *                             `object-fit:cover`
 *   social-human-ux.css:6-7   the reader's own fit mode: `media-fit-fill` cover / `media-fit-fit` contain
 *   app.js:1744-1748          defaults are `immersive` + `fill` (cover), persisted per reader
 *   app.js:4278-4299          the rail: creator, reactions, comments, save, repost/share, soundtrack
 *
 * Round 8 made this page identical in size to every other page of the feed: `FeedScreen` owns the pager
 * (one list, one viewport-sized page per item) and mounts a `ReelPage` for a clip — so the reader this
 * file used to carry for the Reels-only slice is gone with the filter that opened it. Only the page
 * remains, and it fills `height` exactly; `overlayBottom` is the tab bar's constant band, which the
 * caption and the rail keep clear of while the picture runs under it.
 *
 * Round 8, item 2: a **picture** is read exactly like a clip. The owner asked for the photo of the first
 * page to fill the screen with its reactions on the right rail, the caption and its translation at the
 * foot — so the feed sends every post that carries media to this page, and the page adapts only where
 * a photograph has no clock: no soundtrack disc (a still has nothing to mute), no tap-to-play, no clock.
 * An authored article with photographs is the exception: `isAuthoredArticle` keeps it on `PostCard`, so
 * a tall picture cannot turn a page of words into a Reel.
 *
 * Every action behind the rail is a real endpoint call (`lib/postInteractions`) — nothing here is a
 * picture of a button.
 *
 * Round 43 (31 October 2026): **one head, everywhere.** This page printed the author above the caption at
 * the foot whenever a surface left `layout` alone, which is what the feed did, while the profile asked for
 * `layout="post"` and got the head at the top beside a page of words that had always printed it there. The
 * owner asked for the feed to read like the profile, so `post` is now the default — and the feed passes it
 * explicitly — with the notch as `topInset` and the relation door beside the name. The bottom stamp lives
 * on in `PostCanvas` for the shapes that still want it (`reel`), but no page of the app asks for it.
 */

/** One page with media: the whole viewport, the picture or the clip, and the rail the reader uses. */
export function ReelPage({
  post, height, overlayBottom, bottomInset = 0, topInset = 0, layout = 'post', follow = false,
  translate = true, active, muted, onToggleMute, onPanelChange,
}: {
  post: SocialPost;
  height: number;
  /**
   * The band the surface under this page already owns at its foot: the tab bar of the feed
   * (`navReserve`). A page opened on its own route passes nothing here and hands its own device inset
   * instead (`bottomInset`), because the feed's bar is not mounted there.
   */
  overlayBottom: number;
  /**
   * The device's own room at the foot — the navigation bar and, on a page opened from a profile, the
   * plate of metal that carries it (`SystemNavBand`, round 41). Added to `overlayBottom`: the caption,
   * the clock and the rail end above it, so nothing the reader must press stands under the system's own
   * controls. It was `0` everywhere before round 41, which is why a profile reel printed its caption on
   * the very edge of the screen while a text post kept 10dp of paper above the gesture bar.
   */
  bottomInset?: number;
  /**
   * The room the device owns at the top (the status clock and the cutout) — and, on a page that keeps
   * the route's chrome, the header's band as well (`postPageTopInset`). The head of the page starts
   * under it.
   */
  topInset?: number;
  /**
   * Where the author's head goes. `post` — the default, and the only arrangement any surface asks for
   * since round 43 — prints it at the **top** of the page, in the one block a page of words uses: same
   * face, same name, same `@handle`, same place line, same relation door (`PostCanvas.page`). `reel` is the
   * arrangement the feed carried until round 43 (the author above the caption at the foot); it is kept
   * because the canvas still knows both shapes, but the feed now reads exactly like the profile and like
   * the page of words beside it, so no page asks for it any more — the same post must not have two heads
   * depending on where it was opened.
   */
  layout?: PostCanvasLayout;
  /**
   * Draw the author's relation door beside the name. Every page of media does since round 43: the feed's
   * immersive page printed no door while the page of words beside it printed one, and the owner asked for
   * one head everywhere (`PostCard` passes the same `RelationButton` for the same reason).
   */
  follow?: boolean;
  /**
   * Offer `Vezi traducerea` over the page. A **clip** never does: the door stands on the picture, over the
   * caption it is supposed to translate, and the owner asked for its removal from reels only (round 41) —
   * so a reel drops it whatever the surface says, and a still picture, a page of words, an article and a
   * conversation keep the behaviour they have always had.
   */
  translate?: boolean;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
  /**
   * Told when the reaction panel opens and closes (`ReactionControl`): the panel beside a clip is chosen
   * by dragging *along the page*, and a pager that answers a horizontal drag is rare but the vertical
   * one still takes any thumb that wanders off the row — so the feed stops turning while the panel is
   * open (a column's upward drag was stolen natively on the device, 19 October 2026).
   */
  onPanelChange?: (open: boolean) => void;
}) {
  const items = postMediaItems(post).slice(0, MAX_MEDIA);
  const cover: MediaItem | null = items[0] ?? null;
  const isVideo = mediaKindOf(cover) === 'video';
  const handle = post.author?.handle || 'nexus';
  const name = post.author?.display_name || handle;
  /**
   * The band the foot really reserves: the surface's own bar plus the device's inset. Both the canvas and
   * the rail climb by this one number, so a caption and the soundtrack disc under it can never be placed
   * against two different floors.
   */
  const band = Math.max(0, overlayBottom) + Math.max(0, bottomInset);
  const authorId = Number(post.author?.id) || null;
  const relation = useRelation(authorId);
  const stacked = layout === 'post';

  const [playing, setPlaying] = useState(true);
  /**
   * Everything this page *does* to the post lives in the one record `PostCard` reads too
   * (`lib/postEngagement.ts`): the reaction, the save, the repost, the share, the open thread and the paid
   * like waiting for its transfer. A reel liked in the feed therefore reads liked on the profile and in
   * search, because there is one record and not one per surface.
   */
  const engagement = usePostEngagement(post);
  const {
    summary, saved, reposted, distributeOpen, busy, notice: sentence,
  } = engagement;
  const [mediaFailed, setMediaFailed] = useState(false);
  /** A caption longer than the three lines the rail leaves room for, opened in place (section 5). */
  const [expanded, setExpanded] = useState(false);

  const plays = active && playing && isVideo;
  /**
   * Cât loc lasă foaia de comentarii (runda 47, revizuită în runda 48).
   *
   * Reelul, poza și pagina de cuvinte sunt aceeași pagină: când foaia se ridică, compoziția se așază pe
   * locul rămas deasupra ei. **Nu** se schimbă potrivirea imaginii — runda 47 o schimbase în `contain`, iar
   * ownerul a refuzat: poza arăta părți pe care Feed/Profil le ascund. Acum se micșorează cutia, cu raportul
   * paginii (`lib/commentsPreview.ts`), deci decuparea rămâne a feed-ului. Decodorul nu se demontează și nu
   * repornește (aceeași instanță, altă cutie), deci redarea continuă din locul în care era. La închidere,
   * măsurătoarea dispare și pagina revine la înălțimea întreagă.
   */
  const sheetHeight = useSheetPreview(post.id);
  const previewing = sheetHeight > 0;
  const previewRoom = previewRoomOf({ pageHeight: height, sheetHeight });
  /** Lățimea paginii, măsurată pe ea: cutia previzualizării are nevoie de raportul ei, nu de o presupunere. */
  const [pageWidth, setPageWidth] = useState(0);
  const { width: windowWidth } = useWindowDimensions();
  /**
   * Cutia previzualizării (runda 48).
   *
   * Runda 47 micșora pagina, dar și schimba potrivirea imaginii în `contain` — iar ownerul a refuzat exact
   * asta: poza arăta în comentarii părți pe care Feed/Profil le ascund. Acum pagina întreagă se micșorează
   * **proporțional**: cutia are raportul paginii, deci `cover`/`portrait-cover` decupează exact ca în feed,
   * iar cadrul de aici nu face decât să o așeze pe locul rămas (`lib/commentsPreview.ts`).
   */
  const previewFrame = previewing
    ? commentsPreviewFrameOf({
      stage: stageFor(post), pageWidth: pageWidth || windowWidth, pageHeight: height, room: previewRoom,
    })
    : null;

  return (
    <View
      style={[styles.page, { height }]}
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        setPageWidth((previous) => (previous === next ? previous : next));
      }}
    >
      {/**
       * Previzualizarea deasupra foii: același cadru, pe locul rămas. Fără foaie deschisă,
       * `previewRoom` este chiar `height`, deci pagina este exact ce a fost.
       *
       * Runda 48: când foaia este deschisă, compoziția se micșorează **întreagă** în cutia cu raportul
       * paginii — decuparea pozei/clipului rămâne a feed-ului, iar în jur rămâne terenul paginii.
       */}
      <View style={[styles.previewMatter, { height: previewRoom }]}>
      <View style={previewFrame
        ? { width: previewFrame.width, height: previewFrame.height }
        : { width: '100%', height: '100%' }}
      >
      {/**
       * The reel is the page (`PostStage fill`): the composition fills the whole viewport, from the status
       * clock to the gesture sign, with a gallery paged on its own track inside it. It is sized exactly like
       * the page of a post, which is what makes a swipe through the one feed uniform — nothing is fitted
       * into a smaller 9:16 box any more.
       */}
      <PostStage fill>
        {(frame) => (
          <View style={{ width: frame.width, height: frame.height }}>
            {/**
             * The page already is the whole reel: the composition fills the viewport, so there is no larger
             * reading to open. A tap on the picture is the play switch (`tapVideo` becomes play/pause, since
             * the reader removed the full-screen door in round 8); the rail keeps every other hand —
             * comments, save, share, sound.
             */}
            <PostCanvas
              post={post}
              variant="feed"
              layout={layout}
              page={stacked}
              presentation={previewing ? 'commentsPreview' : 'page'}
              active={plays}
              muted={muted}
              expanded={expanded}
              topInset={topInset}
              bottomInset={band}
              onError={() => setMediaFailed(true)}
              onOpenAuthor={() => openSocialProfile(post.author?.handle)}
              onToggleExpanded={() => setExpanded((value) => !value)}
              onTranslate={(translate && !isVideo) ? () => engagement.inform('Traducerea pe dispozitiv nu este disponibilă în această aplicație.') : undefined}
              /**
               * A still has nothing to start: only a clip answers a tap on the picture.
               * (`onPressMedia` is the play switch, since the reader removed the full-screen door in round 8.)
               */
              onPressMedia={isVideo ? () => setPlaying((value) => !value) : undefined}
              notice={sentence?.text}
              noticeTone={sentence?.tone}
              /**
               * The decorations of the manifest, handed to the canvas so they are painted on the picture
               * itself: above the veil, under the author's head and under the caption (`mediaOverlay`).
               */
              mediaOverlay={<PostDecorations post={post} fit="cover" />}
              /**
               * The relation door of the author, when the surface asks for it: the same control, the same
               * store and the same words a text post prints (`PostCard`), so a profile opened on a reel and
               * the same profile opened on a page of words answer `Urmărește` / `Editează profilul` in one
               * place, at one size. The feed's immersive page keeps it off, as it always has.
               */
              authorAction={follow && authorId ? (
                <RelationButton
                  variant="compact"
                  target={{ userId: authorId, handle, name, persona: post.persona ?? 'social' }}
                  relation={relation}
                />
              ) : undefined}
            />

      {/**
       * The decorations live inside the canvas (`mediaOverlay`), not here: a layer beside it was painted
       * over the author's head, so a text on the clip printed itself through his name.
       */}

      {mediaFailed ? (
        <View pointerEvents="none" style={styles.playState}>
          <Text style={styles.unavailable}>Fișierul media nu a putut fi încărcat.</Text>
        </View>
      ) : null}

      {/**
       * Semnul de redare și coloana de presări (runda 48): cât timp foaia de comentarii este deschisă, sus
       * rămâne **numai conținutul** postării. Un disc de redare, o reacție, un „salvează" sau un „distribuie"
       * sunt stratul social pe care ownerul l-a cerut ascuns; ele revin întregi când foaia se închide,
       * fiindcă nimic nu s-a demonstrat — doar nu se desenează.
       */}
      {isVideo && active && !playing && !previewing ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Redă clipul" onPress={() => setPlaying(true)} style={styles.playState}>
          <SolidViewerIcon kind="play" size={54} />
        </Pressable>
      ) : null}



      {/**
       * The rail: the reader's column of five presses, the same component every page of the feed mounts
       * (`PostRail`) — reaction, comments, save and share, then the soundtrack's own disc, which only a
       * clip has. It keeps clear of the band the tab bar owns (`overlayBottom`), which is constant now
       * that the bar is permanent (round 10): the rail and the words simply end above it.
       */}
      {previewing ? null : (
      <PostRail
        bottom={RAIL_FOOT + band}
        summary={summary}
        comments={post.comment_count}
        reposts={post.reposts}
        saved={saved}
        reposted={reposted}
        busy={busy}
        /** The immersive rail keeps the white-heart emoji it shipped with (owner, 31 October 2026). */
        heart="emoji"
        sound={isVideo ? {
          muted,
          label: `${muted ? 'Activează' : 'Oprește'} sunetul · ${audioAttributionFor(post, name)}`,
          onToggle: onToggleMute,
        } : null}
        onReact={(kind) => engagement.react(kind)}
        onOpenComments={engagement.openComments}
        onToggleSaved={engagement.save}
        onShare={engagement.toggleDistribute}
        onPanelChange={onPanelChange}
      />
      )}

      {previewing ? null : (
      <PostDistributePanel
        open={distributeOpen}
        bottom={214 + band}
        reposted={reposted}
        onToggleRepost={engagement.repost}
        onShare={engagement.share}
      />
      )}

          </View>
        )}
      </PostStage>
      </View>
      </View>

      {/**
       * The thread of this reel, over the reel: the app's one comment surface, with the one composer it
       * already has. A sheet, because the reel above is the whole post — there is no page to open.
       */}
      <PostSheets post={post} engagement={engagement} />

    </View>
  );
}

/**
 * `withRepost()` of the server: the post keeps its author and counters, and the line that says who put
 * it in the reader is drawn by `PostCanvas` (the one composition), not here.
 */


const styles = StyleSheet.create({
  /** `feed-surface.css:484 .clipCard{height:100%}` — one reel owns the viewport. */
  page: { width: '100%', backgroundColor: '#000000', overflow: 'hidden' },
  /**
   * Terenul previzualizării (runda 48): locul rămas deasupra foii, cu compoziția micșorată în mijloc.
   *
   * Cutia compoziției are raportul paginii (`lib/commentsPreview.ts`), deci poza sau clipul din ea ies
   * decupate exact ca pe pagina întreagă; benzile din jur sunt terenul paginii, nu o a doua decupare.
   */
  previewMatter: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  /** The frame's own pause/error layer: centred on the canvas, above the picture (`PostCanvas` owns the media). */
  playState: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  unavailable: { color: '#ffc6c6', fontSize: 13, fontWeight: '600', textAlign: 'center', paddingHorizontal: 24 },
});

