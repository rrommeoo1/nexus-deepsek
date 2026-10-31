import { useSyncExternalStore } from 'react';
import { setPostReaction, setPostRepost, setPostSaved, sharePost } from './postInteractions';
import {
  intentIsPaid, paymentRequired, quoteFromFailure, type ActionQuote, type PaymentIntent,
} from './actionPayments';
import { viewerReaction, type ReactionSummary, type SocialPost } from './socialTypes';

/**
 * One post's engagement, in one place (round 42, 31 October 2026).
 *
 * Until this module, every surface that drew a post kept its own copy of the same five facts — the
 * reaction summary, the count of comments, `saved`, `reposted`, the write in flight, the two sheets —
 * inside the component that painted it. `PostCard` (the feed's page of words, the search card, the
 * profile's word page) and `ReelPage` (every page with media) each held a `useState` for every one of
 * them, and each carried its own copy of `react`, `save`, `repost` and `share`. Two surfaces therefore
 * disagreed the moment the same post appeared twice: a reel liked in the feed opened from a profile with
 * the old heart, and printed the count its payload had been fetched with.
 *
 * The rule the owner asked for is the obvious one — a reel liked in the feed must read liked in the
 * profile and in search — and two components agreeing cannot deliver it. One record that both read can:
 *
 *   · a `Map` keyed by post id, one entry per post, holding what the reader has *done* to it;
 *   · every write goes through `POST /api/posts/:id/reaction|save|repost|share` (`lib/postInteractions`),
 *     optimistically, with the same rollback both components already had;
 *   · one write per post per action at a time (`IN_FLIGHT`), so a double tap cannot send two likes;
 *   · a payload *seeds* a record and never overwrites one: the store has seen what this reader did, and
 *     a list fetched a minute ago does not get to un-do it.
 *
 * It is deliberately the shape of `lib/relations.ts` — one map, one listener set, one version, and a
 * `useSyncExternalStore` whose snapshot is a string built from the record's own stamp. The two stores are
 * the app's two shared truths: who follows whom, and what the reader has done to a post.
 */

/** `error` is a failure (`PostCanvas.notice`), `info` a sentence that is not one (a translation this build cannot make). */
export type PostNotice = { text: string; tone: 'error' | 'info' };

/** The paid like waiting for its confirmation: the server's quote, held until the sheet answers it. */
export type PostPayment = { kind: string; quote: ActionQuote | null };

export type PostEngagement = {
  postId: number;
  /** The summary the last write or payload gave, `null` while nothing is known. */
  summary: ReactionSummary | null;
  /** `.clipMetric` of the comment press. */
  comments: number;
  saved: boolean;
  reposted: boolean;
  /** A share is in flight (the rail's quiet spinner, `PostRail.busy`). */
  busy: boolean;
  notice: PostNotice | null;
  payment: PostPayment | null;
  /** The two sheets a page can have open. They live here because both surfaces open the same two. */
  commentsOpen: boolean;
  distributeOpen: boolean;
  /** The stamp `useSyncExternalStore` compares: it changes on every write that changes the record. */
  at: number;
};

const EMPTY: Omit<PostEngagement, 'postId'> = {
  summary: null,
  comments: 0,
  saved: false,
  reposted: false,
  busy: false,
  notice: null,
  payment: null,
  commentsOpen: false,
  distributeOpen: false,
  at: 0,
};

const RECORDS = new Map<number, PostEngagement>();
const LISTENERS = new Set<() => void>();
/**
 * The writes that are on the wire, by `${postId}:${action}`.
 *
 * This is what makes "no duplicate reactions are submitted" true rather than hoped for: a finger that
 * lands twice on the same press, a slow network and an impatient thumb all meet here, and the second
 * call is dropped instead of sent.
 */
const IN_FLIGHT = new Set<string>();
let VERSION = 0;

function emit(): void {
  VERSION += 1;
  for (const listener of Array.from(LISTENERS)) listener();
}

/** The store's version, for a surface that has to rerender on any change (`relationsVersion` twin). */
export function engagementVersion(): number {
  return VERSION;
}

export function subscribePostEngagement(listener: () => void): () => void {
  LISTENERS.add(listener);
  return () => { LISTENERS.delete(listener); };
}

function recordOf(postId: number): PostEngagement {
  const known = RECORDS.get(postId);
  if (known) return known;
  const fresh: PostEngagement = { postId, ...EMPTY };
  RECORDS.set(postId, fresh);
  return fresh;
}

