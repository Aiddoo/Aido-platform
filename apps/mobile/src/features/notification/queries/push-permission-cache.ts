import type { QueryClient } from '@tanstack/react-query';

import type { PushPermission } from '../domains/push-permission.model';
import { PUSH_PERMISSION_QUERY_KEYS } from './push-permission-query-keys';

export function setCachedPushPermission(queryClient: QueryClient, permission: PushPermission) {
  queryClient.setQueryData(PUSH_PERMISSION_QUERY_KEYS.current(), permission);
}

export function invalidatePushPermission(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: PUSH_PERMISSION_QUERY_KEYS.current() });
}
