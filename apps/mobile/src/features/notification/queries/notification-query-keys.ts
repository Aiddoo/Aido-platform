import { type InfiniteData, queryOptions } from '@tanstack/react-query';

import type { NotificationListResult } from '../domains/notification.model';
import type { PushPermission } from '../domains/push-permission.model';
import type { NotificationListQueryKey } from '../schemas/notification-list-query-key.schema';

export const NOTIFICATION_QUERY_KEYS = {
  all: ['notification'] as const,
  lists: () => [...NOTIFICATION_QUERY_KEYS.all, 'list'] as const,
  list: (filters: NotificationListQueryKey) =>
    queryOptions<InfiniteData<NotificationListResult, number | undefined>>({
      queryKey: [...NOTIFICATION_QUERY_KEYS.lists(), filters],
    }).queryKey,
  unreadCount: () =>
    queryOptions<number>({ queryKey: [...NOTIFICATION_QUERY_KEYS.all, 'unread-count'] }).queryKey,
  permission: () =>
    queryOptions<PushPermission>({ queryKey: [...NOTIFICATION_QUERY_KEYS.all, 'permission'] })
      .queryKey,
} as const;
