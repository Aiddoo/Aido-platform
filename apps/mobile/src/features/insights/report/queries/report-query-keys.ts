import { queryOptions } from '@tanstack/react-query';

import type { AiReport, ReportStatus } from '../domains/report.model';
import type { GetAiReportsQuery } from '../schemas/report-list-request.schema';

export const REPORT_QUERY_KEYS = {
  all: ['report'] as const,
  status: () =>
    queryOptions<ReportStatus>({ queryKey: [...REPORT_QUERY_KEYS.all, 'status'] }).queryKey,
  lists: () => [...REPORT_QUERY_KEYS.all, 'list'] as const,
  list: (query: GetAiReportsQuery) =>
    queryOptions<AiReport[]>({ queryKey: [...REPORT_QUERY_KEYS.lists(), query] }).queryKey,
  detail: ({ reportId }: { reportId: number }) =>
    queryOptions<AiReport>({ queryKey: [...REPORT_QUERY_KEYS.all, 'detail', { reportId }] })
      .queryKey,
} as const;
