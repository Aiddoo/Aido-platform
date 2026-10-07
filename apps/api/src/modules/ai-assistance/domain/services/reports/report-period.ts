import dayjs from "dayjs";

import { toDateString } from "#api/shared/domain/date/utils/format";

import type { ReportType } from "../../types/reports/ai-report.types.js";

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
    // ISO week: 해당 연도, 해당 주차의 월요일 ~ 일요일
    const monday = dayjs.utc().year(year).isoWeek(period).startOf("isoWeek");
    const sunday = monday.endOf("isoWeek");
    return {
      startDate: toDateString(monday.toDate()),
      endDate: toDateString(sunday.toDate()),
    };
  }

  // MONTHLY: 해당 월 1일 ~ 마지막 날
  const monthStart = dayjs
    .utc()
    .year(year)
    .month(period - 1)
    .startOf("month");
  const monthEnd = monthStart.endOf("month");
  return {
    startDate: toDateString(monthStart.toDate()),
    endDate: toDateString(monthEnd.toDate()),
  };
}
