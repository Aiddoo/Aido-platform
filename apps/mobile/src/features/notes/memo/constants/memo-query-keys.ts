import { queryOptions } from '@tanstack/react-query';

import type { Memo } from '../domains/memo.model';

export const MEMO_QUERY_KEYS = {
  all: ['memo'] as const,
  list: () => [...MEMO_QUERY_KEYS.all, 'list'] as const,
  details: () => [...MEMO_QUERY_KEYS.all, 'detail'] as const,
  // 뮤테이션이 응답으로 직접 읽고 써 데이터 타입을 붙인다
  detail: ({ memoId }: { memoId: number }) =>
    queryOptions<Memo>({ queryKey: [...MEMO_QUERY_KEYS.details(), { memoId }] }).queryKey,
  resourceLimit: () => [...MEMO_QUERY_KEYS.all, 'resource-limit'] as const,
} as const;
