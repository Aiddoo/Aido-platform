import { useNotificationService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys.constant';

export const getUnreadCountQueryOptions = () => {
  const notificationService = useNotificationService();

  return queryOptions({
    queryKey: NOTIFICATION_QUERY_KEYS.unreadCount(),
    queryFn: async () => {
      const result = await notificationService.getUnreadCount();
      return unwrap(result);
    },
  });
};
