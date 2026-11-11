import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

/**
 * 요약 대상 날짜를 사용자 시간대의 오늘 또는 내일로 제한합니다.
 *
 * 위젯은 자정이 지나기 전에 내일 요약을 미리 받아 timeline에 넣습니다. 과거나 먼 미래는
 * 위젯 계약 밖이므로 SYS_0002로 거부합니다.
 */
export function resolveTodoSummaryDate(
  today: Temporal.PlainDate,
  requestedDate?: Temporal.PlainDate,
): Temporal.PlainDate {
  if (requestedDate == null) {
    return today;
  }

  const tomorrow = today.add({ days: 1 });
  if (!requestedDate.equals(today) && !requestedDate.equals(tomorrow)) {
    throw new DomainException(ErrorCode.SYS_0002, {
      field: "date",
      value: requestedDate.toString(),
      allowed: [today.toString(), tomorrow.toString()],
    });
  }

  return requestedDate;
}
