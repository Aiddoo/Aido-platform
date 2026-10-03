import { useAppIconService } from '@src/bootstrap/providers/di-context';
import type { AppIconService } from '@src/features/app-icon/services/app-icon.service';
import { queryOptions } from '@tanstack/react-query';

import { APP_ICON_QUERY_KEYS } from '../constants/app-icon-query-keys.constant';

export function getCurrentAppIconQueryOptions(service: AppIconService) {
  return queryOptions({
    queryKey: APP_ICON_QUERY_KEYS.current(),
    queryFn: ({ signal }) => service.getCurrentIcon(signal),
    enabled: service.isSupported(),
    retry: false,
    throwOnError: true,
  });
}

export function useGetCurrentAppIconQueryOptions() {
  return getCurrentAppIconQueryOptions(useAppIconService());
}
