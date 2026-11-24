/**
 * 后台刷新把服务端词汇/语法交给阅读器时，用新列表替换本地列表，
 * 但按 id / 数据库 id / 归一化键把当前选中项对上，避免抽屉被清掉。
 * 选中项若这次快照里还没有（例如刚保存、刷新略早），先留在列表里。
 */

export type ReconcilableAsideItem = {
  id: string;
  dbItemId: string | null;
  normalized_key: string;
  occurrences: Array<{
    id: string;
    start_offset?: number;
    end_offset?: number;
  }>;
};

export type AsideSelection = {
  itemId: string;
  occurrenceId?: string;
};

export function sameAsideSelection(
  a: AsideSelection | null,
  b: AsideSelection | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.itemId === b.itemId && a.occurrenceId === b.occurrenceId;
}

function findIncomingMatch<T extends ReconcilableAsideItem>(
  incoming: T[],
  prevItem: T | undefined,
  selectedId: string,
): T | undefined {
  const byId = incoming.find((item) => item.id === selectedId);
  if (byId) return byId;
  if (prevItem?.dbItemId) {
    const byDb = incoming.find((item) => item.dbItemId === prevItem.dbItemId);
    if (byDb) return byDb;
  }
  if (prevItem?.normalized_key) {
    const byKey = incoming.find(
      (item) => item.normalized_key === prevItem.normalized_key,
    );
    if (byKey) return byKey;
  }
  return incoming.find(
    (item) =>
      item.dbItemId === selectedId ||
      item.occurrences.some((occ) => occ.id === selectedId),
  );
}

function remapOccurrenceId<T extends ReconcilableAsideItem>(
  prevItem: T | undefined,
  match: T,
  occurrenceId: string | undefined,
): string | undefined {
  if (!occurrenceId) return match.occurrences[0]?.id;
  if (match.occurrences.some((occ) => occ.id === occurrenceId)) {
    return occurrenceId;
  }
  const prevOcc = prevItem?.occurrences.find((occ) => occ.id === occurrenceId);
  if (
    prevOcc?.start_offset !== undefined &&
    prevOcc.end_offset !== undefined
  ) {
    const hit = match.occurrences.find(
      (occ) =>
        occ.start_offset === prevOcc.start_offset &&
        occ.end_offset === prevOcc.end_offset,
    );
    if (hit) return hit.id;
  }
  return match.occurrences[0]?.id ?? occurrenceId;
}

export function reconcileAsideItems<T extends ReconcilableAsideItem>(
  prev: T[],
  incoming: T[],
  selection: AsideSelection | null,
): { items: T[]; selection: AsideSelection | null } {
  if (!selection) {
    return { items: incoming, selection: null };
  }

  const prevItem = prev.find((item) => item.id === selection.itemId);
  const match = findIncomingMatch(incoming, prevItem, selection.itemId);
  if (!match) {
    if (prevItem && !incoming.some((item) => item.id === prevItem.id)) {
      return { items: [...incoming, prevItem], selection };
    }
    if (prevItem) return { items: incoming, selection };
    return { items: incoming, selection: null };
  }

  return {
    items: incoming,
    selection: {
      itemId: match.id,
      occurrenceId: remapOccurrenceId(prevItem, match, selection.occurrenceId),
    },
  };
}
