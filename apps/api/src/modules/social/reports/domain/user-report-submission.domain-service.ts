import { USER_REPORT_LIMITS } from "@aido/api/vocabulary";

const DAILY_REPORT_WINDOW_HOURS = 24;

// 같은 대상을 다시 신고해도 새 접수로 보지 않는 구간의 시작 시각
export function duplicateReportWindowStart(now: Temporal.Instant): Temporal.Instant {
  return now.subtract({ hours: USER_REPORT_LIMITS.DUPLICATE_WINDOW_HOURS });
}

// 하루 한도는 사용자 현지 날짜가 아니라 지금부터 거꾸로 24시간을 센다
export function dailyReportWindowStart(now: Temporal.Instant): Temporal.Instant {
  return now.subtract({ hours: DAILY_REPORT_WINDOW_HOURS });
}

export function hasReachedDailyReportLimit(reportCountInWindow: number): boolean {
  return reportCountInWindow >= USER_REPORT_LIMITS.DAILY_LIMIT;
}
