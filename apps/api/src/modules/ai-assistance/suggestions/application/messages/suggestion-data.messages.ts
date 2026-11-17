import { uniqBy } from "es-toolkit";

import { truncateGraphemes } from "#api/shared/domain/utils/grapheme.util";

import { toActivityKey } from "../../domain/recorded-activity-evidence.domain-service.js";
import {
  buildSuggestionCandidates,
  type SuggestionCandidate,
  type SuggestionMode,
  suggestionModeOf,
} from "../../domain/suggestion-candidates.domain-service.js";
import type { SuggestionHistoryItem } from "../../domain/suggestions.constants.js";
import type { SuggestionContextReadModel } from "../read-models/suggestion-context.read-model.js";

/** 프롬프트에 넣는 제목 길이. 저장되는 제목은 원본이다. */
const PROMPT_TITLE_MAX_LENGTH = 80;
/** 모델에 보내는 최근 응답 이력 수. 키가 같은 활동은 서버가 전체 이력으로 다시 거른다 */
export const MAX_SUGGESTION_HISTORY_ITEMS = 30;

export interface SuggestionData {
  readonly mode: SuggestionMode;
  readonly candidates: readonly SuggestionCandidate[];
  readonly history: readonly SuggestionHistoryItem[];
}

export function buildSuggestionData(context: SuggestionContextReadModel): SuggestionData {
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
    history: uniqBy(context.suggestionHistory, ({ title }) => toActivityKey(title))
      .slice(0, MAX_SUGGESTION_HISTORY_ITEMS)
      .map(({ title, status }) => ({ title: shorten(title), status })),
  };
}
