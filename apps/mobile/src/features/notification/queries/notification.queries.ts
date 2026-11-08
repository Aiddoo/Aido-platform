import { useNotificationService, usePushDeviceService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import type { InfiniteData } from '@tanstack/react-query';
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { uniqBy } from 'es-toolkit';

import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys';
import type { NotificationListResult } from '../domains/notification.model';
import type { NotificationListQueryKey } from '../schemas/notification-list-query-key.schema';

const FIRST_PAGE_CURSOR: number | undefined = undefined;

export function useGetNotificationsInfiniteQueryOptions({
  category,
  limit,
}: NotificationListQueryKey) {
  const notificationService = useNotificationService();

  return infiniteQueryOptions({
    queryKey: NOTIFICATION_QUERY_KEYS.list({ category, limit }),

    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await notificationService.getNotifications({ cursor: pageParam, limit, category }, signal),
      ),

    initialPageParam: FIRST_PAGE_CURSOR,

    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor != null ? lastPage.nextCursor : undefined,

    select: selectNotifications,
  });
}

function selectNotifications(infinitePages: InfiniteData<NotificationListResult>) {
  return uniqBy(
    infinitePages.pages.flatMap((page) => page.notifications),
    (notification) => notification.id,
  );
}

export function useGetPushPermissionQueryOptions() {
  const pushDeviceService = usePushDeviceService();

  return queryOptions({
    queryKey: NOTIFICATION_QUERY_KEYS.permission(),
    queryFn: () => pushDeviceService.getPermission(),
    networkMode: 'always',

    staleTime: 0,
  });
}

export function useGetUnreadCountQueryOptions() {
  const notificationService = useNotificationService();

  return queryOptions({
    queryKey: NOTIFICATION_QUERY_KEYS.unreadCount(),
    queryFn: async ({ signal }) => unwrap(await notificationService.getUnreadCount(signal)),
    staleTime: 0,
  });
}
