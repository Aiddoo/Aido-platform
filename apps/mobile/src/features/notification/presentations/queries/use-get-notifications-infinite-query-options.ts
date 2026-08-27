import type { NotificationCategory } from '@aido/validators';
import { useNotificationService } from '@src/bootstrap/providers/di-context';
import type {
  Notification,
  NotificationListResult,
} from '@src/features/notification/models/notification.model';
import { unwrap } from '@src/shared/errors/result';
import { getDateSectionLabel } from '@src/shared/utils/date';
import type { InfiniteData } from '@tanstack/react-query';
import { infiniteQueryOptions } from '@tanstack/react-query';
import { groupBy } from 'es-toolkit';

import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys.constant';

export type SectionHeader = { type: 'header'; title: string };
export type SectionItem = { type: 'item'; notification: Notification };
export type NotificationListItem = SectionHeader | SectionItem;

interface NotificationQueryParams {
  category?: NotificationCategory;
  unreadOnly?: boolean;
  limit?: number;
}

interface NotificationPageParam {
  cursor?: number;
}

const INITIAL_NOTIFICATION_PAGE_PARAM: NotificationPageParam = {};

export const useGetNotificationsInfiniteQueryOptions = (params?: NotificationQueryParams) => {
  const notificationService = useNotificationService();

  return infiniteQueryOptions({
    queryKey: NOTIFICATION_QUERY_KEYS.list({
      category: params?.category,
      unreadOnly: params?.unreadOnly,
      limit: params?.limit,
    }),

    queryFn: async ({ pageParam }) => {
      const result = await notificationService.getNotifications({
        cursor: pageParam.cursor,
        limit: params?.limit ?? 20,
        category: params?.category,
        unreadOnly: params?.unreadOnly,
      });
      return unwrap(result);
    },

    initialPageParam: INITIAL_NOTIFICATION_PAGE_PARAM,

    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor !== null
        ? { cursor: lastPage.nextCursor }
        : undefined,

    select: selectSectionedList,
  });
};

const selectSectionedList = (
  data: InfiniteData<NotificationListResult>,
): NotificationListItem[] => {
  const notifications = data.pages.flatMap((page) => page.notifications);

  const grouped = groupBy(notifications, (n) => getDateSectionLabel(n.createdAt));

  const toSortedSections = Object.entries(grouped).flatMap(([title, items]) => [
    { type: 'header' as const, title },
    ...items.map((notification) => ({ type: 'item' as const, notification })),
  ]);

  return toSortedSections;
};
