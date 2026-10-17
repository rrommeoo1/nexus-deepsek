import { useSyncExternalStore } from 'react';
import { API_ORIGIN, NexusApiError, nexusApi } from './nexusApi';

/**
 * One relationship, one place. Every payload the server already answers with carries a few fields about the
 * relation between the reader and the account it names, and this module is where those fields are read once,
 * merged into one record per account, and handed to every screen that prints a face.
 *
 * The endpoints behind it are the real ones (`apps/nexus-web/lib/api.js`):
 *
 *   * `POST /api/follow` (`api.js:4489`) with `{ user_id, persona, active }` → `200 { active,
 *     request_pending, counts }`; `active: false` is the unfollow, and it also cancels a pending or accepted
 *     request (`repo.js:1797-1802`). A private target answers **202** `{ request_pending: true, request_id }`
 *     (`api.js:4504-4517`), and a blocked or unknown target answers `404 profile not found` (`api.js:4496`,
 *     `:4508`, `:4520` — `SOCIAL_FOLLOW_BLOCKED`).
 *   * `GET /api/follow/requests?direction=incoming|outgoing` (`api.js:4462`) for the requests themselves.
 *   * `POST /api/follow/requests/:id/decision` (`api.js:4474`) with `{ decision }`, where the server's two
 *     words are `accept` and `decline` (`repo.js:1873`) — `404` when the row is gone or already decided
 *     (`SOCIAL_FOLLOW_REQUEST_NOT_FOUND` / `SOCIAL_FOLLOW_REQUEST_CONFLICT`).
 *   * `GET /api/social/relations?kind=followers|following|favorites&cursor=` (`api.js:4537`) for the lists,
 *     each person carrying `relation`, `following_me` and `counts` (`repo.js:1926-1932`).
 *   * `POST /api/profile/block` (`api.js:4627`) with `{ user_id, active }`: a block deletes the follows in
 *     both directions and cancels the requests in both directions (`repo.js:997-1001`), which is why the
 *     optimistic state below clears `following`, `followsMe` and `requested` when it sets a block.
 *   * `POST /api/profile/mute` (`api.js:4257`) with `{ user_id, active, scope, topic }`: a mute revokes
 *     nothing (`repo.js:1530-1537`), it only stops the account being a candidate for this reader.
 *
 * What the server does **not** offer is written down instead of invented (`MIGRATION.md` §19.1): there is no
 * endpoint that removes a follower, none that reports an account, and no read that publishes another
 * account's `message_policy` — so no screen draws those, and the `Mesaj` button learns a refusal only from
 * the send itself (`api.js:5116-5118`), which is then remembered here.
 */

/** The words the relations UI prints, each with the bundle key it comes from. */
export const RELATION_WORDS = {
  /** `x.menu.follow` / `publicProfile.follow`. */
  follow: 'Urmărește',
  /** `publicProfile.following` / `post.following`. */
  following: 'Urmărești',
  /** `x.menu.unfollow` — the word the confirmation carries. */
  unfollow: 'Nu mai urmări',
  /** `publicProfile.requested` — a request of mine, still waiting. */
  requested: 'Solicitat',
  /** `friends.requestCancelled`: what a pressed waiting request does. */
  requestCancelled: 'Cerere anulată',
  /** `thread.accept` / `thread.decline`: the two answers to a request that came in. */
  accept: 'Acceptă',
  decline: 'Refuză',
  /** `feed.friends` + `header.friends`: two follows that face each other. */
  friends: 'Prieteni',
  /** `publicProfile.edit`: the owner's own primary button. */
  edit: 'Editează profilul',
  /** `publicProfile.message`. */
  message: 'Mesaj Nexus',
  /** `x.menu.block` / `x.menu.unblock`. */
  block: 'Blochează contul',
  unblock: 'Deblochează contul',
  /** `x.menu.mute` / `x.menu.unmute`. */
  mute: 'Mutează contul',
  unmute: 'Anulează mute',
  /** `x.menu.title`: the round button's own name. */
  options: 'Opțiuni',
  /** `x.menu.relationshipFailed`, printed whenever a change was refused. */
  relationshipFailed: 'Relația nu a putut fi schimbată',
  /** `publicProfile.unavailable` — the sentence an unavailable record answers with. */
  unavailable: 'Profil indisponibil',
} as const;

