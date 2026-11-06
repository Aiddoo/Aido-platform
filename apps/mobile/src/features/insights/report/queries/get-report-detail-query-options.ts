import { useReportService } from '@src/bootstrap/providers/di-context';
import type { ReportService } from '@src/features/insights/report/apis/report.service';
import { REPORT_QUERY_KEYS } from '@src/features/insights/report/constants/report-query-keys';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

function getReportDetailQueryOptions(reportService: ReportService, { id }: { id: number }) {
  return queryOptions({
    queryKey: REPORT_QUERY_KEYS.detail({ reportId: id }),
    queryFn: async ({ signal }) => {
      const result = await reportService.getReportById(id, signal);
      return unwrap(result);
    },
    meta: { refreshOnPremiumChange: true },
  });
}

export function useGetReportDetailQueryOptions({ id }: { id: number }) {
  return getReportDetailQueryOptions(useReportService(), { id });
}
