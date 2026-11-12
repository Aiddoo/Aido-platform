import { mapInfiniteItems, selectPageItems } from '@src/shared/domains/cursor-page.model';
import { type InfiniteData, notifyManager, type QueryClient } from '@tanstack/react-query';
import { uniq } from 'es-toolkit';

import type {
  Notification,
  NotificationPage,
  NotificationType,
} from '../domains/notification.model';
import { NOTIFICATION_QUERY_KEYS } from './notification-query-keys';

type NotificationPages = InfiniteData<NotificationPage, number | undefined>;

/** 읽음 처리 하나가 알림함에서 바꾼 것. 실패하면 이것만 되돌려 함께 진행 중인 다른 읽음은 남긴다 */
export interface NotificationReadChange {
  /** 이 처리가 읽음으로 바꾼, 목록에 안 읽음으로 있던 알림 */
  notificationIds: readonly number[];
  /** 안 읽은 수에서 뺀 만큼. 수를 몰랐으면 0 */
  readCount: number;
}

function withNotificationsPatched(
  pages: NotificationPages,
  isTarget: (notification: Notification) => boolean,
  patch: Pick<Notification, 'isRead'>,
): NotificationPages {
  return mapInfiniteItems(pages, (notification) =>
    isTarget(notification) ? { ...notification, ...patch } : notification,
  );
}

/** `notificationId`가 없으면 안 읽은 알림 전부 */
function findUnreadNotificationIds(pages: NotificationPages | undefined, notificationId?: number) {
  return selectPageItems(pages ?? { pages: [] })
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

  notifyManager.batch(() => {
    queryClient.setQueriesData<NotificationPages>(
      { queryKey: NOTIFICATION_QUERY_KEYS.lists() },
      (pages) =>
        pages &&
        withNotificationsPatched(
          pages,
          (notification) => notificationIds.includes(notification.id),
          { isRead: true },
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
          { isRead: false },
        ),
    );
    queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), (old) =>
      old == null ? old : old + change.readCount,
    );
  });
}

/** 알림함(목록·안 읽은 수)만 다시 받는다. 권한은 `['device', 'push-permission']`이라 닿지 않는다 */
export function invalidateNotifications(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.lists() }),
    queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.unreadCount() }),
  ]);
}

/** 당겨서 새로고침. 화면에 붙은 알림함 조회만 다시 받는다 */
export function refreshNotifications(queryClient: QueryClient) {
  return Promise.all([
    queryClient.refetchQueries({ queryKey: NOTIFICATION_QUERY_KEYS.lists(), type: 'active' }),
    queryClient.refetchQueries({
      queryKey: NOTIFICATION_QUERY_KEYS.unreadCount(),
      type: 'active',
    }),
  ]);
}

/** 앱이 켜진 동안 받으면 다시 받을 다른 기능의 화면. 없으면 null. 서버가 종류를 더하면 여기서 정해야 빌드가 된다 */
export const RECEIVED_REFRESH_BY_TYPE = {
  FOLLOW_NEW: 'friends',
  FOLLOW_ACCEPTED: 'friends',
  INVITE_JOINED: 'invite',
  INVITE_REWARDED: 'invite',
  INVITE_PROGRESS: 'invite',
  INVITE_QUALIFY_REMINDER: null,
  NUDGE_RECEIVED: 'nudge-interactions',
  NUDGE_REPLIED: 'nudge-interactions',
  NUDGE_THANKED: 'nudge-interactions',
  CHEER_RECEIVED: null,
  DAILY_COMPLETE: null,
  FRIEND_COMPLETED: null,
  WEEKLY_ACHIEVEMENT: null,
  TODO_REMINDER: null,
  TODO_SHARED: null,
  WINBACK: null,
  WEATHER_MORNING: null,
  WEATHER_EVENING: null,
  MORNING_REMINDER: null,
  EVENING_REMINDER: null,
  LUNCH_NUDGE: null,
  STREAK_AT_RISK: null,
  WEEKLY_REPORT: null,
  MONTHLY_REPORT: null,
  AI_SUGGESTION: null,
  SYSTEM_NOTICE: null,
  ADMIN_BROADCAST: null,
  ADMIN_TARGETED: null,
  // 보상 기간이 곧 끝난다는 알림이면 구독 화면의 남은 기간을 서버 값으로 맞춘다
  PREMIUM_GRANT_ENDING: 'me',
  SOCIAL_DIGEST: null,
  NUDGE_SUGGEST: null,
} as const satisfies Record<
  NotificationType,
  'nudge-interactions' | 'friends' | 'invite' | 'me' | null
>;

/** 받을 때 그 종류의 화면을 다시 받는지. 다시 받으면 보고 있는 화면에 새 내용이 바로 보인다 */
export function isRefreshedOnReceipt(type: NotificationType) {
  return RECEIVED_REFRESH_BY_TYPE[type] != null;
}
