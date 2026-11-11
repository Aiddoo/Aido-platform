import type { QueryClient } from '@tanstack/react-query';

import { REPORT_QUERY_KEYS } from './report-query-keys';

export function invalidateReports(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: REPORT_QUERY_KEYS.status() }),
    queryClient.invalidateQueries({ queryKey: REPORT_QUERY_KEYS.lists() }),
  ]);
}
