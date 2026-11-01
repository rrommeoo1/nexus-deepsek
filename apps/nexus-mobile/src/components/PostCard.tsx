import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { openSocialProfile } from '../lib/profileNavigation';
import { useRelation } from '../lib/relations';
import { usePostEngagement } from '../lib/postEngagement';
import { PostActionRow } from './PostActionRow';
import { PostCanvas, PostFrame } from './PostCanvas';
import { PostRail, PostDistributePanel, RAIL_FOOT } from './PostRail';
import { PostSheets } from './PostSheets';
import { RelationButton } from './RelationButton';
import { previewRoomOf } from '../lib/sheetPreview';
import { useSheetPreview } from '../lib/useSheetPreview';
import { commentsPreviewFrameOf } from '../lib/commentsPreview';
import { stageFor } from '../lib/postPresentation';
import type { SocialPost } from '../lib/socialTypes';
import type { ControlTone } from '../theme/social';

/**
 * One post: a page of the feed, or a card of a list, in the universal composition.
 *
 * The card is not a second composition: the picture, the author, the caption and the meta are
 * `PostCanvas` (`variant="feed"`, `layout="post"`), the shape around them is the page or `PostFrame`, and
 * the presses are the reader's rail (`PostRail`) on a page or the compact row (`PostActionRow`) inside a
 * 9:16 cell. That is the whole reason a card, a page and the reel cannot drift apart — the same
 * composition, asked for a page or for a cell.
 *
 * Round 8: in the feed the post *is* the page. `height` is the viewport, the media covers it edge to edge,
 * and the words are inset by the device (notch above, tab bar below) — no 9:16 card centred inside a black
 * page, which is what made the picture sit on a band and what resized the card when the tab bar left.
 *
 * Round 8, item 2: this card is what a **page of words** is drawn with. A page that carries a picture or
 * a clip is the reader's immersive page instead (`ReelPage`), because the owner reads a photo with its
 * actions on the right rail, like a reel. The exception is an authored article (`text_style` plus
 * photographs, `isAuthoredArticle`): it stays here, so the words are still a reading and the picture is
 * a bounded block inside the first page rather than the page itself.
 *
 * Round 9 (20 October 2026) closed the last difference between the two: a page of words mounts the *same*
 * rail (`PostRail`) and the same comment sheet and the same reaction palette, and the head of the page
 * starts in the notification band (`PostCanvas.page`). The horizontal bar of five plates that used to stand
 * at its foot is gone — the owner read it as a footer („nu-mi place cum se vede ca și footer, deci trebuie
 * scos"). A card of a list (search) keeps the compact row, because a 9:16 cell has no rail beside its words
 * and no foot to give.
 *
 * There is no second, full-screen copy of the post: the page already is the whole post, so a tap on it
 * opens nothing. The conversation is the one deeper surface, and it arrives as the existing `CommentsSheet`
 * over the feed (never as a page that re-renders the post at a larger size).
 *
 * What stays here is what the canvas deliberately does not own: the state and the writes. Reacting is a
 * paid action on this network, so a refusal (`402 PAYMENT_REQUIRED`) opens `ActionPaymentSheet` with the
 * server's own quote; saving, reposting and sharing are optimistic and put themselves back when the
 * server refuses, printing its sentence in the frame (`notice`) instead of a red line under the card.
 */
