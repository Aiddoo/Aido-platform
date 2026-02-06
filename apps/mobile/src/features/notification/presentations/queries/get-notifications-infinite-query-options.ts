import { useNotificationService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { infiniteQueryOptions } from '@tanstack/react-query';

import { notificationQueryKeys } from '../constants/notification-query-keys.constant';

export const getNotificationsInfiniteQueryOptions = (unreadOnly = false) => {
  const notificationService = useNotificationService();

  return infiniteQueryOptions({
    queryKey: notificationQueryKeys.list({ unreadOnly }),
    queryFn: async ({ pageParam }) => {
      const result = await notificationService.getNotifications({
        cursor: pageParam,
        limit: 20,
        unreadOnly,
      });
      return unwrap(result);
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
    select: (data) => ({
      notifications: data.pages.flatMap((page) => page.notifications),
      unreadCount: data.pages[0]?.unreadCount ?? 0,
      hasNextPage: data.pages.at(-1)?.hasMore ?? false,
    }),
    placeholderData: (previousData) => previousData,
  });
};
