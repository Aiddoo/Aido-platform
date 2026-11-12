import type { SupportedLocale } from "#api/shared/domain/locale";
import { formatIsoWeekLabel } from "#api/shared/domain/time/week-of-month";

import type { ReportType } from "../../domain/ai-report.constants.js";
import { computeDateRange } from "../../domain/report-period.domain-service.js";

const MONTH_NAMES_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const MONTHLY_LABELS: Readonly<Record<SupportedLocale, (year: number, month: number) => string>> = {
  ko: (year, month) => `${year}년 ${month}월`,
  en: (year, month) => `${MONTH_NAMES_EN[month - 1]} ${year}`,
};

interface PeriodLabelInput {
  readonly type: ReportType;
  readonly year: number;
  readonly period: number;
  readonly locale: SupportedLocale;
  /** 사용자 시간대의 오늘. 주간 라벨은 주차 달의 해가 올해가 아니면 연도를 붙인다 */
  readonly localToday: Temporal.PlainDate;
}

/** 주간은 주간 성취와 같은 "11월 2주차"(다른 해면 "2025년 12월 1주차")다. 출시 앱이 이 글자를 그대로 보여도 모양은 같은 문자열이다 */
export function computePeriodLabel({
  type,
  year,
  period,
  locale,
  localToday,
}: PeriodLabelInput): string {
  if (type === "MONTHLY") {
    return MONTHLY_LABELS[locale](year, period);
  }
  const { startDate } = computeDateRange(type, year, period);
  return formatIsoWeekLabel(Temporal.PlainDate.from(startDate), locale, localToday);
}
