import { useLogger, useNotificationService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { notifyError } from '@src/shared/utils/haptics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys';
import {
  optimisticallyMarkNotificationsRead,
  restoreNotificationCache,
} from './notification-cache';

export const useMarkAllAsReadMutationOptions = () => {
  const notificationService = useNotificationService();
  const logger = useLogger();
  const queryClient = useQueryClient();

  // 배지는 겉모습이다 — 일부 안드로이드 런처에서 이 네이티브 호출이 거부하는데,
  // 그것 때문에 읽음 처리가 통째로 실패하면 안 된다.
  const clearBadgeQuietly = () => {
    notificationService.clearBadge().catch(() => undefined);
  };

  return mutationOptions({
    mutationFn: async () => {
      const result = await notificationService.markAllAsRead();
      return unwrap(result);
    },
    onMutate: async () => {
      const snapshot = await optimisticallyMarkNotificationsRead(queryClient);
      clearBadgeQuietly();
      return { snapshot };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all });
      clearBadgeQuietly();
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshot) {
        restoreNotificationCache(queryClient, context.snapshot);
      }
      notificationService
        .syncBadgeCount()
        .catch((error) => logger.warn('[Notification] Badge sync failed', { error }));
      notifyError();
    },
  });
};
