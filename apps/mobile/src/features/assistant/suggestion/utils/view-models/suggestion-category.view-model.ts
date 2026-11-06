import type { AiSuggestion } from '@src/features/ai/domains/ai.model';

export function findSheetSuggestion(
  suggestions: AiSuggestion[],
  suggestionId: number,
): AiSuggestion | null {
  return suggestions.find((suggestion) => suggestion.id === suggestionId) ?? null;
}
