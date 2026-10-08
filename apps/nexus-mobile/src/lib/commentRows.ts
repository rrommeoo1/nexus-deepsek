import type { CommentView } from './socialTypes';
import type { CommentEngagementItem } from './postInteractions';

export type ThreadRow =
  | { kind: 'comment'; key: string; comment: CommentView; depth: number; childCount: number; parentId: number | null }
  | { kind: 'toggle'; key: string; parentId: number; depth: number; hiddenCount: number; collapsed: boolean }
  | { kind: 'sort-tabs'; key: string }
  | { kind: 'empty-replies'; key: string }
  | { kind: 'engagement'; key: string; item: CommentEngagementItem; engagementKind: 'likes' | 'quotes' };

/** A pure pre-order projection; FlatList never mounts recursive row components. */
export function flattenCommentRows(
  comments: CommentView[],
  collapsed: Readonly<Record<number, boolean>>,
  revealed: Readonly<Record<number, number>>,
): ThreadRow[] {
  const children = new Map<number, CommentView[]>();
  const ids = new Set(comments.map((comment) => comment.id));
  for (const comment of comments) {
    const parentId = Number(comment.parent_id || 0);
    const key = parentId && ids.has(parentId) && parentId !== comment.id ? parentId : 0;
    const group = children.get(key) ?? [];
    group.push(comment);
    children.set(key, group);
  }
  const rows: ThreadRow[] = [];
  const seen = new Set<number>();
  const structurallyReachable = new Set<number>();
  const stack = [...(children.get(0) ?? [])];
  while (stack.length) {
    const current = stack.pop()!;
    if (structurallyReachable.has(current.id)) continue;
    structurallyReachable.add(current.id);
    stack.push(...(children.get(current.id) ?? []));
  }
  const visit = (comment: CommentView, depth: number) => {
    if (seen.has(comment.id)) return;
    seen.add(comment.id);
    const direct = children.get(comment.id) ?? [];
    rows.push({ kind: 'comment', key: `comment:${comment.id}`, comment, depth, childCount: direct.length, parentId: comment.parent_id ?? null });
    if (!direct.length) return;
    const isCollapsed = collapsed[comment.id] === true;
    const count = isCollapsed ? 0 : Math.min(direct.length, revealed[comment.id] ?? 3);
    for (const child of direct.slice(0, count)) visit(child, depth + 1);
    rows.push({ kind: 'toggle', key: `toggle:${comment.id}`, parentId: comment.id, depth, hiddenCount: direct.length - count, collapsed: isCollapsed });
  };
  for (const root of children.get(0) ?? []) visit(root, 0);
  // Malformed/orphan cycles never vanish; intentionally hidden descendants do not become roots.
  for (const comment of comments) if (!structurallyReachable.has(comment.id) && !seen.has(comment.id)) visit(comment, 0);
  return rows;
}

/** The first comments page is a list of conversations, not an interleaved tree. */
export function rootCommentRows(comments: CommentView[]): ThreadRow[] {
  const ids = new Set(comments.map((comment) => comment.id));
  const counts = new Map<number, number>();
  for (const comment of comments) {
    const parentId = Number(comment.parent_id || 0);
    if (ids.has(parentId)) counts.set(parentId, (counts.get(parentId) ?? 0) + 1);
  }
  return comments.filter((comment) => !comment.parent_id || !ids.has(comment.parent_id)).map((comment) => ({
    kind: 'comment' as const, key: `comment:${comment.id}`, comment, depth: 0,
    childCount: Math.max(counts.get(comment.id) ?? 0, Number(comment.reply_count ?? 0)), parentId: null,
  }));
}

/** One reading level per screen: the selected comment and all its direct replies. */
export function focusedCommentRows(comments: CommentView[], focusId: number): ThreadRow[] {
  const focused = comments.find((comment) => comment.id === focusId);
  if (!focused) return [];
  const counts = new Map<number, number>();
  for (const comment of comments) {
    const parentId = Number(comment.parent_id || 0);
    if (parentId) counts.set(parentId, (counts.get(parentId) ?? 0) + 1);
  }
  const row = (comment: CommentView, parentId: number | null): ThreadRow => ({
    kind: 'comment', key: `comment:${comment.id}`, comment, depth: 0, parentId,
    childCount: Math.max(counts.get(comment.id) ?? 0, Number(comment.reply_count ?? 0)),
  });
  const replies = comments.filter((comment) => Number(comment.parent_id) === focusId).map((comment) => row(comment, focusId));
  return [row(focused, null), { kind: 'sort-tabs', key: `sort:${focusId}` },
    ...(replies.length ? replies : [{ kind: 'empty-replies' as const, key: `empty:${focusId}` }])];
}
