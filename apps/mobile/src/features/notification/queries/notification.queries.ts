import { useNotificationApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import {
  TodoListPolicy,
  type TodoListResult,
} from '@src/features/planning/todo/domains/todo-list.model';
import {
  addDaysToDateKey,
  type DateKey,
  getCalendarWeek,
  isSameMonthDateKey,
} from '@src/shared/date/date-key';
import type { Instant } from '@src/shared/date/instant';
import { toDateKey } from '@src/shared/date/zoned';
import { getNextCursor, selectPageItems } from '@src/shared/query/cursor-page';
import type { InfiniteData } from '@tanstack/react-query';
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { groupBy, uniqBy } from 'es-toolkit';

import type { NotificationPage } from '../domains/notification.model';
import type { NotificationListQueryKey } from '../schemas/notification-list-query-key.schema';
import { NOTIFICATION_QUERY_KEYS } from './notification-query-keys';

const FIRST_PAGE_CURSOR: number | undefined = undefined;

export type DateSectionKey = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'earlier';

export type DateSectionedListItem<TEntry> =
  | { type: 'header'; section: DateSectionKey }
  | { type: 'item'; entry: TEntry };

/** 날짜 구역을 나누는 기준. 키에 넣지 않아 날짜가 바뀌어도 다시 받지 않고 select만 다시 돈다 */
interface DateSectionBasis {
  todayDateKey: DateKey;
  timezone: string;
}

export function useGetNotificationsInfiniteQueryOptions({
  category,
  limit,
  todayDateKey,
  timezone,
}: NotificationListQueryKey & DateSectionBasis) {
  const notificationApi = useNotificationApi();

  return infiniteQueryOptions({
    queryKey: NOTIFICATION_QUERY_KEYS.list({ category, limit }),

    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await notificationApi.getNotifications({ cursor: pageParam, limit, category }, signal),
      ),

    initialPageParam: FIRST_PAGE_CURSOR,

    getNextPageParam: getNextCursor,

    select: selectNotificationSections({ todayDateKey, timezone }),
  });
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

/** 받은 알림을 날짜 구역으로 묶는다. 쪽 경계에서 겹쳐 온 같은 알림은 한 번만 둔다 */
function selectNotificationSections({ todayDateKey, timezone }: DateSectionBasis) {
  return (infinitePages: InfiniteData<NotificationPage, number | undefined>) =>
    selectDateSectionedListItems(
      uniqBy(selectPageItems(infinitePages), (notification) => notification.id),
      todayDateKey,
      timezone,
    );
}

/** 보낸 콕(다른 기능의 목록)을 알림함과 같은 날짜 구역으로 묶는다 */
export function selectSentNudgeSections({ todayDateKey, timezone }: DateSectionBasis) {
  return <TEntry extends { createdAt: Instant }>(infinitePages: {
    pages: ReadonlyArray<{ items: readonly TEntry[] }>;
  }) => selectDateSectionedListItems(selectPageItems(infinitePages), todayDateKey, timezone);
}

/** 바뀐 순간의 기기 날짜·벽시계(`HH:mm`). 다가오는 할 일의 "앞으로" 기준이다 */
export interface DeviceWallClock {
  dateKey: DateKey;
  time: string;
  timezone: string;
}

/** 그 시각 뒤로 끝나지 않은 시간 있는 할 일이 있는가. 기준 시각이 없으면 없다고 본다 */
export function selectHasUpcomingTimedTodo(now: DeviceWallClock | null) {
  return (list: TodoListResult) => now != null && TodoListPolicy.hasUpcomingTimedTodo(list, now);
}

/** 목록 날짜 구역. 두 날짜 key를 그대로 비교하며 주는 앱 달력 주(일요일 시작)다 */
export function getDateSectionKey(dateKey: DateKey, todayDateKey: DateKey): DateSectionKey {
  if (dateKey === todayDateKey) {
    return 'today';
  }
  if (dateKey === addDaysToDateKey(todayDateKey, -1)) {
    return 'yesterday';
  }
  if (getCalendarWeek(dateKey).startDateKey === getCalendarWeek(todayDateKey).startDateKey) {
    return 'thisWeek';
  }
  if (isSameMonthDateKey(dateKey, todayDateKey)) {
    return 'thisMonth';
  }
  return 'earlier';
}

export function selectDateSectionedListItems<TEntry extends { createdAt: Instant }>(
  entries: readonly TEntry[],
  todayDateKey: DateKey,
  timezone: string,
): DateSectionedListItem<TEntry>[] {
  const getSection = (entry: TEntry) =>
    getDateSectionKey(toDateKey(entry.createdAt, timezone), todayDateKey);
  const sections = groupBy(entries, getSection);
  return Object.values(sections).flatMap((sectionEntries): DateSectionedListItem<TEntry>[] => {
    const first = sectionEntries[0];
    if (first == null) {
      return [];
    }
    return [
      { type: 'header', section: getSection(first) },
      ...sectionEntries.map((entry) => ({ type: 'item' as const, entry })),
    ];
  });
}
