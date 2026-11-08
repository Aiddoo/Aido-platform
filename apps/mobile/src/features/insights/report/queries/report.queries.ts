import { useReportService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { REPORT_QUERY_KEYS } from '../constants/report-query-keys';
import type { GetAiReportsQuery } from '../schemas/report.schema';

export function useGetReportsQueryOptions(query: GetAiReportsQuery) {
  const reportService = useReportService();

  return queryOptions({
    queryKey: REPORT_QUERY_KEYS.list(query),
    queryFn: async ({ signal }) => unwrap(await reportService.getReports(query, signal)),
    meta: { refreshOnPremiumChange: true },
  });
}

export function useGetReportStatusQueryOptions() {
  const reportService = useReportService();

  return queryOptions({
    queryKey: REPORT_QUERY_KEYS.status(),
    queryFn: async ({ signal }) => unwrap(await reportService.getReportStatus(signal)),
    meta: { refreshOnPremiumChange: true },
  });
}

export function useGetReportDetailQueryOptions({ reportId }: { reportId: number }) {
  const reportService = useReportService();

  return queryOptions({
    queryKey: REPORT_QUERY_KEYS.detail({ reportId }),
    queryFn: async ({ signal }) => unwrap(await reportService.getReportById(reportId, signal)),
    meta: { refreshOnPremiumChange: true },
  });
}