/**
 * The words the new header needs that the ro-RO bundle does not have yet. They are the owner's own choice
 * (`MIGRATION.md` §19.2, `docs/PARITY-MATRIX.md` — „decizie de design a proprietarului"), written here as
 * constants rather than typed into a component so the whole app can move to one bundle key later.
 */
export const HEADER_WORDS = {
  /** A follower of mine I do not follow back: the accent the reference profile gives it. */
  followBack: 'Urmărește înapoi',
  /** A private record I do not follow: the only door into it. */
  requestFollow: 'Cere să urmărești',
  share: 'Distribuie profilul',
  /** The third counter, named after what the payload really counts (`counts.posts`). */
  posts: 'Postări',
  followers: 'Urmăritori',
  following: 'Urmărești',
} as const;

/** The actions the server can actually perform, one word each. */
export type RelationActionId =
  | 'follow' | 'unfollow' | 'request' | 'cancel_request'
  | 'block' | 'unblock' | 'mute' | 'unmute'
  | 'accept' | 'decline';

export type RelationCounts = { followers?: number; following?: number; posts?: number };

/** What one account's relation is worth right now, as the store holds it. */
export type RelationView = {
  userId: number;
  /** `profile.is_self`. */
  self: boolean;
  /** `profile.is_following` — I follow them. */
  following: boolean;
  /**
   * Whether the payload that filled `following` really said it. `socialPostView` carries `muted_by_me`,
   * `blocked_by_me` and `follow_request_pending` but **not** whether I follow the author (`api.js:742-746`),
   * while the web's own card reads `post.following_me` (`app.js:4317`) — a field the server never sets, so the
   * web's card button always reads "not following". This app refuses to guess: while the follow side is
   * unknown the button reads the record (`resolveRelation`) and shows the spinner instead of a word that may
   * be wrong (`MIGRATION.md` §19.1, the discrepancy is reported there and not patched in the client).
   */
  followingKnown: boolean;
  /** `person.following_me` — they follow me. */
  followsMe: boolean;
  /** `profile.follow_request_pending` — my request waits for them. */
  requested: boolean;
  /** `post.blocked_by_me` / a block this app sent. */
  blockedByMe: boolean;
  /** `post.muted_by_me` / a mute this app sent. */
  mutedByMe: boolean;
  /** `profile.visibility`, kept as the server word it is. */
  visibility: string;
  counts: RelationCounts;
  /** `404 profile not found`: the record is blocked, hidden, or gone. */
  unavailable: boolean;
  /** A send answered `403` because of their `message_policy` (`api.js:5116-5118`). */
  messageRefused: boolean;
  /** The action in flight, so a double tap cannot become two requests. */
  busy: RelationActionId | null;
  /** When the record was last written, in milliseconds of this device's clock. */
  at: number;
};

/** A reading of one payload: only the fields the payload really carried are set. */
export type RelationPatch = Partial<Omit<RelationView, 'userId' | 'at'>> & { userId?: number | null };

const EMPTY: Omit<RelationView, 'userId' | 'at'> = {
  self: false,
  following: false,
  followingKnown: false,
  followsMe: false,
  requested: false,
  blockedByMe: false,
  mutedByMe: false,
  visibility: 'public',
  counts: {},
  unavailable: false,
  messageRefused: false,
  busy: null,
};

const RECORDS = new Map<number, RelationView>();
const LISTENERS = new Set<() => void>();
let VERSION = 0;

function emit(): void {
  VERSION += 1;
  for (const listener of Array.from(LISTENERS)) listener();
}

/** The version of the store, for anything that has to rerender on any change. */
export function relationsVersion(): number {
  return VERSION;
}

export function subscribeRelations(listener: () => void): () => void {
  LISTENERS.add(listener);
  return () => { LISTENERS.delete(listener); };
}