export function PostCard({
  post, height, topInset = 0, bottomInset = 0, active = false, onPanelChange, folio,
}: {
  post: SocialPost;
  /**
   * The height of the page, when the card *is* the page (the feed). The composition then fills the whole
   * viewport — from the notch to the gesture sign — with the picture covering it, and the words keep clear
   * of the device with `topInset` / `bottomInset`. A caller with no page of its own (search) leaves this
   * out and gets the universal 9:16 card of a list, unchanged.
   */
  height?: number;
  /**
   * The room the device and the route's own chrome own above the composition; the author starts under
   * it. In the feed that is the status clock and the notch (`insets.top`); on `/post/[id]` it is those
   * plus the header's 52dp band (`postPageTopInset`), which is what keeps the author's name out from
   * under the Back button.
   */
  topInset?: number;
  /** Room the floating tab bar and the gesture sign own; the actions end above it. */
  bottomInset?: number;
  /** Only the card the reader is looking at may decode a clip (`PostCanvas.active`). */
  active?: boolean;
  /**
   * Told when the page's reaction panel opens and closes (`PostRail` → `ReactionControl`): the feed stops
   * turning while it is open, because the panel is chosen by dragging along its row and the pager would
   * take that drag at the native level. A card of a list passes nothing — it lives inside a scroll surface
   * that is not the feed.
   */
  onPanelChange?: (open: boolean) => void;
  /**
   * The row a page of words prints its folio in (`lib/textPage.ts::folioRow`), when this card is drawn by a
   * surface that is not the feed. The feed passes nothing — its pages keep `PAGE_FOLIO` — and the reader
   * opened from a profile passes `PROFILE_FOLIO`, so the number stands in the paper the page got back when
   * its foot door was removed (round 32). A page of media never reads it.
   */
  folio?: { band: number; inset: number };
}) {
  const handle = post.author?.handle || 'nexus';
  const name = post.author?.display_name || handle;

  /**
   * Everything this page *does* to a post lives in one record (`lib/postEngagement.ts`), shared with the
   * reel beside it, with the profile's reader and with the search card: a reaction, a save, a repost, a
   * share, an open thread, a paid like waiting for its transfer. This component only paints it.
   */
  const engagement = usePostEngagement(post);
  const {
    summary, saved, reposted, notice, comments: commentCount, distributeOpen,
  } = engagement;
  /** The caption's own reading state: this page's, not the post's — no other surface can open it. */
  const [captionExpanded, setCaptionExpanded] = useState(false);
  /**
   * Cât loc ia foaia de comentarii, cât timp este deschisă (runda 47, revizuită în runda 48).
   *
   * Foaia nu se mută și nu se redesenează: pagina își măsoară locul rămas deasupra ei
   * (`lib/sheetPreview.ts`) și își compune pagina pe el. Runda 48 a schimbat **ce** se vede acolo: numai
   * conținutul postării, fără capul autorului, fără descriere și fără îndemnurile sociale
   * (`PostCanvas.presentation`), iar imaginea păstrează decuparea din Feed/Profil, fiindcă se micșorează
   * cutia, nu se schimbă potrivirea (`lib/commentsPreview.ts`). Când foaia se închide, măsurătoarea
   * dispare și pagina revine la înălțimea ei — nicio stare nu se pierde, fiindcă nimic nu se demontează.
   */
  const sheetHeight = useSheetPreview(post.id);
  const previewing = Boolean(height) && sheetHeight > 0;
  const previewRoom = height ? previewRoomOf({ pageHeight: height, sheetHeight }) : 0;
  /** Lățimea paginii, măsurată pe ea: cutia previzualizării are nevoie de raportul ei, nu de o presupunere. */
  const [pageWidth, setPageWidth] = useState(0);
  const { width: windowWidth } = useWindowDimensions();

  /**
   * The author's own record, from the one store (`lib/relations.ts`): the card prints the same relation the
   * profile, the lists and the search print, because `socialPostView` carries `following_me`,
   * `follow_request_pending`, `muted_by_me` and `blocked_by_me` (`api.js:742-744`) and the feed hands them to
   * the store in one call.
   */
  const authorId = Number(post.author?.id) || null;
  const relation = useRelation(authorId);

  /**
   * The ground the reader's controls stand on (`socialTokens.post.controls`, owner, 28 October 2026).
   *
   * A page of words — a text post, and an authored article with pictures inside it — is set on the cream
   * that `pagePaletteOf` gives every such page, so its rail and its Follow door are a silver plate with
   * graphite ink; a white glyph on that paper was invisible, which is the contrast the owner asked for. A
   * page with a picture, a clip, a quote, or a 9:16 card of a list keeps the graphite plate and the silver
   * ink, because there the field is dark. `stageFor` is the same classifier the canvas reads, so the page's
   * background and its buttons can never disagree about what kind of page this is.
   */
  const stage = stageFor(post);
  const tone: ControlTone = stage === 'text' || stage === 'article' ? 'paper' : 'night';

  /**
   * Cutia previzualizării de deasupra foii de comentarii (runda 48).
   *
   * Ownerul a refuzat runda 47 pentru un singur motiv: poza se vedea **întreagă** în comentarii, cu părți
   * pe care pagina din Feed/Profil le ascunde. Deci previzualizarea nu schimbă potrivirea imaginii — schimbă
   * **cutia**, micșorând pagina întreagă proporțional (`lib/commentsPreview.ts`). Raportul rămâne al
   * paginii, deci `cover` decupează exact ca în feed; o pagină de cuvinte nu se micșorează, se re-pagina.
   */
  const previewFrame = previewing && height
    ? commentsPreviewFrameOf({
      stage, pageWidth: pageWidth || windowWidth, pageHeight: height, room: previewRoom, safeTop: topInset,
    })
    : null;

  /**
   * The composition, drawn once for both shapes: a page of the feed (when a `height` is given) or the
   * universal 9:16 card a list still uses. The page hands it the device's own room as insets, so the author
   * starts under the status clock and the actions end above the tab bar; a card keeps the canvas's padding.
   */
  const canvas = (
    <PostCanvas
      post={post}
      variant="feed"
      layout="post"
      /**
       * A page is the whole composition, not a card of a list: its head starts in the notification band
       * (`topInset` itself) and the right of the page stays clear for the rail the card draws beside it
       * (`PostCanvas.page`). A 9:16 card of a list keeps the canvas's own padding and its compact row.
       */
      page={Boolean(height)}
      presentation={previewing ? 'commentsPreview' : 'page'}
      active={active}
      expanded={captionExpanded}
      playBadge
      topInset={topInset}
      bottomInset={bottomInset}
      folio={folio}
      onError={() => engagement.fail('Fișierul media nu a putut fi încărcat.')}
      notice={notice?.text}
      noticeTone={notice?.tone}
      onOpenAuthor={() => openSocialProfile(post.author?.handle)}
      onToggleExpanded={() => setCaptionExpanded((value) => !value)}
      onTranslate={() => engagement.inform('Traducerea pe dispozitiv nu este disponibilă în această aplicație.')}
      authorAction={authorId ? (
        <RelationButton
          variant="compact"
          tone={tone}
          target={{ userId: authorId, handle, name, persona: post.persona ?? 'social' }}
          relation={relation}
        />
      ) : undefined}
      /* The actions of a *card of a list* — a search result inside its 9:16 cell — under the words, inside
       * the frame. A cell has no rail to put beside the caption, so its five presses keep the compact row
       * the web's own card carries.
       *
       * A page of the feed passes nothing here. Its presses climb the rail a reel uses (`PostRail`), drawn
       * over the page by `PostCard`, because the owner rejected the bar of five plates that used to stand at
       * the foot of a page of words (20 October 2026: „nu-mi place cum se vede ca și footer, deci trebuie
       * scos").
       */
      bottomActions={height ? undefined : (
        <PostActionRow
          summary={summary}
          comments={commentCount}
          reposts={post.reposts}
          saved={saved}
          reposted={reposted}
          onReact={(kind) => engagement.react(kind)}
          onOpenComments={engagement.openComments}
          onToggleSaved={engagement.save}
          onToggleRepost={engagement.repost}
          onShare={engagement.share}
        />
      )}
    />
  );

  return (
    <>
      {height ? (
        <View
          style={{ height }}
          onLayout={(event) => {
            const next = Math.round(event.nativeEvent.layout.width);
            setPageWidth((previous) => (previous === next ? previous : next));
          }}
        >
          {/**
           * Pagina deține înălțimea întreagă (pager-ul feed-ului se sprijină pe ea), dar compoziția se
           * desenează pe locul rămas deasupra foii de comentarii cât timp foaia este deschisă. Așa postarea
           * se vede întreagă fără ca lista să-și schimbe paginile și fără ca poziția în feed să sară.
           */}
          {previewFrame ? (
            <View style={[styles.previewMatter, { height: previewRoom, paddingTop: previewFrame.top }]}>
              <View style={{ width: previewFrame.width, height: previewFrame.height }}>{canvas}</View>
            </View>
          ) : (
            <View style={{ height: previewRoom || height }}>{canvas}</View>
          )}
          {/**
           * The rail, over the page: the same column of five presses a reel carries (`PostRail`), at
           * the same distance from the page's foot. The band the tab bar owns is constant (round 10), so
           * the rail needs no clock: it stands where it stands, and the words end above it — with the
           * thumb on the right, exactly as a picture is.
           */}
          {/**
           * Runda 48: cât timp foaia de comentarii este deschisă, coloana de presări nu se desenează.
           * Ownerul a cerut sus **numai conținutul** postării: reacțiile, comentariul, salvarea și
           * distribuirea sunt exact stratul social pe care l-a numit. Comenzile rămân montate la locul lor
           * când foaia se închide — același record, aceeași foaie, o atingere distanță.
           */}
          {previewing ? null : (
          <PostRail
            bottom={RAIL_FOOT + bottomInset}
            tone={tone}
            summary={summary}
            comments={commentCount}
            reposts={post.reposts}
            saved={saved}
            reposted={reposted}
            busy={engagement.busy}
            onReact={(kind) => engagement.react(kind)}
            onOpenComments={engagement.openComments}
            onToggleSaved={engagement.save}
            onShare={engagement.toggleDistribute}
            onPanelChange={onPanelChange}
          />
          )}
          {/**
           * The share menu, over the page: the two decisions `.clipMoreActions` offers, at the height the
           * reel's panel keeps (the reference's 214) plus the band the tab bar owns.
           */}
          {previewing ? null : (
          <PostDistributePanel
            open={distributeOpen}
            bottom={214 + bottomInset}
            tone={tone}
            reposted={reposted}
            onToggleRepost={engagement.repost}
            onShare={engagement.share}
          />
          )}
        </View>
      ) : <PostFrame>{canvas}</PostFrame>}

      {/**
       * The thread of this exact post and the paid like's confirmation: `PostSheets`, the pair every
       * surface mounts, fed by the one engagement record (`lib/postEngagement.ts`). It is a sheet because
       * the post above is already the whole screen — the thread is the one deeper surface, never a second
       * rendering of the post.
       */}
      <PostSheets post={post} engagement={engagement} />
    </>
  );
}

const styles = StyleSheet.create({
  /**
   * Terenul previzualizării (runda 48): negrul paginii, cu cutia compoziției micșorate în mijlocul locului
   * rămas deasupra foii. Cutia are raportul paginii, deci poza din ea este decupată exact ca în Feed/Profil —
   * benzile laterale sunt doar terenul, nu o a doua decupare.
   */
  previewMatter: {
    backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
});
