import { useNotificationService, usePushDeviceService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import type { InfiniteData } from '@tanstack/react-query';
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { uniqBy } from 'es-toolkit';

import type { NotificationListResult } from '../domains/notification.model';
import type { NotificationListQueryKey } from '../schemas/notification-list-query-key.schema';
import { NOTIFICATION_QUERY_KEYS } from './notification-query-keys';

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
    // 푸시를 받지 못하면 무효화가 오지 않아 낡은 수가 남는다. 화면을 열 때마다 다시 본다
    staleTime: 0,
  });
}
