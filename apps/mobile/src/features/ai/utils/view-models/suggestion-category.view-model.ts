import type { AiSuggestion } from '../../domains/ai.model';

export function findSheetSuggestion(
  suggestions: AiSuggestion[],
  suggestionId: number,
): AiSuggestion | null {
  return suggestions.find((suggestion) => suggestion.id === suggestionId) ?? null;
}

/** 제안된 카테고리가 아직 있으면 그것을, 없으면 첫 카테고리를 처음 선택값으로 쓴다. */
export function resolveSuggestionCategoryId(
  suggestedCategoryId: number | null | undefined,
  categories: { id: number }[],
): number | null {
  if (
    suggestedCategoryId != null &&
    categories.some((category) => category.id === suggestedCategoryId)
  ) {
    return suggestedCategoryId;
  }
  return categories[0]?.id ?? null;
}
