import { pushNotificationDataSchema } from '@aido/api';
import { useLogger, useNotificationService } from '@src/bootstrap/providers/di-context';
import { invalidateFriends } from '@src/features/friend/queries/friend-cache';
import { invalidateOnInviteNotification } from '@src/features/invite/queries/invite-cache';
import { invalidateNudgeInteractions } from '@src/features/nudge/queries/nudge-cache';
import { invalidateMe } from '@src/features/user/queries/user-cache';
import { toError } from '@src/shared/errors';
import { useQueryClient } from '@tanstack/react-query';
import { debounce } from 'es-toolkit';
import type * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useMemo } from 'react';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys';

interface UseForegroundNotificationSyncOptions {
  isAuthenticated: boolean;
}

export function useForegroundNotificationSync({
  isAuthenticated,
}: UseForegroundNotificationSyncOptions) {
  const notificationService = useNotificationService();
  const queryClient = useQueryClient();
  const logger = useLogger();
  const syncNotification = useMemo(
    () =>
      debounce((notification?: Notifications.Notification) => {
        const tasks: Promise<void>[] = [
          queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all }),
          notificationService.syncBadgeCount(),
        ];
        const result = pushNotificationDataSchema.safeParse(notification?.request.content.data);
        const type = result.success ? result.data.type : undefined;
        if (type === 'NUDGE_RECEIVED' || type === 'NUDGE_REPLIED' || type === 'NUDGE_THANKED') {
          tasks.push(invalidateNudgeInteractions(queryClient));
        }
        if (type === 'FOLLOW_NEW' || type === 'FOLLOW_ACCEPTED') {
          tasks.push(invalidateFriends(queryClient));
        }
        if (type === 'INVITE_JOINED' || type === 'INVITE_REWARDED' || type === 'INVITE_PROGRESS') {
          tasks.push(invalidateOnInviteNotification(queryClient));
        }
        // 보상 기간이 곧 끝난다는 알림이면 구독 화면의 남은 기간을 서버 값으로 맞춘다
        if (type === 'PREMIUM_GRANT_ENDING') {
          tasks.push(invalidateMe(queryClient));
        }

        Promise.all(tasks).catch((error) =>
          logger.error(NOTIFICATION_LOG_EVENT.FOREGROUND_HANDLER_FAILED, toError(error)),
        );
      }, 1000),
    [logger, notificationService, queryClient],
  );

  useEffect(() => {
    return () => {
      syncNotification.cancel();
    };
  }, [syncNotification, isAuthenticated]);

  return useCallback(
    (notification?: Notifications.Notification) => {
      if (!isAuthenticated) {
        return;
      }

      syncNotification(notification);
    },
    [isAuthenticated, syncNotification],
  );
}
