import type { SupportedLocale } from "#api/shared/domain/locale";
import { truncateGraphemes } from "#api/shared/domain/utils/grapheme.util";

import type { PromptDefinition } from "../../../generation/application/messages/prompt-definition.messages.js";
import { removeInvisibleCharacters } from "../../../generation/application/messages/untrusted-input.messages.js";
import {
  dedupeByTitlePrefixAndDays,
  isWeatherRelated,
} from "../../domain/pattern-filter.domain-service.js";
import {
  buildSuggestionCandidates,
  isReasonGrounded,
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
  taskClass: "background",
  maxInputChars: 16_000,
  schema: suggestionDraftSchema,
  build: (context, locale) => ({ system: SYSTEM[locale], prompt: buildSuggestionData(context) }),
  normalize: normalizeSuggestions,
};
