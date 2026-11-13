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
