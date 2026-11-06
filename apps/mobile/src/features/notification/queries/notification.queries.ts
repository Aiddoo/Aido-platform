import { useNotificationService, usePushDeviceService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import type { InfiniteData } from '@tanstack/react-query';
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { uniqBy } from 'es-toolkit';

import type { NotificationService } from '../apis/notification.service';
import type { PushDeviceService } from '../apis/push-device.service';
import {
  NOTIFICATION_QUERY_KEYS,
  type NotificationListFilters,
} from '../constants/notification-query-keys';
import type { NotificationListResult } from '../schemas/notification.schema';

type NotificationQueryParams = NotificationListFilters;

interface NotificationPageParam {
  cursor?: number;
}

const INITIAL_NOTIFICATION_PAGE_PARAM: NotificationPageParam = {};

function getNotificationsInfiniteQueryOptions(
  notificationService: NotificationService,
  { params }: { params?: NotificationQueryParams },
) {
  return infiniteQueryOptions({
    queryKey: NOTIFICATION_QUERY_KEYS.list({
      category: params?.category,
      unreadOnly: params?.unreadOnly,
      limit: params?.limit,
    }),

    queryFn: async ({ pageParam, signal }) => {
      const result = await notificationService.getNotifications(
        {
          cursor: pageParam.cursor,
          limit: params?.limit ?? 20,
          category: params?.category,
          unreadOnly: params?.unreadOnly,
        },
        signal,
      );
      return unwrap(result);
    },

    initialPageParam: INITIAL_NOTIFICATION_PAGE_PARAM,

    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor != null ? { cursor: lastPage.nextCursor } : undefined,

    select: selectNotifications,
  });
}

export function useGetNotificationsInfiniteQueryOptions(params?: NotificationQueryParams) {
  return getNotificationsInfiniteQueryOptions(useNotificationService(), { params });
}

const selectNotifications = (infinitePages: InfiniteData<NotificationListResult>) =>
  uniqBy(
    infinitePages.pages.flatMap((page) => page.notifications),
    (notification) => notification.id,
  );

function getPushPermissionQueryOptions(pushDeviceService: PushDeviceService) {
  return queryOptions({
    queryKey: NOTIFICATION_QUERY_KEYS.permission(),
    queryFn: () => pushDeviceService.readPermission(),
    // 기기 안에서만 처리해 연결 상태와 무관하다
    networkMode: 'always',

    // 설정 앱에서 바꾸고 돌아올 수 있어 화면을 열거나 앱으로 돌아올 때마다 다시 본다
    staleTime: 0,
  });
}

export function useGetPushPermissionQueryOptions() {
  return getPushPermissionQueryOptions(usePushDeviceService());
}

function getUnreadCountQueryOptions(notificationService: NotificationService) {
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
