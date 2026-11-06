import { useAppIconService } from '@src/bootstrap/providers/di-context';
import type { AppIconService } from '@src/features/device/app-icon/apis/app-icon.service';
import { queryOptions } from '@tanstack/react-query';

import { APP_ICON_QUERY_KEYS } from '../constants/app-icon-query-keys';

export function getCurrentAppIconQueryOptions(service: AppIconService) {
  return queryOptions({
    queryKey: APP_ICON_QUERY_KEYS.current(),
    queryFn: ({ signal }) => service.getCurrentIcon(signal),
    // 기기 안에서만 처리해 연결 상태와 무관하다
    networkMode: 'always',

    enabled: service.isSupported(),
    retry: false,
    throwOnError: true,
  });
}

export function useGetCurrentAppIconQueryOptions() {
  return getCurrentAppIconQueryOptions(useAppIconService());
}
