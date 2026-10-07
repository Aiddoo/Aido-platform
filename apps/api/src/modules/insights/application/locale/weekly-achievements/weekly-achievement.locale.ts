import type { SupportedLocale } from "#api/shared/domain/locale";

const MONTH_SHORT_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const weekLabels: Record<SupportedLocale, (month: number, week: number) => string> = {
  ko: (month, week) => `${month}월 ${week}주차`,
  en: (month, week) => `Week ${week} of ${MONTH_SHORT_EN[month - 1]}`,
};

export function formatWeekLabel(month: number, week: number, locale: SupportedLocale): string {
  return weekLabels[locale](month, week);
}
