import { getNowInstant } from '@src/shared/date/instant';
import { type InfiniteData, notifyManager, type QueryClient } from '@tanstack/react-query';

import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys';
import type { NotificationListResult } from '../domains/notification.model';
import type { PushPermission } from '../domains/push-permission.model';

export type NotificationCacheSnapshot = Array<[readonly unknown[], unknown]>;

function markPagesRead(
  cachedPages: InfiniteData<NotificationListResult> | undefined,
  notificationId?: number,
): InfiniteData<NotificationListResult> | undefined {
  if (!cachedPages?.pages) {
    return cachedPages;
  }
  return {
    ...cachedPages,
    pages: cachedPages.pages.map((page) => ({
      ...page,
      notifications: page.notifications.map((notification) =>
        (notificationId == null || notification.id === notificationId) && !notification.isRead
          ? { ...notification, isRead: true, readAt: getNowInstant() }
          : notification,
      ),
    })),
  };
}

function hasUnreadNotification(
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

export async function optimisticallyMarkNotificationsRead(
  queryClient: QueryClient,
  notificationId?: number,
  { shouldApply }: { shouldApply?: () => boolean } = {},
): Promise<NotificationCacheSnapshot> {
  await queryClient.cancelQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all });
  if (shouldApply && !shouldApply()) {
    return [];
  }
  const snapshot = queryClient.getQueriesData({ queryKey: NOTIFICATION_QUERY_KEYS.all });
  const listEntries = queryClient.getQueriesData<InfiniteData<NotificationListResult>>({
    queryKey: NOTIFICATION_QUERY_KEYS.lists(),
  });
  const shouldDecrement =
    notificationId == null ||
    listEntries.some(([_queryKey, cachedPages]) =>
      hasUnreadNotification(cachedPages, notificationId),
    );

  notifyManager.batch(() => {
    for (const [queryKey, cachedPages] of listEntries) {
      queryClient.setQueryData(queryKey, markPagesRead(cachedPages, notificationId));
    }
    // 수를 아직 모르면 0으로 채우지 않는다. 성공 뒤 서버 값으로 맞춘다
    queryClient.setQueryData<number>(NOTIFICATION_QUERY_KEYS.unreadCount(), (old) => {
      if (notificationId == null) {
        return 0;
      }
      if (old == null) {
        return undefined;
      }
      return shouldDecrement ? Math.max(0, old - 1) : old;
    });
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

export function setCachedPushPermission(queryClient: QueryClient, permission: PushPermission) {
  queryClient.setQueryData<PushPermission>(NOTIFICATION_QUERY_KEYS.permission(), permission);
}

export function invalidatePushPermission(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.permission() });
}
