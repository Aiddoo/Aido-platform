import type { SupportedLocale } from "#api/shared/domain/locale";

import type { GeneratedReportContent } from "../../../../../domain/types/reports/ai-report.types.js";
import { structuredOutput } from "../../../structured-output.js";
import type { ReportPromptDefinition } from "../types.js";
import { REPORT_PROMPT_VERSION, type ReportAiResponse, reportPromptCatalog } from "./prompt.ko.js";

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

export const reportPromptV1: Readonly<Record<SupportedLocale, ReportPromptDefinition>> = {
  ko: definition("ko"),
  en: definition("en"),
};
