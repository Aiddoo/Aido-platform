export const NOTIFICATION_QUERY_KEYS = {
  all: ['notification'] as const,

  list: (filters: { category?: string; unreadOnly?: boolean; limit?: number }) =>
    [...NOTIFICATION_QUERY_KEYS.all, 'list', filters] as const,

  unreadCount: () => [...NOTIFICATION_QUERY_KEYS.all, 'unread-count'] as const,
} as const;
