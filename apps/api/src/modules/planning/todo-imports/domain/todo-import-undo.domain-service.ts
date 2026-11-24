import { TODO_IMPORT_LIMITS, type TodoImportStatus } from "@aido/api/vocabulary";

const HOURS_PER_DAY = 24;

export type TodoImportUndoWindow =
  | { readonly kind: "open"; readonly undoableUntil: Temporal.Instant }
  | { readonly kind: "expired"; readonly undoableUntil: Temporal.Instant }
  | { readonly kind: "unavailable" };

/**
 * 완료했거나 실패로 멈췄고 만든 할 일이 남아 있으면 끝난 순간부터 정해진 일 수(24시간 단위) 동안 되돌릴 수 있다.
 * 시간대와 상관없는 순간 비교다
 */
export function judgeUndoWindow(params: {
  readonly status: TodoImportStatus;
  readonly completedAt: Temporal.Instant | null;
  readonly updatedAt: Temporal.Instant;
  readonly createdCount: number;
  readonly undoneCount: number;
  readonly now: Temporal.Instant;
}): TodoImportUndoWindow {
  const endedAt = findEndedAt(params);
  if (endedAt == null || params.createdCount <= params.undoneCount) {
    return { kind: "unavailable" };
  }
  const undoableUntil = endedAt.add({ hours: TODO_IMPORT_LIMITS.UNDO_WINDOW_DAYS * HOURS_PER_DAY });
  if (Temporal.Instant.compare(params.now, undoableUntil) < 0) {
    return { kind: "open", undoableUntil };
  }
  return { kind: "expired", undoableUntil };
}

// 실패는 되돌리기 말고는 더 바뀌지 않아 updatedAt이 멈춘 시각이다. 완료 뒤 되돌리다 실패했으면 완료 시각부터 센다
function findEndedAt(params: {
  readonly status: TodoImportStatus;
  readonly completedAt: Temporal.Instant | null;
  readonly updatedAt: Temporal.Instant;
}): Temporal.Instant | null {
  if (params.status === "COMPLETED") {
    return params.completedAt;
  }
  if (params.status === "FAILED") {
    return params.completedAt ?? params.updatedAt;
  }
  return null;
}
