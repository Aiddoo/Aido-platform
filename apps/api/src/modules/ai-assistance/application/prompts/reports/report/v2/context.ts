import type { DayOfWeek } from "@aido/api/vocabulary";

import type { SupportedLocale } from "#api/shared/domain/locale";

import { suggestionContextTranslations } from "../../../../locale/suggestions/suggestion-context.locale.js";
import type { ReportPromptInput } from "../types.js";

const DAY_LABELS = {
  ko: (day: DayOfWeek) => `${suggestionContextTranslations.ko.days[day]}요일`,
  en: (day: DayOfWeek) => suggestionContextTranslations.en.days[day],
} satisfies Record<SupportedLocale, (day: DayOfWeek) => string>;

/** 소수 첫째 자리까지. 모델이 차이를 직접 계산하지 않도록 서버가 넣는다. */
function delta(current: number, previous: number | null): number | null {
  return previous == null ? null : Math.round((current - previous) * 10) / 10;
}

/**
 * 리포트 근거 데이터. 기간은 실제 날짜와 라벨을 함께 주고, 분석축은 하나만 준다.
 * 활동이 없는 기간은 LLM을 부르지 않으므로 활동 있는 기간만 다룬다.
 */
export function buildReportContextV2(input: ReportPromptInput, locale: SupportedLocale) {
  const { data } = input;
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
              label: DAY_LABELS[locale](day),
              total,
              completed,
              rate,
            })),
        };
  return {
    type: input.type,
    period: { label: input.periodLabel, start: input.period.start, end: input.period.end },
    stats: {
      totalTodos: data.totalTodos,
      completedTodos: data.completedTodos,
      completionRate: data.completionRate,
      prevCompletionRate: data.prevCompletionRate,
      completionRateDelta: delta(data.completionRate, data.prevCompletionRate),
      streakDays: data.streakDays,
    },
    focus,
    previousTips: input.prevTips,
  };
}
