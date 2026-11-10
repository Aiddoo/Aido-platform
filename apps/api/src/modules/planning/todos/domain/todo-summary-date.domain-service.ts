import { ErrorCode } from "@aido/api/errors";

import { addDays } from "#api/shared/domain/date/utils/arithmetic";
import { isSameDay } from "#api/shared/domain/date/utils/compare";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

/**
 * 요약 대상 날짜를 사용자 시간대의 오늘 또는 내일로 제한합니다.
 *
 * 위젯은 자정이 지나기 전에 내일 요약을 미리 받아 timeline에 넣습니다. 과거나 먼 미래는
 * 위젯 계약 밖이므로 SYS_0002로 거부합니다. 날짜는 모두 UTC 자정 DATE 값입니다.
 */
export function resolveTodoSummaryDate(today: Date, requestedDate?: Date): Date {
  if (requestedDate == null) {
    return today;
  }

  const tomorrow = addDays(1, today);
  if (!isSameDay(requestedDate, today) && !isSameDay(requestedDate, tomorrow)) {
    throw new DomainException(ErrorCode.SYS_0002, {
      field: "date",
      value: toDateString(requestedDate),
      allowed: [toDateString(today), toDateString(tomorrow)],
    });
  }

  return requestedDate;
}
