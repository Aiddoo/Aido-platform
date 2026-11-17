import type { Localized, SupportedLocale } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import type { PromptDefinition } from "../../../ai-generations/application/messages/prompt-definition.messages.js";
import { wrapUntrusted } from "../../../ai-generations/application/messages/untrusted-input.messages.js";
import type { SuggestionDraft } from "../../../shared/domain/ai-task-outputs.constants.js";
import { dedupeByTitlePrefixAndDays } from "../../domain/pattern-filter.domain-service.js";
import type { SuggestionAnalysisTrigger } from "../../domain/suggestion-analysis.constants.js";
import {
  buildSuggestionCandidates,
  resolveSuggestionPicks,
  suggestionModeOf,
} from "../../domain/suggestion-candidates.domain-service.js";
import type { DetectedPattern } from "../../domain/suggestions.constants.js";
import type { SuggestionContextReadModel } from "../read-models/suggestion-context.read-model.js";
import { SUGGESTION_SYSTEM_EN } from "./locales/en/suggestion-system.messages.js";
import { SUGGESTION_SYSTEM_KO } from "./locales/ko/suggestion-system.messages.js";
import { buildSuggestionData } from "./suggestion-data.messages.js";
import { suggestionReasonCopy } from "./suggestion-reason.messages.js";

export interface SuggestionNormalizeContext {
  readonly context: SuggestionContextReadModel;
  readonly locale: SupportedLocale;
}

const SYSTEM: Localized<string> = {
  ko: SUGGESTION_SYSTEM_KO,
  en: SUGGESTION_SYSTEM_EN,
};

function normalizeSuggestions(
  draft: SuggestionDraft,
  { context, locale }: SuggestionNormalizeContext,
): DetectedPattern[] {
  const copy = suggestionReasonCopy[locale];
  const mode = suggestionModeOf(context.todos.length);
  const resolved = resolveSuggestionPicks(
    draft.picks,
    buildSuggestionCandidates(context.todos, mode, context.repeatingTitles),
    { mode, excludedTitles: context.suggestionHistory.map((history) => history.title) },
  );
  const patterns = resolved.map(({ candidate, daysOfWeek, scheduledTime, confidence }) =>
    match(mode)
      .with("PATTERN", () => ({
        title: candidate.title,
        daysOfWeek,
        scheduledTime,
        confidence,
        reason: copy.repeat(candidate, daysOfWeek),
        matchedTitles: Array.from({ length: candidate.occurrences }, () => candidate.title),
        recordedCount: candidate.occurrences,
        completedCount: candidate.completed,
      }))
      .with("STARTER", () => ({
        title: candidate.title,
        daysOfWeek,
        scheduledTime,
        confidence,
        reason: copy.starter(context.todos.length, candidate, daysOfWeek),
        matchedTitles: [],
        recordedCount: candidate.occurrences,
        completedCount: candidate.completed,
      }))
      .exhaustive(),
  );
  return dedupeByTitlePrefixAndDays(patterns);
}

export const suggestionPrompt: PromptDefinition<
  "suggestion",
  SuggestionContextReadModel,
  DetectedPattern[],
  SuggestionNormalizeContext
> = {
  id: "suggestion",
  version: "suggestion@4",
  taskClass: "background",
  // 후보 30개(제목 80·카테고리 50자, 요일 7개)와 이력 30개(제목 80자)의 최대 user 턴이 약 33,700자다.
  maxInputChars: 36_000,
  build: (context, locale) => ({
    system: SYSTEM[locale],
    prompt: wrapUntrusted("suggestion_data", buildSuggestionData(context)),
  }),
  normalize: normalizeSuggestions,
};

// 지금 받기는 사용자가 앱에서 기다리므로 배경 작업 자리·배경 중단 스위치와 나눠 interactive로 보낸다
export function suggestionPromptFor(trigger: SuggestionAnalysisTrigger): typeof suggestionPrompt {
  return match(trigger)
    .returnType<typeof suggestionPrompt>()
    .with("SCHEDULED", () => suggestionPrompt)
    .with("ON_DEMAND", () => ({ ...suggestionPrompt, taskClass: "interactive" }))
    .exhaustive();
}
