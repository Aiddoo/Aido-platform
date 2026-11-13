import { ErrorCode } from "@aido/api/errors";
import { TODO_ITEM_LIMITS, TODO_LIMITS } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function scheduleEndsBeforeStart(
  startDate: Temporal.PlainDate,
  endDate: Temporal.PlainDate,
): DomainException {
  return new DomainException(
    ErrorCode.SYS_0002,
    { startDate: startDate.toString(), endDate: endDate.toString() },
    { message: "종료 날짜는 시작 날짜보다 빠를 수 없습니다." },
  );
}

export function todoTitleLengthOutOfRange(titleLength: number, minLength: number): DomainException {
  return new DomainException(
    ErrorCode.SYS_0002,
    { titleLength, max: TODO_LIMITS.TITLE_MAX_LENGTH },
    { message: `제목은 ${minLength}~${TODO_LIMITS.TITLE_MAX_LENGTH}자여야 합니다.` },
  );
}

export function checklistLimitReached(currentCount: number): DomainException {
  return new DomainException(ErrorCode.TODO_0821, {
    currentCount,
    maxPerTodo: TODO_ITEM_LIMITS.MAX_PER_TODO,
  });
}

export function duplicateChecklistItemIds(received: number, unique: number): DomainException {
  return new DomainException(
    ErrorCode.SYS_0002,
    { received, unique },
    { message: "중복된 하위 항목 ID가 있습니다" },
  );
}

export function incompleteChecklistItemIds(expected: number, received: number): DomainException {
  return new DomainException(
    ErrorCode.SYS_0002,
    { expected, received },
    { message: "모든 하위 항목 ID를 전달해야 합니다" },
  );
}

export function checklistItemNotFound(itemId: number): DomainException {
  return new DomainException(ErrorCode.TODO_0822, { itemId });
}
