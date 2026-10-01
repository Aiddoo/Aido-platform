import { useNotificationService } from '@src/bootstrap/providers/di-context';
import type { NotificationService } from '@src/features/notification/services/notification.service';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys.constant';

export function getUnreadCountQueryOptions(notificationService: NotificationService) {
  return queryOptions({
    queryKey: NOTIFICATION_QUERY_KEYS.unreadCount(),
    queryFn: async ({ signal }) => {
      const result = await notificationService.getUnreadCount(signal);
      return unwrap(result);
    },
  });
}

export function useGetUnreadCountQueryOptions() {
  return getUnreadCountQueryOptions(useNotificationService());
}
