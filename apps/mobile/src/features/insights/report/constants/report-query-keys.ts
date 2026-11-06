import type { GetAiReportsParams } from '../domains/report.model';

export const REPORT_QUERY_KEYS = {
  all: ['ai'] as const,
  status: () => [...REPORT_QUERY_KEYS.all, 'status'] as const,
  lists: () => [...REPORT_QUERY_KEYS.all, 'list'] as const,
  list: (params?: GetAiReportsParams) => [...REPORT_QUERY_KEYS.lists(), params ?? {}] as const,
  details: () => [...REPORT_QUERY_KEYS.all, 'detail'] as const,
  detail: ({ reportId }: { reportId: number }) =>
    [...REPORT_QUERY_KEYS.details(), { reportId }] as const,
} as const;
