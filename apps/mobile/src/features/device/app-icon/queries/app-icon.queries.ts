import { useAppIconService } from '@src/bootstrap/providers/di-context';
import { queryOptions } from '@tanstack/react-query';

import { APP_ICON_QUERY_KEYS } from './app-icon-query-keys';

export function useGetCurrentAppIconQueryOptions() {
  const appIconService = useAppIconService();

  return queryOptions({
    queryKey: APP_ICON_QUERY_KEYS.current(),
    queryFn: ({ signal }) => appIconService.getCurrentIcon(signal),
    // 기기 안에서만 처리해 연결 상태와 무관하다
    networkMode: 'always',
    retry: false,
  });
}
