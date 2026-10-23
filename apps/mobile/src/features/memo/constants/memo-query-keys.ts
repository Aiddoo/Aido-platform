export const MEMO_QUERY_KEYS = {
  all: ['memo'] as const,
  detail: ({ memoId }: { memoId: number }) =>
    [...MEMO_QUERY_KEYS.all, 'detail', { memoId }] as const,
  list: () => [...MEMO_QUERY_KEYS.all, 'list'] as const,
  resourceLimit: () => [...MEMO_QUERY_KEYS.all, 'resource-limit'] as const,
} as const;
