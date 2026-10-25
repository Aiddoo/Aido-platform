import { USER_REPORT_LIMITS } from "@aido/api/vocabulary";

const HOUR_MS = 60 * 60 * 1000;

/** 같은 대상을 다시 신고해도 새 접수로 보지 않는 구간의 시작 시각 */
export function duplicateReportWindowStart(now: Date): Date {
  return new Date(now.getTime() - USER_REPORT_LIMITS.DUPLICATE_WINDOW_HOURS * HOUR_MS);
}

/** 하루 신고 한도를 세는 구간의 시작 시각 */
export function dailyReportWindowStart(now: Date): Date {
  return new Date(now.getTime() - 24 * HOUR_MS);
}

export function hasReachedDailyReportLimit(reportCountInWindow: number): boolean {
  return reportCountInWindow >= USER_REPORT_LIMITS.DAILY_LIMIT;
}
