import type { NotificationCategory } from '@aido/api';

export interface NotificationListFilters {
  category?: NotificationCategory;
  unreadOnly?: boolean;
  limit?: number;
}

export const NOTIFICATION_QUERY_KEYS = {
  all: ['notification'] as const,
  lists: () => [...NOTIFICATION_QUERY_KEYS.all, 'list'] as const,
  list: (filters: NotificationListFilters) =>
    [...NOTIFICATION_QUERY_KEYS.lists(), filters] as const,
  unreadCount: () => [...NOTIFICATION_QUERY_KEYS.all, 'unread-count'] as const,
  permission: () => [...NOTIFICATION_QUERY_KEYS.all, 'permission'] as const,
} as const;
