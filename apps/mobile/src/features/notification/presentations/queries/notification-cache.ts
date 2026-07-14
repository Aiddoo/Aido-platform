import { type InfiniteData, notifyManager, type QueryClient } from '@tanstack/react-query';
import type { NotificationListResult } from '../../models/notification.model';
import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys.constant';

export type NotificationCacheSnapshot = Array<[readonly unknown[], unknown]>;

function markPagesRead(
  data: InfiniteData<NotificationListResult> | undefined,
  notificationId?: number,
  shouldDecrement = true,
  removeReadItems = false,
): InfiniteData<NotificationListResult> | undefined {
  if (!data?.pages) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      unreadCount:
        notificationId === undefined
          ? 0
          : shouldDecrement
            ? Math.max(0, page.unreadCount - 1)
            : page.unreadCount,
      notifications: page.notifications
        .map((notification) =>
          (notificationId === undefined || notification.id === notificationId) &&
          !notification.isRead
            ? { ...notification, isRead: true, readAt: new Date() }
            : notification,
        )
        .filter((notification) => !removeReadItems || !notification.isRead),
    })),
  };
}

function containsUnreadNotification(
  data: InfiniteData<NotificationListResult> | undefined,
  notificationId: number,
): boolean {
  return (
    data?.pages.some((page) =>
      page.notifications.some(
        (notification) => notification.id === notificationId && !notification.isRead,
      ),
    ) ?? false
  );
}

function isUnreadOnlyQuery(queryKey: readonly unknown[]): boolean {
  const filters = queryKey[2];
  return (
    typeof filters === 'object' &&
    filters !== null &&
    'unreadOnly' in filters &&
    filters.unreadOnly === true
  );
}

export async function optimisticallyMarkNotificationsRead(
  queryClient: QueryClient,
  notificationId?: number,
): Promise<NotificationCacheSnapshot> {
  await queryClient.cancelQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all });
  const snapshot = queryClient.getQueriesData({ queryKey: NOTIFICATION_QUERY_KEYS.all });
  const listEntries = queryClient.getQueriesData<InfiniteData<NotificationListResult>>({
    queryKey: [...NOTIFICATION_QUERY_KEYS.all, 'list'],
  });
  const shouldDecrement =
    notificationId === undefined ||
    listEntries.some(([, data]) => containsUnreadNotification(data, notificationId));

  notifyManager.batch(() => {
    for (const [queryKey, data] of listEntries) {
      queryClient.setQueryData(
        queryKey,
        markPagesRead(data, notificationId, shouldDecrement, isUnreadOnlyQuery(queryKey)),
      );
    }
    queryClient.setQueryData<number>(NOTIFICATION_QUERY_KEYS.unreadCount(), (old = 0) =>
      notificationId === undefined ? 0 : shouldDecrement ? Math.max(0, old - 1) : old,
    );
  });
  return snapshot;
}

export function restoreNotificationCache(
  queryClient: QueryClient,
  snapshot: NotificationCacheSnapshot,
): void {
  for (const [queryKey, data] of snapshot) queryClient.setQueryData(queryKey, data);
}
