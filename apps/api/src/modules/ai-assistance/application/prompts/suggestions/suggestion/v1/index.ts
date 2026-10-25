import { AI_SUGGESTION_LIMITS } from "@aido/api/vocabulary";

import type { SupportedLocale } from "#api/shared/domain/locale";

import {
  applyTypeCap,
  dedupeByTitlePrefixAndDays,
  filterWeakPatterns,
  groundPatternCandidates,
  normalizeStarterSuggestions,
} from "../../../../../domain/services/suggestions/pattern-filter.js";
import type { DetectedPattern } from "../../../../../domain/types/suggestions/ai-suggestion.types.js";
import { structuredOutput } from "../../../structured-output.js";
import type { SuggestionNormalizeContext, SuggestionPromptDefinition } from "../types.js";
import { type DetectedPatternsResponse, suggestionPromptCatalog } from "./prompt.ko.js";

export const SUGGESTION_PROMPT_VERSION_V1 = "suggestion@v1";

function definition(locale: SupportedLocale): SuggestionPromptDefinition {
  const { build, schema, starterReason, repeatReason } = suggestionPromptCatalog[locale];
  const normalize = (
    output: DetectedPatternsResponse,
    { context }: SuggestionNormalizeContext,
  ): DetectedPattern[] => {
    const isStarter = context.todos.length < AI_SUGGESTION_LIMITS.MIN_OCCURRENCES;
    const excludedTitles = context.suggestionHistory.map((history) => history.title);
    const patterns = isStarter
      ? normalizeStarterSuggestions(output.patterns, context)
          .map(({ pattern, recordedActivity }) => ({
            ...pattern,
            reason: starterReason(context.todos.length, recordedActivity, pattern.daysOfWeek),
          }))
          .filter((pattern) => !excludedTitles.includes(pattern.title))
      : applyTypeCap(
          groundPatternCandidates(
            filterWeakPatterns(output.patterns, context),
            context,
            excludedTitles,
          ).map(({ pattern, recordedActivity }) => ({
            ...pattern,
            reason:
              recordedActivity === null
                ? pattern.reason
                : repeatReason(recordedActivity, pattern.daysOfWeek),
          })),
        );
    return dedupeByTitlePrefixAndDays(patterns);
  };
  return {
    promptVersion: SUGGESTION_PROMPT_VERSION_V1,
    build: (input) => build(input.context, AI_SUGGESTION_LIMITS.MIN_REPEAT_OCCURRENCES),
    output: structuredOutput(schema, normalize),
  };
}

export const suggestionPromptV1: Readonly<Record<SupportedLocale, SuggestionPromptDefinition>> = {
  ko: definition("ko"),
  en: definition("en"),
};
