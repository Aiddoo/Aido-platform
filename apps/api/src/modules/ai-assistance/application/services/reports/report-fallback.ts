import type { SupportedLocale } from "#api/shared/domain/locale";

import type {
  AggregatedReportData,
  ReportContent,
  ReportType,
} from "../../../domain/types/reports/ai-report.types.js";

/** 폴백 문구에 필요한 리포트 입력. 프롬프트 입력(ReportPromptInput)을 그대로 넘길 수 있다. */
export interface ReportFallbackInput {
  readonly data: AggregatedReportData;
  readonly periodLabel: string;
  readonly type: ReportType;
}

interface ReportFallbackCopy {
  /** 다음 기간을 부르는 말(다음 주/다음 달). 사용자에게 "기간" 같은 내부 용어를 보이지 않는다. */
  readonly nextPeriod: Readonly<Record<ReportType, string>>;
  readonly emptySummary: (label: string) => string;
  readonly emptyTip: (next: string) => string;
  readonly activeSummary: (label: string, data: AggregatedReportData) => string;
  readonly categoryTip: (category: string, next: string) => string;
  readonly activeTip: (next: string) => string;
}

// 일반 조언 없이 서버 통계만 쓰고, 언어별 팁 개수를 같게 둔다.
const reportFallbackCopy: Readonly<Record<SupportedLocale, ReportFallbackCopy>> = {
  ko: {
    nextPeriod: { WEEKLY: "다음 주", MONTHLY: "다음 달" },
    emptySummary: (label) =>
      `${label}에는 등록된 할 일이 없었어요. 기록이 생기면 다음 리포트에서 흐름을 함께 볼 수 있어요.`,
    emptyTip: (next) => `${next}에 해보고 싶은 작은 일 하나를 등록해보세요.`,
    activeSummary: (label, data) =>
      `${label}에는 할 일 ${data.totalTodos}개 중 ${data.completedTodos}개를 완료해 달성률 ${data.completionRate}%였어요.`,
    categoryTip: (category, next) => `${category} 할 일을 ${next}에도 하나 등록해보세요.`,
    activeTip: (next) => `${next}에 끝내고 싶은 할 일 하나를 미리 등록해보세요.`,
  },
  en: {
    nextPeriod: { WEEKLY: "next week", MONTHLY: "next month" },
    emptySummary: (label) =>
      `No to-dos were recorded in ${label}. Once you add some, the next report can show how things went.`,
    emptyTip: (next) => `Add one small thing you'd like to do ${next}.`,
    activeSummary: (label, data) =>
      `In ${label}, you completed ${data.completedTodos} of ${data.totalTodos} to-dos, a ${data.completionRate}% completion rate.`,
    categoryTip: (category, next) => `Add one ${category} to-do for ${next}, too.`,
    activeTip: (next) => `Add one to-do you'd like to finish ${next} ahead of time.`,
  },
};

/** 가장 많이 완료한 카테고리. 동률이면 집계 순서의 앞쪽을 쓰고, 완료가 없으면 null이다. */
function mostCompletedCategory(data: AggregatedReportData): string | null {
  let best: { readonly name: string; readonly completed: number } | null = null;
  for (const category of data.categoryBreakdown) {
    if (category.completed > (best?.completed ?? 0)) best = category;
  }
  return best == null ? null : best.name;
}

/** 활동이 없는 기간은 LLM 없이 이 템플릿을 저장한다. */
export function buildNoActivityContent(
  input: Omit<ReportFallbackInput, "data">,
  locale: SupportedLocale,
): ReportContent {
  const copy = reportFallbackCopy[locale];
  return {
    aiSummary: copy.emptySummary(input.periodLabel),
    aiTips: [copy.emptyTip(copy.nextPeriod[input.type])],
    contentSource: "TEMPLATE",
    promptVersion: null,
  };
}

/** 사용자가 AI 데이터 처리를 거부해 AI 공급자를 부르지 않고 기록 통계만으로 요약한다. */
export function buildConsentDeclinedContent(
  input: ReportFallbackInput,
  locale: SupportedLocale,
): ReportContent {
  return { ...buildFallbackContent(input, locale), contentSource: "CONSENT_DECLINED" };
}

/** AI를 쓸 수 없거나 마지막 재시도까지 실패한 기간에 저장한다. */
export function buildFallbackContent(
  input: ReportFallbackInput,
  locale: SupportedLocale,
): ReportContent {
  if (!input.data.hasActivity)
    return { ...buildNoActivityContent(input, locale), contentSource: "FALLBACK" };
  const copy = reportFallbackCopy[locale];
  const next = copy.nextPeriod[input.type];
  const category = mostCompletedCategory(input.data);
  return {
    aiSummary: copy.activeSummary(input.periodLabel, input.data),
    aiTips: [category == null ? copy.activeTip(next) : copy.categoryTip(category, next)],
    contentSource: "FALLBACK",
    promptVersion: null,
  };
}
