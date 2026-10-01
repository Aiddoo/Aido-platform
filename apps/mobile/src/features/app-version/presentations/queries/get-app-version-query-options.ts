import { useAppVersionService } from '@src/bootstrap/providers/di-context';
import type { AppVersionService } from '@src/features/app-version/services/app-version.service';
import { queryOptions } from '@tanstack/react-query';

export function getAppVersionQueryOptions(service: AppVersionService) {
  return queryOptions({
    queryKey: ['app-version', 'config'] as const,
    queryFn: ({ signal }) => service.getConfig(signal),
    retry: false,
    staleTime: 0,
  });
}

export function useAppVersionQueryOptions() {
  return getAppVersionQueryOptions(useAppVersionService());
}
