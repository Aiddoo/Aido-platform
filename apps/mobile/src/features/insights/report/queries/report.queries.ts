import { useReportService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { REPORT_QUERY_KEYS } from '../constants/report-query-keys';
import type { GetAiReportsParams } from '../schemas/report.schema';

export function useGetReportsQueryOptions(params?: GetAiReportsParams) {
  const reportService = useReportService();

  return queryOptions({
    queryKey: REPORT_QUERY_KEYS.list(params),
    queryFn: async ({ signal }) => unwrap(await reportService.getReports(params, signal)),
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

export function useGetReportDetailQueryOptions({ id }: { id: number }) {
  const reportService = useReportService();

  return queryOptions({
    queryKey: REPORT_QUERY_KEYS.detail({ reportId: id }),
    queryFn: async ({ signal }) => unwrap(await reportService.getReportById(id, signal)),
    meta: { refreshOnPremiumChange: true },
  });
}
