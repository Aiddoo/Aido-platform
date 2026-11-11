import {
  type MarketingPushOptOutResponse,
  type NotificationInboxResponse,
  type NotificationInboxItem as ServerNotification,
  notificationRoutingSchema,
} from '@aido/api';
import { type Instant, toInstant, toNullableInstant } from '@src/shared/date/instant';

import {
  type Notification,
  type NotificationListResult,
  type NotificationRouting,
} from '../domains/notification.model';

/** 구 서버는 처리 시각을 주지 않아 null이다 */
export function toMarketingPushOptOutResult(dto: MarketingPushOptOutResponse): {
  withdrawnAt: Instant | null;
} {
  return { withdrawnAt: toNullableInstant(dto.marketingPushWithdrawnAt ?? null) };
}

export function toNotification(server: ServerNotification): Notification {
  const routing = toNotificationRouting(server.metadata);

  return {
    id: server.id,
    userId: server.userId,
    type: server.type,
    title: server.title,
    body: server.body,
    isRead: server.isRead,
    ...(routing && { routing }),
    context: server.context,
    action: server.action,
    navigation: server.navigation,
    createdAt: toInstant(server.createdAt),
    readAt: toNullableInstant(server.readAt),
  };
}

function toNotificationRouting(metadata: unknown): NotificationRouting | undefined {
  const parsed = notificationRoutingSchema.safeParse(metadata);
  if (!parsed.success) {
    return undefined;
  }

  const hasRoutingValue = Object.values(parsed.data).some((value) => value != null);
  return hasRoutingValue ? parsed.data : undefined;
}

export function toNotificationListResult(
  server: NotificationInboxResponse,
): NotificationListResult {
  return {
    notifications: server.notifications.map(toNotification),
    hasMore: server.hasMore,
    nextCursor: server.nextCursor,
  };
}
