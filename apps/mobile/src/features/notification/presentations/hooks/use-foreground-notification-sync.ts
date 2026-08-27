import { pushNotificationDataSchema } from '@aido/validators';
import { useLogger, useNotificationService } from '@src/bootstrap/providers/di-context';
import { FRIEND_QUERY_KEYS } from '@src/features/friend/presentations/constants/friend-query-keys.constant';
import { toError } from '@src/shared/errors';
import { useQueryClient } from '@tanstack/react-query';
import type * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef } from 'react';

import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys.constant';

interface UseForegroundNotificationSyncOptions {
  isAuthenticated: boolean;
}

export function useForegroundNotificationSync({
  isAuthenticated,
}: UseForegroundNotificationSyncOptions) {
  const notificationService = useNotificationService();
  const queryClient = useQueryClient();
  const logger = useLogger();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return useCallback(
    (notification?: Notifications.Notification) => {
      if (!isAuthenticated) {
        return;
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        const tasks: Promise<void>[] = [
          queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all }),
          notificationService.syncBadgeCount(),
        ];
        const result = pushNotificationDataSchema.safeParse(notification?.request.content.data);
        const type = result.success ? result.data.type : undefined;
        if (type === 'FOLLOW_NEW' || type === 'FOLLOW_ACCEPTED') {
          tasks.push(queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.all }));
        }

        Promise.all(tasks).catch((error) =>
          logger.error('[Notification] Handler failed', toError(error)),
        );
      }, 1000);
    },
    [isAuthenticated, logger, notificationService, queryClient],
  );
}
