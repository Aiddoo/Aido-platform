import type { ReorderPosition } from "@aido/api/vocabulary";

export interface SortOrderShift {
  readonly fromSortOrder: number;
  readonly toSortOrder: number | null;
  readonly delta: 1 | -1;
}

export interface FriendMovePlan {
  readonly sortOrder: number;
  readonly shift: SortOrderShift;
}

// 새로 수락한 친구는 목록 맨 뒤에 둔다
export function nextFriendSortOrder(maxSortOrder: number | null): number {
  return maxSortOrder == null ? 0 : maxSortOrder + 1;
}

export function planFriendMoveRelativeTo(params: {
  readonly currentSortOrder: number;
  readonly targetSortOrder: number;
  readonly position: ReorderPosition;
}): FriendMovePlan {
  const { currentSortOrder, targetSortOrder, position } = params;
  const desiredSortOrder = position === "before" ? targetSortOrder : targetSortOrder + 1;
  const isMovingDown = currentSortOrder < desiredSortOrder;

  if (isMovingDown) {
    return {
      sortOrder: desiredSortOrder - 1,
      shift: { fromSortOrder: currentSortOrder + 1, toSortOrder: desiredSortOrder - 1, delta: -1 },
    };
  }
  return {
    sortOrder: desiredSortOrder,
    shift: { fromSortOrder: desiredSortOrder, toSortOrder: currentSortOrder - 1, delta: 1 },
  };
}

export function planFriendMoveToEdge(params: {
  readonly currentSortOrder: number;
  readonly position: ReorderPosition;
  readonly maxSortOrder: number;
}): FriendMovePlan {
  const { currentSortOrder, position, maxSortOrder } = params;
  if (position === "before") {
    return {
      sortOrder: 0,
      shift: { fromSortOrder: 0, toSortOrder: currentSortOrder - 1, delta: 1 },
    };
  }
  return {
    sortOrder: maxSortOrder,
    shift: { fromSortOrder: currentSortOrder + 1, toSortOrder: null, delta: -1 },
  };
}
