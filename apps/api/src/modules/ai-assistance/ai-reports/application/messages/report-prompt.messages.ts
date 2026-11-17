import type { SupportedLocale } from "#api/shared/domain/locale";
import { countGraphemes } from "#api/shared/domain/utils/grapheme.util";

import type { PromptDefinition } from "../../../ai-generations/application/messages/prompt-definition.messages.js";
import {
  removeInvisibleCharacters,
  wrapUntrusted,
} from "../../../ai-generations/application/messages/untrusted-input.messages.js";
import type { ReportDraft } from "../../../shared/domain/ai-task-outputs.constants.js";
import {
  type GeneratedReportContent,
  REPORT_MAX_TIPS,
  REPORT_TEXT_MAX_LENGTH,
} from "../../domain/ai-reports.constants.js";
import {
  isGroundedTip,
  keepGroundedInsight,
  type ReportEvidence,
} from "../../domain/report-grounding.domain-service.js";
import { normalizeReportPersona } from "../../domain/report-persona.domain-service.js";
import { reportDraftRejected } from "../ai-reports.errors.js";
import type { ReportContext } from "./report-context.messages.js";
import { REPORT_SYSTEM_EN } from "./report-system-en.messages.js";
import { REPORT_SYSTEM_KO } from "./report-system-ko.messages.js";

export interface ReportNormalizeContext {
  readonly context: ReportContext;
  readonly locale: SupportedLocale;
}

const SYSTEM: Readonly<Record<SupportedLocale, string>> = {
  ko: REPORT_SYSTEM_KO,
  en: REPORT_SYSTEM_EN,
};

export function buildReportEvidence({ stats, focus, period }: ReportContext): ReportEvidence {
  return {
    overallNumbers: [
      stats.totalTodos,
      stats.completedTodos,
      stats.completionRate,
      stats.streakDays,
      // "15%p 올랐어요"·"down 5 points"처럼 부호 없이 쓴다.
      ...[stats.prevCompletionRate, stats.completionRateDelta]
        .filter((value) => value != null)
        .map((value) => Math.abs(value)),
    ],
    items: focus.items.map(({ key, total, completed, rate }) => ({
      key,
      numbers: [total, completed, rate],
    })),
    quotedTexts: [period.label, ...focus.items.map(({ name }) => name)],
  };
}

function normalizeReport(
  draft: ReportDraft,
  { context, locale }: ReportNormalizeContext,
): GeneratedReportContent {
  const evidence = buildReportEvidence(context);
  const maxLength = REPORT_TEXT_MAX_LENGTH[locale];
  const clean = (text: string) =>
    normalizeReportPersona(removeInvisibleCharacters(text).trim(), locale).trim();
  const fits = (text: string, limit: number) => text !== "" && countGraphemes(text) <= limit;
  const insight = keepGroundedInsight(clean(draft.insight), draft.insightKey, evidence);
  const tips = draft.tips
    .map(clean)
    .filter((tip) => fits(tip, maxLength.tip) && isGroundedTip(tip, evidence.quotedTexts))
    .slice(0, REPORT_MAX_TIPS);
  if (!fits(insight, maxLength.insight) || tips.length === 0) {
    throw reportDraftRejected();
  }
  return { aiSummary: insight, aiTips: tips };
}

export const reportPrompt: PromptDefinition<
  "report",
  ReportContext,
  GeneratedReportContent,
  ReportNormalizeContext
> = {
  id: "report",
  version: "report@5",
  taskClass: "background",
  maxInputChars: 16_000,
  build: (context, locale) => ({
    system: SYSTEM[locale],
    prompt: wrapUntrusted("report_data", context),
  }),
  normalize: normalizeReport,
};
