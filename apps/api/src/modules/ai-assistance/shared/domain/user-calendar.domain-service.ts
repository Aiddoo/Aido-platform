import { instantFromDate } from "#api/shared/domain/time/instant";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";

// 옛 날짜 함수(resolveTimezone)처럼 알 수 없는 저장 시간대는 AI 작업을 멈추지 않고 UTC로 계산한다
export function toUserTimeZone(raw: string): TimeZone {
  try {
    return TimeZone.create(raw);
  } catch {
    return TimeZone.UTC;
  }
}

export function localDateTimeAt(
  at: Date | Temporal.Instant,
  timezone: string,
): Temporal.ZonedDateTime {
  const instant = at instanceof Date ? instantFromDate(at) : at;
  return instant.toZonedDateTimeISO(toUserTimeZone(timezone).value);
}

export function localDateAt(at: Date | Temporal.Instant, timezone: string): Temporal.PlainDate {
  return localDateTimeAt(at, timezone).toPlainDate();
}

/** 서머타임으로 자정이 없는 날은 그날 첫 순간이다 */
export function startOfLocalDate(date: Temporal.PlainDate, timezone: string): Date {
  return new Date(date.toZonedDateTime(toUserTimeZone(timezone).value).epochMilliseconds);
}

// planning DATE 칸과 포트는 아직 달력 날짜를 UTC 자정 Date로 주고받는다
export function plainDateOfDateColumn(value: Date): Temporal.PlainDate {
  return instantFromDate(value).toZonedDateTimeISO("UTC").toPlainDate();
}

export function dateColumnOf(date: Temporal.PlainDate): Date {
  return new Date(date.toZonedDateTime("UTC").epochMilliseconds);
}

/** `dayIndexToDayOfWeek`가 받는 일요일 0 ~ 토요일 6. Temporal 요일은 월요일 1 ~ 일요일 7이다 */
export function sundayBasedDayIndex(date: Temporal.PlainDate): number {
  return date.dayOfWeek % 7;
}
