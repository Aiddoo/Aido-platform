import type { QueryClient } from '@tanstack/react-query';

import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys';
import type { Memo } from '../domains/memo.model';

export function invalidateMemos(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.all });
}

export function invalidateMemoList(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.list() });
}

export function invalidateMemoResourceLimit(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.resourceLimit() });
}

/** 바뀌지 않은 쪽과 항목의 참조는 `setQueryData`의 구조 공유가 되살린다. */
export function replaceMemoInList(queryClient: QueryClient, memo: Memo) {
  queryClient.setQueryData(MEMO_QUERY_KEYS.list(), (data) =>
    data == null
      ? undefined
      : {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => (item.id === memo.id ? memo : item)),
          })),
        },
  );
}
