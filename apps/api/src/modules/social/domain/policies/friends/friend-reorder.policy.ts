export type ReorderPosition = "before" | "after";

export interface ReorderShift {
  from: number;
  to: number | null;
  delta: number;
}

export interface ReorderPlan {
  newSortOrder: number;
  shift: ReorderShift;
}

export function planReorderRelativeTo(
  currentSortOrder: number,
  targetSortOrder: number,
  position: ReorderPosition,
): ReorderPlan {
  const desired = position === "before" ? targetSortOrder : targetSortOrder + 1;

  if (currentSortOrder < desired) {
    return {
      newSortOrder: desired - 1,
      shift: { from: currentSortOrder + 1, to: desired - 1, delta: -1 },
    };
  }

  return {
    newSortOrder: desired,
    shift: { from: desired, to: currentSortOrder - 1, delta: 1 },
  };
}

export function planReorderToEdge(
  currentSortOrder: number,
  position: ReorderPosition,
  maxSortOrder: number,
): ReorderPlan {
  if (position === "before") {
    return {
      newSortOrder: 0,
      shift: { from: 0, to: currentSortOrder - 1, delta: 1 },
    };
  }

  return {
    newSortOrder: maxSortOrder,
    shift: { from: currentSortOrder + 1, to: null, delta: -1 },
  };
}