/** The record of one post, read once (a caller that must not subscribe: a test, a report). */
export function postEngagementOf(postId: number): PostEngagement {
  return recordOf(Number(postId));
}

/** Everything the store holds, for a report or a debug screen. */
export function postEngagementsSnapshot(): PostEngagement[] {
  return Array.from(RECORDS.values()).sort((left, right) => right.at - left.at);
}

/**
 * The store's one writer. A patch replaces only the fields it carries, and a patch that changes nothing
 * notifies nobody — the rule `relations.ts` had to learn on 26 October 2026, when a payload handed back
 * to a store that emitted on every write turned the profile into a reload loop.
 */
export function rememberPostEngagement(
  postId: number,
  patch: Partial<Omit<PostEngagement, 'postId'>>,
): PostEngagement {
  const id = Number(postId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`post necunoscut: ${postId}`);
  const changed = merge(id, patch);
  if (changed) emit();
  return recordOf(id);
}

/**
 * The write itself, without the announcement. Returns `true` when something really changed.
 *
 * It is separate from `rememberPostEngagement` because a *payload* is seeded while a component renders
 * (`usePostEngagement`), and a store that emitted there would be asking React to re-render a screen in
 * the middle of rendering another — the one thing `useSyncExternalStore` forbids. Seeding therefore
 * writes silently: the surface that is rendering already reads the record in this very pass, and every
 * other surface seeds its own post on its own render.
 */
function merge(id: number, patch: Partial<Omit<PostEngagement, 'postId'>>): boolean {
  const previous = recordOf(id);
  const next: PostEngagement = { ...previous, ...patch, postId: id, at: previous.at + 1 };
  let changed = false;
  for (const key of Object.keys(patch) as (keyof Omit<PostEngagement, 'postId'>)[]) {
    if (key === 'at') continue;
    if (!sameValue(previous[key], next[key])) { changed = true; break; }
  }
  if (!changed) return false;
  RECORDS.set(id, next);
  return true;
}


/** Shallow equality that also holds for the two small objects a record carries (`notice`, `payment`). */
function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => a[key] === b[key]);
}

/**
 * What a payload says about a post, handed to the store without letting a stale list win.
 *
 * The rule is "fill, never overwrite": a field the store has not learned yet is taken from the payload,
 * and a field it already knows — because this reader wrote it, in this session, on this phone — is left
 * alone. That is what keeps a reaction taken in the feed while the profile's archive (fetched before it)
 * lands one screen later: the archive says `viewer_reaction: null`, and the answer is no.
 *
 * The count of comments is the one field that may *grow* from a payload: a thread that gained comments
 * elsewhere is news, and news never contradicts anything the reader did here.
 */
export function seedPostEngagement(post?: SocialPost | null): void {
  if (!post) return;
  const id = Number(post.id);
  if (!Number.isSafeInteger(id) || id <= 0) return;
  const known = RECORDS.has(id);
  const previous = recordOf(id);
  const patch: Partial<Omit<PostEngagement, 'postId'>> = {};
  if (!known || previous.summary === null) {
    if (post.reactions) patch.summary = post.reactions;
  }
  const comments = Math.max(previous.comments, Number(post.comment_count ?? 0) || 0);
  if (comments !== previous.comments) patch.comments = comments;
  /** `saved_by_me` / `reposted_by_me` are only read when the store has never heard of the post. */
  if (!known) {
    patch.saved = Boolean(post.saved_by_me);
    patch.reposted = Boolean(post.reposted_by_me);
  }
  /** Silent, because `usePostEngagement` seeds while it renders (`merge` documents why). */
  if (Object.keys(patch).length) merge(id, patch);
}

/** The sentence a refused write prints: the server's own when it has one. */
function sentenceOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Acțiunea nu a putut fi trimisă.';
}

export function notePostNotice(postId: number, text: string, tone: PostNotice['tone'] = 'error'): void {
  rememberPostEngagement(postId, { notice: { text, tone } });
}

export function clearPostNotice(postId: number): void {
  rememberPostEngagement(postId, { notice: null });
}

/**
 * A reaction: the one write both surfaces make, and therefore the one that has to be identical on a reel
 * and on a page of words.
 *
 * A like is a *paid* action on this network (`lib/action-payments.js`), so the write is not assumed to
 * succeed: the glyph only turns over before the answer when the reader is taking a reaction *back*
 * (nothing is charged for that) or when a payment has already been made for it. Everything else waits for
 * the server, and a `402 PAYMENT_REQUIRED` puts the quote in the record so the one sheet both surfaces
 * mount can carry the confirmation, the signed devnet transfer and the retry.
 */
