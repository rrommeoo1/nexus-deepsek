import type { CommentView } from './socialTypes';

export type ThreadRow =
  | { kind: 'comment'; key: string; comment: CommentView; depth: number; childCount: number; parentId: number | null }
  | { kind: 'toggle'; key: string; parentId: number; depth: number; hiddenCount: number; collapsed: boolean };

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
