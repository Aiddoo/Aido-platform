import { useAppVersionService } from '@src/bootstrap/providers/di-context';
import type { AppVersionService } from '@src/features/app-version/apis/app-version.service';
import { queryOptions } from '@tanstack/react-query';

import { APP_VERSION_QUERY_KEYS } from '../constants/app-version-query-keys';

export function getAppVersionQueryOptions(service: AppVersionService) {
  return queryOptions({
    queryKey: APP_VERSION_QUERY_KEYS.config(),
    queryFn: ({ signal }) => service.getConfig(signal),
    retry: false,
    staleTime: 0,
  });
}

export function useGetAppVersionQueryOptions() {
  return getAppVersionQueryOptions(useAppVersionService());
}
