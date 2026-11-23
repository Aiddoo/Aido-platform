import { localDateIn } from "#api/shared/domain/time/timezone-name";

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

/**
 * 시간대 묶음의 사람마다 현지 날짜 [firstDay, endDay)가 되는 순간을 모두 덮는 범위다.
 * 묶음의 시간대는 지금 오프셋이 같아도 그날 오프셋이 다를 수 있어 넓게 읽고, 사람마다 localDaysSince로 거른다.
 */
export function localDayRangeAcross(
  timezones: readonly string[],
  firstDay: Temporal.PlainDate,
  endDay: Temporal.PlainDate,
): { readonly since: Temporal.Instant; readonly until: Temporal.Instant } | null {
  const starts = timezones.map((timezone) => localStartOf(firstDay, timezone));
  const ends = timezones.map((timezone) => localStartOf(endDay, timezone));
  const since = starts.toSorted(Temporal.Instant.compare).at(0);
  const until = ends.toSorted(Temporal.Instant.compare).at(-1);
  return since == null || until == null ? null : { since, until };
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

/** 그 날이 속한 ISO 주의 월요일부터 다음 주 월요일 전까지 */
export function isoWeekRangeOf(date: Temporal.PlainDate): {
  readonly start: Temporal.PlainDate;
  readonly end: Temporal.PlainDate;
} {
  const start = date.subtract({ days: date.dayOfWeek - 1 });
  return { start, end: start.add({ weeks: 1 }) };
}
