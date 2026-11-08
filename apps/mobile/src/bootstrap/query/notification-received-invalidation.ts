import { invalidateMe } from '@src/features/identity/user/queries/user-cache';
import type { NotificationType } from '@src/features/notification/schemas/notification.schema';
import { invalidateFriends } from '@src/features/social/friend/queries/friend-cache';
import { invalidateOnInviteNotification } from '@src/features/social/invite/queries/invite-cache';
import { invalidateNudgeInteractions } from '@src/features/social/nudge/queries/todo-nudge-cache';
import type { QueryClient } from '@tanstack/react-query';
import { match } from 'ts-pattern';

/** 앱이 켜진 동안 받은 알림이 바꾸는 다른 기능의 화면을 다시 받는다 */
export function invalidateOnNotificationReceived(
  queryClient: QueryClient,
  type: NotificationType,
): Promise<unknown> {
  return (
    match(type)
      .with('NUDGE_RECEIVED', 'NUDGE_REPLIED', 'NUDGE_THANKED', () =>
        invalidateNudgeInteractions(queryClient),
      )
      .with('FOLLOW_NEW', 'FOLLOW_ACCEPTED', () => invalidateFriends(queryClient))
      .with('INVITE_JOINED', 'INVITE_REWARDED', 'INVITE_PROGRESS', () =>
        invalidateOnInviteNotification(queryClient),
      )
      // 보상 기간이 곧 끝난다는 알림이면 구독 화면의 남은 기간을 서버 값으로 맞춘다
      .with('PREMIUM_GRANT_ENDING', () => invalidateMe(queryClient))
      .otherwise(() => Promise.resolve())
  );
}
