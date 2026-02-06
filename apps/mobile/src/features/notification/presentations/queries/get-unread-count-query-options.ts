import { useNotificationService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { notificationQueryKeys } from '../constants/notification-query-keys.constant';

export const getUnreadCountQueryOptions = () => {
  const notificationService = useNotificationService();

  return queryOptions({
    queryKey: notificationQueryKeys.unreadCount(),
    queryFn: async () => {
      const result = await notificationService.getUnreadCount();
      return unwrap(result);
    },
    staleTime: 30 * 1000, // 30초
  });
};
