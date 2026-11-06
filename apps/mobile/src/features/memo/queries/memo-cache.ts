import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys';
import type { Memo, MemoPage } from '../schemas/memo.schema';

export function invalidateMemos(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.all });
}

/** 바뀌지 않은 쪽과 항목의 참조는 `setQueryData`의 구조 공유가 되살린다. */
export function replaceMemoInList(queryClient: QueryClient, memo: Memo) {
  queryClient.setQueryData<InfiniteData<MemoPage>>(MEMO_QUERY_KEYS.list(), (data) =>
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
