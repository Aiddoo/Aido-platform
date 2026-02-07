import { useNotificationService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys.constant';

export const markAsReadMutationOptions = () => {
  const notificationService = useNotificationService();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async (notificationId: number) => {
      const result = await notificationService.markAsRead(notificationId);
      return unwrap(result);
    },
    onSuccess: async () => {
      // Optimistic: 캐시된 unreadCount를 즉시 1 감소 + 배지 반영
      const count = queryClient.getQueryData<number>(NOTIFICATION_QUERY_KEYS.unreadCount());
      if (count !== undefined && count > 0) {
        const newCount = count - 1;
        queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), newCount);
        await notificationService.setBadgeCount(newCount);
      }
      // Background: 서버와 동기화
      await queryClient.invalidateQueries({
        queryKey: NOTIFICATION_QUERY_KEYS.all,
      });
    },
  });
};
