import { localDateTimeAt } from "../../shared/domain/user-calendar.domain-service.js";
import type { ReportType } from "./ai-report.constants.js";
import { isoWeekPeriodOf, monthPeriodOf, reportPeriodId } from "./report-period.domain-service.js";

/**
 * 사용자 로컬 기준 새 주기 시작 뒤 디스패치를 허용하는 시간.
 * 매시 실행이 몇 번 빠져도(재배포·장애·DST) 같은 날 안에서 따라잡고, 중복은 멱등 키가 막는다.
 */
export const REPORT_DISPATCH_WINDOW_HOURS = 6;

/** 사용자 로컬 시각이 새 주(월요일)·새 달(1일) 시작 직후인지 판단한다. 이때 직전 주기가 끝나 있다. */
export function isInReportDispatchWindow(type: ReportType, at: Date, timezone: string): boolean {
  const local = localDateTimeAt(at, timezone);
  const isPeriodStart = type === "WEEKLY" ? local.dayOfWeek === 1 : local.day === 1;
  return isPeriodStart && local.hour < REPORT_DISPATCH_WINDOW_HOURS;
}

/** 사용자 로컬 기준 디스패치 주기 식별자. 기존 KST 사용자의 멱등 키와 같은 형식이다. */
export function reportDispatchPeriodId(type: ReportType, at: Date, timezone: string): string {
  const localDate = localDateTimeAt(at, timezone).toPlainDate();
  return reportPeriodId(
    type,
    type === "WEEKLY" ? isoWeekPeriodOf(localDate) : monthPeriodOf(localDate),
  );
}
