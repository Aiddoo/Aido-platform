import { getNowInstant } from '@src/shared/date/instant';
import { type InfiniteData, notifyManager, type QueryClient } from '@tanstack/react-query';
import { uniq } from 'es-toolkit';

import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys';
import type { Notification, NotificationListResult } from '../domains/notification.model';
import type { PushPermission } from '../domains/push-permission.model';

type NotificationPages = InfiniteData<NotificationListResult>;

/** 읽음 처리 하나가 알림함에서 바꾼 것. 실패하면 이것만 되돌려 함께 진행 중인 다른 읽음은 남긴다 */
export interface NotificationReadChange {
  /** 이 처리가 읽음으로 바꾼, 목록에 안 읽음으로 있던 알림 */
  notificationIds: readonly number[];
  /** 안 읽은 수에서 뺀 만큼. 수를 몰랐으면 0 */
  readCount: number;
}

/** 바뀐 알림이 없는 쪽은 그대로 돌려 그 쪽을 그리는 행이 다시 그려지지 않는다 */
function withNotificationsPatched(
  pages: NotificationPages,
  isTarget: (notification: Notification) => boolean,
  patch: Pick<Notification, 'isRead' | 'readAt'>,
): NotificationPages {
  return {
    ...pages,
    pages: pages.pages.map((page) =>
      page.notifications.some(isTarget)
        ? {
            ...page,
            notifications: page.notifications.map((notification) =>
              isTarget(notification) ? { ...notification, ...patch } : notification,
            ),
          }
        : page,
    ),
  };
}

/** `notificationId`가 없으면 안 읽은 알림 전부 */
function findUnreadNotificationIds(pages: NotificationPages | undefined, notificationId?: number) {
  return (pages?.pages ?? [])
    .flatMap((page) => page.notifications)
    .filter(
      (notification) =>
        !notification.isRead && (notificationId == null || notification.id === notificationId),
    )
    .map((notification) => notification.id);
}

/**
 * 목록의 그 알림(없으면 안 읽은 알림 전부)을 읽음으로, 안 읽은 수를 그만큼 줄인다.
 * 낙관적으로 읽음을 쓰지 않았으면(다른 세션) null
 */
export async function optimisticallyMarkNotificationsRead(
  queryClient: QueryClient,
  notificationId?: number,
  { shouldApply }: { shouldApply?: () => boolean } = {},
): Promise<NotificationReadChange | null> {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: NOTIFICATION_QUERY_KEYS.lists() }),
    queryClient.cancelQueries({ queryKey: NOTIFICATION_QUERY_KEYS.unreadCount(), exact: true }),
  ]);
  if (shouldApply && !shouldApply()) {
    return null;
  }
  // 필터마다 목록이 여럿이라 접두사로 고르고, 키에 데이터 타입이 없어 TanStack 문서대로 제네릭으로 밝힌다
  const notificationIds = uniq(
    queryClient
      .getQueriesData<NotificationPages>({ queryKey: NOTIFICATION_QUERY_KEYS.lists() })
      .flatMap(([_queryKey, pages]) => findUnreadNotificationIds(pages, notificationId)),
  );
  const unreadCount = queryClient.getQueryData(NOTIFICATION_QUERY_KEYS.unreadCount());
  // 하나 읽기는 목록에 안 읽음으로 있을 때만 하나를 뺀다. 수를 아직 모르면 채우지 않고 서버 값을 기다린다
  const readCount =
    notificationId == null ? (unreadCount ?? 0) : Math.min(notificationIds.length, 1);
  const readAt = getNowInstant();

  notifyManager.batch(() => {
    queryClient.setQueriesData<NotificationPages>(
      { queryKey: NOTIFICATION_QUERY_KEYS.lists() },
      (pages) =>
        pages &&
        withNotificationsPatched(
          pages,
          (notification) => notificationIds.includes(notification.id),
          { isRead: true, readAt },
        ),
    );
    queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), (old) =>
      notificationId == null ? 0 : old == null ? old : Math.max(0, old - readCount),
    );
  });
  return { notificationIds, readCount };
}

/** 이 처리가 읽음으로 바꾼 알림만 지금 캐시에서 안 읽음으로 되돌리고 뺀 수만큼 더한다 */
export function revertNotificationsRead(queryClient: QueryClient, change: NotificationReadChange) {
  notifyManager.batch(() => {
    queryClient.setQueriesData<NotificationPages>(
      { queryKey: NOTIFICATION_QUERY_KEYS.lists() },
      (pages) =>
        pages &&
        withNotificationsPatched(
          pages,
          (notification) => change.notificationIds.includes(notification.id),
          { isRead: false, readAt: null },
        ),
    );
    queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), (old) =>
      old == null ? old : old + change.readCount,
    );
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
