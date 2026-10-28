import { useState } from 'react';
import { View } from 'react-native';
import { openSocialProfile } from '../lib/profileNavigation';
import { useRelation } from '../lib/relations';
import {
  intentIsPaid, paymentRequired, quoteFromFailure, type ActionQuote, type PaymentIntent,
} from '../lib/actionPayments';
import { ActionPaymentSheet } from './ActionPaymentSheet';
import { CommentsSheet } from './CommentsSheet';
import { PostActionRow } from './PostActionRow';
import { PostCanvas, PostFrame } from './PostCanvas';
import { PostRail, PostDistributePanel, RAIL_FOOT } from './PostRail';
import { RelationButton } from './RelationButton';
import { setPostReaction, setPostRepost, setPostSaved, sharePost } from '../lib/postInteractions';
import { stageFor } from '../lib/postPresentation';
import { viewerReaction, type SocialPost } from '../lib/socialTypes';
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

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [summary, setSummary] = useState(post.reactions ?? null);
  const [saved, setSaved] = useState(Boolean(post.saved_by_me));
  const [reposted, setReposted] = useState(Boolean(post.reposted_by_me));
  const [confirmedCommentCount, setConfirmedCommentCount] = useState(0);
  /**
   * The frame's own sentence (`PostCanvas.notice`): a media file that would not load, a refused write, a
   * translation this build cannot produce. It carries its own tone, because a translation is information
   * and a failure is a failure, and the two must not look alike.
   */
  const [notice, setNotice] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);
  /**
   * The paid like. Reacting is a paid action on this network, so the card does not assume success: it
   * sends the write, and if the server answers `402 PAYMENT_REQUIRED` it holds the server's own quote
   * here and lets `ActionPaymentSheet` carry the confirmation, the signed devnet transfer and the retry.
   */
  const [likePayment, setLikePayment] = useState<{ kind: string; quote: ActionQuote | null } | null>(null);
  /**
   * The share menu of the page (`PostDistributePanel`): a share is two decisions — a repost inside the
   * feed, or a share with the server's own sentence — and the rail's single cell can only mean one of
   * them. The reel has opened this panel since round 8; a page of words opens the same one, from the same
   * cell, at the same distance from the foot.
   */
  const [distributeOpen, setDistributeOpen] = useState(false);
  const mine = viewerReaction(summary);
  const commentCount = Math.max(Number(post.comment_count ?? 0), confirmedCommentCount);
  const commentCreated = (postId: number) => {
    if (postId === post.id) setConfirmedCommentCount((previous) => Math.max(previous, Number(post.comment_count ?? 0)) + 1);
  };

  function fail(cause: unknown) {
    setNotice({ text: cause instanceof Error ? cause.message : 'Acțiunea nu a putut fi trimisă.', tone: 'error' });
  }

  const react = (kind: string, paymentIntentId?: string | null, approval?: PaymentIntent | null) => {
    const nextActive = mine !== kind;
    const optimistic = !nextActive || Boolean(paymentIntentId || approval);
    // The like is only drawn as taken once it is paid for; until then the summary stays as the server left it.
    if (optimistic) setSummary((previous) => ({ ...(previous ?? {}), viewer_reaction: nextActive ? kind : null }));
    setPostReaction(post.id, kind, nextActive, { paymentIntentId })
      .then((answer) => {
        setSummary({ counts: answer.counts, viewer_reaction: answer.viewer_reaction });
        setLikePayment(null);
        setNotice(null);
      })
      .catch((cause) => {
        if (paymentRequired(cause)) {
          setLikePayment({ kind, quote: quoteFromFailure(cause) });
          // A refused write on top of a paid transfer is a real charge: never let it look unpaid.
          if (approval && intentIsPaid(approval)) {
            fail(new Error('Transferul a plecat, dar aprecierea nu a fost înregistrată. Reîncarcă.'));
          }
          return;
        }
        if (optimistic) setSummary((previous) => ({ ...(previous ?? {}), viewer_reaction: mine }));
        fail(cause);
      });
  };

  const save = () => {
    const next = !saved;
    setSaved(next);
    setPostSaved(post.id, next).then((answer) => setSaved(answer.saved)).catch((cause) => { setSaved(!next); fail(cause); });
  };

  const repostIt = () => {
    const next = !reposted;
    setReposted(next);
    setPostRepost(post.id, next)
      .then((answer) => setReposted(Boolean(answer.reposted_by_me ?? answer.active)))
      .catch((cause) => { setReposted(!next); fail(cause); });
  };

  // Sharing stays internal on this product: the server answers with its own sentence and the card prints it.
  const share = () => { sharePost(post.id).catch(fail); };

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
      active={active}
      expanded={captionExpanded}
      playBadge
      topInset={topInset}
      bottomInset={bottomInset}
      folio={folio}
      onError={() => setNotice({ text: 'Fișierul media nu a putut fi încărcat.', tone: 'error' })}
      notice={notice?.text}
      noticeTone={notice?.tone}
      onOpenAuthor={() => openSocialProfile(post.author?.handle)}
      onToggleExpanded={() => setCaptionExpanded((value) => !value)}
      onTranslate={() => setNotice({ text: 'Traducerea pe dispozitiv nu este disponibilă în această aplicație.', tone: 'info' })}
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
          onReact={(kind) => react(kind)}
          onOpenComments={() => setCommentsOpen(true)}
          onToggleSaved={save}
          onToggleRepost={repostIt}
          onShare={share}
        />
      )}
    />
  );

  return (
    <>
      {height ? (
        <View style={{ height }}>
          {canvas}
          {/**
           * The rail, over the page: the same column of five presses a reel carries (`PostRail`), at the
           * same distance from the page's foot. The band the tab bar owns is constant (round 10), so
           * the rail needs no clock: it stands where it stands, and the words end above it.
           * with the thumb on the right, exactly as a picture is. The owner, 20 October 2026: the
           * horizontal bar at the foot was „footer”, and the reactions had to climb the reel's own column.
           */}
          <PostRail
            bottom={RAIL_FOOT + bottomInset}
            tone={tone}
            summary={summary}
            comments={commentCount}
            reposts={post.reposts}
            saved={saved}
            reposted={reposted}
            onReact={(kind) => react(kind)}
            onOpenComments={() => setCommentsOpen(true)}
            onToggleSaved={save}
            onShare={() => setDistributeOpen((open) => !open)}
            onPanelChange={onPanelChange}
          />
          {/**
           * The share menu, over the page: the two decisions `.clipMoreActions` offers, at the height the
           * reel's panel keeps (the reference's 214) plus the band the tab bar owns.
           */}
          <PostDistributePanel
            open={distributeOpen}
            bottom={214 + bottomInset}
            tone={tone}
            reposted={reposted}
            onToggleRepost={repostIt}
            onShare={share}
          />
        </View>
      ) : <PostFrame>{canvas}</PostFrame>}

      {/**
       * The thread of this exact post, over the feed: the app's one comment surface (`CommentsSheet`),
       * with the one composer it already had. It is a sheet because the post above is already the whole
       * screen — the thread is the one deeper surface, never a second rendering of the post.
       */}
      {commentsOpen ? (
        <CommentsSheet
          post={post}
          onClose={() => setCommentsOpen(false)}
          onCommentCreated={commentCreated}
        />
      ) : null}

      {/**
       * The paid like. `onPaid` re-sends the same reaction carrying the ledger row as `payment_intent_id`,
       * so the appreciation lands once the transfer exists — and only then.
       */}
      <ActionPaymentSheet
        visible={Boolean(likePayment)}
        postId={post.id}
        action="appreciation"
        quote={likePayment?.quote ?? null}
        onPaid={(approval) => { if (likePayment) react(likePayment.kind, approval.id, approval); }}
        onClose={() => setLikePayment(null)}
      />
    </>
  );
}
