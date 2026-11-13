import type { QueryClient } from '@tanstack/react-query';

import { SUGGESTION_QUERY_KEYS } from './suggestion-query-keys';

export function invalidateAiSuggestions(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: SUGGESTION_QUERY_KEYS.all });
}

/** 당겨서 새로고침. 화면에 붙은 제안 목록만 다시 받는다 */
export function refreshAiSuggestions(queryClient: QueryClient) {
  return queryClient.refetchQueries({ queryKey: SUGGESTION_QUERY_KEYS.all, type: 'active' });
}
