import { localDateIn } from "#api/shared/domain/time/time-zone-name";

import { nonIsoCalendarDate } from "./reminders.errors.js";

// 날짜 규칙(docs/conventions/dates.md): 배치는 사용자 저장 시간대의 달력 날짜로 센다

/** 그 순간이 현지 달력으로 오늘보다 며칠 전인지. 같은 날이면 0이다 */
export function localDaysSince(
  since: Temporal.Instant,
  today: Temporal.PlainDate,
  timezone: string,
): number {
  return localDateIn(since, timezone).until(today, { largestUnit: "days" }).days;
}

/** 현지 날짜가 시작하는 순간. 자정이 DST 틈이면 틈 뒤 첫 순간이다 */
export function localStartOf(date: Temporal.PlainDate, timezone: string): Temporal.Instant {
  return date.toZonedDateTime(timezone).toInstant();
}

// 날짜 키로 만든 PlainDate는 ISO 달력이라 주차가 늘 있고 타입만 undefined를 허용한다
function isoWeekOf(date: Temporal.PlainDate): { readonly year: number; readonly week: number } {
  const { yearOfWeek, weekOfYear } = date;
  if (yearOfWeek == null || weekOfYear == null) {
    throw nonIsoCalendarDate(date);
  }
  return { year: yearOfWeek, week: weekOfYear };
}

/** 지난주 월요일부터 이번 주 월요일 전까지(ISO 주). 연도·주차는 지난주 월요일 기준이다 */
export function previousIsoWeekOf(today: Temporal.PlainDate): {
  readonly start: Temporal.PlainDate;
  readonly end: Temporal.PlainDate;
  readonly isoYear: number;
  readonly isoWeek: number;
} {
  const end = today.subtract({ days: today.dayOfWeek - 1 });
  const start = end.subtract({ weeks: 1 });
  const { year, week } = isoWeekOf(start);
  return { start, end, isoYear: year, isoWeek: week };
}

/** 주 단위 발송 이력 key의 주 식별자(예: "2026-W10") */
export function isoWeekIdOf(date: Temporal.PlainDate): string {
  const { year, week } = isoWeekOf(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}
