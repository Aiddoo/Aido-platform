import { ErrorCode } from "@aido/api/errors";
import type { TodoImportStatus } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { toIsoString } from "#api/shared/domain/time/instant";

/** 지금 상태에서는 할 수 없는 전이(취소된 가져오기를 확정 등) */
export function todoImportStatusConflict(status: TodoImportStatus): DomainException {
  return new DomainException(ErrorCode.TODO_IMPORT_2305, { status });
}

export function todoImportUndoExpired(undoableUntil: Temporal.Instant): DomainException {
  return new DomainException(ErrorCode.TODO_IMPORT_2308, {
    undoableUntil: toIsoString(undoableUntil),
  });
}