/** The record of one account, or nothing when no payload has ever mentioned it. */
export function relationOf(userId?: number | null): RelationView | undefined {
  const id = Number(userId);
  return Number.isSafeInteger(id) && id > 0 ? RECORDS.get(id) : undefined;
}

/** Every record the store holds, newest first — what a report or a debug screen reads. */
export function relationsSnapshot(): RelationView[] {
  return Array.from(RECORDS.values()).sort((left, right) => right.at - left.at);
}

/**
 * The store's one writer. A patch replaces only the facts it carries: a payload that says `is_following` and
 * nothing about `following_me` leaves the follower side as the last payload that knew it, which is why no
 * screen has to be handed a full record to stay correct.
 */
export function remember(patch: RelationPatch): RelationView | null {
  const id = Number(patch.userId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const previous = RECORDS.get(id);
  const next: RelationView = { ...EMPTY, ...(previous ?? {}), userId: id, at: Date.now() };
  for (const key of Object.keys(patch) as (keyof RelationView)[]) {
    if (key === 'userId' || key === 'at') continue;
    const value = patch[key];
    if (value === undefined) continue;
    if (key === 'counts') {
      next.counts = { ...(previous?.counts ?? {}), ...(value as RelationCounts) };
      continue;
    }
    (next as unknown as Record<string, unknown>)[key] = value;
  }
  RECORDS.set(id, next);
  emit();
  return next;
}

/** Forgets every record: the session changed, so every relation in memory belongs to someone else. */
export function forgetRelations(): void {
  if (!RECORDS.size) return;
  RECORDS.clear();
  emit();
}

/** The counters a payload carries, read as numbers: a missing one stays missing rather than becoming 0. */
function countsFrom(counts: RelationCounts): RelationCounts {
  const next: RelationCounts = {};
  if (counts.followers !== undefined) next.followers = Math.max(0, Number(counts.followers) || 0);
  if (counts.following !== undefined) next.following = Math.max(0, Number(counts.following) || 0);
  if (counts.posts !== undefined) next.posts = Math.max(0, Number(counts.posts) || 0);
  return next;
}

/** `profile` of `GET /api/profiles/:handle` (`api.js:2989-3030`). */
export function patchFromProfile(profile?: {
  user_id?: number | null;
  is_self?: boolean;
  is_following?: boolean;
  follow_request_pending?: boolean;
  visibility?: string | null;
  counts?: RelationCounts | null;
} | null): RelationPatch | null {
  if (!profile) return null;
  const userId = Number(profile.user_id);
  if (!Number.isSafeInteger(userId) || userId <= 0) return null;
  return {
    userId,
    ...(profile.is_self === undefined ? {} : { self: profile.is_self === true }),
    ...(profile.is_following === undefined ? {} : { following: profile.is_following === true, followingKnown: true }),
    ...(profile.follow_request_pending === undefined ? {} : { requested: profile.follow_request_pending === true }),
    ...(profile.visibility ? { visibility: String(profile.visibility) } : {}),
    ...(profile.counts ? { counts: countsFrom(profile.counts) } : {}),
    unavailable: false,
  };
}

/** One person of `GET /api/social/relations` (`repo.js:1926-1932`): `relation`, `following_me`, `counts`. */
export function patchFromPerson(person?: {
  user_id?: number | null;
  id?: number | null;
  relation?: string | null;
  following_me?: boolean;
  counts?: RelationCounts | null;
} | null): RelationPatch | null {
  if (!person) return null;
  const userId = Number(person.user_id ?? person.id);
  if (!Number.isSafeInteger(userId) || userId <= 0) return null;
  /**
   * The two fields say different things, and the repo says which (`repo.js:1903-1932`):
   *
   *   * `relation` is the list the person was read from — `following` is the list of the accounts I follow,
   *     `followers` the list of the accounts that follow me;
   *   * `following_me` is **my** side of it: `this.isFollowing(userId, person.user_id, persona)`, so true means
   *     I follow them. The name reads the other way round, which is why this is the only place that reads it.
   *
   * So a followers row also tells the app that this account follows me, which is the one payload in the whole
   * API that can recognise a mutual follow (`Prieteni`) or a follower I have not answered
   * (`Urmărește înapoi`) — every screen that later prints that account inherits the same answer.
   */
  const listed = String(person.relation ?? '');
  return {
    userId,
    ...(listed === 'followers' ? { followsMe: true } : {}),
    ...(person.following_me === undefined ? {} : { following: person.following_me === true, followingKnown: true }),
    ...(person.counts ? { counts: countsFrom(person.counts) } : {}),
  };
}

/** A post's author, from `socialPostView` (`api.js:742-744`) and from the profile endpoint's own posts. */
export function patchFromPost(post?: {
  author?: { id?: number | null } | null;
  user_id?: number | null;
  following_me?: boolean;
  follow_request_pending?: boolean;
  muted_by_me?: boolean;
  blocked_by_me?: boolean;
} | null): RelationPatch | null {
  if (!post) return null;
  const userId = Number(post.author?.id ?? post.user_id);
  if (!Number.isSafeInteger(userId) || userId <= 0) return null;
  return {
    userId,
    ...(post.following_me === undefined ? {} : { followsMe: post.following_me === true }),
    ...(post.follow_request_pending === undefined ? {} : { requested: post.follow_request_pending === true }),
    ...(post.muted_by_me === undefined ? {} : { mutedByMe: post.muted_by_me === true }),
    ...(post.blocked_by_me === undefined ? {} : { blockedByMe: post.blocked_by_me === true }),
  };
}

/** A live session's host (`/api/social/live`): the one relation field it carries is `is_following`. */
export function patchFromLive(session?: {
  host_id?: number | null;
  user_id?: number | null;
  is_following?: boolean;
} | null): RelationPatch | null {
  if (!session) return null;
  const userId = Number(session.host_id ?? session.user_id);
  if (!Number.isSafeInteger(userId) || userId <= 0) return null;
  return { userId, ...(session.is_following === undefined ? {} : { following: session.is_following === true, followingKnown: true }) };
}

/**
 * The handles whose record is being read right now. A record the payloads never mentioned cannot be shown as
 * followed or not — so the button reads that one record (`GET /api/profiles/:handle`, `api.js:2870`) and paints
 * a spinner until the answer lands, instead of printing a word the server never said.
 */
const RESOLVING = new Set<string>();

const handleKey = (handle?: string | null, persona = 'social'): string =>
  `${persona}:${String(handle ?? '').trim().toLowerCase().replace(/^@/, '')}`;

/** Reads one record into the store, once per handle at a time, so a list of cards makes one read per face. */
export async function resolveRelation(handle?: string | null, persona = 'social'): Promise<RelationView | null> {
  const who = String(handle ?? '').trim().replace(/^@/, '');
  const key = handleKey(who, persona);
  if (!who || RESOLVING.has(key)) return null;
  RESOLVING.add(key);
  emit();
  try {
    const page = await nexusApi<{ ok: true; profile?: { user_id?: number } }>(
      `/api/profiles/${encodeURIComponent(who)}?persona=${encodeURIComponent(persona)}`,
    );
    rememberPayload(page);
    const id = Number(page.profile?.user_id);
    return relationOf(id) ?? null;
  } catch {
    /** A record that cannot be read stays unknown: the button keeps its spinner, it never guesses. */
    return null;
  } finally {
    RESOLVING.delete(key);
    emit();
  }
}

/** Whether a face's record is being read right now, subscribed, so the button can show it. */
export function useRelationResolving(handle?: string | null, persona = 'social'): boolean {
  const key = handleKey(handle, persona);
  useSyncExternalStore(
    subscribeRelations,
    () => (key && RESOLVING.has(key) ? 'reading:' + VERSION : 'idle'),
  );
  return Boolean(key) && RESOLVING.has(key);
}

/**
 * Feeds the store from any payload that names accounts, in one call. Every screen hands over what it just
 * received and the store keeps what each payload knew — this is the app's only reader of a payload, which is
 * what makes one relation the same relation on every screen.
 */
export function rememberPayload(payload: unknown): void {
  if (!payload || typeof payload !== 'object') return;
  const body = payload as Record<string, unknown>;
  const profile = patchFromProfile(body.profile as never);
  if (profile) remember(profile);
  const lists = [body.people, body.profiles, body.requests, body.conversations, body.notifications, body.posts, body.live, body.creators, body.stories, body.items];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (!entry || typeof entry !== 'object') continue;
      const row = entry as Record<string, unknown>;
      const person = patchFromPerson(row as never);
      if (person) remember(person);
      const live = patchFromLive(row as never);
      if (live && (row.host_id !== undefined || row.is_following !== undefined)) remember(live);
      const post = patchFromPost(row as never);
      if (post && ((row.author as { id?: unknown } | undefined)?.id !== undefined || row.user_id !== undefined)) remember(post);
    }
  }
}

