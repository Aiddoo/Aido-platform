import type { DayOfWeek } from "@aido/api/vocabulary";

import type { SupportedLocale } from "#api/shared/domain/locale";

import type {
  AggregatedReportData,
  ReportType,
} from "../../../domain/types/reports/ai-report.types.js";
import { suggestionContextTranslations } from "../../locale/suggestions/suggestion-context.locale.js";
import type { BuildReportPromptOptions } from "./report.prompt.types.js";

const REPORT_DAY_LABELS = {
  ko: (day: DayOfWeek) => `${suggestionContextTranslations.ko.days[day]}요일`,
  en: (day: DayOfWeek) => suggestionContextTranslations.en.days[day],
} satisfies Record<SupportedLocale, (day: DayOfWeek) => string>;

/** 완료 근거를 시간·카테고리·요일의 교차 사실로 오인하지 않도록 한 분석축만 제공한다. */
export function buildReportContext(
  data: AggregatedReportData,
  periodLabel: string,
  type: ReportType,
  options: BuildReportPromptOptions,
  locale: SupportedLocale,
) {
  if (!data.hasActivity) {
    return {
      periodLabel,
      type,
      hasActivity: false,
      stats: null,
      focus: null,
      previousTips: options.prevTips,
    };
  }
  const categories = data.categoryBreakdown.filter((category) => category.total > 0);
  const focus =
    categories.length >= 2
      ? {
          axis: "CATEGORY" as const,
          categories: categories.map(({ name, total, completed, rate }) => ({
            name,
            total,
            completed,
            rate,
          })),
        }
      : {
          axis: "DAY_OF_WEEK" as const,
          days: data.dayPatterns
            .filter((day) => day.total > 0)
            .map(({ day, total, completed, rate }) => ({
              day,
              label: REPORT_DAY_LABELS[locale](day),
              total,
              completed,
              rate,
            })),
        };
  return {
    periodLabel,
    type,
    hasActivity: true,
    stats: {
      totalTodos: data.totalTodos,
      completedTodos: data.completedTodos,
      completionRate: data.completionRate,
      prevCompletionRate: data.prevCompletionRate,
      streakDays: data.streakDays,
    },
    focus,
    previousTips: options.prevTips,
  };
}
