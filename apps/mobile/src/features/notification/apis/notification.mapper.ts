import {
  type NotificationInboxResponse,
  type NotificationInboxItem as ServerNotification,
  notificationRoutingSchema,
  pushNotificationDataSchema,
} from '@aido/api';

import type {
  Notification,
  NotificationListResult,
  NotificationRouting,
  PushNotificationPayload,
} from '../domains/notification.model';

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
    createdAt: new Date(server.createdAt),
    readAt: server.readAt ? new Date(server.readAt) : null,
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

export const toNotificationListResult = (
  server: NotificationInboxResponse,
): NotificationListResult => ({
  notifications: server.notifications.map(toNotification),
  unreadCount: server.unreadCount,
  hasMore: server.hasMore,
  nextCursor: server.nextCursor,
});

export type PushNotificationPayloadResult =
  | { success: true; payload: PushNotificationPayload }
  | { success: false; error: Error };

export function toPushNotificationPayload(data: unknown): PushNotificationPayloadResult {
  const parsed = pushNotificationDataSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error };
  }

  const {
    notificationId,
    type,
    action,
    context,
    routing,
    campaignKey,
    variantId,
    purpose,
    marketingOptOutToken,
  } = parsed.data;
  return {
    success: true,
    payload: {
      notificationId,
      type,
      action,
      context,
      routing,
      campaignKey,
      variantId,
      purpose,
      marketingOptOutToken,
    },
  };
}
