import { queryOptions } from '@tanstack/react-query';

import type { AiReport, ReportStatus } from '../domains/report.model';
import type { GetAiReportsQuery } from '../schemas/report-list-request.schema';

// 'ai' 접두어는 제안과 같은 서버 모듈(ai) 키 공간을 쓰던 옛 키라 그대로 둔다
export const REPORT_QUERY_KEYS = {
  all: ['ai'] as const,
  status: () =>
    queryOptions<ReportStatus>({ queryKey: [...REPORT_QUERY_KEYS.all, 'status'] }).queryKey,
  lists: () => [...REPORT_QUERY_KEYS.all, 'list'] as const,
  list: (query: GetAiReportsQuery) =>
    queryOptions<AiReport[]>({ queryKey: [...REPORT_QUERY_KEYS.lists(), query] }).queryKey,
  detail: ({ reportId }: { reportId: number }) =>
    queryOptions<AiReport>({ queryKey: [...REPORT_QUERY_KEYS.all, 'detail', { reportId }] })
      .queryKey,
} as const;
