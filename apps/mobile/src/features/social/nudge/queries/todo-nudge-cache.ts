import type { QueryClient } from '@tanstack/react-query';

import { TODO_NUDGE_QUERY_KEYS } from './todo-nudge-query-keys';

export function invalidateNudgeInteractions(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: TODO_NUDGE_QUERY_KEYS.interactions() });
}

export function invalidateNudges(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: TODO_NUDGE_QUERY_KEYS.all });
}
