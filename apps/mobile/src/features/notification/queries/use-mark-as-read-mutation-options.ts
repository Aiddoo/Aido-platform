import { useHaptics, useLogger, useNotificationService } from '@src/bootstrap/providers/di-context';
import { errorMessageOf } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys';
import {
  optimisticallyMarkNotificationsRead,
  restoreNotificationCache,
} from './notification-cache';

export const useMarkAsReadMutationOptions = () => {
  const haptics = useHaptics();
  const notificationService = useNotificationService();
  const logger = useLogger();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async (notificationId: number) => {
      const result = await notificationService.markAsRead(notificationId);
      return unwrap(result);
    },
    onMutate: async (notificationId) => {
      const snapshot = await optimisticallyMarkNotificationsRead(queryClient, notificationId);
      const count = queryClient.getQueryData<number>(NOTIFICATION_QUERY_KEYS.unreadCount());
      // 읽지 않은 수를 아직 모르면 배지를 0으로 지우지 않고 성공 뒤 서버 값으로 맞춘다.
      // 일부 Android 런처는 배지 호출을 거부하므로 그 실패로 읽음 처리가 멈추지 않게 한다
      if (count != null) {
        notificationService
          .setBadgeCount(count)
          .catch((error) =>
            logger.warn(NOTIFICATION_LOG_EVENT.BADGE_SYNC_FAILED, { error: errorMessageOf(error) }),
          );
      }
      return { snapshot, hasBadgeCount: count != null };
    },
    onSuccess: async (_data, _notificationId, context) => {
      await queryClient.invalidateQueries({
        queryKey: NOTIFICATION_QUERY_KEYS.all,
      });
      if (!context.hasBadgeCount) {
        notificationService
          .syncBadgeCount()
          .catch((error) =>
            logger.warn(NOTIFICATION_LOG_EVENT.BADGE_SYNC_FAILED, { error: errorMessageOf(error) }),
          );
      }
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshot) {
        restoreNotificationCache(queryClient, context.snapshot);
      }
      notificationService
        .syncBadgeCount()
        .catch((error) =>
          logger.warn(NOTIFICATION_LOG_EVENT.BADGE_SYNC_FAILED, { error: errorMessageOf(error) }),
        );
      haptics.notify('error');
    },
  });
};
