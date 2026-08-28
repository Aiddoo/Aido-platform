import {
  type NotificationListResponse,
  type Notification as ServerNotification,
  type NotificationRouting,
  notificationRoutingSchema,
} from '@aido/validators';

import type { Notification, NotificationListResult } from '../models/notification.model';

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

  const hasRoutingValue = Object.values(parsed.data).some((value) => value !== undefined);
  return hasRoutingValue ? parsed.data : undefined;
}

export const toNotificationListResult = (
  server: NotificationListResponse,
): NotificationListResult => ({
  notifications: server.notifications.map(toNotification),
  unreadCount: server.unreadCount,
  hasMore: server.hasMore,
  nextCursor: server.nextCursor,
});
