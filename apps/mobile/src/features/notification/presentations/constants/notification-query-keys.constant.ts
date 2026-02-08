export const NOTIFICATION_QUERY_KEYS = {
  all: ['notification'] as const,

  pushToken: () => [...NOTIFICATION_QUERY_KEYS.all, 'push-token'] as const,

  list: (filters: { category?: string; unreadOnly?: boolean }) =>
    [...NOTIFICATION_QUERY_KEYS.all, 'list', filters] as const,

  unreadCount: () => [...NOTIFICATION_QUERY_KEYS.all, 'unread-count'] as const,
} as const;
