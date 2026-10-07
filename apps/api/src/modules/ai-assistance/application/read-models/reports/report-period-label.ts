import type { SupportedLocale } from "#api/shared/domain/locale";

import type { ReportType } from "../../../domain/types/reports/ai-report.types.js";

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

interface PeriodLabelTranslations {
  readonly weekly: (year: number, period: number) => string;
  readonly monthly: (year: number, period: number) => string;
}
const periodLabelTranslations: Readonly<Record<SupportedLocale, PeriodLabelTranslations>> = {
  ko: {
    weekly: (year, period) => `${year}년 ${period}주차`,
    monthly: (year, period) => `${year}년 ${period}월`,
  },
  en: {
    weekly: (year, period) => `Week ${period}, ${year}`,
    monthly: (year, period) => `${MONTH_NAMES_EN[period - 1]} ${year}`,
  },
};

export function computePeriodLabel(
  type: ReportType,
  year: number,
  period: number,
  locale: SupportedLocale = "ko",
): string {
  const translations = periodLabelTranslations[locale];
  return type === "WEEKLY" ? translations.weekly(year, period) : translations.monthly(year, period);
}
