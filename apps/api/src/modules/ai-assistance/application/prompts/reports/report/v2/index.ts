import { z } from "zod";

import type { SupportedLocale } from "#api/shared/domain/locale";
import { truncateGraphemes } from "#api/shared/domain/utils/grapheme.util";

import { normalizeReportPersona } from "../../../../../domain/services/reports/report-persona.js";
import type { GeneratedReportContent } from "../../../../../domain/types/reports/ai-report.types.js";
import { structuredOutput } from "../../../structured-output.js";
import type { ReportPromptDefinition } from "../types.js";
import { buildReportPromptEnV2 } from "./prompt.en.js";
import { buildReportPromptKoV2 } from "./prompt.ko.js";

export const REPORT_PROMPT_VERSION_V2 = "report@v2.1";

const SUMMARY_MAX_LENGTH = 600;
const TIP_MAX_LENGTH = 120;
const MAX_TIPS = 3;

/** LLM 출력 schema(관대). 개수·길이는 서버가 맞춘다. */
export const reportDraftSchema = z.object({
  summary: z.string().describe("3-5 sentences in the requested language."),
  tips: z.array(z.string()).describe("1-3 tips, one sentence each."),
});

export class ReportDraftRejectedError extends Error {
  constructor() {
    super("report draft has no usable summary or tips");
    this.name = ReportDraftRejectedError.name;
  }
}

function normalizeV2(
  draft: z.infer<typeof reportDraftSchema>,
  locale: SupportedLocale,
): GeneratedReportContent {
  const clean = (text: string) => normalizeReportPersona(text.trim(), locale).trim();
  const summary = truncateGraphemes(clean(draft.summary), SUMMARY_MAX_LENGTH);
  const tips = draft.tips
    .map((tip) => truncateGraphemes(clean(tip), TIP_MAX_LENGTH))
    .filter((tip) => tip !== "")
    .slice(0, MAX_TIPS);
  // 비어 있는 결과는 저장하지 않고 폴백으로 넘긴다.
  if (summary === "" || tips.length === 0) throw new ReportDraftRejectedError();
  return { aiSummary: summary, aiTips: tips };
}

const outputV2 = (locale: SupportedLocale) =>
  structuredOutput(reportDraftSchema, (draft: z.infer<typeof reportDraftSchema>) =>
    normalizeV2(draft, locale),
  );

export const reportPromptV2: Readonly<Record<SupportedLocale, ReportPromptDefinition>> = {
  ko: {
    promptVersion: REPORT_PROMPT_VERSION_V2,
    build: buildReportPromptKoV2,
    output: outputV2("ko"),
  },
  en: {
    promptVersion: REPORT_PROMPT_VERSION_V2,
    build: buildReportPromptEnV2,
    output: outputV2("en"),
  },
};
