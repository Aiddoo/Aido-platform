import type { NotificationCategory } from '@aido/validators';
import { useNotificationService } from '@src/bootstrap/providers/di-context';
import type { NotificationListResult } from '@src/features/notification/models/notification.model';
import type { NotificationService } from '@src/features/notification/services/notification.service';
import { unwrap } from '@src/shared/errors/result';
import type { InfiniteData } from '@tanstack/react-query';
import { infiniteQueryOptions } from '@tanstack/react-query';
import { uniqBy } from 'es-toolkit';

import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys.constant';

interface NotificationQueryParams {
  category?: NotificationCategory;
  unreadOnly?: boolean;
  limit?: number;
}

interface NotificationPageParam {
  cursor?: number;
}

const INITIAL_NOTIFICATION_PAGE_PARAM: NotificationPageParam = {};

export function getNotificationsInfiniteQueryOptions(
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
      lastPage.hasMore && lastPage.nextCursor !== null
        ? { cursor: lastPage.nextCursor }
        : undefined,

    select: selectNotifications,
  });
}

export function useGetNotificationsInfiniteQueryOptions(params?: NotificationQueryParams) {
  return getNotificationsInfiniteQueryOptions(useNotificationService(), { params });
}

const selectNotifications = (data: InfiniteData<NotificationListResult>) =>
  uniqBy(
    data.pages.flatMap((page) => page.notifications),
    (notification) => notification.id,
  );
