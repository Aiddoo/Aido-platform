import type { QueryClient } from '@tanstack/react-query';

import { SUGGESTION_QUERY_KEYS } from './suggestion-query-keys';

export function invalidateAiSuggestions(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: SUGGESTION_QUERY_KEYS.all });
}
