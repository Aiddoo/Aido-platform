import { queryOptions } from '@tanstack/react-query';

import type { Memo } from '../domains/memo.model';

export const MEMO_QUERY_KEYS = {
  all: ['memo'] as const,
  list: () => [...MEMO_QUERY_KEYS.all, 'list'] as const,
  details: () => [...MEMO_QUERY_KEYS.all, 'detail'] as const,
  detail: ({ memoId }: { memoId: number }) =>
    queryOptions<Memo>({ queryKey: [...MEMO_QUERY_KEYS.details(), { memoId }] }).queryKey,
  resourceLimit: () => [...MEMO_QUERY_KEYS.all, 'resource-limit'] as const,
} as const;
