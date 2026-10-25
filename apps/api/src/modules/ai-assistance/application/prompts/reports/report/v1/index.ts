// TODO: 1.13.0 이전 앱 사용자가 업데이트한 뒤(v2 안정화 확인 후) v1 프롬프트 폴더와 전환 env를 제거한다
import type { SupportedLocale } from "#api/shared/domain/locale";

import type { GeneratedReportContent } from "../../../../../domain/types/reports/ai-report.types.js";
import { structuredOutput } from "../../../structured-output.js";
import type { ReportPromptDefinition } from "../types.js";
import { REPORT_PROMPT_VERSION, type ReportAiResponse, reportPromptCatalog } from "./prompt.ko.js";

/** @deprecated report v2로 대체됐다. AI_PROMPT_VERSION 롤백용으로만 남긴다. */
export const REPORT_PROMPT_VERSION_V1 = REPORT_PROMPT_VERSION;

const toContent = (output: ReportAiResponse): GeneratedReportContent => ({
  aiSummary: output.summary,
  aiTips: output.tips,
});

function definition(locale: SupportedLocale): ReportPromptDefinition {
  const { build, schema } = reportPromptCatalog[locale];
  return {
    promptVersion: REPORT_PROMPT_VERSION_V1,
    build: (input) =>
      build(input.data, input.periodLabel, input.type, {
        prevTips: input.prevTips === null ? null : [...input.prevTips],
      }),
    output: structuredOutput(schema, toContent),
  };
}

/** @deprecated report v2로 대체됐다. AI_PROMPT_VERSION 롤백용으로만 남긴다. */
export const reportPromptV1: Readonly<Record<SupportedLocale, ReportPromptDefinition>> = {
  ko: definition("ko"),
  en: definition("en"),
};
