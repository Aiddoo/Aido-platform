import { usePushRegistrationService } from '@src/bootstrap/providers/di-context';
import { OS_PERMISSION_QUERY_OPTIONS } from '@src/shared/constants/os-permission-query';
import { queryOptions } from '@tanstack/react-query';

import { PUSH_PERMISSION_QUERY_KEYS } from './push-permission-query-keys';

export function useGetPushPermissionQueryOptions() {
  const pushRegistrationService = usePushRegistrationService();

  return queryOptions({
    queryKey: PUSH_PERMISSION_QUERY_KEYS.current(),
    queryFn: () => pushRegistrationService.getPermission(),
    ...OS_PERMISSION_QUERY_OPTIONS,
  });
}
