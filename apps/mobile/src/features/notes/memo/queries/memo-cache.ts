import { mapInfiniteItems } from '@src/shared/domains/cursor-page.model';
import type { QueryClient } from '@tanstack/react-query';

import type { Memo } from '../domains/memo.model';
import { MEMO_QUERY_KEYS } from './memo-query-keys';

export function invalidateMemos(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.all });
}

export function invalidateMemoList(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.list() });
}

export function invalidateMemoResourceLimit(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.resourceLimit() });
}

export function replaceMemoInList(queryClient: QueryClient, memo: Memo) {
  queryClient.setQueryData(
    MEMO_QUERY_KEYS.list(),
    (data) => data && mapInfiniteItems(data, (item) => (item.id === memo.id ? memo : item)),
  );
}
