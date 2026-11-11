import { instantFromDate } from "#api/shared/domain/time/instant";
import { localDateIn, resolveTimezone } from "#api/shared/domain/time/time-zone-name";

// 알 수 없는 저장 시간대는 AI 작업을 멈추지 않고 UTC로 계산한다(resolveTimezone)
export function localDateTimeAt(
  at: Date | Temporal.Instant,
  timezone: string,
): Temporal.ZonedDateTime {
  const instant = at instanceof Date ? instantFromDate(at) : at;
  return instant.toZonedDateTimeISO(resolveTimezone(timezone));
}

export function localDateAt(at: Date | Temporal.Instant, timezone: string): Temporal.PlainDate {
  return localDateIn(at instanceof Date ? instantFromDate(at) : at, timezone);
}

/** 서머타임으로 자정이 없는 날은 그날 첫 순간이다 */
export function startOfLocalDate(date: Temporal.PlainDate, timezone: string): Date {
  return new Date(date.toZonedDateTime(resolveTimezone(timezone)).epochMilliseconds);
}

/** `dayIndexToDayOfWeek`가 받는 일요일 0 ~ 토요일 6. Temporal 요일은 월요일 1 ~ 일요일 7이다 */
export function sundayBasedDayIndex(date: Temporal.PlainDate): number {
  return date.dayOfWeek % 7;
}
