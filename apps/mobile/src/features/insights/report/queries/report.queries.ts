import { useReportApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { queryOptions } from '@tanstack/react-query';

import type { GetAiReportsQuery } from '../schemas/report-list-request.schema';
import { REPORT_QUERY_KEYS } from './report-query-keys';

export function useGetReportsQueryOptions(query: GetAiReportsQuery) {
  const reportApi = useReportApi();

  return queryOptions({
    queryKey: REPORT_QUERY_KEYS.list(query),
    queryFn: async ({ signal }) => unwrap(await reportApi.getReports(query, signal)),
    meta: { refreshOnPremiumChange: true },
  });
}

export function useGetReportStatusQueryOptions() {
  const reportApi = useReportApi();

  return queryOptions({
    queryKey: REPORT_QUERY_KEYS.status(),
    queryFn: async ({ signal }) => unwrap(await reportApi.getReportStatus(signal)),
    meta: { refreshOnPremiumChange: true },
  });
}

export function useGetReportDetailQueryOptions({ reportId }: { reportId: number }) {
  const reportApi = useReportApi();

  return queryOptions({
    queryKey: REPORT_QUERY_KEYS.detail({ reportId }),
    queryFn: async ({ signal }) => unwrap(await reportApi.getReportById(reportId, signal)),
    // 서버가 기간마다 한 번 만들고 고치지 않는다. 'static'은 구독이 바뀔 때의 무효화까지 막아 Infinity로 둔다
    staleTime: Infinity,
    meta: { refreshOnPremiumChange: true },
  });
}
