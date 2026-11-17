import { startOfLocalDate } from "../../shared/domain/user-calendar.domain-service.js";
import type { ReportType } from "./ai-reports.constants.js";
import { nonIsoWeekDate } from "./ai-reports.errors.js";

/** 리포트 행은 (type, year, period)로 하나다. 주간은 ISO 주 연도·주차, 월간은 연·월이다 */
export interface ReportPeriod {
  readonly year: number;
  readonly period: number;
}

/** ISO 주는 목요일이 든 해의 주라 연말·연초 날짜는 달력 연도와 다를 수 있다(2027-01-03 → 2026-W53) */
export function isoWeekPeriodOf(date: Temporal.PlainDate): ReportPeriod {
  const { yearOfWeek, weekOfYear } = date;
  if (yearOfWeek == null || weekOfYear == null) {
    throw nonIsoWeekDate();
  }
  return { year: yearOfWeek, period: weekOfYear };
}

export function monthPeriodOf(date: Temporal.PlainDate): ReportPeriod {
  return { year: date.year, period: date.month };
}

/** 리포트가 분석하는 지난 주기와 그 전 주기의 경계. 끝은 다음 주기 첫날의 시작이다 */
export interface ReportWindow extends ReportPeriod {
  readonly startDate: Date;
  readonly endDate: Date;
  readonly prevStartDate: Date;
  readonly prevEndDate: Date;
  /** 사용자 로컬 기간 첫날·마지막 날 (YYYY-MM-DD) */
  readonly periodStart: string;
  readonly periodEnd: string;
}

/**
 * 주간은 지난 주(월~일), 월간은 지난달이다. 달력 날짜를 먼저 정하고 각 경계를 다시 시간대에 적용해
 * DST offset을 반영한다.
 */
export function resolveLastReportWindow(input: {
  readonly type: ReportType;
  readonly localToday: Temporal.PlainDate;
  readonly timezone: string;
}): ReportWindow {
  const { type, localToday, timezone } = input;
  if (type === "WEEKLY") {
    const thisMonday = localToday.subtract({ days: localToday.dayOfWeek - 1 });
    const lastWeekStart = thisMonday.subtract({ weeks: 1 });
    return toReportWindow(isoWeekPeriodOf(lastWeekStart), {
      start: lastWeekStart,
      end: thisMonday,
      previousStart: lastWeekStart.subtract({ weeks: 1 }),
      timezone,
    });
  }
  const thisMonthStart = localToday.with({ day: 1 });
  const lastMonthStart = thisMonthStart.subtract({ months: 1 });
  return toReportWindow(monthPeriodOf(lastMonthStart), {
    start: lastMonthStart,
    end: thisMonthStart,
    previousStart: lastMonthStart.subtract({ months: 1 }),
    timezone,
  });
}

function toReportWindow(
  period: ReportPeriod,
  days: {
    readonly start: Temporal.PlainDate;
    readonly end: Temporal.PlainDate;
    readonly previousStart: Temporal.PlainDate;
    readonly timezone: string;
  },
): ReportWindow {
  const { start, end, previousStart, timezone } = days;
  return {
    ...period,
    startDate: startOfLocalDate(start, timezone),
    endDate: startOfLocalDate(end, timezone),
    prevStartDate: startOfLocalDate(previousStart, timezone),
    prevEndDate: startOfLocalDate(start, timezone),
    periodStart: start.toString(),
    periodEnd: end.subtract({ days: 1 }).toString(),
  };
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