export function reactToPost(
  post: SocialPost | number,
  kind: string,
  options: { paymentIntentId?: string | null; approval?: PaymentIntent | null } = {},
): void {
  const id = typeof post === 'number' ? post : Number(post.id);
  if (!Number.isSafeInteger(id) || id <= 0) return;
  const record = recordOf(id);
  const mine = viewerReaction(record.summary);
  const key = `${id}:reaction`;
  if (IN_FLIGHT.has(key)) return;
  const nextActive = mine !== kind;
  const paid = Boolean(options.paymentIntentId || options.approval);
  const optimistic = !nextActive || paid;
  IN_FLIGHT.add(key);
  if (optimistic) {
    rememberPostEngagement(id, { summary: { ...(record.summary ?? {}), viewer_reaction: nextActive ? kind : null } });
  }
  setPostReaction(id, kind, nextActive, { paymentIntentId: options.paymentIntentId ?? null })
    .then((answer) => {
      rememberPostEngagement(id, {
        summary: { counts: answer.counts, viewer_reaction: answer.viewer_reaction },
        payment: null,
        notice: null,
      });
    })
    .catch((cause) => {
      if (paymentRequired(cause)) {
        rememberPostEngagement(id, { payment: { kind, quote: quoteFromFailure(cause) } });
        /** A refusal after a real transfer is a charge: never let it look unpaid. */
        if (paid && options.approval && intentIsPaid(options.approval)) {
          notePostNotice(id, 'Transferul a plecat, dar aprecierea nu a fost înregistrată. Reîncarcă.');
        }
        return;
      }
      if (optimistic) {
        rememberPostEngagement(id, { summary: { ...(record.summary ?? {}), viewer_reaction: mine } });
      }
      notePostNotice(id, sentenceOf(cause));
    })
    .finally(() => { IN_FLIGHT.delete(key); });
}

/** Save: optimistic, with the rollback the two components already had. */
export function togglePostSaved(post: SocialPost | number): void {
  const id = typeof post === 'number' ? post : Number(post.id);
  const key = `${id}:save`;
  if (!Number.isSafeInteger(id) || id <= 0 || IN_FLIGHT.has(key)) return;
  const next = !recordOf(id).saved;
  IN_FLIGHT.add(key);
  rememberPostEngagement(id, { saved: next });
  setPostSaved(id, next)
    .then((answer) => rememberPostEngagement(id, { saved: answer.saved }))
    .catch((cause) => {
      rememberPostEngagement(id, { saved: !next });
      notePostNotice(id, sentenceOf(cause));
    })
    .finally(() => { IN_FLIGHT.delete(key); });
}

/** A repost inside the network: the same optimistic rule, and the panel closes on the press. */
export function togglePostRepost(post: SocialPost | number): void {
  const id = typeof post === 'number' ? post : Number(post.id);
  const key = `${id}:repost`;
  if (!Number.isSafeInteger(id) || id <= 0 || IN_FLIGHT.has(key)) return;
  const next = !recordOf(id).reposted;
  IN_FLIGHT.add(key);
  rememberPostEngagement(id, { reposted: next, distributeOpen: false });
  setPostRepost(id, next)
    .then((answer) => rememberPostEngagement(id, { reposted: Boolean(answer.reposted_by_me ?? answer.active) }))
    .catch((cause) => {
      rememberPostEngagement(id, { reposted: !next });
      notePostNotice(id, sentenceOf(cause));
    })
    .finally(() => { IN_FLIGHT.delete(key); });
}

/**
 * Sharing stays internal on this product: the server answers `409` with its own sentence and the page
 * prints that sentence instead of a spinner that never ends.
 */
export function sharePostFrom(post: SocialPost | number): void {
  const id = typeof post === 'number' ? post : Number(post.id);
  const key = `${id}:share`;
  if (!Number.isSafeInteger(id) || id <= 0 || IN_FLIGHT.has(key)) return;
  IN_FLIGHT.add(key);
  rememberPostEngagement(id, { busy: true, distributeOpen: false });
  sharePost(id)
    .catch((cause) => notePostNotice(id, sentenceOf(cause)))
    .finally(() => {
      IN_FLIGHT.delete(key);
      rememberPostEngagement(id, { busy: false });
    });
}

