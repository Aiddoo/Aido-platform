import { getNowInstant } from '@src/shared/date/instant';
import { getQueryKeyParams } from '@src/shared/utils/get-query-key-params';
import { type InfiniteData, notifyManager, type QueryClient } from '@tanstack/react-query';
import { match, P } from 'ts-pattern';

import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys';
import { notificationListQueryKeySchema } from '../schemas/notification-list-query-key.schema';
import type { NotificationListResult } from '../schemas/notification.schema';
import type { PushPermission } from '../schemas/push-permission.schema';

export type NotificationCacheSnapshot = Array<[readonly unknown[], unknown]>;

interface MarkPagesReadOptions {
  /** 없으면 모든 알림을 읽음으로 바꾼다 */
  notificationId?: number;
  shouldDecrement: boolean;
  removeReadItems: boolean;
}

function markPagesRead(
  cachedPages: InfiniteData<NotificationListResult> | undefined,
  { notificationId, shouldDecrement, removeReadItems }: MarkPagesReadOptions,
): InfiniteData<NotificationListResult> | undefined {
  if (!cachedPages?.pages) {
    return cachedPages;
  }
  return {
    ...cachedPages,
    pages: cachedPages.pages.map((page) => ({
      ...page,
      unreadCount: match({ notificationId, shouldDecrement })
        .with({ notificationId: P.nullish }, () => 0)
        .with({ shouldDecrement: true }, () => Math.max(0, page.unreadCount - 1))
        .otherwise(() => page.unreadCount),
      notifications: page.notifications
        .map((notification) =>
          (notificationId == null || notification.id === notificationId) && !notification.isRead
            ? { ...notification, isRead: true, readAt: getNowInstant() }
            : notification,
        )
        .filter((notification) => !removeReadItems || !notification.isRead),
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

function isUnreadOnlyQuery(queryKey: readonly unknown[]): boolean {
  return getQueryKeyParams(queryKey, notificationListQueryKeySchema)?.unreadOnly === true;
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
      queryClient.setQueryData(
        queryKey,
        markPagesRead(cachedPages, {
          notificationId,
          shouldDecrement,
          removeReadItems: isUnreadOnlyQuery(queryKey),
        }),
      );
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
