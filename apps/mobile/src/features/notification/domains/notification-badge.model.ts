import type { AuthStatus } from '@src/core/session/auth-status';

type UnreadCount = number;

function hasUnread(unreadCount: UnreadCount) {
  return unreadCount > 0;
}

/** 앱 아이콘 배지에 쓸 수. null이면 배지를 건드리지 않는다 */
function getBadgeCount(
  unreadCount: UnreadCount | undefined,
  { authStatus }: { authStatus: AuthStatus },
): UnreadCount | null {
  // 콜드 스타트의 인증 확인 중(loading·locked)은 로그아웃이 아니다. 지우면 읽지 않은 알림이 있어도 배지가 사라진다
  if (authStatus === 'loading' || authStatus === 'locked') {
    return null;
  }
  if (authStatus === 'unauthenticated') {
    return 0;
  }
  return unreadCount ?? null;
}

export const NotificationBadgePolicy = {
  hasUnread,
  getBadgeCount,
} as const;
