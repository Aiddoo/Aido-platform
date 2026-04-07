export const MEMO_QUERY_KEYS = {
  all: ['memo'] as const,
  detail: (id: number) => [...MEMO_QUERY_KEYS.all, 'detail', id] as const,
  list: () => [...MEMO_QUERY_KEYS.all, 'list'] as const,
  resourceLimit: () => [...MEMO_QUERY_KEYS.all, 'resource-limit'] as const,
} as const;
