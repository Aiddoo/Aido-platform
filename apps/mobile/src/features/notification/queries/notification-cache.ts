import { toInstant } from '@src/shared/date/instant';
import { readQueryKeyParams } from '@src/shared/utils/query-key-params';
import { type InfiniteData, notifyManager, type QueryClient } from '@tanstack/react-query';
import { match, P } from 'ts-pattern';

import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys';
import { notificationListQueryParamsSchema } from '../schemas/notification-list-query-params.schema';
import type { NotificationListResult } from '../schemas/notification.schema';
import type { PushPermission } from '../schemas/push-permission.schema';

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
            ? { ...notification, isRead: true, readAt: toInstant(new Date().toISOString()) }
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
  return readQueryKeyParams(queryKey, notificationListQueryParamsSchema)?.unreadOnly === true;
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
      match({ notificationId, shouldDecrement })
        .with({ notificationId: P.nullish }, () => 0)
        .with({ shouldDecrement: true }, () => Math.max(0, old - 1))
        .otherwise(() => old),
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

export function setCachedPushPermission(queryClient: QueryClient, permission: PushPermission) {
  queryClient.setQueryData<PushPermission>(NOTIFICATION_QUERY_KEYS.permission(), permission);
}

export function invalidatePushPermission(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.permission() });
}
