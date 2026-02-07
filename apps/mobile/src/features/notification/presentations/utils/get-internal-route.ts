import type { NotificationContext, NotificationType } from '@aido/validators';

/**
 * 알림 타입과 컨텍스트를 기반으로 앱 내부 라우트를 결정한다.
 *
 * push 알림 탭 → 앱 내 이동, 알림 목록 아이템 탭 → 앱 내 이동 두 곳에서 공통으로 사용된다.
 *
 * @param type - 알림 타입 (e.g. `'FOLLOW_NEW'`, `'NUDGE_RECEIVED'`)
 * @param context - 알림에 첨부된 부가 정보 (`friendId`, `todoId` 등)
 * @returns 이동할 앱 내부 경로. 이동이 불필요하거나 외부 URL로 처리되는 경우 `null`
 *
 * @example
 * ```ts
 * getInternalRoute('FOLLOW_NEW');
 * // → '/friends'
 *
 * getInternalRoute('CHEER_RECEIVED', { friendId: 'abc' });
 * // → '/friends/abc'
 *
 * getInternalRoute('SYSTEM_NOTICE');
 * // → null (외부 URL은 NotificationPolicy.getExternalUrl로 처리)
 * ```
 */
export const getInternalRoute = (
  type: NotificationType,
  context?: NotificationContext,
): string | null => {
  switch (type) {
    // 친구 요청
    case 'FOLLOW_NEW':
      return '/friends';

    // 친구 프로필로 이동
    case 'FOLLOW_ACCEPTED':
    case 'CHEER_RECEIVED':
    case 'FRIEND_COMPLETED':
      return context?.friendId ? `/friends/${context.friendId}` : null;

    // 콕 찌르기: 친구 프로필로 이동
    case 'NUDGE_RECEIVED':
      if (context?.friendId) return `/friends/${context.friendId}`;
      return null;

    // 할일 관련: 홈으로 이동
    case 'TODO_REMINDER':
    case 'TODO_SHARED':
    case 'DAILY_COMPLETE':
    case 'MORNING_REMINDER':
    case 'EVENING_REMINDER':
      return '/feed';

    // 달성 화면
    case 'WEEKLY_ACHIEVEMENT':
      return '/achievements';

    // 시스템 공지 (action.url로 처리되므로 여기선 null)
    case 'SYSTEM_NOTICE':
      return null;

    default:
      return null;
  }
};
