import { getNowInstant } from '@src/shared/date/instant';
import {
  type InfiniteData,
  notifyManager,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';

import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys';
import type { NotificationListResult } from '../domains/notification.model';
import type { PushPermission } from '../domains/push-permission.model';

/** 읽음 처리가 고치는 알림함(목록·안 읽은 수). 기기 권한 상태는 읽음과 무관해 담지 않는다 */
export interface NotificationCacheSnapshot {
  lists: Array<[QueryKey, InfiniteData<NotificationListResult> | undefined]>;
  unreadCount: number | undefined;
}

/** `notificationId`가 없으면 모든 알림을 읽음으로 바꾼다 */
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

/** 낙관적으로 읽음을 쓰지 않았으면(다른 세션) null */
export async function optimisticallyMarkNotificationsRead(
  queryClient: QueryClient,
  notificationId?: number,
  { shouldApply }: { shouldApply?: () => boolean } = {},
): Promise<NotificationCacheSnapshot | null> {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: NOTIFICATION_QUERY_KEYS.lists() }),
    queryClient.cancelQueries({ queryKey: NOTIFICATION_QUERY_KEYS.unreadCount(), exact: true }),
  ]);
  if (shouldApply && !shouldApply()) {
    return null;
  }
  // 필터마다 목록이 여럿이라 접두사로 고르고, 키에 데이터 타입이 없어 TanStack 문서대로 제네릭으로 밝힌다
  const listEntries = queryClient.getQueriesData<InfiniteData<NotificationListResult>>({
    queryKey: NOTIFICATION_QUERY_KEYS.lists(),
  });
  const snapshot: NotificationCacheSnapshot = {
    lists: listEntries,
    unreadCount: queryClient.getQueryData(NOTIFICATION_QUERY_KEYS.unreadCount()),
  };
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
    queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), (old) => {
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
  snapshot: NotificationCacheSnapshot | null,
): void {
  if (snapshot == null) {
    return;
  }
  notifyManager.batch(() => {
    for (const [queryKey, cachedPages] of snapshot.lists) {
      queryClient.setQueryData(queryKey, cachedPages);
    }
    queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), snapshot.unreadCount);
  });
}

/** 알림함(목록·안 읽은 수)만 다시 받는다. 권한은 OS 설정에서 돌아올 때 따로 맞춘다 */
export function invalidateNotifications(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.lists() }),
    queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.unreadCount() }),
  ]);
}

export function setCachedPushPermission(queryClient: QueryClient, permission: PushPermission) {
  queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.permission(), permission);
}

export function invalidatePushPermission(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.permission() });
}