/** What a `catch` is worth to a reader: a sentence for the status, or the one word the menu uses. */
export function relationErrorMessage(cause: unknown): string {
  if (cause instanceof NexusApiError) {
    if (cause.status === 404) return RELATION_WORDS.unavailable;
    if (cause.status === 429) return 'Prea multe cereri într-un timp scurt. Reîncearcă în câteva momente.';
    if (cause.status === 409) return 'Relația s-a schimbat între timp. Reîncarcă și încearcă din nou.';
    if (cause.status >= 500) return 'Serverul nu a confirmat schimbarea. Reîncearcă.';
  }
  return RELATION_WORDS.relationshipFailed;
}

/** The shape `POST /api/follow` answers with (`api.js:4502`, `:4516`, `:4527`). */
type FollowReply = { ok: true; active?: boolean; request_pending?: boolean; counts?: RelationCounts | null };

async function post(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return nexusApi<Record<string, unknown>>(path, {
    method: 'POST',
    /**
     * The web client's `api()` lets the browser send `Origin`; a native client has no browser, so it says
     * who it is out loud. The value is the API's own origin — what the header would hold on the web.
     * `nexusApi` adds the `Idempotency-Key` every mutation needs (`lib/idempotency.ts`).
     */
    headers: { Origin: API_ORIGIN },
    body: JSON.stringify(body),
  });
}

