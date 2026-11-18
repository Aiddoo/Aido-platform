import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

/** 요약은 오늘·내일만 볼 수 있다 */
export function summaryDateNotAllowed(
  requestedDate: string,
  allowedDates: readonly string[],
): DomainException {
  return new DomainException(ErrorCode.SYS_0002, {
    field: "date",
    value: requestedDate,
    allowed: allowedDates,
  });
}

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
