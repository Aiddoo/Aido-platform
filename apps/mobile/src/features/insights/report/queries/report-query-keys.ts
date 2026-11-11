import type { GetAiReportsQuery } from '../schemas/report-list-request.schema';

// 'ai' 접두어는 제안과 같은 서버 모듈(ai) 키 공간을 쓰던 옛 키라 그대로 둔다
export const REPORT_QUERY_KEYS = {
  all: ['ai'] as const,
  status: () => [...REPORT_QUERY_KEYS.all, 'status'] as const,
  lists: () => [...REPORT_QUERY_KEYS.all, 'list'] as const,
  list: (query: GetAiReportsQuery) => [...REPORT_QUERY_KEYS.lists(), query] as const,
  details: () => [...REPORT_QUERY_KEYS.all, 'detail'] as const,
  detail: ({ reportId }: { reportId: number }) =>
    [...REPORT_QUERY_KEYS.details(), { reportId }] as const,
} as const;
