import type { QueryClient } from '@tanstack/react-query';

import { REPORT_QUERY_KEYS } from './report-query-keys';

/** 당겨서 새로고침. 화면에 붙은 상태·목록만 다시 받는다 */
export function refreshReports(queryClient: QueryClient) {
  return Promise.all([
    queryClient.refetchQueries({ queryKey: REPORT_QUERY_KEYS.status(), type: 'active' }),
    queryClient.refetchQueries({ queryKey: REPORT_QUERY_KEYS.lists(), type: 'active' }),
  ]);
}
