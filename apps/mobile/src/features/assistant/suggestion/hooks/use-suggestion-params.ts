import { useLocalSearchParams } from 'expo-router';

import { suggestionParamsSchema } from '../schemas/suggestion-params.schema';

export function useSuggestionParams() {
  return suggestionParamsSchema.parse(useLocalSearchParams());
}
