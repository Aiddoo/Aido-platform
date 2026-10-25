export type ReorderPosition = 'before' | 'after';

export interface ReorderInstruction<TId> {
  movedId: TId;
  targetId: TId;
  position: ReorderPosition;
}

export function getReorderInstruction<TItem, TId>(
  reorderedItems: TItem[],
  from: number,
  to: number,
  getItemId: (item: TItem) => TId,
): ReorderInstruction<TId> | null {
  if (from === to) {
    return null;
  }

  const movedItem = reorderedItems[to];
  if (!movedItem) {
    return null;
  }

  if (to === 0) {
    const nextItem = reorderedItems[1];
    if (!nextItem) {
      return null;
    }

    return { movedId: getItemId(movedItem), targetId: getItemId(nextItem), position: 'before' };
  }

  const previousItem = reorderedItems[to - 1];
  if (!previousItem) {
    return null;
  }

  return { movedId: getItemId(movedItem), targetId: getItemId(previousItem), position: 'after' };
}
