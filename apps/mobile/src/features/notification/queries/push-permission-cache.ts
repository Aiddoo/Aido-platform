import type { QueryClient } from '@tanstack/react-query';

import type { PushPermission } from '../domains/push-permission.model';
import { PUSH_PERMISSION_QUERY_KEYS } from './push-permission-query-keys';
import type { useGetPushPermissionQueryOptions } from './push-permission.queries';

export function setCachedPushPermission(queryClient: QueryClient, permission: PushPermission) {
  queryClient.setQueryData(PUSH_PERMISSION_QUERY_KEYS.current(), permission);
}

/** 받은 기기 권한이 있으면 그대로, 없으면 OS에 묻는다 */
export function ensurePushPermission(
  queryClient: QueryClient,
  options: ReturnType<typeof useGetPushPermissionQueryOptions>,
) {
  return queryClient.ensureQueryData(options);
}

export function invalidatePushPermission(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: PUSH_PERMISSION_QUERY_KEYS.current() });
}
