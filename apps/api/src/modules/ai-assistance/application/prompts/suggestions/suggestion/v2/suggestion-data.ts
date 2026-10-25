import { encodeUntrustedJson } from "#api/shared/domain/prompt/sanitize";
import { truncateGraphemes } from "#api/shared/domain/utils/grapheme.util";

import {
  buildSuggestionCandidates,
  suggestionModeOf,
} from "../../../../../domain/services/suggestions/suggestion-candidates.js";
import type { SuggestionPromptInput } from "../types.js";

/** 프롬프트에 넣는 제목 길이. 저장되는 제목은 원본이다. */
const PROMPT_TITLE_MAX_LENGTH = 80;

/** 서버가 만든 후보와 응답 이력만 준다. 원본 할 일 배열과 날씨는 넣지 않는다. */
export function buildSuggestionData({ context }: SuggestionPromptInput): string {
  const shorten = (title: string) => truncateGraphemes(title, PROMPT_TITLE_MAX_LENGTH);
  return encodeUntrustedJson({
    mode: suggestionModeOf(context.todos.length),
    today: context.currentDate,
    candidates: buildSuggestionCandidates(context.todos).map((candidate) => ({
      ...candidate,
      title: shorten(candidate.title),
      categoryName: shorten(candidate.categoryName),
    })),
    history: context.suggestionHistory.map(({ title, status }) => ({
      title: shorten(title),
      status,
    })),
  });
}
