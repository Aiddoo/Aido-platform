import { useNotificationApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import type { DateKey } from '@src/shared/date/date-key';
import { getNextCursor, selectPageItems } from '@src/shared/domains/cursor-page.model';
import type { InfiniteData } from '@tanstack/react-query';
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { uniqBy } from 'es-toolkit';

import type { NotificationPage } from '../domains/notification.model';
import type { NotificationListQueryKey } from '../schemas/notification-list-query-key.schema';
import { toDateSectionedListItems } from '../utils/notification-section.view-model';
import { NOTIFICATION_QUERY_KEYS } from './notification-query-keys';

const FIRST_PAGE_CURSOR: number | undefined = undefined;

interface NotificationsInfiniteQueryInput extends NotificationListQueryKey {
  /** 날짜 섹션을 나누는 기준. 키에 넣지 않아 날짜가 바뀌어도 다시 받지 않고 select만 다시 돈다 */
  todayDateKey: DateKey;
  timeZone: string;
}

export function useGetNotificationsInfiniteQueryOptions({
  category,
  limit,
  todayDateKey,
  timeZone,
}: NotificationsInfiniteQueryInput) {
  const notificationApi = useNotificationApi();

  return infiniteQueryOptions({
    queryKey: NOTIFICATION_QUERY_KEYS.list({ category, limit }),

    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await notificationApi.getNotifications({ cursor: pageParam, limit, category }, signal),
      ),

    initialPageParam: FIRST_PAGE_CURSOR,

    getNextPageParam: getNextCursor,

    select: (infinitePages) =>
      toDateSectionedListItems(selectNotifications(infinitePages), todayDateKey, timeZone),
  });
}

function selectNotifications(infinitePages: InfiniteData<NotificationPage, number | undefined>) {
  return uniqBy(selectPageItems(infinitePages), (notification) => notification.id);
}

export function useGetUnreadCountQueryOptions() {
  const notificationApi = useNotificationApi();

  return queryOptions({
    queryKey: NOTIFICATION_QUERY_KEYS.unreadCount(),
    queryFn: async ({ signal }) => unwrap(await notificationApi.getUnreadCount(signal)),
    // 푸시를 받지 못하면 무효화가 오지 않아 낡은 수가 남는다. 화면을 열 때마다 다시 본다
    staleTime: 0,
  });
}
