import { useNotificationService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys.constant';
import {
  optimisticallyMarkNotificationsRead,
  restoreNotificationCache,
} from './notification-cache';

export const useMarkAsReadMutationOptions = () => {
  const notificationService = useNotificationService();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async (notificationId: number) => {
      const result = await notificationService.markAsRead(notificationId);
      return unwrap(result);
    },
    onMutate: async (notificationId) => {
      const snapshot = await optimisticallyMarkNotificationsRead(queryClient, notificationId);
      const count = queryClient.getQueryData<number>(NOTIFICATION_QUERY_KEYS.unreadCount());
      await notificationService.setBadgeCount(count ?? 0);
      return { snapshot };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: NOTIFICATION_QUERY_KEYS.all,
      });
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshot) restoreNotificationCache(queryClient, context.snapshot);
      void notificationService.syncBadgeCount();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });
};
