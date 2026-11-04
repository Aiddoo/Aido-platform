import type { SupportedLocale } from "#api/shared/domain/locale";
import { truncateGraphemes } from "#api/shared/domain/utils/grapheme.util";

import {
  dedupeByTitlePrefixAndDays,
  isWeatherRelated,
} from "../../../../domain/services/suggestions/pattern-filter.js";
import {
  buildSuggestionCandidates,
  isReasonGrounded,
  resolveSuggestionPicks,
  suggestionModeOf,
} from "../../../../domain/services/suggestions/suggestion-candidates.js";
import type { DetectedPattern } from "../../../../domain/types/suggestions/ai-suggestion.types.js";
import { suggestionReasonCopy } from "../../../locale/suggestions/suggestion-reason.locale.js";
import type { SuggestionContext } from "../../../types/suggestions/suggestion-context.js";
import type { PromptDefinition } from "../../kit/prompt-definition.js";
import { removeInvisibleCharacters } from "../../kit/untrusted-input.js";
import { SUGGESTION_SYSTEM_EN } from "./prompt.en.js";
import { SUGGESTION_SYSTEM_KO } from "./prompt.ko.js";
import { type SuggestionDraft, suggestionDraftSchema } from "./schema.js";
import { buildSuggestionData } from "./suggestion-data.js";

const REASON_MAX_LENGTH = 200;

export interface SuggestionNormalizeContext {
  readonly context: SuggestionContext;
  readonly locale: SupportedLocale;
}

const SYSTEM: Readonly<Record<SupportedLocale, string>> = {
  ko: SUGGESTION_SYSTEM_KO,
  en: SUGGESTION_SYSTEM_EN,
};

/** 근거 검증·요일·시각·사유를 서버가 확정한 저장 후보 */
function normalizeSuggestions(
  draft: SuggestionDraft,
  { context, locale }: SuggestionNormalizeContext,
): DetectedPattern[] {
  const copy = suggestionReasonCopy[locale];
  const mode = suggestionModeOf(context.todos.length);
  const resolved = resolveSuggestionPicks(draft.picks, buildSuggestionCandidates(context.todos), {
    mode,
    excludedTitles: context.suggestionHistory.map((history) => history.title),
  });
  const patterns = resolved.map(
    ({ candidate, daysOfWeek, scheduledTime, confidence, modelReason }) => {
      const reason = truncateGraphemes(
        removeInvisibleCharacters(modelReason).trim(),
        REASON_MAX_LENGTH,
      );
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
}

export const suggestionPrompt: PromptDefinition<
  SuggestionContext,
  SuggestionDraft,
  DetectedPattern[],
  SuggestionNormalizeContext
> = {
  id: "suggestion",
  version: "suggestion@3",
  schema: suggestionDraftSchema,
  build: (context, locale) => ({ system: SYSTEM[locale], prompt: buildSuggestionData(context) }),
  normalize: normalizeSuggestions,
};
