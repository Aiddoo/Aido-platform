import type { QueryClient } from '@tanstack/react-query';

import { REPORT_QUERY_KEYS } from './report-query-keys';

export function refreshReports(queryClient: QueryClient) {
  return Promise.all([
    queryClient.refetchQueries({ queryKey: REPORT_QUERY_KEYS.status(), type: 'active' }),
    queryClient.refetchQueries({ queryKey: REPORT_QUERY_KEYS.lists(), type: 'active' }),
  ]);
}
