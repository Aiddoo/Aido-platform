import { match } from "ts-pattern";

import type { SupportedLocale } from "#api/shared/domain/locale";

import type { PromptDefinition } from "../../../generation/application/messages/prompt-definition.messages.js";
import { wrapUntrusted } from "../../../generation/application/messages/untrusted-input.messages.js";
import { dedupeByTitlePrefixAndDays } from "../../domain/pattern-filter.domain-service.js";
import {
  buildSuggestionCandidates,
  resolveSuggestionPicks,
  suggestionModeOf,
} from "../../domain/suggestion-candidates.domain-service.js";
import type { DetectedPattern } from "../../domain/suggestion.constants.js";
import type { SuggestionContext } from "../read-models/suggestion-context.read-model.js";
import { buildSuggestionData } from "./suggestion-data.messages.js";
import { type SuggestionDraft, suggestionDraftSchema } from "./suggestion-draft.wire.js";
import { suggestionReasonCopy } from "./suggestion-reason.messages.js";
import { SUGGESTION_SYSTEM_EN } from "./suggestion-system-en.messages.js";
import { SUGGESTION_SYSTEM_KO } from "./suggestion-system-ko.messages.js";

export interface SuggestionNormalizeContext {
  readonly context: SuggestionContext;
  readonly locale: SupportedLocale;
}

const SYSTEM: Readonly<Record<SupportedLocale, string>> = {
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
  SuggestionContext,
  SuggestionDraft,
  DetectedPattern[],
  SuggestionNormalizeContext
> = {
  id: "suggestion",
  version: "suggestion@4",
  taskClass: "background",
  maxInputChars: 16_000,
  schema: suggestionDraftSchema,
  build: (context, locale) => ({
    system: SYSTEM[locale],
    prompt: wrapUntrusted("suggestion_data", buildSuggestionData(context)),
  }),
  normalize: normalizeSuggestions,
};
