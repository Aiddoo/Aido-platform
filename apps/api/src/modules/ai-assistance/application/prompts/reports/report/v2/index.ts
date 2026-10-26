import { z } from "zod";

import type { SupportedLocale } from "#api/shared/domain/locale";
import { truncateGraphemes } from "#api/shared/domain/utils/grapheme.util";

import { numbersIn } from "../../../../../domain/services/grounding/grounded-numbers.js";
import { keepGroundedSentences } from "../../../../../domain/services/reports/report-grounding.js";
import { normalizeReportPersona } from "../../../../../domain/services/reports/report-persona.js";
import type { GeneratedReportContent } from "../../../../../domain/types/reports/ai-report.types.js";
import { structuredOutput } from "../../../structured-output.js";
import type { ReportPromptDefinition, ReportPromptInput } from "../types.js";
import { buildReportContextV2 } from "./context.js";
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

/** 모델에 준 report_data의 수치와 사용자가 쓴 이름. 문장 속 숫자는 이 안에 있어야 한다. */
function numberEvidence(input: ReportPromptInput, locale: SupportedLocale) {
  const { stats, focus, period } = buildReportContextV2(input, locale);
  const focusItems = focus.axis === "CATEGORY" ? focus.categories : focus.days;
  return {
    numbers: [
      stats.totalTodos,
      stats.completedTodos,
      stats.completionRate,
      stats.streakDays,
      // "15%p 올랐어요"·"down 5 points"처럼 부호 없이 쓴다.
      ...[stats.prevCompletionRate, stats.completionRateDelta]
        .filter((value) => value != null)
        .map((value) => Math.abs(value)),
      ...focusItems.flatMap(({ total, completed, rate }) => [total, completed, rate]),
      ...numbersIn(period.label),
      // 주간 리포트는 "다음 7일"을 말하도록 지시한다.
      ...(input.type === "WEEKLY" ? [7] : []),
    ],
    quotedTexts: [period.label, ...input.data.categoryBreakdown.map(({ name }) => name)],
  };
}

function normalizeV2(
  draft: z.infer<typeof reportDraftSchema>,
  locale: SupportedLocale,
  input: ReportPromptInput,
): GeneratedReportContent {
  const evidence = numberEvidence(input, locale);
  // persona 말투를 고친 뒤, 근거 밖 숫자가 있는 문장은 빼고 남은 문장만 쓴다.
  const clean = (text: string) =>
    keepGroundedSentences(normalizeReportPersona(text.trim(), locale).trim(), evidence);
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
  structuredOutput(
    reportDraftSchema,
    (draft: z.infer<typeof reportDraftSchema>, input: ReportPromptInput) =>
      normalizeV2(draft, locale, input),
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
