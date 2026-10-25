import { type InfiniteData, notifyManager, type QueryClient } from '@tanstack/react-query';

import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys';
import type { NotificationListResult } from '../domains/notification.model';

export type NotificationCacheSnapshot = Array<[readonly unknown[], unknown]>;

function markPagesRead(
  cachedPages: InfiniteData<NotificationListResult> | undefined,
  notificationId?: number,
  shouldDecrement = true,
  removeReadItems = false,
): InfiniteData<NotificationListResult> | undefined {
  if (!cachedPages?.pages) {
    return cachedPages;
  }
  return {
    ...cachedPages,
    pages: cachedPages.pages.map((page) => ({
      ...page,
      unreadCount:
        notificationId == null
          ? 0
          : shouldDecrement
            ? Math.max(0, page.unreadCount - 1)
            : page.unreadCount,
      notifications: page.notifications
        .map((notification) =>
          (notificationId == null || notification.id === notificationId) && !notification.isRead
            ? { ...notification, isRead: true, readAt: new Date() }
            : notification,
        )
        .filter((notification) => !removeReadItems || !notification.isRead),
    })),
  };
}

function containsUnreadNotification(
  cachedPages: InfiniteData<NotificationListResult> | undefined,
  notificationId: number,
): boolean {
  return (
    cachedPages?.pages.some((page) =>
      page.notifications.some(
        (notification) => notification.id === notificationId && !notification.isRead,
      ),
    ) ?? false
  );
}

function isUnreadOnlyQuery(queryKey: readonly unknown[]): boolean {
  const filters = queryKey[NOTIFICATION_QUERY_KEYS.lists().length];
  return (
    typeof filters === 'object' &&
    filters != null &&
    'unreadOnly' in filters &&
    filters.unreadOnly === true
  );
}

export async function optimisticallyMarkNotificationsRead(
  queryClient: QueryClient,
  notificationId?: number,
  { canApply }: { canApply?: () => boolean } = {},
): Promise<NotificationCacheSnapshot> {
  await queryClient.cancelQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all });
  if (canApply && !canApply()) {
    return [];
  }
  const snapshot = queryClient.getQueriesData({ queryKey: NOTIFICATION_QUERY_KEYS.all });
  const listEntries = queryClient.getQueriesData<InfiniteData<NotificationListResult>>({
    queryKey: NOTIFICATION_QUERY_KEYS.lists(),
  });
  const shouldDecrement =
    notificationId == null ||
    listEntries.some(([_queryKey, cachedPages]) =>
      containsUnreadNotification(cachedPages, notificationId),
    );

  notifyManager.batch(() => {
    for (const [queryKey, cachedPages] of listEntries) {
      queryClient.setQueryData(
        queryKey,
        markPagesRead(cachedPages, notificationId, shouldDecrement, isUnreadOnlyQuery(queryKey)),
      );
    }
    queryClient.setQueryData<number>(NOTIFICATION_QUERY_KEYS.unreadCount(), (old = 0) =>
      notificationId == null ? 0 : shouldDecrement ? Math.max(0, old - 1) : old,
    );
  });
  return snapshot;
}

export function restoreNotificationCache(
  queryClient: QueryClient,
  snapshot: NotificationCacheSnapshot,
): void {
  for (const [queryKey, cachedPages] of snapshot) {
    queryClient.setQueryData(queryKey, cachedPages);
  }
}

export function invalidateNotifications(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all });
}
