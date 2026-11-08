export type UnreadCount = number;

function hasUnread(unreadCount: UnreadCount) {
  return unreadCount > 0;
}

export const NotificationBadgePolicy = {
  hasUnread,
} as const;
