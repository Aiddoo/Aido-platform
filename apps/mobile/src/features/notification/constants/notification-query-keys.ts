import type { NotificationListQueryKey } from '../schemas/notification-list-query-key.schema';

export const NOTIFICATION_QUERY_KEYS = {
  all: ['notification'] as const,
  lists: () => [...NOTIFICATION_QUERY_KEYS.all, 'list'] as const,
  list: (filters: NotificationListQueryKey) =>
    [...NOTIFICATION_QUERY_KEYS.lists(), filters] as const,
  unreadCount: () => [...NOTIFICATION_QUERY_KEYS.all, 'unread-count'] as const,
  permission: () => [...NOTIFICATION_QUERY_KEYS.all, 'permission'] as const,
} as const;
