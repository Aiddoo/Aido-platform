import { resolveDateBoundaryTimezone } from "#api/shared/domain/time/timezone-name";

export interface DailySendWindow {
  readonly localDate: Temporal.PlainDate;
  readonly startsAt: Temporal.Instant;
  readonly endsAt: Temporal.Instant;
}

// 응원·찌르기 일간 한도는 보낸 사람이 요청한 시간대의 달력 하루다. 끝은 다음 현지 자정(제외)이다
export function dailySendWindowAt(params: {
  readonly now: Temporal.Instant;
  readonly timezone: string;
}): DailySendWindow {
  // 비었거나 모르는 시간대는 날짜 경계 규칙(UTC)의 하루로 센다
  const timezoneId = resolveDateBoundaryTimezone(params.timezone);
  const localDate = params.now.toZonedDateTimeISO(timezoneId).toPlainDate();
  return {
    localDate,
    startsAt: localDate.toZonedDateTime(timezoneId).toInstant(),
    endsAt: localDate.add({ days: 1 }).toZonedDateTime(timezoneId).toInstant(),
  };
}
