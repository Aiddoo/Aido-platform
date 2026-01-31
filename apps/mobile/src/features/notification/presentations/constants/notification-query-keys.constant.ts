export const notificationQueryKeys = {
  all: ['notification'] as const,

  // Push Token
  pushToken: () => [...notificationQueryKeys.all, 'push-token'] as const,

  // Notification List
  lists: () => [...notificationQueryKeys.all, 'list'] as const,
  list: (filters: { unreadOnly?: boolean }) => [...notificationQueryKeys.lists(), filters] as const,

  // Unread Count
  unreadCount: () => [...notificationQueryKeys.all, 'unread-count'] as const,
} as const;
