import type { QueryClient } from '@tanstack/react-query';

import { AI_QUERY_KEYS } from '../constants/ai-query-keys';

export function invalidateAiReports(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: AI_QUERY_KEYS.status() }),
    queryClient.invalidateQueries({ queryKey: AI_QUERY_KEYS.lists() }),
  ]);
}

export function invalidateAiSuggestions(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: AI_QUERY_KEYS.suggestions() });
}
