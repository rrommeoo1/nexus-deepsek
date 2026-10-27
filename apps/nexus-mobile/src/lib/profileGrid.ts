/**
 * The owner's arrangement of their own profile grid.
 *
 * Two facts decide where a tile stands: the server's `grid_position` (the place the owner dragged it
 * to, `POST /api/posts/order`) and the reading the tab is on. This file is the arithmetic of both, kept
 * pure so the phone can be told what it should draw without a renderer, and so the drag gesture can be
 * tested as numbers instead of as pixels.
 *
 * Three rules are deliberate:
 *
 *   - a post the owner has never placed has **no** position, not position zero. It therefore stays
 *     above the arrangement, newest first, which is what makes a new post visible instead of buried;
 *   - a pin is not a position: it is hoisted by the reading (`profileContent.ts`), so pinning never
 *     rewrites the places the owner chose for everything else;
 *   - the arrangement belongs to one profile and one persona, and only a post of that account is ever
 *     placed (`repo.setProfileGridOrder` refuses the rest).
 */
export type GridPost = {
  id?: number;
  grid_position?: number | null;
  pinned_at?: number;
  user_id?: number;
  created_at?: number | string | null;
  /** Present when this cell is a repost: the share is what the owner arranges, not the post inside it. */
  __repost?: { id?: number; grid_position?: number | null; reposted_at?: number } | null;
};

/**
 * The identity of one cell of the archive, as a number an arrangement can hold.
 *
 * A post is its own id. A repost is `-shareId`: negative, because post ids are positive and a share id can
 * equal a post id — the two live in different tables, so the sign is what keeps one arrangement from
 * meaning two different cells. `0` means "no identity", and no caller may place it.
 */
