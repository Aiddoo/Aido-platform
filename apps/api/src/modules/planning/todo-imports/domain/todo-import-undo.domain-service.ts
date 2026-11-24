import { TODO_IMPORT_LIMITS } from "@aido/api/vocabulary";

const HOURS_PER_DAY = 24;

export type TodoImportUndoWindow =
  | { readonly kind: "open"; readonly undoableUntil: Temporal.Instant }
  | { readonly kind: "expired"; readonly undoableUntil: Temporal.Instant };

/** 완료한 순간부터 정해진 일 수(24시간 단위) 동안 되돌릴 수 있다. 시간대와 상관없는 순간 비교다 */
export function judgeUndoWindow(params: {
  readonly completedAt: Temporal.Instant;
  readonly now: Temporal.Instant;
}): TodoImportUndoWindow {
  const undoableUntil = params.completedAt.add({
    hours: TODO_IMPORT_LIMITS.UNDO_WINDOW_DAYS * HOURS_PER_DAY,
  });
  if (Temporal.Instant.compare(params.now, undoableUntil) < 0) {
    return { kind: "open", undoableUntil };
  }
  return { kind: "expired", undoableUntil };
}
