import { invalidateMe } from '@src/features/identity/user/queries/user-cache';
import {
  getNotificationReceiptRefresh,
  type NotificationType,
} from '@src/features/notification/domains/notification.model';
import { invalidateFriends } from '@src/features/social/friend/queries/friend-cache';
import { invalidateOnInviteNotification } from '@src/features/social/invite/queries/invite-cache';
import { invalidateNudgeInteractions } from '@src/features/social/nudge/queries/todo-nudge-cache';
import type { QueryClient } from '@tanstack/react-query';
import { match } from 'ts-pattern';

export function invalidateOnNotificationReceived(
  queryClient: QueryClient,
  type: NotificationType,
): Promise<unknown> {
  return match(getNotificationReceiptRefresh(type))
    .with('nudge-interactions', () => invalidateNudgeInteractions(queryClient))
    .with('friends', () => invalidateFriends(queryClient))
    .with('invite', () => invalidateOnInviteNotification(queryClient))
    .with('me', () => invalidateMe(queryClient))
    .with(null, () => Promise.resolve())
    .exhaustive();
}
