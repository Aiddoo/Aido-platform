import { useAppVersionService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { APP_VERSION_QUERY_KEYS } from './app-version-query-keys';

export function useGetAppVersionQueryOptions() {
  const appVersionService = useAppVersionService();

  return queryOptions({
    queryKey: APP_VERSION_QUERY_KEYS.config(),
    queryFn: async ({ signal }) => unwrap(await appVersionService.getConfig(signal)),
    retry: false,
    staleTime: 0,
  });
}
