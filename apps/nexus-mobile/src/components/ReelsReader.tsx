import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PostRail, PostDistributePanel, RAIL_FOOT } from './PostRail';
import { ActionPaymentSheet } from './ActionPaymentSheet';
import { CommentsSheet } from './CommentsSheet';
import { SolidViewerIcon } from './SolidViewerIcon';
import { PostDecorations } from './PostDecorations';
import { PostCanvas, PostStage } from './PostCanvas';
import { setPostReaction, setPostRepost, setPostSaved, sharePost } from '../lib/postInteractions';
import {
  intentIsPaid, paymentRequired, quoteFromFailure,
  type ActionQuote, type PaymentIntent,
} from '../lib/actionPayments';
import {
  audioAttributionFor, mediaKindOf, postMediaItems, viewerReaction,
  type MediaItem, type SocialPost,
} from '../lib/socialTypes';
import { MAX_MEDIA } from '../lib/postPresentation';
import { openSocialProfile } from '../lib/profileNavigation';

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
 */

/** One page with media: the whole viewport, the picture or the clip, and the rail the reader uses. */
export function ReelPage({ post, height, overlayBottom, active, muted, onToggleMute, onPanelChange }: {
  post: SocialPost;
  height: number;
  overlayBottom: number;
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

  const [playing, setPlaying] = useState(true);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [summary, setSummary] = useState(post.reactions ?? null);
  const [saved, setSaved] = useState(Boolean(post.saved_by_me));
  const [reposted, setReposted] = useState(Boolean(post.reposted_by_me));
  const [distributeOpen, setDistributeOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  /** A caption longer than the three lines the rail leaves room for, opened in place (section 5). */
  const [expanded, setExpanded] = useState(false);
  /** The paid appreciation waiting for its confirmation: the quote the server refused the like with. */
  const [likePayment, setLikePayment] = useState<{ kind: string; quote: ActionQuote | null } | null>(null);

  const mine = viewerReaction(summary);
  const plays = active && playing && isVideo;

  function fail(cause: unknown) {
    setNotice(cause instanceof Error ? cause.message : 'Acțiunea nu a putut fi trimisă.');
  }

  /**
   * An appreciation is a paid action on this network (`lib/action-payments.js`): the server refuses
   * the reaction with `402 PAYMENT_REQUIRED` and the quote for it, and the like lands only once its
   * devnet transfer exists. The reader looks at the numbers on `ActionPaymentSheet`, and the second
   * call carries the ledger row back as `payment_intent_id`.
   */
  const react = (kind: string, paymentIntentId?: string | null, approval?: PaymentIntent | null) => {
    const nextActive = mine !== kind;
    const optimistic = !nextActive || Boolean(paymentIntentId || approval);
    if (optimistic) setSummary((previous) => ({ ...(previous ?? {}), viewer_reaction: nextActive ? kind : null }));
    setPostReaction(post.id, kind, nextActive, { paymentIntentId })
      .then((answer) => {
        setSummary({ counts: answer.counts, viewer_reaction: answer.viewer_reaction });
        setLikePayment(null);
        setNotice('');
      })
      .catch((cause) => {
        if (paymentRequired(cause)) {
          setLikePayment({ kind, quote: quoteFromFailure(cause) });
          // A refusal after a real transfer is a charge: never let it look unpaid.
          if (approval && intentIsPaid(approval)) fail(new Error('Transferul a plecat, dar aprecierea nu a fost înregistrată. Reîncarcă.'));
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

  const repost = () => {
    const next = !reposted;
    setDistributeOpen(false);
    setReposted(next);
    setPostRepost(post.id, next)
      .then((answer) => setReposted(Boolean(answer.reposted_by_me ?? answer.active)))
      .catch((cause) => { setReposted(!next); fail(cause); });
  };

  // Sharing is off by design on this product; the server's own sentence is what the reader sees.
  const share = () => {
    setDistributeOpen(false);
    setBusy(true);
    sharePost(post.id).catch(fail).finally(() => setBusy(false));
  };

  return (
    <View style={[styles.page, { height }]}>
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
              active={plays}
              muted={muted}
              expanded={expanded}
              bottomInset={overlayBottom}
              onError={() => setMediaFailed(true)}
              onOpenAuthor={() => openSocialProfile(post.author?.handle)}
              onToggleExpanded={() => setExpanded((value) => !value)}
              onTranslate={() => setNotice('Traducerea pe dispozitiv nu este disponibilă în această aplicație.')}
              /** A still has nothing to start: only a clip answers a tap on the picture. */
              onPressMedia={isVideo ? () => setPlaying((value) => !value) : undefined}
              notice={notice}
            />

      {/** The picture covers the page, so the decorations are drawn on the same cover box. */}
      <PostDecorations post={post} fit="cover" />

      {mediaFailed ? (
        <View pointerEvents="none" style={styles.playState}>
          <Text style={styles.unavailable}>Fișierul media nu a putut fi încărcat.</Text>
        </View>
      ) : null}

      {isVideo && active && !playing ? (
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
      <PostRail
        bottom={RAIL_FOOT + overlayBottom}
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
        onReact={(kind) => react(kind)}
        onOpenComments={() => setCommentsOpen(true)}
        onToggleSaved={save}
        onShare={() => setDistributeOpen((open) => !open)}
        onPanelChange={onPanelChange}
      />

      {/**
       * The share menu, over the page: the two decisions `.clipMoreActions` offers, where the reel always
       * drew them.
       */}
      <PostDistributePanel
        open={distributeOpen}
        bottom={214}
        reposted={reposted}
        onToggleRepost={repost}
        onShare={share}
      />

          </View>
        )}
      </PostStage>

      {/**
       * The thread of this reel, over the reel: the app's one comment surface, with the one composer it
       * already has. A sheet, because the reel above is the whole post — there is no page to open.
       */}
      {commentsOpen ? <CommentsSheet post={post} onClose={() => setCommentsOpen(false)} /> : null}

      {/**
       * The paid like: `onPaid` re-sends the same reaction with the ledger row as `payment_intent_id`,
       * so the appreciation lands once the devnet transfer exists — and only then.
       */}
      <ActionPaymentSheet
        visible={Boolean(likePayment)}
        postId={post.id}
        action="appreciation"
        quote={likePayment?.quote ?? null}
        onPaid={(approval) => { if (likePayment) react(likePayment.kind, approval.id, approval); }}
        onClose={() => setLikePayment(null)}
      />

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
  /** The frame's own pause/error layer: centred on the canvas, above the picture (`PostCanvas` owns the media). */
  playState: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  unavailable: { color: '#ffc6c6', fontSize: 13, fontWeight: '600', textAlign: 'center', paddingHorizontal: 24 },
});

