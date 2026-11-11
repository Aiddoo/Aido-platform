import type { ReportType } from "./ai-report.constants.js";

/** 리포트 행은 (type, year, period)로 하나다. 주간은 ISO 주 연도·주차, 월간은 연·월이다 */
export interface ReportPeriod {
  readonly year: number;
  readonly period: number;
}

/** ISO 주는 목요일이 든 해의 주라 연말·연초 날짜는 달력 연도와 다를 수 있다(2027-01-03 → 2026-W53) */
export function isoWeekPeriodOf(date: Temporal.PlainDate): ReportPeriod {
  const { yearOfWeek, weekOfYear } = date;
  if (yearOfWeek == null || weekOfYear == null) {
    throw new RangeError("ISO 달력 날짜만 주차를 셀 수 있다");
  }
  return { year: yearOfWeek, period: weekOfYear };
}

export function monthPeriodOf(date: Temporal.PlainDate): ReportPeriod {
  return { year: date.year, period: date.month };
}

/** 멱등 키에 쓰는 주기 식별자("2026-W53"·"2027-M01"). 출시 뒤 바꾸지 않는다 */
export function reportPeriodId(type: ReportType, { year, period }: ReportPeriod): string {
  return `${year}-${type === "WEEKLY" ? "W" : "M"}${String(period).padStart(2, "0")}`;
}

/**
 * 날짜 범위 계산
 *
 * WEEKLY: ISO 주 기준 월요일 ~ 일요일
 * MONTHLY: 해당 월 1일 ~ 마지막 날
 */
export function computeDateRange(
  type: ReportType,
  year: number,
  period: number,
): { startDate: string; endDate: string } {
  if (type === "WEEKLY") {
    // ISO 1주차는 1월 4일이 속한 주다. 현재 시각에 기대면 연초·연말에 주가 어긋난다.
    const january4 = Temporal.PlainDate.from({ year, month: 1, day: 4 });
    const monday = january4.subtract({ days: january4.dayOfWeek - 1 }).add({ weeks: period - 1 });
    return {
      startDate: monday.toString(),
      endDate: monday.add({ days: 6 }).toString(),
    };
  }

  const monthStart = Temporal.PlainDate.from({ year, month: 1, day: 1 }).add({
    months: period - 1,
  });
  return {
    startDate: monthStart.toString(),
    endDate: monthStart.with({ day: monthStart.daysInMonth }).toString(),
  };
}
