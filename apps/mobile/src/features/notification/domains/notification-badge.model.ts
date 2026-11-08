export type UnreadCount = number;

function hasUnread(unreadCount: UnreadCount) {
  return unreadCount > 0;
}

function hasNewUnread(unreadCount: UnreadCount, previousCount: UnreadCount | null) {
  return previousCount != null && unreadCount > previousCount;
}

export const NotificationBadgePolicy = {
  hasUnread,
  hasNewUnread,
} as const;
