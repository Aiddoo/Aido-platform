import { useNotificationService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { notificationQueryKeys } from '../constants/notification-query-keys.constant';

export const markAsReadMutationOptions = () => {
  const notificationService = useNotificationService();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async (notificationId: number) => {
      const result = await notificationService.markAsRead(notificationId);
      return unwrap(result);
    },
    onSuccess: async () => {
      // Invalidate notification queries to refresh data
      await queryClient.invalidateQueries({
        queryKey: notificationQueryKeys.all,
      });

      // Sync badge count with server
      await notificationService.syncBadgeCount();
    },
  });
};
