import { dayOfWeekSchema } from "@aido/api";
import { z } from "zod";

import type { SupportedLocale } from "#api/shared/domain/locale";
import { truncateGraphemes } from "#api/shared/domain/utils/grapheme.util";

import {
  dedupeByTitlePrefixAndDays,
  isWeatherRelated,
} from "../../../../../domain/services/suggestions/pattern-filter.js";
import {
  buildSuggestionCandidates,
  isReasonGrounded,
  resolveSuggestionPicks,
  suggestionModeOf,
} from "../../../../../domain/services/suggestions/suggestion-candidates.js";
import type { DetectedPattern } from "../../../../../domain/types/suggestions/ai-suggestion.types.js";
import { suggestionReasonCopy } from "../../../../locale/suggestions/suggestion-reason.locale.js";
import { structuredOutput } from "../../../structured-output.js";
import type { SuggestionNormalizeContext, SuggestionPromptDefinition } from "../types.js";
import { buildSuggestionPromptEnV2 } from "./prompt.en.js";
import { buildSuggestionPromptKoV2 } from "./prompt.ko.js";

export const SUGGESTION_PROMPT_VERSION_V2 = "suggestion@v2.1";

const REASON_MAX_LENGTH = 200;

/** LLM 출력 schema(관대). 후보 검증·요일·시각·신뢰도는 서버가 정한다. */
export const suggestionDraftSchema = z.object({
  picks: z
    .array(
      z.object({
        candidateId: z.string(),
        daysOfWeek: z.array(dayOfWeekSchema),
        useRecordedTime: z.boolean(),
        reason: z
          .string()
          .describe("One sentence in the requested language using only the candidate's numbers."),
      }),
    )
    .describe("0-5 picks, best first."),
});

function definition(
  locale: SupportedLocale,
  build: SuggestionPromptDefinition["build"],
): SuggestionPromptDefinition {
  const copy = suggestionReasonCopy[locale];
  const normalize = (
    draft: z.infer<typeof suggestionDraftSchema>,
    { context }: SuggestionNormalizeContext,
  ): DetectedPattern[] => {
    const mode = suggestionModeOf(context.todos.length);
    const resolved = resolveSuggestionPicks(draft.picks, buildSuggestionCandidates(context.todos), {
      mode,
      excludedTitles: context.suggestionHistory.map((history) => history.title),
    });
    const patterns = resolved.map(
      ({ candidate, daysOfWeek, scheduledTime, confidence, modelReason }) => {
        const reason = truncateGraphemes(modelReason.trim(), REASON_MAX_LENGTH);
        // 근거 밖 수치·날씨·빈 사유는 서버 문장으로 바꾼다.
        const grounded =
          reason !== "" && !isWeatherRelated(reason) && isReasonGrounded(reason, candidate);
        return {
          title: candidate.title,
          daysOfWeek,
          scheduledTime,
          confidence,
          reason: grounded
            ? reason
            : mode === "STARTER"
              ? copy.starter(context.todos.length, candidate, daysOfWeek)
              : copy.repeat(candidate, daysOfWeek),
          matchedTitles:
            mode === "STARTER"
              ? []
              : Array.from({ length: candidate.occurrences }, () => candidate.title),
        };
      },
    );
    return dedupeByTitlePrefixAndDays(patterns);
  };
  return {
    promptVersion: SUGGESTION_PROMPT_VERSION_V2,
    build,
    output: structuredOutput(suggestionDraftSchema, normalize),
  };
}

export const suggestionPromptV2: Readonly<Record<SupportedLocale, SuggestionPromptDefinition>> = {
  ko: definition("ko", buildSuggestionPromptKoV2),
  en: definition("en", buildSuggestionPromptEnV2),
};
