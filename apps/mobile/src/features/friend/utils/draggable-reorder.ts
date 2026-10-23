export type ReorderPosition = 'before' | 'after';

export interface FriendReorderInstruction {
  movedFollowId: string;
  targetFollowId: string;
  position: ReorderPosition;
}

interface ItemWithFollowId {
  followId: string;
}

export const getFriendReorderInstruction = <TItem extends ItemWithFollowId>(
  reorderedData: TItem[],
  from: number,
  to: number,
): FriendReorderInstruction | null => {
  if (from === to) {
    return null;
  }

  const movedItem = reorderedData[to];
  if (!movedItem) {
    return null;
  }

  if (to === 0) {
    const target = reorderedData[1];
    if (!target) {
      return null;
    }

    return {
      movedFollowId: movedItem.followId,
      targetFollowId: target.followId,
      position: 'before',
    };
  }

  const target = reorderedData[to - 1];
  if (!target) {
    return null;
  }

  return {
    movedFollowId: movedItem.followId,
    targetFollowId: target.followId,
    position: 'after',
  };
};
