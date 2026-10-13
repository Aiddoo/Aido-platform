import type { QueryClient } from '@tanstack/react-query';

import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys';

export function invalidateMemoResourceLimit(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.resourceLimit() });
}