/**
 * The optimistic half of a follow press, so the button answers under the finger: a public record becomes
 * followed, a private one becomes a waiting request (`api.js:4504`). The server's answer replaces this.
 */
export function optimisticFollow(target: { userId: number; persona?: string }, active: boolean, visibility = 'public'): RelationView | null {
  const id = Number(target.userId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  if (!active) return remember({ userId: id, following: false, followingKnown: true, requested: false });
  if (visibility === 'private') return remember({ userId: id, requested: true, following: false, followingKnown: false });
  return remember({ userId: id, following: true, followingKnown: true, requested: false });
}

/**
 * One press of a relation button, in four steps: the record is written first, the server is asked next, its
 * answer is merged in, and a refusal puts the previous record back field for field. The record carries the
 * action in flight while it waits, so the same button cannot be pressed twice into two requests, and a
 * second press while it waits returns the record as it stands.
 */
export async function mutateRelation(
  action: RelationActionId,
  target: { userId: number; persona?: string },
  run: () => Promise<RelationPatch | null>,
): Promise<RelationView | null> {
  const id = Number(target.userId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const before = relationOf(id);
  if (before?.busy) return before;
  remember({ userId: id, busy: action });
  try {
    const patch = await run();
    remember({ ...(patch ?? {}), userId: id, busy: null });
    return relationOf(id) ?? null;
  } catch (cause) {
    remember({ ...(before ?? { userId: id }), busy: null });
    throw cause;
  }
}

/** Follow, or unfollow when `active` is false — the one call both halves of the button use. */
export async function setFollowing(target: { userId: number; persona?: string }, active: boolean): Promise<RelationView | null> {
  const persona = target.persona ?? 'social';
  const id = Number(target.userId);
  const known = relationOf(id);
  if (known?.busy) return known;
  /**
   * The snapshot the rollback returns to: the record *before* the optimistic write, because the mutation's own
   * rollback only knows the state it was handed (the optimistic one). Two layers, one honest answer.
   */
  const before = known ? { ...known } : null;
  optimisticFollow(target, active, known?.visibility);
  const action: RelationActionId = active ? 'follow' : 'unfollow';
  try {
    return await mutateRelation(action, target, async () => {
      const reply = await post('/api/follow', { user_id: id, persona, active }) as FollowReply;
      return {
        userId: id,
        following: reply.active === true,
        followingKnown: true,
        requested: reply.request_pending === true,
        unavailable: false,
        ...(reply.counts ? { counts: countsFrom(reply.counts) } : {}),
      };
    });
  } catch (cause) {
    /**
     * A `404` is the server's whole answer for a record that blocked this reader or is gone (`api.js:4496`): the
     * button stops offering a relation, and no further press is drawn. Any other refusal puts the record back
     * exactly where it was, field for field.
     */
    remember({
      ...(before ?? { userId: id }),
      busy: null,
      ...(cause instanceof NexusApiError && cause.status === 404 ? { unavailable: true } : {}),
    });
    throw cause;
  }
}

/**
 * Cancels the request of mine that is still waiting. The server has one door for it: `POST /api/follow` with
 * `active: false`, which deletes nothing but marks the pending row `cancelled` (`repo.js:1800-1802`).
 */
export function cancelFollowRequest(target: { userId: number; persona?: string }): Promise<RelationView | null> {
  return setFollowing(target, false);
}

/**
 * Accepts or declines a request that came in (`api.js:4474`; the server's two words are `accept` and
 * `decline`, `repo.js:1873`). Accepting makes them a follower of mine — that is what the accepted row means
 * (`repo.js:1884`) — so the record learns `followsMe`; declining only closes the queue entry.
 */
export function decideFollowRequest(
  request: { requestId: number; userId: number; persona?: string },
  decision: 'accept' | 'decline',
): Promise<RelationView | null> {
  const id = Number(request.userId);
  if (!Number.isSafeInteger(id) || id <= 0) return Promise.resolve(null);
  return mutateRelation(decision, { userId: id, persona: request.persona }, async () => {
    await post(`/api/follow/requests/${Number(request.requestId)}/decision`, { decision });
    return decision === 'accept' ? { userId: id, followsMe: true } : { userId: id };
  });
}

/** Blocking clears the two follows and the request, exactly as the server does (`repo.js:997-1001`). */
export async function setBlocked(target: { userId: number; persona?: string }, active: boolean): Promise<RelationView | null> {
  const persona = target.persona ?? 'social';
  const id = Number(target.userId);
  const action: RelationActionId = active ? 'block' : 'unblock';
  return mutateRelation(action, target, async () => {
    await post('/api/profile/block', { user_id: id, persona, active });
    return active
      ? { userId: id, blockedByMe: true, following: false, followsMe: false, requested: false }
      : { userId: id, blockedByMe: false };
  });
}

/** A mute revokes nothing (`repo.js:1530-1537`): the record only learns that this reader stops seeing them. */
export async function setMuted(target: { userId: number; persona?: string }, active: boolean): Promise<RelationView | null> {
  const persona = target.persona ?? 'social';
  const id = Number(target.userId);
  const action: RelationActionId = active ? 'mute' : 'unmute';
  return mutateRelation(action, target, async () => {
    await post('/api/profile/mute', { user_id: id, persona, active, scope: 'account', topic: '' });
    return { userId: id, mutedByMe: active };
  });
}

/** The send refused with 403 because of their policy (`api.js:5116-5118`) — remembered, so the button explains itself. */
export function noteMessageRefused(userId: number): void {
  remember({ userId: Number(userId), messageRefused: true });
}

/**
 * The record of one account, subscribed: a mutation anywhere rerenders every screen that prints that face.
 * The snapshot is a string built from the record's own stamp, which is stable between writes and therefore
 * safe for `useSyncExternalStore` to compare.
 */
export function useRelation(userId?: number | null): RelationView | undefined {
  const id = Number(userId);
  const watched = Number.isSafeInteger(id) && id > 0 ? id : 0;
  useSyncExternalStore(
    subscribeRelations,
    () => {
      const record = RECORDS.get(watched);
      return record ? record.at + ':' + (record.busy ?? '') : 'absent';
    },
  );
  return RECORDS.get(watched);
}

/** The account a face belongs to, as the screen knows it. */
export type RelationTarget = {
  userId: number | null;
  handle?: string | null;
  persona?: string | null;
  /** The name the payload printed, used in the button's own accessible name. */
  name?: string | null;
};

/** The one thing a primary button does. */
export type RelationUiAction = 'edit_profile' | 'follow' | 'unfollow' | 'request' | 'cancel_request' | 'unblock' | 'none';

/** The state the button is drawn in, named after what the record is, not after what was pressed. */
export type RelationUiKind =
  | 'self' | 'unavailable' | 'blocked'
  | 'friends' | 'following' | 'requested'
  | 'requestable' | 'follow_back' | 'followable' | 'unresolved';

export type RelationMenuItem = {
  id: RelationActionId;
  label: string;
  /** Printed last, in the warning ink: a block takes the relation away rather than changing it. */
  destructive?: boolean;
  /** Whether this entry's own action is already on, so pressing it turns it off. */
  active?: boolean;
};

export type RelationUi = {
  kind: RelationUiKind;
  primary: {
    action: RelationUiAction;
    label: string;
    tone: 'accent' | 'neutral';
    /** The word the confirmation carries, when the action takes something away. */
    confirm?: string;
    accessibilityLabel: string;
  };
  message: { enabled: boolean; label: string; reason?: string };
  menu: RelationMenuItem[];
  /** Whether the record's own content region may be read. */
  contentVisible: boolean;
  /** The sentence the region prints instead, when it may not. */
  note?: string;
};

/**
 * The menu of an account: only what the server can really do (`MIGRATION.md` §19.1). A blocked account keeps
 * one entry — the way back — because a mute on someone who cannot be seen changes nothing. Nothing else is
 * drawn: there is no route that removes a follower and none that reports an account, so no entry pretends
 * there is.
 */
export function relationMenu(relation?: RelationView): RelationMenuItem[] {
  if (!relation || relation.self || relation.unavailable) return [];
  if (relation.blockedByMe) return [{ id: 'unblock', label: RELATION_WORDS.unblock, active: true }];
  return [
    relation.mutedByMe
      ? { id: 'unmute', label: RELATION_WORDS.unmute, active: true }
      : { id: 'mute', label: RELATION_WORDS.mute, active: false },
    { id: 'block', label: RELATION_WORDS.block, destructive: true, active: false },
  ];
}

/**
 * The one function that says what a relation looks like. It is pure — the same record, target and viewer
 * always answer the same button — so the header, a feed card, a comment row and a conversation can be held
 * against each other, and a screen that printed something else would be the screen that is wrong.
 *
 * The cases, each one taken from the audit rather than from taste (`MIGRATION.md` §19.1):
 *
 *   * my own record (`profile.is_self`) has no relation button at all: its primary is the editor;
 *   * a record the server answered `404` for (`unavailable`) is printed without any action;
 *   * a record I blocked keeps only the unblock, and its content is not shown (the server hides it anyway);
 *   * a private record I do not follow offers the request (`api.js:4504`), and shows no content;
 *   * a waiting request of mine (`follow_request_pending`) is pressed to cancel (`repo.js:1800-1802`);
 *   * two follows that face each other are `Prieteni`, and pressing it is the unfollow with its confirmation;
 *   * a follower of mine I do not follow back gets the accent `Urmărește înapoi`;
 *   * everyone else is `Urmărește`, the accent the reference profile gives it.
 */
export function deriveRelationUi(
  relation: RelationView | undefined,
  target: RelationTarget,
  viewer: { userId?: number | null } = {},
): RelationUi {
  const self = relation?.self === true
    || (relation !== undefined && target.userId !== null && Number(target.userId) === Number(viewer.userId));
  const who = String(target.name || target.handle || '').trim() || 'acest cont';
  const named = (word: string) => `${word} · ${who}`;
  const messageOff = (reason?: string): RelationUi['message'] => ({
    enabled: false,
    label: RELATION_WORDS.message,
    ...(reason ? { reason } : {}),
  });

  if (self) {
    return {
      kind: 'self',
      primary: { action: 'edit_profile', label: RELATION_WORDS.edit, tone: 'accent', accessibilityLabel: RELATION_WORDS.edit },
      message: messageOff('Conversația cu propriul cont nu are destinatar.'),
      menu: [],
      contentVisible: true,
    };
  }

  if (relation?.unavailable) {
    return {
      kind: 'unavailable',
      primary: { action: 'none', label: RELATION_WORDS.unavailable, tone: 'neutral', accessibilityLabel: named(RELATION_WORDS.unavailable) },
      message: messageOff('Contul nu este disponibil.'),
      menu: [],
      contentVisible: false,
      note: RELATION_WORDS.unavailable,
    };
  }

  if (relation?.blockedByMe === true) {
    return {
      kind: 'blocked',
      primary: { action: 'unblock', label: RELATION_WORDS.unblock, tone: 'neutral', accessibilityLabel: named(RELATION_WORDS.unblock) },
      message: messageOff('Mesajele sunt oprite cât timp contul este blocat.'),
      menu: relationMenu(relation),
      contentVisible: false,
      note: 'Conținutul acestui cont nu se afișează cât timp îl ai blocat.',
    };
  }

  const following = relation?.following === true;
  const followsMe = relation?.followsMe === true;
  const message: RelationUi['message'] = relation?.messageRefused
    ? messageOff('Acest cont nu acceptă mesaje de la tine.')
    : { enabled: true, label: RELATION_WORDS.message };

  if (relation?.requested === true) {
    return {
      kind: 'requested',
      primary: {
        action: 'cancel_request',
        label: RELATION_WORDS.requested,
        tone: 'neutral',
        confirm: RELATION_WORDS.requestCancelled,
        accessibilityLabel: named(RELATION_WORDS.requested),
      },
      message,
      menu: relationMenu(relation),
      contentVisible: false,
      note: 'Cererea de urmărire așteaptă confirmarea contului.',
    };
  }

  if (following) {
    const word = followsMe ? RELATION_WORDS.friends : RELATION_WORDS.following;
    return {
      kind: followsMe ? 'friends' : 'following',
      primary: { action: 'unfollow', label: word, tone: 'neutral', confirm: RELATION_WORDS.unfollow, accessibilityLabel: named(word) },
      message,
      menu: relationMenu(relation),
      contentVisible: true,
    };
  }

  if (followsMe) {
    return {
      kind: 'follow_back',
      primary: { action: 'follow', label: HEADER_WORDS.followBack, tone: 'accent', accessibilityLabel: named(HEADER_WORDS.followBack) },
      message,
      menu: relationMenu(relation),
      contentVisible: true,
    };
  }

  if (relation?.visibility === 'private') {
    return {
      kind: 'requestable',
      primary: { action: 'request', label: HEADER_WORDS.requestFollow, tone: 'accent', accessibilityLabel: named(HEADER_WORDS.requestFollow) },
      message,
      menu: relationMenu(relation),
      contentVisible: false,
      note: 'Acest cont este privat. Conținutul apare după ce cererea este acceptată.',
    };
  }

  /**
   * Nothing is known about the follow side yet: the payloads that named this account said nothing about it
   * (`socialPostView` has no follow field, `api.js:742-746`). The button reads the record and paints the read;
   * it never prints `Urmărește` for an account that may already be followed.
   */
  if (relation?.followingKnown !== true && !following) {
    return {
      kind: 'unresolved',
      primary: { action: 'none', label: RELATION_WORDS.follow, tone: 'accent', accessibilityLabel: named(RELATION_WORDS.follow) },
      message,
      menu: [],
      contentVisible: true,
    };
  }

  return {
    kind: 'followable',
    primary: { action: 'follow', label: RELATION_WORDS.follow, tone: 'accent', accessibilityLabel: named(RELATION_WORDS.follow) },
    message,
    menu: relationMenu(relation),
    contentVisible: true,
  };
}
