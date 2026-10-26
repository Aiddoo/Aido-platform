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
    // ISO 1주차는 1월 4일이 속한 주다. 현재 시각에 기대면 연초·연말에 주가 어긋난다.
    const monday = dayjs
      .utc(Date.UTC(year, 0, 4))
      .startOf("isoWeek")
      .add(period - 1, "week");
    const sunday = monday.endOf("isoWeek");
    return {
      startDate: toDateString(monday.toDate()),
      endDate: toDateString(sunday.toDate()),
    };
  }

  // MONTHLY: 해당 월 1일 ~ 마지막 날
  const monthStart = dayjs.utc(Date.UTC(year, period - 1, 1));
  const monthEnd = monthStart.endOf("month");
  return {
    startDate: toDateString(monthStart.toDate()),
    endDate: toDateString(monthEnd.toDate()),
  };
}
