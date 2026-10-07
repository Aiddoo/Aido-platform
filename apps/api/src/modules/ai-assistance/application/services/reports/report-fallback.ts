import type { SupportedLocale } from "#api/shared/domain/locale";

import type { GeneratedReportContent } from "../../../domain/types/reports/ai-report.types.js";

interface ReportFallbackTranslations {
  readonly active: GeneratedReportContent;
  readonly empty: GeneratedReportContent;
}
const reportFallbackTranslations: Readonly<Record<SupportedLocale, ReportFallbackTranslations>> = {
  ko: {
    empty: {
      aiSummary: "이번 기간에는 등록된 할 일이 없었어요. 다음에는 작은 목표부터 시작해보세요!",
      aiTips: ["하루에 할 일 1개씩 등록하는 습관을 만들어보세요."],
    },
    active: {
      aiSummary:
        "이번 기간의 할 일 통계를 기반으로 리포트가 생성되었습니다. 자세한 통계는 위의 데이터를 확인해주세요.",
      aiTips: [
        "매일 같은 시간에 할 일을 정리하는 루틴을 만들어보세요.",
        "큰 할 일은 작은 단위로 나누면 달성률이 올라요.",
      ],
    },
  },
  en: {
    empty: {
      aiSummary:
        "No to-dos were registered this period. Next time, try starting with one small goal!",
      aiTips: ["Try building the habit of adding just 1 to-do a day."],
    },
    active: {
      aiSummary:
        "This report was generated from your to-do stats for the period. Check the data above for details.",
      aiTips: ["Keep up your current pace and check in on your progress regularly."],
    },
  },
};

export function buildFallbackContent(
  hasActivity: boolean,
  locale: SupportedLocale = "ko",
): GeneratedReportContent {
  const content = reportFallbackTranslations[locale][hasActivity ? "active" : "empty"];
  return { aiSummary: content.aiSummary, aiTips: [...content.aiTips] };
}
