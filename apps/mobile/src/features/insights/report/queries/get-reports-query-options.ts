import { useReportService } from '@src/bootstrap/providers/di-context';
import type { ReportService } from '@src/features/insights/report/apis/report.service';
import { REPORT_QUERY_KEYS } from '@src/features/insights/report/constants/report-query-keys';
import type { GetAiReportsParams } from '@src/features/insights/report/domains/report.model';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

function getReportsQueryOptions(
  reportService: ReportService,
  { params }: { params?: GetAiReportsParams },
) {
  return queryOptions({
    queryKey: REPORT_QUERY_KEYS.list(params),
    queryFn: async ({ signal }) => {
      const result = await reportService.getReports(params, signal);
      return unwrap(result);
    },
    meta: { refreshOnPremiumChange: true },
  });
}

export function useGetReportsQueryOptions(params?: GetAiReportsParams) {
  return getReportsQueryOptions(useReportService(), { params });
}
