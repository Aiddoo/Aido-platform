import type { DayOfWeek } from "@aido/api/vocabulary";
import { maxBy, minBy } from "es-toolkit";

import type { SupportedLocale } from "#api/shared/domain/locale";

import { suggestionContextTranslations } from "../../../suggestions/application/messages/suggestion-context.messages.js";
import type { AggregatedReportData, ReportType } from "../../domain/ai-reports.constants.js";

const DAY_LABELS = {
  ko: (day: DayOfWeek) => `${suggestionContextTranslations.ko.days[day]}요일`,
  en: (day: DayOfWeek) => suggestionContextTranslations.en.days[day],
} satisfies Record<SupportedLocale, (day: DayOfWeek) => string>;

/** strongest·weakest 후보가 되는 항목의 최소 할 일 수. 더 적으면 한두 개로 달성률이 크게 흔들린다 */
const MIN_FOCUS_ITEM_TODOS = 3;

export interface ReportPromptInput {
  readonly reportData: AggregatedReportData;
  readonly periodLabel: string;
  readonly type: ReportType;
  /** 사용자 로컬 기간 첫날·마지막 날 (YYYY-MM-DD) */
  readonly period: { readonly start: string; readonly end: string };
  readonly previousTips: readonly string[] | null;
}

export interface ReportFocusItem {
  /** 모델이 insightKey로 되돌려 주는 값. 카테고리는 c1…, 요일은 MON… */
  readonly key: string;
  readonly name: string;
  readonly total: number;
  readonly completed: number;
  readonly rate: number;
}

/** `<report_data>` 블록. 활동이 없는 기간은 LLM을 부르지 않으므로 활동 있는 기간만 다룬다 */
export interface ReportContext {
  readonly type: ReportType;
  readonly period: { readonly label: string; readonly start: string; readonly end: string };
  readonly stats: {
    readonly totalTodos: number;
    readonly completedTodos: number;
    readonly completionRate: number;
    readonly prevCompletionRate: number | null;
    /** 소수 첫째 자리까지. 모델이 차이를 직접 계산하지 않게 서버가 넣는다 */
    readonly completionRateDelta: number | null;
    readonly streakDays: number;
  };
  readonly focus: {
    readonly axis: "CATEGORY" | "DAY_OF_WEEK";
    readonly items: readonly ReportFocusItem[];
    readonly strongest: string | null;
    readonly weakest: string | null;
  };
  readonly previousTips: readonly string[] | null;
}

function delta(current: number, previous: number | null): number | null {
  return previous == null ? null : Math.round((current - previous) * 10) / 10;
}

function buildFocusItems(
  data: AggregatedReportData,
  locale: SupportedLocale,
): Pick<ReportContext["focus"], "axis" | "items"> {
  const categories = data.categoryBreakdown.filter((category) => category.total > 0);
  if (categories.length >= 2) {
    return {
      axis: "CATEGORY",
      items: categories.map(({ name, total, completed, rate }, index) => ({
        key: `c${index + 1}`,
        name,
        total,
        completed,
        rate,
      })),
    };
  }
  return {
    axis: "DAY_OF_WEEK",
    items: data.dayPatterns
      .filter((day) => day.total > 0)
      .map(({ day, total, completed, rate }) => ({
        key: day,
        name: DAY_LABELS[locale](day),
        total,
        completed,
        rate,
      })),
  };
}

/** 충분한 항목의 달성률이 모두 같으면 약한 항목은 없다 */
function pickStrongestAndWeakest(items: readonly ReportFocusItem[]) {
  const eligible = items.filter((item) => MIN_FOCUS_ITEM_TODOS <= item.total);
  const strongest = maxBy(eligible, (item) => item.rate);
  const weakest = minBy(eligible, (item) => item.rate);
  return {
    strongest: strongest?.key ?? null,
    weakest: weakest == null || weakest.rate === strongest?.rate ? null : weakest.key,
  };
}

export function buildReportContext(
  input: ReportPromptInput,
  locale: SupportedLocale,
): ReportContext {
  const { reportData: data } = input;
  const focus = buildFocusItems(data, locale);
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
    focus: { ...focus, ...pickStrongestAndWeakest(focus.items) },
    previousTips: input.previousTips,
  };
}
