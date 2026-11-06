import { z } from 'zod';

const unreadCountSchema = z.int().nonnegative();
export type UnreadCount = z.infer<typeof unreadCountSchema>;

function hasUnread(unreadCount: UnreadCount) {
  return unreadCount > 0;
}

/** 처음 읽어 온 값(이전 값 없음)은 새로 온 알림이 아니다. 읽어서 줄어든 것도 아니다 */
function hasNewUnread(unreadCount: UnreadCount, previousCount: UnreadCount | null) {
  return previousCount != null && unreadCount > previousCount;
}

export const NotificationBadgePolicy = {
  hasUnread,
  hasNewUnread,
} as const;
