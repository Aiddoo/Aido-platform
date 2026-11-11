import { type InfiniteData, queryOptions } from '@tanstack/react-query';

import type { Memo, MemoPage } from '../domains/memo.model';

export const MEMO_QUERY_KEYS = {
  all: ['memo'] as const,
  list: () =>
    queryOptions<InfiniteData<MemoPage, number | undefined>>({
      queryKey: [...MEMO_QUERY_KEYS.all, 'list'],
    }).queryKey,
  details: () => [...MEMO_QUERY_KEYS.all, 'detail'] as const,
  detail: ({ memoId }: { memoId: number }) =>
    queryOptions<Memo>({ queryKey: [...MEMO_QUERY_KEYS.details(), { memoId }] }).queryKey,
  resourceLimit: () => [...MEMO_QUERY_KEYS.all, 'resource-limit'] as const,
} as const;
