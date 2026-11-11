import type { SupportedLocale } from "#api/shared/domain/locale";
import { truncateGraphemes } from "#api/shared/domain/utils/grapheme.util";

import type { PromptDefinition } from "../../../generation/application/messages/prompt-definition.messages.js";
import {
  removeInvisibleCharacters,
  wrapUntrusted,
} from "../../../generation/application/messages/untrusted-input.messages.js";
import { numbersIn } from "../../../shared/domain/grounded-numbers.domain-service.js";
import type { GeneratedReportContent } from "../../domain/ai-report.constants.js";
import { keepGroundedSentences } from "../../domain/report-grounding.domain-service.js";
import { normalizeReportPersona } from "../../domain/report-persona.domain-service.js";
import { type ReportDraft, reportDraftSchema } from "./report-content.wire.js";
import { buildReportContext, type ReportPromptInput } from "./report-context.messages.js";
import { REPORT_SYSTEM_EN } from "./report-system-en.messages.js";
import { REPORT_SYSTEM_KO } from "./report-system-ko.messages.js";

const SUMMARY_MAX_LENGTH = 600;
const TIP_MAX_LENGTH = 120;
const MAX_TIPS = 3;

/** 정규화가 문장 속 숫자를 build에 넘긴 입력의 근거로 검증한다. */
export interface ReportNormalizeContext {
  readonly input: ReportPromptInput;
  readonly locale: SupportedLocale;
}

export class ReportDraftRejectedError extends Error {
  constructor() {
    super("report draft has no usable summary or tips");
    this.name = ReportDraftRejectedError.name;
  }
}

const SYSTEM: Readonly<Record<SupportedLocale, string>> = {
  ko: REPORT_SYSTEM_KO,
  en: REPORT_SYSTEM_EN,
};

/** 모델에 준 report_data의 수치와 사용자가 쓴 이름. 문장 속 숫자는 이 안에 있어야 한다. */
function buildNumberEvidence(input: ReportPromptInput, locale: SupportedLocale) {
  const { stats, focus, period } = buildReportContext(input, locale);
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
    quotedTexts: [period.label, ...input.reportData.categoryBreakdown.map(({ name }) => name)],
  };
}

function normalizeReport(
  draft: ReportDraft,
  { input, locale }: ReportNormalizeContext,
): GeneratedReportContent {
  const evidence = buildNumberEvidence(input, locale);
  // persona 말투를 고친 뒤, 근거 밖 숫자가 있는 문장은 빼고 남은 문장만 쓴다.
  const clean = (text: string) =>
    keepGroundedSentences(
      normalizeReportPersona(removeInvisibleCharacters(text).trim(), locale).trim(),
      evidence,
    );
  const summary = truncateGraphemes(clean(draft.summary), SUMMARY_MAX_LENGTH);
  const tips = draft.tips
    .map((tip) => truncateGraphemes(clean(tip), TIP_MAX_LENGTH))
    .filter((tip) => tip !== "")
    .slice(0, MAX_TIPS);
  // 비어 있는 결과는 저장하지 않고 폴백으로 넘긴다.
  if (summary === "" || tips.length === 0) {
    throw new ReportDraftRejectedError();
  }
  return { aiSummary: summary, aiTips: tips };
}

export const reportPrompt: PromptDefinition<
  ReportPromptInput,
  ReportDraft,
  GeneratedReportContent,
  ReportNormalizeContext
> = {
  id: "report",
  version: "report@3",
  taskClass: "background",
  maxInputChars: 16_000,
  schema: reportDraftSchema,
  build: (input, locale) => ({
    system: SYSTEM[locale],
    prompt: wrapUntrusted("report_data", buildReportContext(input, locale)),
  }),
  normalize: normalizeReport,
};
