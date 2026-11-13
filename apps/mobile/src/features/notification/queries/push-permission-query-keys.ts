import { queryOptions } from '@tanstack/react-query';

import type { PushPermission } from '../domains/push-permission.model';

export const PUSH_PERMISSION_QUERY_KEYS = {
  // OS 상태라 알림함(`['notification']`) 무효화에 휩쓸려 다시 묻지 않도록 기기 루트에 둔다
  all: ['device', 'push-permission'] as const,
  current: () =>
    queryOptions<PushPermission>({ queryKey: [...PUSH_PERMISSION_QUERY_KEYS.all, 'current'] })
      .queryKey,
} as const;
