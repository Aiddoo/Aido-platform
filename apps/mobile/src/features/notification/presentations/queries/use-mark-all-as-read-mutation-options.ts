import { useNotificationService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys.constant';
import {
  optimisticallyMarkNotificationsRead,
  restoreNotificationCache,
} from './notification-cache';

export const useMarkAllAsReadMutationOptions = () => {
  const notificationService = useNotificationService();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async () => {
      const result = await notificationService.markAllAsRead();
      return unwrap(result);
    },
    onMutate: async () => {
      const snapshot = await optimisticallyMarkNotificationsRead(queryClient);
      await notificationService.clearBadge();
      return { snapshot };
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: NOTIFICATION_QUERY_KEYS.all,
        }),
        notificationService.clearBadge(),
      ]);
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshot) restoreNotificationCache(queryClient, context.snapshot);
      void notificationService.syncBadgeCount();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });
};