export function tileId(post: GridPost | null | undefined): number {
  const share = Number(post?.__repost?.id);
  if (Number.isSafeInteger(share) && share > 0) return -share;
  const id = Number(post?.id);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

/**
 * The entry the server accepts for one tile (`repo.setProfileGridOrder`): a post tile names its post, a
 * repost tile names its share. The two are never interchangeable — a repost written as a post id would be
 * refused as somebody else's post, which is precisely the refusal that used to make reposts unarrangeable.
 */
export function tileEntry(id: number): { post_id: number } | { share_id: number } | null {
  const value = Number(id);
  if (!Number.isSafeInteger(value) || value === 0) return null;
  return value < 0 ? { share_id: -value } : { post_id: value };
}

/** Post id to place, as the grid reads it. */
export type Arrangement = ReadonlyMap<number, number>;

/** The number of columns the archive draws, as `socialTokens.archive.gridColumns`. */
export const GRID_COLUMNS = 3;
/** The gap between cells, as `socialTokens.archive.gridGap`. */
export const GRID_GAP = 2;
/** The cell's own shape, as `socialTokens.archive.tileAspect` (9:16). */
export const TILE_ASPECT = 9 / 16;

/**
 * The places the payload already carries. A post with no `grid_position`, a withdrawn one, or a value
 * that is not a whole number simply has no place: the grid must not invent one from an index it happens
 * to read, because that would silently rearrange an archive nobody arranged.
 */
export function arrangementMap(posts: readonly GridPost[] | null | undefined): Arrangement {
  const map = new Map<number, number>();
  for (const post of Array.isArray(posts) ? posts : []) {
    const id = tileId(post);
    if (!id) continue;
    // A repost's place is the share's own (`post_shares.grid_position`); the post's own `grid_position`
    // belongs to its author, so reading it here would move somebody else's arrangement onto this profile.
    const raw = post?.__repost ? post.__repost.grid_position : post?.grid_position;
    if (raw === null || raw === undefined) continue;
    const place = Number(raw);
    if (!Number.isSafeInteger(place) || place < 0) continue;
    map.set(id, place);
  }
  return map;
}

/**
 * The places a drag has just made, before the server has answered.
 *
 * A gesture is previewed like every other arrangement in this app: the grid draws the order the finger
 * chose, the write travels, and the payload's own `grid_position` takes over again once it lands. A
 * failed write therefore costs the optimistic order and nothing else.
 *
 * A repost's identity is negative (`tileId`), and it is placed here like every other tile: leaving it
 * out used to drop the repost from the preview, so the grid drew the repost where the server had put it
 * last time while everything around it moved — a drag over a repost looked like a drag that failed.
 */
export function optimisticArrangement(ids: readonly unknown[] | null | undefined): Arrangement {
  const map = new Map<number, number>();
  (Array.isArray(ids) ? ids : []).forEach((value, index) => {
    const id = Number(value);
    if (Number.isSafeInteger(id) && id !== 0 && !map.has(id)) map.set(id, index);
  });
  return map;
}

/** The place one post holds, or nothing when the owner never placed it. */
export function arrangementRank(post: GridPost | null | undefined, arrangement: Arrangement | null | undefined): number | null {
  const id = tileId(post);
  if (!id || !arrangement) return null;
  const place = arrangement.get(id);
  return Number.isSafeInteger(place) && (place as number) >= 0 ? (place as number) : null;
}

/**
 * A post moved from one place to another, with everything between the two shifted by one. The list is
 * the whole gesture: `to` is the place the finger let go over, and a move to the same place is a no-op
 * that still returns a list, so a tap that did not drag costs nothing.
 */
export function moveWithin<T>(list: readonly T[], from: number, to: number): T[] {
  const copy = [...(Array.isArray(list) ? list : [])];
  if (copy.length < 2) return copy;
  const start = Math.max(0, Math.min(copy.length - 1, Math.trunc(Number(from) || 0)));
  const end = Math.max(0, Math.min(copy.length - 1, Math.trunc(Number(to) || 0)));
  if (start === end) return copy;
  const [moved] = copy.splice(start, 1);
  copy.splice(end, 0, moved);
  return copy;
}

/** A grid's own measurements: one cell and the gap between cells. */
export type GridGeometry = { columns?: number; tileWidth: number; tileHeight: number; gap?: number };

/**
 * The width and height of one cell of a grid of `columns` cells inside `containerWidth`, plus the same
 * two numbers under the names the placement arithmetic reads (`tileWidth` / `tileHeight`), so one value
 * describes both the cell and the slot.
 */
export function tileSize(containerWidth: number, columns = GRID_COLUMNS, gap = GRID_GAP): GridGeometry & { width: number; height: number } {
  const space = Math.max(0, Math.max(0, Number(containerWidth) || 0) - gap * Math.max(0, columns - 1));
  const width = columns > 0 ? space / columns : 0;
  const height = width / TILE_ASPECT;
  return { width, height, gap, columns, tileWidth: width, tileHeight: height };
}

/** Where the cell at `index` stands inside the grid, in points from the grid's own top-left corner. */
export function gridSlot(
  index: number,
  geometry: GridGeometry,
): { row: number; column: number; left: number; top: number } {
  const columns = Math.max(1, Math.trunc(Number(geometry.columns) || GRID_COLUMNS));
  const gap = Math.max(0, Number(geometry.gap ?? GRID_GAP) || 0);
  const place = Math.max(0, Math.trunc(Number(index) || 0));
  const row = Math.floor(place / columns);
  const column = place % columns;
  return {
    row,
    column,
    left: column * (geometry.tileWidth + gap),
    top: row * (geometry.tileHeight + gap),
  };
}

/**
 * The place a dragged cell is standing over.
 *
 * The finger's own offset decides it, not the cell's: the cell is drawn under the finger exactly, so the
 * moved cell's own corner is what the nearest slot is measured from. The answer is clamped inside the
 * grid, because a drop past the last cell is a drop on the last cell and never an index the list does
 * not have.
 */
export function gridTarget(options: {
  index: number;
  dx: number;
  dy: number;
  count: number;
  geometry: GridGeometry;
}): number {
  const count = Math.max(0, Math.trunc(Number(options.count) || 0));
  if (!count) return 0;
  const columns = Math.max(1, Math.trunc(Number(options.geometry.columns ?? GRID_COLUMNS) || GRID_COLUMNS));
  const gap = Math.max(0, Number(options.geometry.gap ?? GRID_GAP) || 0);
  const from = gridSlot(options.index, options.geometry);
  const stride = {
    x: Math.max(1, (Number(options.geometry.tileWidth) || 0) + gap),
    y: Math.max(1, (Number(options.geometry.tileHeight) || 0) + gap),
  };
  const column = Math.max(0, Math.min(columns - 1, Math.round((from.left + options.dx) / stride.x)));
  const row = Math.max(0, Math.round((from.top + options.dy) / stride.y));
  return Math.max(0, Math.min(count - 1, row * columns + column));
}


/** `PINNED_POST_LIMIT` of `lib/repo.js`: three pins are the whole allowance, counted per profile. */
export const PIN_LIMIT = 3;

export type ManageActions = {
  /** Whether this cell may offer its own place at the top. */
  canPin: boolean;
  /** Whether this cell may offer its deletion - only the owner's own posts ever can. */
  canDelete: boolean;
  /**
   * Whether this cell may be dragged at all. A repost sits in the owner's archive but not in the owner's
   * work: `POST /api/posts/order` only places this account's own posts (`repo.setProfileGridOrder`), so a
   * cell that is somebody else's must not offer a drag the server would refuse.
   */
  canPlace: boolean;
  /** The word the pin control prints: a pin already made offers its removal. */
  pinWord: string;
  /** Why the control is not offered, when it is not. */
  pinReason: string;
};

/**
 * What the management strip of one cell may offer.
 *
 * A repost is the case that matters: the tile is the owner's archive (they may arrange it) but the work in
 * it is somebody else's (they may not pin or delete it). So `canPlace` is true for a repost and the other
 * two are not — the server refuses a pin or a deletion of somebody else's post with 404, and the screen
 * never paints a control the server would refuse.
 */
export function manageActions(
  post: GridPost | null | undefined,
  options: { isOwner?: boolean; pinnedCount?: number; pinLimit?: number; ownerId?: number | null } = {},
): ManageActions {
  const pinned = Number(post?.pinned_at || 0) > 0;
  const limit = Math.max(1, Math.trunc(Number(options.pinLimit) || PIN_LIMIT));
  const count = Math.max(0, Math.trunc(Number(options.pinnedCount) || 0));
  const full = !pinned && count >= limit;
  const repost = Boolean(post?.__repost?.id);
  const own = Boolean(options.isOwner) && (options.ownerId === undefined || options.ownerId === null
    ? true
    : Number(post?.user_id) === Number(options.ownerId));
  return {
    canPin: own && !full,
    canDelete: own,
    // A repost belongs to this profile even though the post inside it does not: `post_shares.grid_position`
    // is the reposter's own place, which is what makes a repost draggable at all.
    canPlace: Boolean(options.isOwner) && (own || repost),
    pinWord: pinned ? 'Scoate din fixate' : 'Fixează',
    pinReason: full ? `Trei postări fixate sunt limita (${limit}).` : '',
  };
}

/** How many of the posts the grid shows are pinned, which is what the allowance is spent on. */
export function pinnedCount(posts: readonly GridPost[] | null | undefined): number {
  return (Array.isArray(posts) ? posts : []).filter((post) => Number(post?.pinned_at || 0) > 0).length;
}


/** Whether this cell is the owner's own work, which is what a pin or a deletion may touch. */
export function isOwnPost(post: GridPost | null | undefined, ownerId?: number | null): boolean {
  if (ownerId === undefined || ownerId === null) return true;
  return Number(post?.user_id) === Number(ownerId);
}

/**
 * Whether a drag may name this cell.
 *
 * Every cell of the owner's archive can be arranged: their own posts (`posts.grid_position`) and their own
 * reposts (`post_shares.grid_position`). Nothing here decides ownership of the *post* — a repost of
 * somebody else's post is still the owner's own entry on their own grid.
 */
export function isPlaceable(post: GridPost | null | undefined, ownerId?: number | null): boolean {
  if (!tileId(post)) return false;
  return isOwnPost(post, ownerId) || Boolean(post?.__repost?.id);
}

/**
 * The nearest place a drag may really write.
 *
 * With reposts arrangeable every cell is placeable, so this normally answers the index it was given. It
 * stays because a cell without an identity (a shared reply, a malformed node) must still not be written,
 * and a finger that lets go over one lands on the nearest cell that can be — first downwards, then upwards.
 */
export function nearestPlaceable(posts: readonly GridPost[], index: number, ownerId?: number | null): number {
  const list = Array.isArray(posts) ? posts : [];
  if (!list.length) return 0;
  const start = Math.max(0, Math.min(list.length - 1, Math.trunc(Number(index) || 0)));
  if (isPlaceable(list[start], ownerId)) return start;
  for (let step = 1; step < list.length; step += 1) {
    const after = start + step;
    if (after < list.length && isPlaceable(list[after], ownerId)) return after;
    const before = start - step;
    if (before >= 0 && isPlaceable(list[before], ownerId)) return before;
  }
  return start;
}

/** The identities of the cells an arrangement may name, in the order the grid draws them. */
export function placeableIds(posts: readonly GridPost[], ownerId?: number | null): number[] {
  return (Array.isArray(posts) ? posts : [])
    .filter((post) => isPlaceable(post, ownerId))
    .map(tileId)
    .filter((id) => id !== 0);
}

/**
 * The body of `POST /api/posts/order`: one entry per tile, in the order the finger left them.
 *
 * A post tile is `{ post_id }`, a repost tile is `{ share_id }`; the server writes the first to
 * `posts.grid_position` and the second to `post_shares.grid_position`, in one transaction, and refuses a
 * tile this account does not own — whole, never half-way.
 */
export function orderEntries(ids: readonly number[]): Array<{ post_id: number } | { share_id: number }> {
  const entries: Array<{ post_id: number } | { share_id: number }> = [];
  for (const id of Array.isArray(ids) ? ids : []) {
    const entry = tileEntry(Number(id));
    if (entry) entries.push(entry);
  }
  return entries;
}

