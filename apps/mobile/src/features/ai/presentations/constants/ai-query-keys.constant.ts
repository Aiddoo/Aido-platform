import type { GetAiReportsParams } from '../../models/ai.model';

export const AI_QUERY_KEYS = {
  all: ['ai'] as const,
  status: () => [...AI_QUERY_KEYS.all, 'status'] as const,
  lists: () => [...AI_QUERY_KEYS.all, 'list'] as const,
  list: (params?: GetAiReportsParams) => [...AI_QUERY_KEYS.lists(), params] as const,
  details: () => [...AI_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...AI_QUERY_KEYS.details(), id] as const,
} as const;
