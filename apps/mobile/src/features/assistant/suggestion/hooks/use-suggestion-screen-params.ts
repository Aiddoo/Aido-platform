import { useLocalSearchParams } from 'expo-router';

import { suggestionScreenParamsSchema } from '../schemas/suggestion-params.schema';

export function useSuggestionScreenParams() {
  return suggestionScreenParamsSchema.parse(useLocalSearchParams());
}
