const DAY_MS = 24 * 60 * 60_000;

// 리마인더 대상 구간은 사용자 현지 오늘을 UTC 자정 순간으로 둔 옛 기준을 그대로 쓴다
export function utcStartOf(date: Temporal.PlainDate): Temporal.Instant {
  return date.toZonedDateTime("UTC").toInstant();
}

/** 그 순간부터 현지 오늘(UTC 자정 기준)까지 지난 24시간 단위 일수. 0 쪽으로 버린다 */
export function elapsedDaysUntil(today: Temporal.PlainDate, since: Temporal.Instant): number {
  const days = Math.trunc((utcStartOf(today).epochMilliseconds - since.epochMilliseconds) / DAY_MS);
  // 오늘 자정 뒤의 순간은 -0이 되어 0과 다르게 비교되지 않게 맞춘다
  return days === 0 ? 0 : days;
}

// 날짜 키로 만든 PlainDate는 ISO 달력이라 주차가 늘 있고 타입만 undefined를 허용한다
function isoWeekOf(date: Temporal.PlainDate): { readonly year: number; readonly week: number } {
  const { yearOfWeek, weekOfYear } = date;
  if (yearOfWeek == null || weekOfYear == null) {
    throw new Error(`ISO 달력 날짜가 아니다: ${date.toString()}`);
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
