import { useLogger } from '@src/bootstrap/providers/di-context';
import type { ReceivedPushNotification } from '@src/core/ports/push-notification-gateway';
import { SECOND_MS } from '@src/shared/constants/time-units';
import { toError } from '@src/shared/errors';
import { useQueryClient } from '@tanstack/react-query';
import { debounce } from 'es-toolkit';
import { useCallback, useEffect, useMemo } from 'react';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { type NotificationType } from '../domains/notification.model';
import { NOTIFICATION_QUERY_KEYS } from '../queries/notification-query-keys';
import { pushNotificationPayloadSchema } from '../schemas/push-notification-payload.schema';

const FOREGROUND_SYNC_DELAY_MS = SECOND_MS;

interface UseForegroundNotificationSyncOptions {
  isAuthenticated: boolean;
  /** 받은 알림 타입이 바꾸는 다른 기능의 화면을 다시 받는다. 위층인 bootstrap이 조립한다 */
  invalidateByType: (type: NotificationType) => Promise<unknown>;
}

export function useForegroundNotificationSync({
  isAuthenticated,
  invalidateByType,
}: UseForegroundNotificationSyncOptions) {
  const queryClient = useQueryClient();
  const logger = useLogger();
  const syncNotification = useMemo(() => {
    // 마지막 알림만 남기면 1초 안에 온 다른 타입의 화면이 옛 값으로 남으므로 받은 타입을 모은다
    const pendingTypes = new Set<NotificationType>();
    const flush = debounce(() => {
      const types = [...pendingTypes];
      pendingTypes.clear();
      // 안 읽은 수도 함께 다시 받아 앱 아이콘 배지가 따라간다(`useNotificationBadgeSync`)
      const tasks: Promise<unknown>[] = [
        queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all }),
        ...types.map((type) => invalidateByType(type)),
      ];

      Promise.all(tasks).catch((error) =>
        logger.error(NOTIFICATION_LOG_EVENT.FOREGROUND_HANDLER_FAILED, toError(error)),
      );
    }, FOREGROUND_SYNC_DELAY_MS);

    return {
      schedule: (notification?: ReceivedPushNotification) => {
        const payload = pushNotificationPayloadSchema.safeParse(notification?.data);
        if (payload.success && payload.data.type != null) {
          pendingTypes.add(payload.data.type);
        }
        flush();
      },
      cancel: () => {
        pendingTypes.clear();
        flush.cancel();
      },
    };
  }, [invalidateByType, logger, queryClient]);

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

      syncNotification.schedule(notification);
    },
    [isAuthenticated, syncNotification],
  );
}
