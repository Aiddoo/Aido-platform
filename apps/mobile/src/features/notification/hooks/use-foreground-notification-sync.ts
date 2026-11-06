import { useLogger, useNotificationService } from '@src/bootstrap/providers/di-context';
import type { ReceivedPushNotification } from '@src/core/ports/push-notification-gateway';
import { toError } from '@src/shared/errors';
import { useQueryClient } from '@tanstack/react-query';
import { debounce } from 'es-toolkit';
import { useCallback, useEffect, useMemo } from 'react';

import { toPushNotificationPayload } from '../apis/notification.mapper';
import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys';
import type { NotificationType } from '../schemas/notification.schema';

interface UseForegroundNotificationSyncOptions {
  isAuthenticated: boolean;
  /** 받은 알림 타입이 바꾸는 다른 기능의 화면을 다시 받는다. 위층인 bootstrap이 조립한다 */
  invalidateByType: (type: NotificationType) => Promise<unknown>;
}

export function useForegroundNotificationSync({
  isAuthenticated,
  invalidateByType,
}: UseForegroundNotificationSyncOptions) {
  const notificationService = useNotificationService();
  const queryClient = useQueryClient();
  const logger = useLogger();
  const syncNotification = useMemo(
    () =>
      debounce((notification?: ReceivedPushNotification) => {
        const tasks: Promise<unknown>[] = [
          queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all }),
          notificationService.syncBadgeCount(),
        ];
        const result = toPushNotificationPayload(notification?.data);
        if (result.success && result.payload.type != null) {
          tasks.push(invalidateByType(result.payload.type));
        }

        Promise.all(tasks).catch((error) =>
          logger.error(NOTIFICATION_LOG_EVENT.FOREGROUND_HANDLER_FAILED, toError(error)),
        );
      }, 1000),
    [invalidateByType, logger, notificationService, queryClient],
  );

  useEffect(() => {
    return () => {
      syncNotification.cancel();
    };
  }, [syncNotification, isAuthenticated]);

  return useCallback(
    (notification?: ReceivedPushNotification) => {
      if (!isAuthenticated) {
        return;
      }

      syncNotification(notification);
    },
    [isAuthenticated, syncNotification],
  );
}
