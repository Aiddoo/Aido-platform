import { useNotificationService, usePushDeviceService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import type { InfiniteData } from '@tanstack/react-query';
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { uniqBy } from 'es-toolkit';

import {
  NOTIFICATION_QUERY_KEYS,
  type NotificationListFilters,
} from '../constants/notification-query-keys';
import type { NotificationListResult } from '../schemas/notification.schema';

interface NotificationPageParam {
  cursor?: number;
}

const INITIAL_NOTIFICATION_PAGE_PARAM: NotificationPageParam = {};

export function useGetNotificationsInfiniteQueryOptions({
  category,
  limit,
}: NotificationListFilters) {
  const notificationService = useNotificationService();

  return infiniteQueryOptions({
    queryKey: NOTIFICATION_QUERY_KEYS.list({ category, limit }),

    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await notificationService.getNotifications(
          { cursor: pageParam.cursor, limit, category },
          signal,
        ),
      ),

    initialPageParam: INITIAL_NOTIFICATION_PAGE_PARAM,

    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor != null ? { cursor: lastPage.nextCursor } : undefined,

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
    // 기기 안에서만 처리해 연결 상태와 무관하다
    networkMode: 'always',

    // 설정 앱에서 바꾸고 돌아올 수 있어 화면을 열거나 앱으로 돌아올 때마다 다시 본다
    staleTime: 0,
  });
}

export function useGetUnreadCountQueryOptions() {
  const notificationService = useNotificationService();

  return queryOptions({
    queryKey: NOTIFICATION_QUERY_KEYS.unreadCount(),
    queryFn: async ({ signal }) => unwrap(await notificationService.getUnreadCount(signal)),
  });
}
