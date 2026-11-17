import type { SupportedLocale } from "#api/shared/domain/locale";

import type {
  AggregatedReportData,
  ReportContent,
  ReportType,
} from "../../domain/ai-reports.constants.js";

export interface ReportFallbackInput {
  readonly reportData: AggregatedReportData;
  readonly type: ReportType;
}

interface ReportFallbackCopy {
  /** 다음 기간을 부르는 말(다음 주/다음 달). 사용자에게 "기간" 같은 내부 용어를 보이지 않는다. */
  readonly nextPeriod: Readonly<Record<ReportType, string>>;
  readonly emptySummary: string;
  readonly emptyTip: (next: string) => string;
  readonly categorySummary: (category: string) => string;
  readonly activeSummary: string;
  readonly categoryTip: (category: string, next: string) => string;
  readonly activeTip: (next: string) => string;
}

// 차트가 숫자를 보여 주므로 AI 카드처럼 통계를 되풀이하지 않는 한 문장 + 팁 하나다.
const reportFallbackCopy: Readonly<Record<SupportedLocale, ReportFallbackCopy>> = {
  ko: {
    nextPeriod: { WEEKLY: "다음 주", MONTHLY: "다음 달" },
    emptySummary: "등록된 할 일이 없어 흐름은 다음 리포트에서 함께 볼 수 있어요.",
    emptyTip: (next) => `${next}에 해보고 싶은 작은 일 하나를 등록해보세요.`,
    categorySummary: (category) => `'${category}' 카테고리의 할 일을 가장 많이 끝냈어요.`,
    activeSummary: "작은 일 하나부터 다시 시작하기 좋은 때예요.",
    categoryTip: (category, next) =>
      `'${category}' 카테고리 할 일을 ${next}에도 하나 등록해보세요.`,
    activeTip: (next) => `${next}에 끝내고 싶은 할 일 하나를 미리 등록해보세요.`,
  },
  en: {
    nextPeriod: { WEEKLY: "next week", MONTHLY: "next month" },
    emptySummary: "No to-dos were recorded, so the next report can show how things go.",
    emptyTip: (next) => `Add one small thing you'd like to do ${next}.`,
    categorySummary: (category) => `You finished the most to-dos in the '${category}' category.`,
    activeSummary: "It's a good time to restart with one small thing.",
    categoryTip: (category, next) => `Add one '${category}' to-do for ${next}, too.`,
    activeTip: (next) => `Add one to-do you'd like to finish ${next} ahead of time.`,
  },
};

/** 가장 많이 완료한 카테고리. 동률이면 집계 순서의 앞쪽을 쓰고, 완료가 없으면 null이다. */
function mostCompletedCategory(data: AggregatedReportData): string | null {
  let best: { readonly name: string; readonly completed: number } | null = null;
  for (const category of data.categoryBreakdown) {
    if (category.completed > (best?.completed ?? 0)) {
      best = category;
    }
  }
  return best == null ? null : best.name;
}

/** 활동이 없는 기간은 LLM 없이 이 템플릿을 저장한다. */
export function buildNoActivityContent(
  input: Pick<ReportFallbackInput, "type">,
  locale: SupportedLocale,
): ReportContent {
  const copy = reportFallbackCopy[locale];
  return {
    aiSummary: copy.emptySummary,
    aiTips: [copy.emptyTip(copy.nextPeriod[input.type])],
    contentSource: "TEMPLATE",
    promptVersion: null,
  };
}

/** AI 데이터 처리 동의가 없어(거부·철회, 또는 1.13.0 이상 앱에서 미응답) AI 없이 기록 통계만으로 요약한다. */
export function buildNoAiConsentContent(
  input: ReportFallbackInput,
  locale: SupportedLocale,
): ReportContent {
  return { ...buildFallbackContent(input, locale), contentSource: "NO_AI_CONSENT" };
}

/** AI를 쓸 수 없거나 마지막 재시도까지 실패한 기간에 저장한다. */
export function buildFallbackContent(
  input: ReportFallbackInput,
  locale: SupportedLocale,
): ReportContent {
  if (!input.reportData.hasActivity) {
    return { ...buildNoActivityContent(input, locale), contentSource: "FALLBACK" };
  }
  const copy = reportFallbackCopy[locale];
  const next = copy.nextPeriod[input.type];
  const category = mostCompletedCategory(input.reportData);
  if (category == null) {
    return {
      aiSummary: copy.activeSummary,
      aiTips: [copy.activeTip(next)],
      contentSource: "FALLBACK",
      promptVersion: null,
    };
  }
  return {
    aiSummary: copy.categorySummary(category),
    aiTips: [copy.categoryTip(category, next)],
    contentSource: "FALLBACK",
    promptVersion: null,
  };
}
