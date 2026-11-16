import { truncateGraphemes } from "#api/shared/domain/utils/grapheme.util";

import {
  buildSuggestionCandidates,
  type SuggestionCandidate,
  type SuggestionMode,
  suggestionModeOf,
} from "../../domain/suggestion-candidates.domain-service.js";
import type { SuggestionHistoryItem } from "../../domain/suggestion.constants.js";
import type { SuggestionContext } from "../read-models/suggestion-context.read-model.js";

/** 프롬프트에 넣는 제목 길이. 저장되는 제목은 원본이다. */
const PROMPT_TITLE_MAX_LENGTH = 80;

export interface SuggestionData {
  readonly mode: SuggestionMode;
  readonly candidates: readonly SuggestionCandidate[];
  readonly history: readonly SuggestionHistoryItem[];
}

export function buildSuggestionData(context: SuggestionContext): SuggestionData {
  const shorten = (title: string) => truncateGraphemes(title, PROMPT_TITLE_MAX_LENGTH);
  const mode = suggestionModeOf(context.todos.length);
  return {
    mode,
    candidates: buildSuggestionCandidates(context.todos, mode, context.repeatingTitles).map(
      (candidate) => ({
        ...candidate,
        title: shorten(candidate.title),
        categoryName: shorten(candidate.categoryName),
      }),
    ),
    history: context.suggestionHistory.map(({ title, status }) => ({
      title: shorten(title),
      status,
    })),
  };
}
