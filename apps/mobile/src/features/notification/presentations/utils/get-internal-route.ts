import type { NotificationContext, NotificationType } from '@aido/validators';
import { match } from 'ts-pattern';

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
  return match(type)
    .with('FOLLOW_NEW', () => '/friends')
    .with('FOLLOW_ACCEPTED', 'CHEER_RECEIVED', 'FRIEND_COMPLETED', () =>
      context?.friendId ? `/friends/${context.friendId}` : null,
    )
    .with('NUDGE_RECEIVED', () => (context?.friendId ? `/friends/${context.friendId}` : null))
    .with(
      'TODO_REMINDER',
      'TODO_SHARED',
      'DAILY_COMPLETE',
      'MORNING_REMINDER',
      'EVENING_REMINDER',
      () => '/feed',
    )
    .with('WEEKLY_ACHIEVEMENT', () => '/achievements')
    .with('SYSTEM_NOTICE', 'ADMIN_BROADCAST', 'ADMIN_TARGETED', () => null)
    .exhaustive();
};
