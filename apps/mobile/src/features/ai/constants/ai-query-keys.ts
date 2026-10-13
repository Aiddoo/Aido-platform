import type { GetAiReportsParams } from '../domains/ai.model';

export const AI_QUERY_KEYS = {
  all: ['ai'] as const,
  usage: () => [...AI_QUERY_KEYS.all, 'usage'] as const,
  status: () => [...AI_QUERY_KEYS.all, 'status'] as const,
  lists: () => [...AI_QUERY_KEYS.all, 'list'] as const,
  list: (params?: GetAiReportsParams) => [...AI_QUERY_KEYS.lists(), params ?? {}] as const,
  suggestions: () => [...AI_QUERY_KEYS.all, 'suggestions'] as const,
  suggestion: ({ suggestionId }: { suggestionId: number }) =>
    [...AI_QUERY_KEYS.suggestions(), { suggestionId }] as const,
  details: () => [...AI_QUERY_KEYS.all, 'detail'] as const,
  detail: ({ reportId }: { reportId: number }) =>
    [...AI_QUERY_KEYS.details(), { reportId }] as const,
  parseMemo: ({ memoId }: { memoId: number }) =>
    [...AI_QUERY_KEYS.all, 'parse-memo', { memoId }] as const,
} as const;
