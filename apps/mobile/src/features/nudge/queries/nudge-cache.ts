import type { QueryClient } from '@tanstack/react-query';

import { NUDGE_QUERY_KEYS } from '../constants/nudge-query-keys';

export function invalidateNudgeInteractions(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: NUDGE_QUERY_KEYS.interactions() });
}

export function invalidateNudgeLimit(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: NUDGE_QUERY_KEYS.limit() });
}
