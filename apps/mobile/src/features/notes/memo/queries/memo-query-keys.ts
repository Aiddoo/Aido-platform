import { type InfiniteData, queryOptions } from '@tanstack/react-query';

import type { Memo, MemoPage, MemoResourceLimit } from '../domains/memo.model';

export const MEMO_QUERY_KEYS = {
  all: ['memo'] as const,
  list: () =>
    queryOptions<InfiniteData<MemoPage, number | undefined>>({
      queryKey: [...MEMO_QUERY_KEYS.all, 'list'],
    }).queryKey,
  detail: ({ memoId }: { memoId: number }) =>
    queryOptions<Memo>({ queryKey: [...MEMO_QUERY_KEYS.all, 'detail', { memoId }] }).queryKey,
  resourceLimit: () =>
    queryOptions<MemoResourceLimit>({ queryKey: [...MEMO_QUERY_KEYS.all, 'resource-limit'] })
      .queryKey,
} as const;
