import { useNotificationService } from '@src/bootstrap/providers/di-provider';
import { queryOptions } from '@tanstack/react-query';

import { notificationQueryKeys } from '../constants/notification-query-keys.constant';

export const getUnreadCountQueryOptions = () => {
  const notificationService = useNotificationService();

  return queryOptions({
    queryKey: notificationQueryKeys.unreadCount(),
    queryFn: () => notificationService.getUnreadCount(),
    staleTime: 30 * 1000, // 30초
  });
};
