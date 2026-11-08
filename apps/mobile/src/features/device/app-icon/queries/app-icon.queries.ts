import { useAppIconService } from '@src/bootstrap/providers/di-context';
import { queryOptions } from '@tanstack/react-query';

import { APP_ICON_QUERY_KEYS } from '../constants/app-icon-query-keys';

export function useGetCurrentAppIconQueryOptions() {
  const appIconService = useAppIconService();

  return queryOptions({
    queryKey: APP_ICON_QUERY_KEYS.current(),
    queryFn: ({ signal }) => appIconService.getCurrentIcon(signal),
    networkMode: 'always',
    retry: false,
  });
}
