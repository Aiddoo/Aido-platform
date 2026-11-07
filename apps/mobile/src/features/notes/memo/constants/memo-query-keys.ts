export const MEMO_QUERY_KEYS = {
  all: ['memo'] as const,
  list: () => [...MEMO_QUERY_KEYS.all, 'list'] as const,
  details: () => [...MEMO_QUERY_KEYS.all, 'detail'] as const,
  detail: ({ memoId }: { memoId: number }) => [...MEMO_QUERY_KEYS.details(), { memoId }] as const,
  resourceLimit: () => [...MEMO_QUERY_KEYS.all, 'resource-limit'] as const,
} as const;
