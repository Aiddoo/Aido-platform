export type ReorderPosition = 'before' | 'after';

export interface ReorderInstruction {
  movedItemId: number;
  targetId: number;
  position: ReorderPosition;
}

interface ItemWithId {
  id: number;
}

export const getReorderInstruction = <TItem extends ItemWithId>(
  reorderedData: TItem[],
  from: number,
  to: number,
): ReorderInstruction | null => {
  if (from === to) return null;

  const movedItem = reorderedData[to];
  if (!movedItem) return null;

  if (to === 0) {
    const target = reorderedData[1];
    if (!target) return null;

    return {
      movedItemId: movedItem.id,
      targetId: target.id,
      position: 'before',
    };
  }

  const target = reorderedData[to - 1];
  if (!target) return null;

  return {
    movedItemId: movedItem.id,
    targetId: target.id,
    position: 'after',
  };
};
