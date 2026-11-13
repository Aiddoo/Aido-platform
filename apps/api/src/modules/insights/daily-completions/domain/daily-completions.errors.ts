import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function invalidDateRange(
  startDate: Temporal.PlainDate,
  endDate: Temporal.PlainDate,
): DomainException {
  return new DomainException(ErrorCode.SYS_0002, {
    field: "dateRange",
    startDate: startDate.toString(),
    endDate: endDate.toString(),
  });
}
