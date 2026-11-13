import { useLogger, usePushNotification } from '@src/bootstrap/providers/di-context';
import type { AuthStatus } from '@src/core/session/auth-status';
import { SECOND_MS } from '@src/shared/constants/time-units';
import { toError } from '@src/shared/errors';
import { useQueryClient } from '@tanstack/react-query';
import { debounce } from 'es-toolkit';
import { useEffect, useEffectEvent } from 'react';

import { parsePushNotification } from '../apis/push-notification.mapper';
import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { type NotificationType } from '../domains/notification.model';
import { invalidateNotifications } from '../queries/notification-cache';

const FOREGROUND_SYNC_DELAY_MS = SECOND_MS;

interface UseForegroundPushSyncOptions {
  authStatus: AuthStatus;
  /** 받은 알림 타입이 바꾸는 다른 기능의 화면을 다시 받는다. 위층인 bootstrap이 조립한다 */
  invalidateByType: (type: NotificationType) => Promise<unknown>;
}

/** 앱이 앞에 있을 때 받은 푸시로 알림함·안 읽은 수와 그 타입의 화면을 다시 받는다 */
export function useForegroundPushSync({
  authStatus,
  invalidateByType,
}: UseForegroundPushSyncOptions) {
  const gateway = usePushNotification();
  const queryClient = useQueryClient();
  const logger = useLogger();
  const isAuthenticated = authStatus === 'authenticated';

  const refresh = useEffectEvent((types: readonly NotificationType[]) => {
    // 안 읽은 수를 따라 앱 아이콘 배지가 맞춰진다(`useNotificationBadgeSync`)
    Promise.all([
      invalidateNotifications(queryClient),
      ...types.map((type) => invalidateByType(type)),
    ]).catch((error) =>
      logger.error(NOTIFICATION_LOG_EVENT.FOREGROUND_HANDLER_FAILED, toError(error)),
    );
  });

  useEffect(() => {
    // 마지막 알림만 남기면 1초 안에 온 다른 타입의 화면이 옛 값으로 남으므로 받은 타입을 모은다
    const pendingTypes = new Set<NotificationType>();
    const flush = debounce(() => {
      const types = [...pendingTypes];
      pendingTypes.clear();
      refresh(types);
    }, FOREGROUND_SYNC_DELAY_MS);
    const removeReceivedListener = gateway.subscribeReceived((notification) => {
      logger.info(NOTIFICATION_LOG_EVENT.FOREGROUND_RECEIVED);
      if (!isAuthenticated) {
        return;
      }
      // 같은 푸시의 버린 칸은 포그라운드 표시 판단(useForegroundPushPresentation)이 로그로 남긴다
      const type = parsePushNotification(notification.data).notification?.type;
      if (type != null) {
        pendingTypes.add(type);
      }
      flush();
    });

    return () => {
      removeReceivedListener();
      flush.cancel();
    };
  }, [gateway, isAuthenticated, logger]);
}
