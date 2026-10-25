import type { SupportedLocale } from "#api/shared/domain/locale";

import type {
  AggregatedReportData,
  ReportContent,
} from "../../../domain/types/reports/ai-report.types.js";

interface ReportFallbackCopy {
  readonly emptySummary: (label: string) => string;
  readonly emptyTip: string;
  readonly activeSummary: (label: string, data: AggregatedReportData) => string;
  readonly activeTip: string;
}

// 일반 조언 없이 서버 통계만 쓰고, 언어별 팁 개수를 같게 둔다.
const reportFallbackCopy: Readonly<Record<SupportedLocale, ReportFallbackCopy>> = {
  ko: {
    emptySummary: (label) =>
      `${label}에는 등록된 할 일이 없었어요. 기록이 생기면 다음 리포트에서 흐름을 함께 볼 수 있어요.`,
    emptyTip: "다음 기간에 해보고 싶은 작은 일 하나를 앱에 등록해보세요.",
    activeSummary: (label, data) =>
      `${label}에는 할 일 ${data.totalTodos}개 중 ${data.completedTodos}개를 완료해 달성률 ${data.completionRate}%였어요.`,
    activeTip: "이번 기간에 가장 많이 완료한 카테고리의 할 일을 다음 기간에도 하나 등록해보세요.",
  },
  en: {
    emptySummary: (label) =>
      `No to-dos were recorded in ${label}. Once you add some, the next report can show how things went.`,
    emptyTip: "Add one small thing you'd like to do next period to the app.",
    activeSummary: (label, data) =>
      `In ${label} you completed ${data.completedTodos} of ${data.totalTodos} to-dos, a ${data.completionRate}% completion rate.`,
    activeTip: "Add one to-do next period from the category you completed most this time.",
  },
};

/** 활동이 없는 기간은 LLM 없이 이 템플릿을 저장한다. */
export function buildNoActivityContent(
  periodLabel: string,
  locale: SupportedLocale,
): ReportContent {
  const copy = reportFallbackCopy[locale];
  return {
    aiSummary: copy.emptySummary(periodLabel),
    aiTips: [copy.emptyTip],
    contentSource: "TEMPLATE",
    promptVersion: null,
  };
}

/** AI를 쓸 수 없거나 마지막 재시도까지 실패한 기간에 저장한다. */
export function buildFallbackContent(
  data: AggregatedReportData,
  periodLabel: string,
  locale: SupportedLocale,
): ReportContent {
  if (!data.hasActivity)
    return { ...buildNoActivityContent(periodLabel, locale), contentSource: "FALLBACK" };
  const copy = reportFallbackCopy[locale];
  return {
    aiSummary: copy.activeSummary(periodLabel, data),
    aiTips: [copy.activeTip],
    contentSource: "FALLBACK",
    promptVersion: null,
  };
}
