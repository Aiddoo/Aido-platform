import { useNotificationService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { notificationQueryKeys } from '../constants/notification-query-keys.constant';

export const markAsReadMutationOptions = () => {
  const notificationService = useNotificationService();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: (notificationId: number) => notificationService.markAsRead(notificationId),
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
