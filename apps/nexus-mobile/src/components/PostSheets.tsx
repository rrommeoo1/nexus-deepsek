import { ActionPaymentSheet } from './ActionPaymentSheet';
import { CommentsSheet } from './CommentsSheet';
import type { PostEngagementApi } from '../lib/postEngagement';
import type { SocialPost } from '../lib/socialTypes';

/**
 * The two sheets a post can open, mounted once for every surface (round 42).
 *
 * A page of words and a page of media have always carried the same pair — the thread (`CommentsSheet`)
 * and the paid like's confirmation (`ActionPaymentSheet`) — but they wired the thread differently:
 * `PostCard` told the page a comment had been written, so its count moved, and `ReelPage` said nothing,
 * so a comment on a reel left the rail's number where the payload had put it. That is the kind of
 * difference the owner reads as "the reel works differently", and it cannot survive one component.
 *
 * Both are fed from the same record (`lib/postEngagement.ts`), so which sheet is open, what the thread
 * counts and what the payment carries are one answer on every surface.
 */
export function PostSheets({ post, engagement }: { post: SocialPost; engagement: PostEngagementApi }) {
  return (
    <>
      {engagement.commentsOpen ? (
        <CommentsSheet
          post={post}
          onClose={engagement.closeComments}
          onCommentCreated={engagement.commentWritten}
          onCountSeen={(_postId: number, count: number) => engagement.commentSeen(count)}
        />
      ) : null}
      {/**
       * The paid like: `onPaid` re-sends the same reaction with the ledger row as `payment_intent_id`,
       * so the appreciation lands once the devnet transfer exists — and only then.
       */}
      <ActionPaymentSheet
        visible={Boolean(engagement.payment)}
        postId={post.id}
        action="appreciation"
        quote={engagement.payment?.quote ?? null}
        onPaid={engagement.paid}
        onClose={engagement.closePayment}
      />
    </>
  );
}
