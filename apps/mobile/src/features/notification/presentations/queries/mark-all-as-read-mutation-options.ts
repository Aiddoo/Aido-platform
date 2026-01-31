import { useNotificationService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { notificationQueryKeys } from '../constants/notification-query-keys.constant';

export const markAllAsReadMutationOptions = () => {
  const notificationService = useNotificationService();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: async () => {
      // Invalidate notification queries to refresh data
      await queryClient.invalidateQueries({
        queryKey: notificationQueryKeys.all,
      });

      // Clear badge
      await notificationService.clearBadge();
    },
  });
};