/** The paid reaction came back confirmed: send the same reaction again, carrying the ledger row. */
export function payForReaction(post: SocialPost | number, approval: PaymentIntent): void {
  const id = typeof post === 'number' ? post : Number(post.id);
  const pending = recordOf(id).payment;
  if (!pending) return;
  reactToPost(id, pending.kind, { paymentIntentId: approval.id, approval });
}

export function closePostPayment(postId: number): void {
  rememberPostEngagement(postId, { payment: null });
}

/** One comment was written on this post (`CommentsSheet.onCommentCreated`). */
export function notePostComment(post: SocialPost | number): void {
  const id = typeof post === 'number' ? post : Number(post.id);
  if (!Number.isSafeInteger(id) || id <= 0) return;
  const record = recordOf(id);
  const fromPayload = Number(typeof post === 'number' ? 0 : post.comment_count ?? 0) || 0;
  rememberPostEngagement(id, { comments: Math.max(record.comments, fromPayload) + 1 });
}

/** A surface read the thread's real total (`CommentsSheet.onCountSeen`): it may only grow. */
export function notePostCommentCount(postId: number, count: number): void {
  const id = Number(postId);
  const seen = Number(count);
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isFinite(seen)) return;
  const record = recordOf(id);
  if (seen > record.comments) rememberPostEngagement(id, { comments: Math.round(seen) });
}

export function setPostCommentsOpen(postId: number, open: boolean): void {
  rememberPostEngagement(postId, { commentsOpen: Boolean(open) });
}

export function setPostDistributeOpen(postId: number, open: boolean): void {
  rememberPostEngagement(postId, { distributeOpen: Boolean(open) });
}

/**
 * The record of one post, subscribed, together with the six presses every surface makes.
 *
 * The actions are built here rather than in each component so that the *component* only paints: a reel
 * and a page of words cannot send a like differently, cannot count a comment differently and cannot
 * disagree about what is saved, because there is one implementation of each and they share one record.
 * A surface that mounts this post twice (the feed's page and the reader route) gets the same numbers in
 * both, which is the whole point of the module.
 */
export type PostEngagementApi = PostEngagement & {
  mine: string | null;
  react: (kind: string, options?: { paymentIntentId?: string | null; approval?: PaymentIntent | null }) => void;
  save: () => void;
  repost: () => void;
  share: () => void;
  openComments: () => void;
  closeComments: () => void;
  toggleDistribute: () => void;
  closeDistribute: () => void;
  commentWritten: () => void;
  commentSeen: (count: number) => void;
  paid: (approval: PaymentIntent) => void;
  closePayment: () => void;
  fail: (text: string) => void;
  inform: (text: string) => void;
  clearNotice: () => void;
};

export function usePostEngagement(post: SocialPost): PostEngagementApi {
  const id = Number(post.id);
  useSyncExternalStore(
    subscribePostEngagement,
    () => {
      const record = RECORDS.get(id);
      return record ? `${record.at}:${record.commentsOpen ? 'c' : ''}${record.distributeOpen ? 'd' : ''}` : 'absent';
    },
  );
  /**
   * A payload seeds the record on every render, and `seedPostEngagement` is the one place that decides
   * what may be taken from it ("fill, never overwrite"). Seeding is silent by design, so this render is
   * the only one it affects.
   */
  seedPostEngagement(post);
  const record = recordOf(id);
  return {
    ...record,
    mine: viewerReaction(record.summary),
    react: (kind, options = {}) => reactToPost(id, kind, options),
    save: () => togglePostSaved(id),
    repost: () => togglePostRepost(id),
    share: () => sharePostFrom(id),
    openComments: () => setPostCommentsOpen(id, true),
    closeComments: () => setPostCommentsOpen(id, false),
    toggleDistribute: () => setPostDistributeOpen(id, !recordOf(id).distributeOpen),
    closeDistribute: () => setPostDistributeOpen(id, false),
    commentWritten: () => notePostComment(post),
    commentSeen: (count: number) => notePostCommentCount(id, count),
    paid: (approval) => payForReaction(id, approval),
    closePayment: () => closePostPayment(id),
    fail: (text: string) => notePostNotice(id, text),
    inform: (text: string) => notePostNotice(id, text, 'info'),
    clearNotice: () => clearPostNotice(id),
  };
}

/** Forget everything. Only a test does this: the phone's records live as long as the process. */
export function clearPostEngagement(): void {
  RECORDS.clear();
  LISTENERS.clear();
  IN_FLIGHT.clear();
  VERSION = 0;
}

