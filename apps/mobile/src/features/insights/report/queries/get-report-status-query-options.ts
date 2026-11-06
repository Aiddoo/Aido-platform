import { useReportService } from '@src/bootstrap/providers/di-context';
import type { ReportService } from '@src/features/insights/report/apis/report.service';
import { REPORT_QUERY_KEYS } from '@src/features/insights/report/constants/report-query-keys';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

function getReportStatusQueryOptions(reportService: ReportService) {
  return queryOptions({
    queryKey: REPORT_QUERY_KEYS.status(),
    queryFn: async ({ signal }) => {
      const result = await reportService.getReportStatus(signal);
      return unwrap(result);
    },
    meta: { refreshOnPremiumChange: true },
  });
}

export function useGetReportStatusQueryOptions() {
  return getReportStatusQueryOptions(useReportService());
}
