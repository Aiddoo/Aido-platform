import type { AiSuggestion } from '../../domains/ai.model';

export function findSheetSuggestion(
  suggestions: AiSuggestion[],
  suggestionId: number,
): AiSuggestion | null {
  return suggestions.find((suggestion) => suggestion.id === suggestionId) ?? null;
}
